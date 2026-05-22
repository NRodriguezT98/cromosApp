import React, { useMemo, useState, useRef } from 'react';
import {
  View, Text, SectionList, StyleSheet, Pressable,
  TextInput, KeyboardAvoidingView, Platform, Animated, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, ActivityEntry } from '@/context/StickersContext';
import {
  ArrowLeft, Plus, Minus, Trash, MagnifyingGlass, X, CaretLeft, CaretRight,
  ArrowDown, ArrowUp, ArrowsLeftRight,
} from 'phosphor-react-native';

// ── helpers ────────────────────────────────────────────────────────────────

const normalize = (s: string) => s.toUpperCase().replace(/\s+/g, '');

function matchesQuery(entry: ActivityEntry, query: string): boolean {
  const q = normalize(query);
  return (
    normalize(entry.code).includes(q) ||
    normalize(entry.name).includes(q) ||
    normalize(entry.teamName).includes(q)
  );
}

function formatDay(ts: number): string {
  const d    = new Date(ts);
  const now  = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return 'Hoy';
  if (d.toDateString() === yest.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-CO', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-CO', {
    hour: '2-digit', minute: '2-digit',
    hour12: true, timeZone: 'America/Bogota',
  });
}

function entryLabel(entry: ActivityEntry): string {
  if (entry.action === 'trade_in')  return 'Recibí';
  if (entry.action === 'trade_out') return 'Di';
  if (entry.action === 'add') {
    if (entry.qty === 1) return 'Nuevo';
    const reps = entry.qty - 1;
    return `${reps} repetido${reps !== 1 ? 's' : ''}`;
  }
  if (entry.qty === 0) return 'Eliminado';
  if (entry.qty === 1) return 'Sin repetidos';
  const reps = entry.qty - 1;
  return `${reps} repetido${reps !== 1 ? 's' : ''}`;
}

type DaySection = { title: string; timestamp: number; data: ActivityEntry[] };

// ── component ──────────────────────────────────────────────────────────────

