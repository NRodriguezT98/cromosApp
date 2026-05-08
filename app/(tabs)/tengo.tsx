import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers } from '@/context/StickersContext';
import { StickerCell, ViewMode } from '@/components/ui/StickerCell';
import { FlagImage } from '@/components/ui/FlagImage';
import { ArrowLeft, GridFour, SquaresFour, Rows, List } from 'phosphor-react-native';

const COLS: Record<ViewMode, number> = { tiny: 6, small: 4, medium: 3, list: 1 };

type StickerFilter = 'all' | 'player' | 'foil' | 'logo' | 'photo';

const FILTERS: { key: StickerFilter; label: string }[] = [
  { key: 'all',    label: 'Todos'     },
  { key: 'player', label: 'Jugadores' },
  { key: 'foil',   label: '✦ FOIL'   },
  { key: 'logo',   label: 'Escudos'  },
  { key: 'photo',  label: 'Fotos'    },
];

const VIEW_OPTIONS: { mode: ViewMode }[] = [
  { mode: 'tiny' }, { mode: 'small' }, { mode: 'medium' }, { mode: 'list' },
];

function ViewIcon({ mode, color }: { mode: ViewMode; color: string }) {
  const size = 14; const w = 'fill' as const;
  if (mode === 'tiny')   return <GridFour    size={size} color={color} weight={w} />;
  if (mode === 'small')  return <SquaresFour size={size} color={color} weight={w} />;
  if (mode === 'medium') return <Rows        size={size} color={color} weight={w} />;
  return                        <List        size={size} color={color} weight={w} />;
}

export default function TengoScreen() {
  const { stickers, sections, quantities, increment, decrement } = useStickers();
  const router = useRouter();
  const [mode, setMode]     = useState<ViewMode>('small');
  const [filter, setFilter] = useState<StickerFilter>('all');
  const cols = COLS[mode];

  const owned = useMemo(
    () => stickers.filter(s => (quantities[s.code] ?? 0) > 0),
    [stickers, quantities],
  );

  const filtered = useMemo(() => {
    if (filter === 'all')    return owned;
    if (filter === 'foil')   return owned.filter(s => s.foil);
    if (filter === 'logo')   return owned.filter(s => s.type === 'team_logo');
    if (filter === 'photo')  return owned.filter(s => s.type === 'team_photo');
    if (filter === 'player') return owned.filter(s => s.type === 'player');
    return owned;
  }, [owned, filter]);

  const sectionedData = useMemo(() => {
    return sections
      .map(sec => {
        const secOwned = filtered.filter(s => s.teamCode === sec.code);
        if (secOwned.length === 0) return null;
        if (mode === 'list') {
          return { section: sec, ownedCount: secOwned.length, data: secOwned.map(s => [s]) };
        }
        const rows: typeof secOwned[] = [];
        for (let i = 0; i < secOwned.length; i += cols) rows.push(secOwned.slice(i, i + cols));
        return { section: sec, ownedCount: secOwned.length, data: rows };
      })
      .filter(Boolean) as Array<{ section: typeof sections[0]; ownedCount: number; data: typeof filtered[] }>;
  }, [filtered, sections, mode, cols]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.textPrimary} weight="bold" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.labelM, { color: Colors.owned, letterSpacing: 3 }]}>MI COLECCIÓN</Text>
          <Text style={[Typography.titleXL, { color: Colors.textPrimary, marginTop: 4 }]}>Tengo</Text>
          <Text style={[Typography.bodyS, { color: Colors.textMuted, marginTop: 3 }]}>
            {filtered.length} cromo{filtered.length !== 1 ? 's' : ''} en tu álbum
          </Text>
        </View>
        <View style={styles.viewToggle}>
          {VIEW_OPTIONS.map(opt => {
            const active = mode === opt.mode;
            const color  = active ? Colors.owned : Colors.textMuted;
            return (
              <Pressable key={opt.mode} onPress={() => setMode(opt.mode)}
                style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
                <ViewIcon mode={opt.mode} color={color} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll} contentContainerStyle={styles.filtersRow}>
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}>
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {owned.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[Typography.titleM, { color: Colors.textSecondary, textAlign: 'center', marginTop: 16 }]}>
            Sin cromos aún
          </Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            Añade cromos desde el Álbum
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[Typography.titleS, { color: Colors.textSecondary, textAlign: 'center' }]}>
            Sin resultados para este filtro
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sectionedData}
          keyExtractor={(row, i) => `r${i}-${row[0]?.code ?? i}`}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section: { section, ownedCount } }) => (
            <View style={styles.sectionHeader}>
              <FlagImage isoCode={section.isoCode} size={24} />
              <Text style={[Typography.titleS, { color: Colors.textPrimary, flex: 1, marginLeft: 10 }]} numberOfLines={1}>
                {section.name}
              </Text>
              <View style={styles.countBadge}>
                <Text style={[Typography.labelS, { color: Colors.owned }]}>{ownedCount}</Text>
              </View>
            </View>
          )}
          renderItem={({ item: row }) => {
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
                  <View key={`ph-${i}`} style={{ flex: 1, aspectRatio: 0.72 }} />
                ))}
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 100 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  viewToggle: {
    flexDirection: 'row', gap: 2, backgroundColor: Colors.bgCard,
    borderRadius: Radii.md, padding: 3, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtn: { padding: 7, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: Colors.owned + '20', borderWidth: 1, borderColor: Colors.owned + '50' },
  filtersScroll: { flexGrow: 0, flexShrink: 0, height: 52 },
  filtersRow: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 10 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  filterChipActive: { backgroundColor: Colors.owned + '20', borderColor: Colors.owned + '60' },
  filterLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: Colors.textMuted },
  filterLabelActive: { color: Colors.owned },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    marginTop: Spacing.md, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  countBadge: {
    backgroundColor: Colors.owned + '20', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.owned + '40',
  },
  gridRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
});
