import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers } from '@/context/StickersContext';
import { StickerCell, ViewMode } from '@/components/ui/StickerCell';
import { FlagImage } from '@/components/ui/FlagImage';
import { ArrowLeft, CheckCircle, SquaresFour, List, GridFour, Rows } from 'phosphor-react-native';

const COLS: Record<ViewMode, number> = { tiny: 6, small: 4, medium: 3, list: 1 };

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

export default function SeleccionScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { getSectionStickers, getSectionStats, quantities, increment, decrement, sections } = useStickers();
  const [mode, setMode] = useState<ViewMode>('small');

  const section = sections.find(s => s.code === code);
  const allStickers = getSectionStickers(code ?? '');
  const stats = getSectionStats(code ?? '');
  const cols = COLS[mode];
  const isComplete = stats.completionPct === 100;

  const rows = useMemo(() => {
    if (mode === 'list') return allStickers.map(s => [s]);
    const r: typeof allStickers[] = [];
    for (let i = 0; i < allStickers.length; i += cols) r.push(allStickers.slice(i, i + cols));
    return r;
  }, [allStickers, mode, cols]);

  if (!section) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={18} color={Colors.textPrimary} weight="bold" />
        </Pressable>

        <FlagImage isoCode={section.isoCode} size={32} style={{ borderRadius: 6 }} />

        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[Typography.titleM, { color: Colors.textPrimary }]} numberOfLines={1}>
            {section.name}
          </Text>
          <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>
            {stats.owned}/{section.total} · {stats.completionPct}%
            {stats.duplicateCount > 0 ? ` · ${stats.duplicateCount} rep.` : ''}
          </Text>
        </View>

        {isComplete && <CheckCircle size={22} color={Colors.owned} weight="fill" />}

        {/* Selector de vista */}
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
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressWrap}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, {
            width: `${stats.completionPct}%`,
            backgroundColor: isComplete ? Colors.owned : Colors.red,
          }]} />
        </View>
      </View>

      {/* Grid / Lista */}
      <FlatList
        data={rows}
        keyExtractor={(_, i) => `row-${i}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        ListHeaderComponent={
          <Text style={[Typography.bodyS, { color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm }]}>
            Toca para sumar · Mantén para restar
          </Text>
        }
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
        ListFooterComponent={<View style={{ height: 80 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 12,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  progressWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 8, paddingBottom: 4,
  },
  progressBar: {
    height: 4, backgroundColor: Colors.bgCardAlt,
    borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 4, borderRadius: 2 },
  grid: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  gridRow: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  viewToggle: {
    flexDirection: 'row',
    gap: 2,
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.md,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleBtn: {
    padding: 7,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActive: {
    backgroundColor: Colors.redSoft,
    borderWidth: 1,
    borderColor: Colors.red + '50',
  },
});