export default function HistorialScreen() {
  const { history, clearHistory } = useStickers();
  const router  = useRouter();
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'add' | 'remove' | 'trade'>('all');
  const inputRef = useRef<TextInput>(null);
  const focusAnim = useRef(new Animated.Value(0)).current;

  const onFocus = () => Animated.spring(focusAnim, { toValue: 1, useNativeDriver: false, tension: 100, friction: 12 }).start();
  const onBlur  = () => Animated.spring(focusAnim, { toValue: 0, useNativeDriver: false, tension: 100, friction: 12 }).start();

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.textSecondary + '80'],
  });

  const [dayIndex, setDayIndex] = useState(0);

  // Group by day
  const sections: DaySection[] = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    for (const entry of history) {
      const key = new Date(entry.timestamp)
        .toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    }
    const arr = Object.values(groups).map(data => ({
      title:     formatDay(data[0].timestamp),
      timestamp: data[0].timestamp,
      data,
    }));
    return arr.sort((a, b) => b.timestamp - a.timestamp);
  }, [history]);

  // Adjust dayIndex if history changes and the current index goes out of bounds
  if (sections.length > 0 && dayIndex >= sections.length) {
    setDayIndex(Math.max(-1, sections.length - 1));
  }

  const activeSection = dayIndex >= 0 ? sections[dayIndex] : null;

  // Daily metrics (only 'add' events count toward sobre stats)
  const sourceData = dayIndex === -1 ? history : (activeSection?.data ?? []);
  const addEvents  = sourceData.filter(e => e.action === 'add');

  const mTotal     = addEvents.length;
  const mNuevos    = addEvents.filter(e => e.qty === 1).length;
  const mRepetidos = addEvents.filter(e => e.qty > 1).length;
  const mCanjes    = new Set(
    sourceData
      .filter(e => e.action === 'trade_in' || e.action === 'trade_out')
      .map(e => e.timestamp)
  ).size;

  // Apply search + type filter
  const filteredSections: DaySection[] = useMemo(() => {
    const sourceSections = dayIndex === -1 ? sections : (activeSection ? [activeSection] : []);
    const q = query.trim();

    return sourceSections.map(sec => {
      const filteredData = sec.data.filter(e => {
        if (filterType === 'add'    && e.action !== 'add')    return false;
        if (filterType === 'remove' && e.action !== 'remove') return false;
        if (filterType === 'trade'  && e.action !== 'trade_in' && e.action !== 'trade_out') return false;
        if (q && !matchesQuery(e, q)) return false;
        return true;
      });
      return { ...sec, data: filteredData };
    }).filter(sec => sec.data.length > 0);
  }, [sections, dayIndex, activeSection, query, filterType]);

  const isSearching   = query.trim().length > 0;
  const totalFiltered = filteredSections.reduce((sum, s) => sum + s.data.length, 0);

  // Quick stats for filter tabs
  const totalAdded   = mTotal;
  const totalRemoved = sourceData.filter(e => e.action === 'remove').length;
  const totalTrades  = sourceData.filter(e => e.action === 'trade_in' || e.action === 'trade_out').length;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/')}>
            <ArrowLeft size={18} color={Colors.textPrimary} weight="bold" />
          </Pressable>
          {history.length > 0 && (
            <Pressable style={styles.clearBtn} onPress={clearHistory}>
              <Trash size={14} color={Colors.red} weight="bold" />
              <Text style={styles.clearBtnText}>Borrar todo</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.headerTitles}>
          <Text style={styles.headerLabel}>REGISTRO</Text>
          <Text style={styles.headerTitle}>Historial</Text>
        </View>

        {/* Date Navigator & Daily Stats */}
        {sections.length > 0 && (
          <View style={styles.dailyDashboard}>
            <View style={styles.dateNavigator}>
              <Pressable 
                style={({ pressed }) => [styles.dateNavBtn, pressed && { opacity: 0.5 }]} 
                onPress={() => setDayIndex(Math.min(sections.length - 1, dayIndex + 1))}
                disabled={dayIndex === sections.length - 1}
              >
                <CaretLeft size={18} color={dayIndex === sections.length - 1 ? Colors.textMuted : Colors.textPrimary} weight="bold" />
              </Pressable>

              <Text style={styles.dateNavTitle}>
                {dayIndex === -1 ? 'Todo el Historial' : activeSection?.title}
              </Text>

              <Pressable 
                style={({ pressed }) => [styles.dateNavBtn, pressed && { opacity: 0.5 }]} 
                onPress={() => setDayIndex(Math.max(-1, dayIndex - 1))}
                disabled={dayIndex === -1}
              >
                <CaretRight size={18} color={dayIndex === -1 ? Colors.textMuted : Colors.textPrimary} weight="bold" />
              </Pressable>
            </View>

            <View style={styles.dailyStatsGrid}>
              <View style={styles.dailyStatCard}>
                <Text style={styles.dailyStatValue}>{mTotal}</Text>
                <Text style={styles.dailyStatLabel}>TOTAL</Text>
              </View>
              <View style={styles.dailyStatDivider} />
              <View style={styles.dailyStatCard}>
                <Text style={[styles.dailyStatValue, { color: Colors.owned }]}>{mNuevos}</Text>
                <Text style={styles.dailyStatLabel}>NUEVOS</Text>
              </View>
              <View style={styles.dailyStatDivider} />
              <View style={styles.dailyStatCard}>
                <Text style={[styles.dailyStatValue, { color: Colors.duplicate }]}>{mRepetidos}</Text>
                <Text style={styles.dailyStatLabel}>REPETIDOS</Text>
              </View>
              <View style={styles.dailyStatDivider} />
              <View style={styles.dailyStatCard}>
                <Text style={[styles.dailyStatValue, { color: Colors.trade }]}>{mCanjes}</Text>
                <Text style={styles.dailyStatLabel}>CANJES</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* ── Search bar ── */}
      {history.length > 0 && (
        <View style={styles.searchSection}>
          <Animated.View style={[styles.searchBar, { borderColor }]}>
            <MagnifyingGlass
              size={16}
              color={isSearching ? Colors.textSecondary : Colors.textMuted}
              weight={isSearching ? 'bold' : 'regular'}
            />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Buscar por jugador, equipo o código…"
              placeholderTextColor={Colors.textMuted}
              value={query}
              onChangeText={setQuery}
              onFocus={onFocus}
              onBlur={onBlur}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable
                onPress={() => { setQuery(''); inputRef.current?.focus(); }}
                hitSlop={10}
                style={styles.clearSearch}
              >
                <X size={14} color={Colors.textMuted} />
              </Pressable>
            )}
          </Animated.View>

          {isSearching && (
            <View style={styles.searchResultsBadge}>
              {totalFiltered === 0 ? (
                <Text style={styles.searchResultsText}>Sin resultados para "{query}"</Text>
              ) : (
                <>
                  <View style={styles.searchResultsDot} />
                  <Text style={styles.searchResultsText}>
                    {totalFiltered} cromo{totalFiltered !== 1 ? 's' : ''} encontrado{totalFiltered !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </View>
          )}

          {/* ── Filter tabs ── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterTabs}
          >
            {(
              [
                { key: 'all',    label: 'Todos',         count: totalFiltered },
                { key: 'add',    label: 'Añadidos',      count: totalAdded },
                { key: 'remove', label: 'Eliminados',    count: totalRemoved },
                { key: 'trade',  label: 'Intercambios',  count: totalTrades },
              ] as const
            ).map(({ key, label, count }) => {
              const active = filterType === key;
              const dotColor =
                key === 'add'    ? Colors.owned :
                key === 'remove' ? Colors.red :
                key === 'trade'  ? Colors.trade :
                Colors.textSecondary;
              return (
                <Pressable
                  key={key}
                  style={[styles.filterTab, active && styles.filterTabActive]}
                  onPress={() => setFilterType(key)}
                >
                  {key !== 'all' && (
                    <View style={[styles.filterTabDot, { backgroundColor: active ? dotColor : Colors.textMuted }]} />
                  )}
                  <Text style={[styles.filterTabText, active && { color: Colors.textPrimary }]}>
                    {label}
                  </Text>
                  <View style={[styles.filterTabBadge, active && { backgroundColor: dotColor + '30' }]}>
                    <Text style={[styles.filterTabBadgeText, active && { color: dotColor }]}>
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Content ── */}
      {history.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MagnifyingGlass size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Sin actividad aún</Text>
          <Text style={styles.emptyBody}>
            Cada cromo que escanees o modifiques quedará registrado aquí con su hora exacta
          </Text>
        </View>

      ) : filteredSections.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <MagnifyingGlass size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptyBody}>
            Ningún cromo coincide con "{query}"
          </Text>
        </View>

      ) : (
        <SectionList
          sections={filteredSections}
          keyExtractor={(item, i) => `${item.code}-${item.timestamp}-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"

          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.dayHeader}>
              <View style={styles.dayHeaderLine} />
              <Text style={styles.dayHeaderTitle}>{title.toUpperCase()}</Text>
              <View style={styles.dayHeaderLine} />
              <View style={styles.dayHeaderBadge}>
                <Text style={styles.dayHeaderCount}>
                  {data.length} cromo{data.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          renderItem={({ item: entry, index, section }) => {
            const isTrade    = entry.action === 'trade_in' || entry.action === 'trade_out';
            const isTradeIn  = entry.action === 'trade_in';
            const isAdd      = entry.action === 'add';
            const isDup      = isAdd && entry.qty > 1;

            const accentColor = isTrade
              ? (isTradeIn ? Colors.owned : Colors.duplicate)
              : isAdd
                ? (isDup ? Colors.duplicate : Colors.owned)
                : Colors.red;

            const isFirst = index === 0;
            const isLast  = index === section.data.length - 1;

            const EntryIcon = isTrade
              ? (isTradeIn ? ArrowDown : ArrowUp)
              : (isAdd ? Plus : Minus);

            return (
              <View style={[
                styles.entryCard,
                isFirst && styles.entryCardFirst,
                isLast  && styles.entryCardLast,
                isTrade && { backgroundColor: (isTradeIn ? Colors.owned : Colors.duplicate) + '08' },
              ]}>
                <View style={[styles.entryAccent, { backgroundColor: accentColor }]} />

                <View style={[styles.entryIcon, { backgroundColor: accentColor + '20' }]}>
                  <EntryIcon size={12} color={accentColor} weight="bold" />
                </View>

                <View style={styles.entryInfo}>
                  <View style={styles.entryNameRow}>
                    <View style={[styles.entryCodeBadge, isTrade && { borderColor: Colors.trade + '40' }]}>
                      <Text style={styles.entryCode}>{entry.code}</Text>
                    </View>
                    <Text style={styles.entryName} numberOfLines={1}>{entry.name}</Text>
                  </View>
                  <Text style={styles.entryTeam} numberOfLines={1}>{entry.teamName}</Text>
                </View>

                <View style={styles.entryMeta}>
                  <View style={[styles.entryStatusBadge, { backgroundColor: accentColor + '20' }]}>
                    <Text style={[styles.entryStatus, { color: accentColor }]}>
                      {entryLabel(entry)}
                    </Text>
                  </View>
                  <Text style={styles.entryTime}>{formatTime(entry.timestamp)}</Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// ── styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: {
    paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 10,
  },
  headerTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.red + '40',
    backgroundColor: Colors.red + '10',
  },
  clearBtnText: {
    fontFamily: 'DMSans_500Medium', fontSize: 12, color: Colors.red,
  },
  headerTitles: { gap: 1 },
  headerLabel: {
    fontFamily: 'DMSans_500Medium', fontSize: 11,
    color: Colors.textMuted, letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: 'Oswald_700Bold', fontSize: 32,
    color: Colors.textPrimary, letterSpacing: 0,
  },

  // Daily Dashboard
  dailyDashboard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, paddingHorizontal: 16,
    gap: 14, marginTop: 4,
  },
  dateNavigator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateNavBtn: {
    padding: 6, borderRadius: Radii.full,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  dateNavTitle: {
    fontFamily: 'Oswald_600SemiBold', fontSize: 16,
    color: Colors.textPrimary, letterSpacing: 0.5,
  },
  dailyStatsGrid: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dailyStatCard: {
    alignItems: 'center', gap: 2, flex: 1,
  },
  dailyStatValue: {
    fontFamily: 'Oswald_700Bold', fontSize: 20,
    color: Colors.textPrimary,
  },
  dailyStatLabel: {
    fontFamily: 'DMSans_700Bold', fontSize: 9,
    color: Colors.textMuted, letterSpacing: 1,
  },
  dailyStatDivider: {
    width: 1, height: 24, backgroundColor: Colors.border,
  },

  // Search
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 14, paddingBottom: 10,
    backgroundColor: Colors.bgCard,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg,
    borderWidth: 1.5,
    borderRadius: Radii.full,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14,
    color: Colors.textPrimary, paddingVertical: 0,
  },
  clearSearch: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  searchResultsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 4,
  },
  searchResultsDot: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: Colors.owned,
  },
  searchResultsText: {
    fontFamily: 'DMSans_400Regular', fontSize: 12,
    color: Colors.textSecondary,
  },

  // List
  list: { paddingTop: Spacing.md, paddingHorizontal: Spacing.lg },

  // Day header — centered with lines
  dayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 20, marginBottom: 8,
  },
  dayHeaderLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dayHeaderTitle: {
    fontFamily: 'DMSans_500Medium', fontSize: 10,
    color: Colors.textMuted, letterSpacing: 2,
  },
  dayHeaderBadge: {
    backgroundColor: Colors.bgCard,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.border,
  },
  dayHeaderCount: {
    fontFamily: 'DMSans_500Medium', fontSize: 10,
    color: Colors.textMuted,
  },

  // Entry cards — grouped block feel
  entryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard,
    marginBottom: 1,
    paddingVertical: 10, paddingRight: 12,
    overflow: 'hidden',
  },
  entryCardFirst: { borderTopLeftRadius: Radii.md, borderTopRightRadius: Radii.md },
  entryCardLast:  { borderBottomLeftRadius: Radii.md, borderBottomRightRadius: Radii.md, marginBottom: 0 },
  entryAccent:    { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  entryIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  entryInfo: { flex: 1, gap: 2 },
  entryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  entryCodeBadge: {
    backgroundColor: Colors.bgCardAlt,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, borderWidth: 1, borderColor: Colors.border,
    flexShrink: 0,
  },
  entryCode: {
    fontFamily: 'DMSans_700Bold', fontSize: 9,
    color: Colors.textSecondary, letterSpacing: 0.5,
  },
  entryName: {
    fontFamily: 'DMSans_500Medium', fontSize: 13,
    color: Colors.textPrimary, flex: 1,
  },
  entryTeam: {
    fontFamily: 'DMSans_400Regular', fontSize: 11,
    color: Colors.textMuted,
  },
  entryMeta: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  entryStatusBadge: {
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: Radii.full,
  },
  entryStatus: {
    fontFamily: 'DMSans_700Bold', fontSize: 10,
  },
  entryTime: {
    fontFamily: 'DMSans_400Regular', fontSize: 10,
    color: Colors.textMuted,
  },

  // Empty
  empty: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xxl, gap: 12,
  },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: 'Oswald_600SemiBold', fontSize: 20,
    color: Colors.textSecondary, textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'DMSans_400Regular', fontSize: 13,
    color: Colors.textMuted, textAlign: 'center', lineHeight: 18,
  },

  // Filter tabs
  filterTabs: {
    flexDirection: 'row', gap: 6,
    paddingTop: 4, paddingBottom: 2,
  },
  filterTab: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  filterTabActive: {
    borderColor: Colors.borderBright,
    backgroundColor: Colors.bgCardAlt,
  },
  filterTabDot: {
    width: 5, height: 5, borderRadius: 3,
  },
  filterTabText: {
    fontFamily: 'DMSans_500Medium', fontSize: 12,
    color: Colors.textMuted,
  },
  filterTabBadge: {
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: Radii.full,
    backgroundColor: Colors.bgCardAlt,
    minWidth: 18, alignItems: 'center',
  },
  filterTabBadgeText: {
    fontFamily: 'DMSans_700Bold', fontSize: 10,
    color: Colors.textMuted,
  },
});
