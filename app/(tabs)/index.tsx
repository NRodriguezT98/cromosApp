import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers } from '@/context/StickersContext';
import {
  Trophy, XCircle, ArrowsClockwise, Star, Camera, ShareNetwork,
  ClockCounterClockwise, Plus, Minus, Sparkle, CopySimple,
} from 'phosphor-react-native';
import { FlagImage } from '@/components/ui/FlagImage';
import { ScannerModal } from '@/components/ui/ScannerModal';

// ── Mini progress ring (SVG, 56px) ─────────────────────────────────────────
function MiniRing({ pct }: { pct: number }) {
  const [live, setLive] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = anim.addListener(({ value }) => setLive(value));
    Animated.timing(anim, {
      toValue: pct, duration: 1400,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [pct]);

  const SIZE   = 56;
  const STROKE = 6;
  const R      = (SIZE - STROKE) / 2;
  const C      = SIZE / 2;
  const circ   = 2 * Math.PI * R;
  const offset = circ * (1 - live / 100);
  const isComplete = pct === 100;
  const arcColor   = isComplete ? Colors.owned : Colors.red;
  const gradEnd    = isComplete ? '#6FD9A6' : '#FF8080';

  // Leading dot
  const angle = (live / 100) * 2 * Math.PI - Math.PI / 2;
  const dotX  = C + R * Math.cos(angle);
  const dotY  = C + R * Math.sin(angle);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={arcColor} />
            <Stop offset="100%" stopColor={gradEnd} />
          </SvgGradient>
        </Defs>
        <Circle cx={C} cy={C} r={R} fill="none" stroke={Colors.bgCardAlt} strokeWidth={STROKE} />
        {live > 0.5 && (
          <>
            <Circle cx={C} cy={C} r={R} fill="none"
              stroke={arcColor} strokeWidth={STROKE + 6} strokeOpacity={0.12}
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round" rotation={-90} origin={`${C},${C}`}
            />
            <Circle cx={C} cy={C} r={R} fill="none"
              stroke="url(#mg)" strokeWidth={STROKE}
              strokeDasharray={circ} strokeDashoffset={offset}
              strokeLinecap="round" rotation={-90} origin={`${C},${C}`}
            />
          </>
        )}
        {live > 3 && (
          <>
            <Circle cx={dotX} cy={dotY} r={6} fill={arcColor} fillOpacity={0.25} />
            <Circle cx={dotX} cy={dotY} r={3.5} fill={arcColor} />
          </>
        )}
      </Svg>
    </View>
  );
}

