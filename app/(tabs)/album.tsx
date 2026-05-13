import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView,
  Modal, TextInput, Keyboard,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';

import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Section, Sticker } from '@/context/StickersContext';
import { StickerCell, ViewMode } from '@/components/ui/StickerCell';
import { FlagImage } from '@/components/ui/FlagImage';
import {
  SquaresFourIcon, ListIcon, GridFourIcon, RowsIcon,
  ArrowsDownUpIcon, CaretDownIcon, CaretUpIcon, CheckIcon,
  MagnifyingGlassIcon, XIcon, ShareNetworkIcon,
} from 'phosphor-react-native';
import { ExportModal } from '@/components/ui/ExportModal';

const COLS: Record<ViewMode, number> = { tiny: 6, small: 4, medium: 3, list: 1 };

type SubTab   = 'all' | 'owned' | 'missing' | 'duplicates';
type SortMode = 'original' | 'alpha' | 'progress_desc' | 'progress_asc';

const SUB_TABS: { key: SubTab; label: string; color: string }[] = [
  { key: 'all',        label: 'Todo el álbum', color: Colors.red       },
  { key: 'owned',      label: 'Tengo',         color: Colors.owned     },
  { key: 'missing',    label: 'Me Faltan',     color: Colors.red       },
  { key: 'duplicates', label: 'Repetidos',     color: Colors.duplicate },
];

const SORT_OPTIONS: { key: SortMode; label: string; sub: string }[] = [
  { key: 'original',      label: 'Álbum original',     sub: 'Orden del álbum físico'       },
  { key: 'alpha',         label: 'Alfabético',          sub: 'A → Z por nombre de selección'},
  { key: 'progress_desc', label: 'Más avanzadas',       sub: 'Mayor % completado primero'   },
  { key: 'progress_asc',  label: 'Menos avanzadas',     sub: 'Menor % completado primero'   },
];

const VIEW_OPTIONS: ViewMode[] = ['tiny', 'small', 'medium', 'list'];

type AlbumFlatItem =
  | { kind: 'header'; section: Section; count: number; pct: number; owned: number; isCollapsed: boolean }
  | { kind: 'row'; stickers: Sticker[] };

function ViewIcon({ mode, color }: { mode: ViewMode; color: string }) {
  const size = 15; const w = 'fill' as const;
  if (mode === 'tiny')   return <GridFourIcon    size={size} color={color} weight={w} />;
  if (mode === 'small')  return <SquaresFourIcon size={size} color={color} weight={w} />;
  if (mode === 'medium') return <RowsIcon        size={size} color={color} weight={w} />;
  return                        <ListIcon        size={size} color={color} weight={w} />;
}

