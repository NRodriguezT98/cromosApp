import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Section } from '@/context/StickersContext';
import { StickerCell, ViewMode } from '@/components/ui/StickerCell';
import { FlagImage } from '@/components/ui/FlagImage';
import { ExportModal } from '@/components/ui/ExportModal';
import { ShareNetwork, GridFour, SquaresFour, Rows, List } from 'phosphor-react-native';

const COLS: Record<ViewMode, number> = { tiny: 6, small: 4, medium: 3, list: 1 };

type StickerFilter = 'all' | 'player' | 'foil' | 'logo' | 'photo';

const FILTERS: { key: StickerFilter; label: string }[] = [
  { key: 'all',    label: 'Todos'    },
  { key: 'player', label: 'Jugadores'},
  { key: 'foil',   label: '✦ FOIL'  },
  { key: 'logo',   label: 'Escudos' },
  { key: 'photo',  label: 'Fotos'   },
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

type DupSticker = ReturnType<ReturnType<typeof useStickers>['getDuplicateStickers']>[number];

type FlatItem =
  | { kind: 'header'; section: Section; dupCount: number; extrasCount: number }
  | { kind: 'row';    stickers: DupSticker[] };

export default function RepetidosScreen() {
  const { getDuplicateStickers, sections, quantities, increment, decrement } = useStickers();
  const [mode, setMode]         = useState<ViewMode>('small');
  const [filter, setFilter]     = useState<StickerFilter>('all');
  const [exportVisible, setExportVisible] = useState(false);
  const cols = COLS[mode];

  const duplicates = getDuplicateStickers();
  const totalExtras = duplicates.reduce((sum, s) => sum + s.extras, 0);

  const filtered = useMemo(() => {
    if (filter === 'foil')   return duplicates.filter(s => s.foil);
    if (filter === 'logo')   return duplicates.filter(s => s.type === 'team_logo');
    if (filter === 'photo')  return duplicates.filter(s => s.type === 'team_photo');
    if (filter === 'player') return duplicates.filter(s => s.type === 'player');
    return duplicates;
  }, [duplicates, filter]);

  const flatData = useMemo((): FlatItem[] => {
    const result: FlatItem[] = [];
    for (const sec of sections) {
      const secDups = filtered.filter(s => s.teamCode === sec.code);
      if (secDups.length === 0) continue;
      const secExtras = secDups.reduce((sum, s) => sum + s.extras, 0);
      result.push({ kind: 'header', section: sec, dupCount: secDups.length, extrasCount: secExtras });
      if (mode === 'list') {
        for (const s of secDups) result.push({ kind: 'row', stickers: [s] });
      } else {
        for (let i = 0; i < secDups.length; i += cols) {
          result.push({ kind: 'row', stickers: secDups.slice(i, i + cols) });
        }
      }
    }
    return result;
  }, [filtered, sections, mode, cols]);

  const estimatedItemSize = mode === 'list' ? 60 : mode === 'tiny' ? 80 : mode === 'medium' ? 160 : 120;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.labelM, { color: Colors.duplicate, letterSpacing: 3 }]}>PARA CAMBIAR</Text>
          <Text style={[Typography.titleXL, { color: Colors.textPrimary, marginTop: 4 }]}>Repetidos</Text>
          <Text style={[Typography.bodyS, { color: Colors.textMuted, marginTop: 3 }]}>
            {filtered.length} cromo{filtered.length !== 1 ? 's' : ''} · {totalExtras} copias extra
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.viewToggle}>
            {VIEW_OPTIONS.map(opt => {
              const active = mode === opt.mode;
              return (
                <Pressable key={opt.mode} onPress={() => setMode(opt.mode)}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
                  <ViewIcon mode={opt.mode} color={active ? Colors.duplicate : Colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
          {duplicates.length > 0 && (
            <Pressable style={styles.shareBtn} onPress={() => setExportVisible(true)}>
              <ShareNetwork size={16} color={Colors.textPrimary} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Chips de filtro */}
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

      {duplicates.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[Typography.titleM, { color: Colors.textSecondary, textAlign: 'center', marginTop: 16 }]}>
            Sin repetidos
          </Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            Todos tus cromos son únicos
          </Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[Typography.titleS, { color: Colors.textSecondary, textAlign: 'center' }]}>
            Sin resultados para este filtro
          </Text>
        </View>
      ) : (
        <FlashList
          data={flatData}
          estimatedItemSize={estimatedItemSize}
          keyExtractor={(item, i) => item.kind === 'header' ? `h-${item.section.code}` : `r-${i}`}
          showsVerticalScrollIndicator={false}
          getItemType={item => item.kind}
          contentContainerStyle={styles.list}
          ListFooterComponent={<View style={{ height: 100 }} />}
          renderItem={({ item }) => {
            if (item.kind === 'header') {
              return (
                <View style={styles.sectionHeader}>
                  <FlagImage isoCode={item.section.isoCode} size={24} />
                  <Text style={[Typography.titleS, { color: Colors.textPrimary, flex: 1, marginLeft: 10 }]} numberOfLines={1}>
                    {item.section.name}
                  </Text>
                  <View style={styles.countBadge}>
                    <Text style={[Typography.labelS, { color: Colors.duplicate }]}>{item.dupCount}</Text>
                  </View>
                </View>
              );
            }
            if (mode === 'list') {
              const sticker = item.stickers[0];
              return (
                <StickerCell sticker={sticker} qty={quantities[sticker.code] ?? 0}
                  mode="list" onTap={() => increment(sticker.code)} onLongPress={() => decrement(sticker.code)} />
              );
            }
            return (
              <View style={styles.gridRow}>
                {item.stickers.map(sticker => (
                  <StickerCell key={sticker.code} sticker={sticker} qty={quantities[sticker.code] ?? 0}
                    mode={mode} onTap={() => increment(sticker.code)} onLongPress={() => decrement(sticker.code)} />
                ))}
                {item.stickers.length < cols && Array.from({ length: cols - item.stickers.length }).map((_, i) => (
                  <View key={`ph-${i}`} style={{ flex: 1, aspectRatio: 0.72 }} />
                ))}
              </View>
            );
          }}
        />
      )}

      <ExportModal visible={exportVisible} onClose={() => setExportVisible(false)} type="duplicates" />
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: {
    flexDirection: 'row', gap: 2, backgroundColor: Colors.bgCard,
    borderRadius: Radii.md, padding: 3, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtn: { padding: 7, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: Colors.duplicate + '20', borderWidth: 1, borderColor: Colors.duplicate + '50' },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.duplicate, alignItems: 'center', justifyContent: 'center',
  },
  filtersScroll: { flexGrow: 0, flexShrink: 0, height: 52 },
  filtersRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  filterChipActive: { backgroundColor: Colors.duplicate + '20', borderColor: Colors.duplicate + '60' },
  filterLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: Colors.textMuted },
  filterLabelActive: { color: Colors.duplicate },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, marginTop: Spacing.md, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  countBadge: {
    backgroundColor: Colors.duplicate + '20', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.duplicate + '40',
  },
  gridRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
});