// ── Stat cell ───────────────────────────────────────────────────────────────
function StatCell({
  icon, value, label, color, sub, onPress,
}: {
  icon?: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
  sub?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCell, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <View style={[styles.statCellIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statCellValue, { color: Colors.textPrimary }]} numberOfLines={1}>
          {value}
          {sub ? <Text style={styles.statCellSub}> /{sub}</Text> : null}
        </Text>
        <Text style={styles.statCellLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

// ── Completado cell (ring variant) ──────────────────────────────────────────
function CompletadoCell({ pct, onPress }: { pct: number; onPress?: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.statCell, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <MiniRing pct={pct} />
      <View style={{ flex: 1, marginLeft: 4 }}>
        <Text style={[styles.statCellValue, { color: Colors.textPrimary }]}>
          {pct}<Text style={styles.statCellSub}>%</Text>
        </Text>
        <Text style={styles.statCellLabel}>Completado</Text>
      </View>
    </Pressable>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)  return 'ahora mismo';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function flagEmoji(iso: string) {
  if (!/^[A-Za-z]{2}$/.test(iso)) return '';
  return iso.toUpperCase().split('').map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)).join('');
}

// ── Home screen ─────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const {
    getStats, getSectionStats, sections, stickers,
    getMissingStickers, getDuplicateStickers, quantities, history,
  } = useStickers();
  const stats  = getStats();
  const router = useRouter();
  const [scannerOpen, setScannerOpen] = useState(false);

  // Foil stats
  const foilTotal = stickers.filter(s => s.foil).length;
  const foilOwned = stickers.filter(s => s.foil && (quantities[s.code] ?? 0) > 0).length;

  const handleShareCambios = async () => {
    const missing    = getMissingStickers();
    const duplicates = getDuplicateStickers();

    const groupBySection = <T extends { teamCode: string }>(items: T[]) =>
      sections
        .map(sec => ({ sec, items: items.filter(s => s.teamCode === sec.code) }))
        .filter(g => g.items.length > 0);

    const buscoLines = groupBySection(missing).map(g => {
      const f = flagEmoji(g.sec.isoCode ?? '');
      return `${f ? f + ' ' : ''}${g.sec.name}\n${g.items.map(s => s.code).join(', ')}`;
    });
    const ofrezcoLines = groupBySection(duplicates).map(g => {
      const f = flagEmoji(g.sec.isoCode ?? '');
      const items = g.items.map(s => {
        const extras = (quantities[s.code] ?? 2) - 1;
        return extras > 1 ? `${s.code} (+${extras})` : s.code;
      }).join(', ');
      return `${f ? f + ' ' : ''}${g.sec.name}\n${items}`;
    });

    const parts: string[] = ['📋 Mis cambios - Panini Mundial 2026'];
    if (buscoLines.length > 0) {
      parts.push('', `🔍 BUSCO (${missing.length} cromos):`);
      buscoLines.forEach(l => parts.push('', l));
    }
    if (ofrezcoLines.length > 0) {
      const extras = duplicates.reduce((sum, s) => sum + s.extras, 0);
      parts.push('', `🔄 OFREZCO (${extras} cromos):`);
      ofrezcoLines.forEach(l => parts.push('', l));
    }
    await Share.share({ message: parts.join('\n') });
  };

  const topSections = sections
    .map(s => {
      const st = getSectionStats(s.code);
      return { ...s, pct: st.completionPct, owned: st.owned, total: st.total };
    })
    .filter(s => s.owned > 0)
    .sort((a, b) => b.pct - a.pct || b.owned - a.owned)
    .slice(0, 5);

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <LinearGradient colors={['#141E33', Colors.bg]} style={styles.header}>
          <Text style={[Typography.labelM, { color: Colors.red, letterSpacing: 4 }]}>PANINI ★ MUNDIAL 2026</Text>
          <Text style={[Typography.displayM, { color: Colors.textPrimary, marginTop: 4, textAlign: 'center' }]}>
            Mi Álbum
          </Text>
        </LinearGradient>

        {/* ── RESUMEN ── */}
        <View style={styles.resumeCard}>
          <LinearGradient
            colors={['#1C2640', '#111827', '#0B1120']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          />

          <Text style={styles.resumeTitle}>Resumen</Text>

          {/* Row 1 */}
          <View style={styles.statRow}>
            <CompletadoCell pct={stats.completionPct} />
            <View style={styles.statDividerV} />
            <StatCell
              icon={<Star size={18} color={Colors.gold} weight="fill" />}
              value={stats.total}
              label="Total"
              color={Colors.gold}
            />
          </View>

          <View style={styles.statDividerH} />

          {/* Row 2 */}
          <View style={styles.statRow}>
            <StatCell
              icon={<XCircle size={18} color={Colors.red} weight="fill" />}
              value={stats.missing}
              label="Me faltan"
              color={Colors.red}
              onPress={() => router.push('/(tabs)/faltan')}
            />
            <View style={styles.statDividerV} />
            <StatCell
              icon={<Trophy size={18} color={Colors.owned} weight="fill" />}
              value={stats.owned}
              label="Tengo"
              color={Colors.owned}
              onPress={() => router.push('/(tabs)/tengo')}
            />
          </View>

          <View style={styles.statDividerH} />

          {/* Row 3 */}
          <View style={styles.statRow}>
            <StatCell
              icon={<ArrowsClockwise size={18} color={Colors.duplicate} weight="fill" />}
              value={stats.duplicateCount}
              label="Repetidas"
              color={Colors.duplicate}
              onPress={() => router.push('/(tabs)/repetidos')}
            />
            <View style={styles.statDividerV} />
            <StatCell
              icon={<Sparkle size={18} color={Colors.gold} weight="fill" />}
              value={foilOwned}
              label="Brillantes"
              color={Colors.gold}
              sub={String(foilTotal)}
            />
          </View>
        </View>

        {/* Share */}
        {stats.owned > 0 && (
          <Pressable style={({ pressed }) => [styles.shareRow, pressed && { opacity: 0.7 }]} onPress={handleShareCambios}>
            <ShareNetwork size={16} color={Colors.textSecondary} weight="bold" />
            <Text style={[Typography.labelM, { color: Colors.textSecondary, marginLeft: 8 }]}>
              Compartir lista BUSCO / OFREZCO
            </Text>
          </Pressable>
        )}

        {/* Empty state */}
        {stats.owned === 0 && (
          <View style={styles.emptyState}>
            <Text style={[Typography.titleM, { color: Colors.textSecondary, textAlign: 'center', marginTop: 16 }]}>
              ¡Tu álbum está vacío!
            </Text>
            <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
              Toca "Escanear Sobre" para registrar tus primeros cromos
            </Text>
          </View>
        )}

        {/* Más avanzadas */}
        {stats.owned > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Star size={15} color={Colors.gold} weight="fill" />
              <Text style={[Typography.titleS, { color: Colors.textSecondary, marginLeft: 6, letterSpacing: 2 }]}>MÁS AVANZADAS</Text>
            </View>
            <View style={styles.topCard}>
              {topSections.map((s, i) => (
                <Pressable
                  key={s.code}
                  style={[styles.teamRow, i < topSections.length - 1 && styles.teamRowBorder]}
                  onPress={() => router.push(`/seleccion/${s.code}`)}
                >
                  <FlagImage isoCode={s.isoCode} size={24} style={{ borderRadius: 4 }} />
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>{s.name}</Text>
                      <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>({s.owned}/{s.total})</Text>
                    </View>
                    <View style={styles.miniBar}>
                      <View style={[styles.miniBarFill, { width: `${s.pct}%`, backgroundColor: s.pct === 100 ? Colors.owned : Colors.red }]} />
                    </View>
                  </View>
                  <Text style={[Typography.titleS, { color: s.pct === 100 ? Colors.owned : Colors.red }]}>{s.pct}%</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Actividad reciente */}
        {history.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ClockCounterClockwise size={15} color={Colors.textMuted} weight="fill" />
                <Text style={[Typography.titleS, { color: Colors.textSecondary, marginLeft: 6, letterSpacing: 2 }]}>ACTIVIDAD RECIENTE</Text>
              </View>
              <Pressable onPress={() => router.push('/(tabs)/historial')}>
                <Text style={[Typography.bodyS, { color: Colors.red }]}>Ver todo →</Text>
              </Pressable>
            </View>
            <View style={styles.topCard}>
              {history.slice(0, 8).map((entry, i) => {
                const isAdd = entry.action === 'add';
                const color = isAdd ? Colors.owned : Colors.red;
                return (
                  <View key={i} style={[styles.teamRow, i < Math.min(history.length, 8) - 1 && styles.teamRowBorder]}>
                    <View style={[styles.activityIcon, { backgroundColor: color + '20' }]}>
                      {isAdd ? <Plus size={12} color={color} weight="bold" /> : <Minus size={12} color={color} weight="bold" />}
                    </View>
                    <View style={{ flex: 1, marginHorizontal: 10 }}>
                      <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>
                        {entry.code} · {entry.name}
                      </Text>
                      <Text style={[Typography.bodyS, { color: Colors.textMuted }]} numberOfLines={1}>{entry.teamName}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {/* Estado del cromo */}
                      {isAdd && entry.qty === 1 && (
                        <View style={styles.badgeNew}>
                          <Text style={styles.badgeNewText}>nuevo</Text>
                        </View>
                      )}
                      {isAdd && entry.qty > 1 && (
                        <View style={styles.badgeDup}>
                          <CopySimple size={10} color={Colors.duplicate} weight="fill" />
                          <Text style={styles.badgeDupText}>{entry.qty - 1} {entry.qty - 1 === 1 ? 'repetido' : 'repetidos'}</Text>
                        </View>
                      )}
                      {!isAdd && entry.qty === 0 && (
                        <View style={styles.badgeRemoved}>
                          <Text style={styles.badgeRemovedText}>eliminado</Text>
                        </View>
                      )}
                      {!isAdd && entry.qty === 1 && (
                        <View style={styles.badgeNew}>
                          <Text style={styles.badgeNewText}>×1</Text>
                        </View>
                      )}
                      {!isAdd && entry.qty > 1 && (
                        <View style={styles.badgeDup}>
                          <CopySimple size={10} color={Colors.duplicate} weight="fill" />
                          <Text style={styles.badgeDupText}>{entry.qty - 1} {entry.qty - 1 === 1 ? 'repetido' : 'repetidos'}</Text>
                        </View>
                      )}
                      <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>{timeAgo(entry.timestamp)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] }]}
        onPress={() => setScannerOpen(true)}
      >
        <Camera size={20} color={Colors.textPrimary} weight="fill" />
        <Text style={styles.fabLabel}>Escanear Sobre</Text>
      </Pressable>

      <ScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen:    { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1 },
  content:   { flexGrow: 1 },
  header:    { paddingTop: 56, paddingBottom: 20, paddingHorizontal: Spacing.xl, alignItems: 'center' },

  /* ── Resumen card ── */
  resumeCard: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    borderRadius: Radii.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  resumeTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 13, color: Colors.textSecondary,
    letterSpacing: 0.5, paddingHorizontal: Spacing.lg, paddingTop: 14, paddingBottom: 8,
  },

  statRow: { flexDirection: 'row', alignItems: 'center' },
  statDividerH: { height: 1, backgroundColor: Colors.border + '80', marginHorizontal: 0 },
  statDividerV: { width: 1, alignSelf: 'stretch', backgroundColor: Colors.border + '80' },

  statCell: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: 14, gap: 12,
  },
  statCellIcon: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  statCellValue: {
    fontFamily: 'Oswald_600SemiBold', fontSize: 26, color: Colors.textPrimary, lineHeight: 30,
  },
  statCellSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.textMuted,
  },
  statCellLabel: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1,
  },

  /* ── Rest ── */
  shareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    paddingVertical: 10, paddingHorizontal: 18,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.bgCard,
  },
  emptyState: { alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.xxxl },
  section:       { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  topCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  teamRow:       { flexDirection: 'row', alignItems: 'center', padding: Spacing.md },
  teamRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  miniBar:       { height: 3, backgroundColor: Colors.bgCardAlt, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  miniBarFill:   { height: 3, borderRadius: 2 },
  activityIcon:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  /* Activity badges */
  badgeNew: {
    backgroundColor: Colors.owned + '20',
    borderWidth: 1, borderColor: Colors.owned + '50',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radii.full,
  },
  badgeNewText: {
    fontFamily: 'DMSans_700Bold', fontSize: 10, color: Colors.owned,
  },
  badgeDup: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: Colors.duplicate + '22',
    borderWidth: 1, borderColor: Colors.duplicate + '55',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radii.full,
  },
  badgeDupText: {
    fontFamily: 'DMSans_700Bold', fontSize: 10, color: Colors.duplicate,
  },
  badgeRemoved: {
    backgroundColor: Colors.red + '20',
    borderWidth: 1, borderColor: Colors.red + '50',
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: Radii.full,
  },
  badgeRemovedText: {
    fontFamily: 'DMSans_700Bold', fontSize: 10, color: Colors.red,
  },
  fab: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.red, paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: Radii.full, gap: 8, elevation: 8,
  },
  fabLabel: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.textPrimary, letterSpacing: 0.3 },
});
