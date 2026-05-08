import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, Share, ScrollView } from 'react-native';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers } from '@/context/StickersContext';
import { StickerCell, ViewMode } from '@/components/ui/StickerCell';
import { FlagImage } from '@/components/ui/FlagImage';
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

type ViewOption = { mode: ViewMode; label: string };
const VIEW_OPTIONS: ViewOption[] = [
  { mode: 'tiny',   label: 'Min'  },
  { mode: 'small',  label: 'Grid' },
  { mode: 'medium', label: 'Big'  },
  { mode: 'list',   label: 'Lista'},
];

function ViewIcon({ mode, color }: { mode: ViewMode; color: string }) {
  const size = 14;
  const w = 'fill' as const;
  if (mode === 'tiny')   return <GridFour    size={size} color={color} weight={w} />;
  if (mode === 'small')  return <SquaresFour size={size} color={color} weight={w} />;
  if (mode === 'medium') return <Rows        size={size} color={color} weight={w} />;
  return                        <List        size={size} color={color} weight={w} />;
}

export default function FaltanScreen() {
  const { getMissingStickers, sections, quantities, increment, decrement } = useStickers();
  const [mode, setMode]     = useState<ViewMode>('small');
  const [filter, setFilter] = useState<StickerFilter>('all');
  const cols = COLS[mode];

  const missing = getMissingStickers();

  const filtered = useMemo(() => {
    if (filter === 'all')    return missing;
    if (filter === 'foil')   return missing.filter(s => s.foil);
    if (filter === 'logo')   return missing.filter(s => s.type === 'team_logo');
    if (filter === 'photo')  return missing.filter(s => s.type === 'team_photo');
    if (filter === 'player') return missing.filter(s => s.type === 'player');
    return missing;
  }, [missing, filter]);

  const sectionedData = useMemo(() => {
    return sections
      .map(sec => {
        const secMissing = filtered.filter(s => s.teamCode === sec.code);
        if (secMissing.length === 0) return null;
        if (mode === 'list') {
          return { section: sec, missingCount: secMissing.length, data: secMissing.map(s => [s]) };
        }
        const rows: typeof secMissing[] = [];
        for (let i = 0; i < secMissing.length; i += cols) {
          rows.push(secMissing.slice(i, i + cols));
        }
        return { section: sec, missingCount: secMissing.length, data: rows };
      })
      .filter(Boolean) as Array<{ section: typeof sections[0]; missingCount: number; data: typeof filtered[] }>;
  }, [filtered, sections, mode, cols]);

  const handleShare = async () => {
    const flag = (iso: string) =>
      /^[A-Za-z]{2}$/.test(iso)
        ? iso.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)).join('')
        : '';

    const lines = sectionedData.map(g => {
      const f = flag(g.section.isoCode);
      const codes = g.data.flat().map(s => s.code).join(', ');
      return `${f ? f + ' ' : ''}${g.section.name} (${g.missingCount})\n${codes}`;
    });
    const total = missing.length;
    const text = [
      `🔍 BUSCO - Panini Mundial 2026`,
      ``,
      ...lines.map((l, i) => (i < lines.length - 1 ? l + '\n' : l)),
      ``,
      `Total: ${total} cromo${total !== 1 ? 's' : ''} que me faltan`,
    ].join('\n');
    await Share.share({ message: text });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.labelM, { color: Colors.red, letterSpacing: 3 }]}>ÁLBUM 2026</Text>
          <Text style={[Typography.titleXL, { color: Colors.textPrimary, marginTop: 4 }]}>Me Faltan</Text>
          <Text style={[Typography.bodyS, { color: Colors.textMuted, marginTop: 3 }]}>
            {filtered.length} cromo{filtered.length !== 1 ? 's' : ''} pendientes
          </Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.viewToggle}>
            {VIEW_OPTIONS.map(opt => {
              const active = mode === opt.mode;
              const color  = active ? Colors.red : Colors.textMuted;
              return (
                <Pressable
                  key={opt.mode}
                  onPress={() => setMode(opt.mode)}
                  style={[styles.toggleBtn, active && styles.toggleBtnActive]}
                >
                  <ViewIcon mode={opt.mode} color={color} />
                </Pressable>
              );
            })}
          </View>
          {missing.length > 0 && (
            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <ShareNetwork size={16} color={Colors.textPrimary} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Chips de filtro */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        {FILTERS.map(f => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <Text style={[styles.filterLabel, active && styles.filterLabelActive]}>
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {missing.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={[Typography.titleM, { color: Colors.owned, textAlign: 'center', marginTop: 16 }]}>
            ¡Álbum completo!
          </Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            No te falta ningún cromo
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
          keyExtractor={(row, index) => `r${index}-${row[0]?.code ?? index}`}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section: { section, missingCount } }) => (
            <View style={styles.sectionHeader}>
              <FlagImage isoCode={section.isoCode} size={24} />
              <Text style={[Typography.titleS, { color: Colors.textPrimary, flex: 1, marginLeft: 10 }]} numberOfLines={1}>
                {section.name}
              </Text>
              <View style={styles.countBadge}>
                <Text style={[Typography.labelS, { color: Colors.red }]}>{missingCount}</Text>
              </View>
            </View>
          )}
          renderItem={({ item: row }) => {
            if (mode === 'list') {
              const sticker = row[0];
              return (
                <StickerCell
                  sticker={sticker}
                  qty={quantities[sticker.code] ?? 0}
                  mode="list"
                  onTap={() => increment(sticker.code)}
                  onLongPress={() => decrement(sticker.code)}
                />
              );
            }
            return (
              <View style={styles.gridRow}>
                {row.map(sticker => (
                  <StickerCell
                    key={sticker.code}
                    sticker={sticker}
                    qty={quantities[sticker.code] ?? 0}
                    mode={mode}
                    onTap={() => increment(sticker.code)}
                    onLongPress={() => decrement(sticker.code)}
                  />
                ))}
                {row.length < cols &&
                  Array.from({ length: cols - row.length }).map((_, i) => (
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
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewToggle: {
    flexDirection: 'row', gap: 2,
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    padding: 3, borderWidth: 1, borderColor: Colors.border,
  },
  toggleBtn: { padding: 7, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  toggleBtnActive: { backgroundColor: Colors.redSoft, borderWidth: 1, borderColor: Colors.red + '50' },
  shareBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  },
  filtersScroll: { flexGrow: 0, flexShrink: 0, height: 52 },
  filtersRow: {
    flexDirection: 'row', gap: 8, alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  filterChipActive: {
    backgroundColor: Colors.redSoft, borderColor: Colors.red + '60',
  },
  filterLabel: {
    fontFamily: 'DMSans_500Medium', fontSize: 12, color: Colors.textMuted,
  },
  filterLabelActive: { color: Colors.red },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, marginTop: Spacing.md, marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  countBadge: {
    backgroundColor: Colors.redSoft, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.red + '40',
  },
  gridRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
});