/** Normalise a string: lowercase + remove accents */
function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function AlbumScreen() {
  const { sections, stickers, quantities, getSectionStats, increment, decrement } = useStickers();

  const [mode, setMode]               = useState<ViewMode>('small');
  const [subTab, setSubTab]           = useState<SubTab>('all');
  const [sortMode, setSortMode]       = useState<SortMode>('original');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set());
  const [exportVisible, setExportVisible] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const cols = COLS[mode];

  const activeTab   = SUB_TABS.find(t => t.key === subTab)!;
  const sortIsActive = sortMode !== 'original';
  const isSearching  = searchQuery.trim().length > 0;

  const toggleCollapse = (code: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    Keyboard.dismiss();
  }, []);

  const baseStickers = useMemo(() => {
    switch (subTab) {
      case 'owned':      return stickers.filter(s => (quantities[s.code] ?? 0) > 0);
      case 'missing':    return stickers.filter(s => (quantities[s.code] ?? 0) === 0);
      case 'duplicates': return stickers.filter(s => (quantities[s.code] ?? 0) > 1);
      default:           return stickers;
    }
  }, [subTab, stickers, quantities]);

  /** Search results: flat list of matching stickers */
  const searchResults = useMemo(() => {
    if (!isSearching) return [];

    // Normalize query and also remove spaces so "GHA 14" → "gha14"
    const raw   = searchQuery.trim();
    const q     = norm(raw);
    const qNoSp = q.replace(/\s+/g, '');

    return baseStickers.filter(s => {
      const sCode    = norm(s.code);                     // e.g. "gha14"
      const sName    = norm(s.name);                     // e.g. "jordan ayew"
      const sTeam    = norm(s.teamName);                 // e.g. "ghana"
      const sSection = norm(s.section);                  // e.g. "gha"

      return (
        sCode.includes(qNoSp)    ||  // GHA14, gha14, gha 14
        sCode.includes(q)        ||  // direct match
        sSection === qNoSp       ||  // section prefix match
        sName.includes(q)        ||  // player name substring
        sTeam.includes(q)            // country/team name
      );
    });
  }, [searchQuery, baseStickers, isSearching]);

  const sectionedData = useMemo(() => {
    let result = sections
      .map(sec => {
        const secStickers = baseStickers.filter(s => s.teamCode === sec.code);
        if (subTab !== 'all' && secStickers.length === 0) return null;
        const stats = getSectionStats(sec.code);
        const isCollapsed = collapsed.has(sec.code);
        let rows: typeof secStickers[] = [];
        if (!isCollapsed) {
          if (mode === 'list') {
            rows = secStickers.map(s => [s]);
          } else {
            for (let i = 0; i < secStickers.length; i += cols) rows.push(secStickers.slice(i, i + cols));
          }
        }
        return {
          section: sec,
          count: secStickers.length,
          pct: stats.completionPct,
          owned: stats.owned,
          isCollapsed,
          data: rows,
        };
      })
      .filter(Boolean) as {
        section: typeof sections[0]; count: number; pct: number;
        owned: number; isCollapsed: boolean; data: typeof baseStickers[];
      }[];

    if (subTab === 'all') {
      if (sortMode === 'alpha')         result = [...result].sort((a, b) => a.section.name.localeCompare(b.section.name, 'es'));
      if (sortMode === 'progress_desc') result = [...result].sort((a, b) => b.pct - a.pct || b.owned - a.owned);
      if (sortMode === 'progress_asc')  result = [...result].sort((a, b) => a.pct - b.pct || a.owned - b.owned);
    }

    return result;
  }, [sections, baseStickers, mode, cols, subTab, collapsed, sortMode, getSectionStats]);

  const activeSortLabel = SORT_OPTIONS.find(o => o.key === sortMode)?.label ?? '';

  // Build a code→section map for search result labels
  const sectionByCode = useMemo(() => {
    const map: Record<string, typeof sections[0]> = {};
    for (const sec of sections) map[sec.code] = sec;
    return map;
  }, [sections]);

  const estimatedItemSize = mode === 'list' ? 60 : mode === 'tiny' ? 80 : mode === 'medium' ? 160 : 120;

  const flatData = useMemo((): AlbumFlatItem[] => {
    return sectionedData.flatMap(g => [
      { kind: 'header' as const, section: g.section, count: g.count, pct: g.pct, owned: g.owned, isCollapsed: g.isCollapsed },
      ...g.data.map(row => ({ kind: 'row' as const, stickers: row })),
    ]);
  }, [sectionedData]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.labelM, { color: Colors.red, letterSpacing: 3 }]}>PANINI ★ 2026</Text>
          <Text style={[Typography.titleXL, { color: Colors.textPrimary, marginTop: 4 }]}>Álbum</Text>
          <Text style={[Typography.bodyS, { color: Colors.textMuted, marginTop: 3 }]}>
            {isSearching
              ? `${searchResults.length} resultado${searchResults.length !== 1 ? 's' : ''}`
              : `${baseStickers.length} cromo${baseStickers.length !== 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {subTab === 'all' && !isSearching && (
            <Pressable
              onPress={() => setSortMenuOpen(true)}
              style={[styles.sortBtn, sortIsActive && { backgroundColor: activeTab.color + '20', borderColor: activeTab.color + '50' }]}
            >
              <ArrowsDownUpIcon size={14} color={sortIsActive ? activeTab.color : Colors.textMuted} weight="bold" />
              <Text style={[styles.sortBtnLabel, sortIsActive && { color: activeTab.color }]}>
                {sortIsActive ? activeSortLabel : 'Ordenar'}
              </Text>
            </Pressable>
          )}
          {(subTab === 'missing' || subTab === 'duplicates') && !isSearching && (
            <Pressable
              style={[styles.shareBtn, { backgroundColor: activeTab.color }]}
              onPress={() => setExportVisible(true)}
            >
              <ShareNetworkIcon size={16} color={Colors.white} weight="bold" />
            </Pressable>
          )}
          {!isSearching && (
            <View style={styles.viewToggle}>
              {VIEW_OPTIONS.map(opt => {
                const active = mode === opt;
                const color  = active ? activeTab.color : Colors.textMuted;
                return (
                  <Pressable key={opt} onPress={() => setMode(opt)}
                    style={[styles.toggleBtn, active && [styles.toggleBtnActive, { backgroundColor: activeTab.color + '20', borderColor: activeTab.color + '50' }]]}>
                    <ViewIcon mode={opt} color={color} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <MagnifyingGlassIcon size={15} color={searchFocused ? Colors.red : Colors.textMuted} weight="bold" />
          <TextInput
            ref={searchInputRef}
            style={styles.searchInput}
            placeholder="Buscar por nombre, código o país…"
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={clearSearch} style={styles.clearBtn} hitSlop={8}>
              <XIcon size={13} color={Colors.textMuted} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Sub-tabs (hidden while searching) */}
      {!isSearching && (
        <ScrollView
          horizontal showsHorizontalScrollIndicator={false}
          style={styles.subTabsScroll} contentContainerStyle={styles.subTabsRow}
        >
          {SUB_TABS.map(tab => {
            const active = subTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => setSubTab(tab.key)}
                style={[styles.subTabBtn, active && { borderBottomColor: tab.color, borderBottomWidth: 2 }]}>
                <Text style={[styles.subTabLabel, active && { color: tab.color, fontFamily: 'DMSans_700Bold' }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* === SEARCH RESULTS === */}
      {isSearching ? (
        <FlashList
          data={searchResults}
          estimatedItemSize={80}
          keyExtractor={s => s.code}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[Typography.titleM, { color: Colors.textSecondary, textAlign: 'center' }]}>
                Sin resultados
              </Text>
              <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
                Prueba con "{searchQuery.toUpperCase()}", el nombre del jugador o el país
              </Text>
            </View>
          }
          renderItem={({ item: sticker }) => {
            const sec = sectionByCode[sticker.teamCode];
            return (
              <View style={styles.searchResultItem}>
                <View style={styles.searchResultBadge}>
                  <FlagImage isoCode={sec?.isoCode ?? null} size={14} />
                  <Text style={styles.searchResultBadgeText}>{sticker.code}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <StickerCell
                    sticker={sticker}
                    qty={quantities[sticker.code] ?? 0}
                    mode="list"
                    onTap={() => increment(sticker.code)}
                    onLongPress={() => decrement(sticker.code)}
                  />
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      ) : (
        /* === MAIN ALBUM LIST === */
        <FlashList
          data={flatData}
          estimatedItemSize={estimatedItemSize}
          keyExtractor={(item, i) => item.kind === 'header' ? `h-${item.section.code}` : `r-${i}`}
          showsVerticalScrollIndicator={false}
          getItemType={item => item.kind}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={[Typography.titleM, { color: Colors.textSecondary, textAlign: 'center' }]}>
                {subTab === 'owned'      ? 'Sin cromos aún'   :
                 subTab === 'missing'   ? '¡Álbum completo!' :
                 subTab === 'duplicates'? 'Sin repetidos'    : ''}
              </Text>
              <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
                {subTab === 'owned'      ? 'Toca un cromo para marcarlo'  :
                 subTab === 'missing'   ? 'No te falta ningún cromo'      :
                 subTab === 'duplicates'? 'No tienes cromos repetidos'    : ''}
              </Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              const { section, count, pct, owned, isCollapsed } = item;
              const isComplete = pct === 100;
              const pctColor   = isComplete ? Colors.owned : activeTab.color;
              const showBar    = subTab === 'all';
              return (
                <Pressable style={styles.sectionHeader} onPress={() => toggleCollapse(section.code)}>
                  <FlagImage isoCode={section.isoCode} size={26} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[Typography.titleS, { color: Colors.textPrimary, flexShrink: 1 }]} numberOfLines={1}>
                        {section.name}
                      </Text>
                      {section.group && (
                        <View style={styles.groupBadge}>
                          <Text style={styles.groupBadgeText}>Grupo {section.group}</Text>
                        </View>
                      )}
                    </View>
                    {showBar ? (
                      <View style={styles.miniBarRow}>
                        <View style={styles.miniBar}>
                          <View style={[styles.miniBarFill, { width: `${pct}%`, backgroundColor: pctColor }]} />
                        </View>
                        <Text style={[Typography.labelS, { color: Colors.textMuted, marginLeft: 8 }]}>
                          {owned}/{section.total}
                        </Text>
                      </View>
                    ) : (
                      <Text style={[Typography.labelS, { color: Colors.textMuted, marginTop: 2 }]}>
                        {count} cromo{count !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  {showBar ? (
                    <Text style={[Typography.labelM, { color: pctColor, marginHorizontal: 8, minWidth: 40, textAlign: 'right', fontFamily: 'Oswald_600SemiBold' }]}>
                      {pct}%
                    </Text>
                  ) : (
                    <View style={[styles.countBadge, { backgroundColor: activeTab.color + '20', borderColor: activeTab.color + '40', marginHorizontal: 8 }]}>
                      <Text style={[Typography.labelS, { color: activeTab.color }]}>{count}</Text>
                    </View>
                  )}
                  {isCollapsed
                    ? <CaretUpIcon   size={14} color={Colors.textMuted} weight="bold" />
                    : <CaretDownIcon size={14} color={Colors.textMuted} weight="bold" />}
                </Pressable>
              );
            }
            const { stickers: row } = item;
            if (mode === 'list') {
              const sticker = row[0];
              return (
                <StickerCell sticker={sticker} qty={quantities[sticker.code] ?? 0}
                  mode="list" onTap={() => increment(sticker.code)} onLongPress={() => decrement(sticker.code)} />
              );
            }
            return (
              <View style={styles.gridRow}>
                {row.map(sticker => (
                  <StickerCell key={sticker.code} sticker={sticker} qty={quantities[sticker.code] ?? 0}
                    mode={mode} onTap={() => increment(sticker.code)} onLongPress={() => decrement(sticker.code)} />
                ))}
                {row.length < cols && Array.from({ length: cols - row.length }).map((_, i) => (
                  <View key={`ph-${i}`} style={styles.cellPh} />
                ))}
              </View>
            );
          }}
        />
      )}


      <ExportModal
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        type={subTab === 'missing' ? 'missing' : 'duplicates'}
      />

      <Modal visible={sortMenuOpen} transparent animationType="fade" onRequestClose={() => setSortMenuOpen(false)}>
        <Pressable style={styles.sortOverlay} onPress={() => setSortMenuOpen(false)}>
          <Pressable style={styles.sortMenu} onPress={e => e.stopPropagation()}>
            <View style={styles.sortMenuHeader}>
              <ArrowsDownUpIcon size={14} color={Colors.textMuted} weight="bold" />
              <Text style={[Typography.labelM, { color: Colors.textMuted, letterSpacing: 2, marginLeft: 6 }]}>
                ORDENAR SECCIONES
              </Text>
            </View>
            {SORT_OPTIONS.map((opt, i) => {
              const active = sortMode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  style={[styles.sortOption, i < SORT_OPTIONS.length - 1 && styles.sortOptionBorder, active && styles.sortOptionActive]}
                  onPress={() => { setSortMode(opt.key); setSortMenuOpen(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sortOptionLabel, active && { color: Colors.red }]}>{opt.label}</Text>
                    <Text style={styles.sortOptionSub}>{opt.sub}</Text>
                  </View>
                  {active && <CheckIcon size={16} color={Colors.red} weight="bold" />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 52, paddingBottom: 8, paddingHorizontal: Spacing.lg,
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
  },

  /* Search */
  searchRow: {
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchBoxFocused: {
    borderColor: Colors.red + '80',
    backgroundColor: Colors.bgCard,
  },
  searchInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 14,
    color: Colors.textPrimary, padding: 0, margin: 0,
  },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
  },

  /* Search results */
  searchResultItem: {
    marginBottom: 6,
  },
  searchResultBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    marginBottom: 2,
  },
  searchResultBadgeText: {
    fontFamily: 'DMSans_700Bold', fontSize: 11,
    color: Colors.textMuted, letterSpacing: 1,
  },

  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radii.md,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    height: 34,
  },
  sortBtnLabel: { fontFamily: 'DMSans_500Medium', fontSize: 11, color: Colors.textMuted },
  viewToggle: {
    flexDirection: 'row', gap: 2,
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    padding: 3, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtn: { padding: 7, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { borderWidth: 1 },
  subTabsScroll: { flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: Colors.border },
  subTabsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg },
  subTabBtn: {
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  subTabLabel: { fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.textMuted },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, marginTop: Spacing.md, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  miniBarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  miniBar: { flex: 1, height: 3, backgroundColor: Colors.bgCardAlt, borderRadius: 2, overflow: 'hidden' },
  miniBarFill: { height: 3, borderRadius: 2 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.full, borderWidth: 1 },
  gridRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  cellPh: { flex: 1, aspectRatio: 0.72 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, marginTop: 60 },
  fab: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.red, paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: Radii.full, gap: 8, elevation: 8,
  },
  fabLabel: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.textPrimary, letterSpacing: 0.3 },

  /* Sort modal */
  sortOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-start', alignItems: 'flex-end',
    paddingTop: 108, paddingRight: Spacing.lg,
  },
  sortMenu: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border,
    minWidth: 230, overflow: 'hidden',
  },
  sortMenuHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sortOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
  },
  sortOptionBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  sortOptionActive: { backgroundColor: Colors.red + '0D' },
  sortOptionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.textPrimary },
  sortOptionSub: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1 },
  groupBadge: {
    backgroundColor: Colors.bgCardAlt, borderRadius: Radii.sm,
    paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: Colors.border,
  },
  groupBadgeText: { fontFamily: 'DMSans_500Medium', fontSize: 10, color: Colors.textMuted },
  shareBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
});
