import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, SectionList, Platform, Modal, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, TradeEntry } from '@/context/StickersContext';
import { Plus, Swap, Trash, ArrowDown, ArrowsLeftRight, ArrowUp, Warning } from 'phosphor-react-native';
import { TradeModal } from '@/components/ui/TradeModal';

// Tab bar height + safe area
const TAB_OFFSET = Platform.OS === 'ios' ? 100 : 80;

// ── helpers ────────────────────────────────────────────────────────────────

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

// ── Trade card ────────────────────────────────────────────────────────────────

function TradeCard({ trade, onDelete }: { trade: TradeEntry; onDelete: () => void }) {
  const MAX_SHOW = 3;
  const givenExtra    = trade.given.length - MAX_SHOW;
  const receivedExtra = trade.received.length - MAX_SHOW;

  return (
    <View style={styles.tradeCard}>
      <View style={styles.tradeCardHeader}>
        <View style={styles.tradeIconWrap}>
          <Swap size={13} color={Colors.trade} weight="fill" />
        </View>
        <Text style={styles.tradeTime}>{formatTime(trade.timestamp)}</Text>
        <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
          <Trash size={14} color={Colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.tradeBody}>
        <View style={styles.tradeSection}>
          <Text style={[styles.tradeSectionLabel, { color: Colors.duplicate }]}>DISTE</Text>
          {trade.given.slice(0, MAX_SHOW).map(s => (
            <View key={s.code} style={styles.tradeRow}>
              <Text style={styles.tradeCode}>{s.code}</Text>
              <Text style={styles.tradeName} numberOfLines={1}>{s.name}</Text>
            </View>
          ))}
          {givenExtra > 0 && <Text style={styles.tradeMore}>+{givenExtra} más</Text>}
        </View>

        <View style={styles.tradeSepCol}>
          <View style={styles.tradeSepLine} />
          <View style={styles.tradeSepIcon}>
            <ArrowDown size={10} color={Colors.trade} weight="bold" />
          </View>
          <View style={styles.tradeSepLine} />
        </View>

        <View style={[styles.tradeSection, { flex: 1 }]}>
          <Text style={[styles.tradeSectionLabel, { color: Colors.owned }]}>RECIBISTE</Text>
          {trade.received.slice(0, MAX_SHOW).map(s => (
            <View key={s.code} style={styles.tradeRow}>
              <Text style={styles.tradeCode}>{s.code}</Text>
              <Text style={styles.tradeName} numberOfLines={1}>{s.name}</Text>
            </View>
          ))}
          {receivedExtra > 0 && <Text style={styles.tradeMore}>+{receivedExtra} más</Text>}
        </View>
      </View>
    </View>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.emptyState}>
      {/* Glow rings */}
      <View style={styles.emptyGlowOuter}>
        <View style={styles.emptyGlowMid}>
          <View style={styles.emptyGlowInner}>
            <LinearGradient
              colors={[Colors.trade + 'CC', Colors.trade + '44']}
              style={styles.emptyIconGrad}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <ArrowsLeftRight size={40} color={Colors.white} weight="fill" />
            </LinearGradient>
          </View>
        </View>
      </View>

      <Text style={styles.emptyLabel}>CAMBIATON</Text>
      <Text style={styles.emptyTitle}>¡Registrá tus{'\n'}intercambios!</Text>
      <Text style={styles.emptyBody}>
        Llevá el historial de cada cromo que diste y recibiste. Ideal para la Cambiaton.
      </Text>

      {/* Decorative feature pills */}
      <View style={styles.emptyPills}>
        <View style={styles.emptyPill}>
          <View style={[styles.emptyPillDot, { backgroundColor: Colors.duplicate }]} />
          <Text style={styles.emptyPillText}>Lo que diste</Text>
        </View>
        <View style={styles.emptyPillSep} />
        <View style={styles.emptyPill}>
          <View style={[styles.emptyPillDot, { backgroundColor: Colors.owned }]} />
          <Text style={styles.emptyPillText}>Lo que recibiste</Text>
        </View>
        <View style={styles.emptyPillSep} />
        <View style={styles.emptyPill}>
          <View style={[styles.emptyPillDot, { backgroundColor: Colors.trade }]} />
          <Text style={styles.emptyPillText}>Historial completo</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.85 }]}
        onPress={onPress}
      >
        <LinearGradient
          colors={[Colors.trade, '#4F46E5']}
          style={styles.emptyBtnGrad}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        >
          <Plus size={18} color={Colors.white} weight="bold" />
          <Text style={styles.emptyBtnText}>Registrar primer intercambio</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

// ── Delete confirmation sheet ─────────────────────────────────────────────────

function DeleteConfirmSheet({
  trade,
  quantities,
  onConfirm,
  onCancel,
}: {
  trade: TradeEntry;
  quantities: Record<string, number>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Split received stickers into: will be removed vs already gone
  const toRemove  = trade.received.filter(s => (quantities[s.code] ?? 0) > 0);
  const alreadyGone = trade.received.filter(s => (quantities[s.code] ?? 0) === 0);

  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={sheet.backdrop} onPress={onCancel}>
        <Pressable style={sheet.card} onPress={() => {}}>
          {/* Icon */}
          <View style={sheet.iconWrap}>
            <Warning size={28} color={Colors.red} weight="fill" />
          </View>

          <Text style={sheet.title}>Revertir intercambio</Text>

          {/* Sticker lists */}
          <View style={sheet.listsRow}>
            {/* Given → come back */}
            <View style={sheet.listCol}>
              <View style={sheet.listHeader}>
                <ArrowUp size={11} color={Colors.owned} weight="bold" />
                <Text style={[sheet.listTitle, { color: Colors.owned }]}>VUELVEN</Text>
              </View>
              <ScrollView style={{ maxHeight: 100 }} showsVerticalScrollIndicator={false}>
                {trade.given.map(s => (
                  <View key={s.code} style={sheet.stickerRow}>
                    <Text style={sheet.stickerCode}>{s.code}</Text>
                    <Text style={sheet.stickerName} numberOfLines={1}>{s.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={sheet.listDivider} />

            {/* Received → what happens */}
            <View style={sheet.listCol}>
              <View style={sheet.listHeader}>
                <ArrowDown size={11} color={Colors.red} weight="bold" />
                <Text style={[sheet.listTitle, { color: Colors.red }]}>SE QUITAN</Text>
              </View>
              <ScrollView style={{ maxHeight: 100 }} showsVerticalScrollIndicator={false}>
                {toRemove.map(s => (
                  <View key={s.code} style={sheet.stickerRow}>
                    <Text style={sheet.stickerCode}>{s.code}</Text>
                    <Text style={sheet.stickerName} numberOfLines={1}>{s.name}</Text>
                  </View>
                ))}
                {alreadyGone.map(s => (
                  <View key={s.code} style={[sheet.stickerRow, { opacity: 0.4 }]}>
                    <Text style={sheet.stickerCode}>{s.code}</Text>
                    <Text style={[sheet.stickerName, { fontStyle: 'italic' }]} numberOfLines={1}>
                      {s.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Contextual note */}
          {alreadyGone.length > 0 && toRemove.length === 0 && (
            <View style={sheet.note}>
              <Text style={sheet.noteText}>
                Los cromos que recibiste ya no están en tu álbum. Solo volverán los que diste.
              </Text>
            </View>
          )}
          {alreadyGone.length > 0 && toRemove.length > 0 && (
            <View style={sheet.note}>
              <Text style={sheet.noteText}>
                Los cromos en gris ya no están en tu álbum y no se quitarán. Los demás se descuentan del total actual, independientemente de su origen.
              </Text>
            </View>
          )}
          {alreadyGone.length === 0 && toRemove.length > 0 && (
            <View style={sheet.note}>
              <Text style={sheet.noteText}>
                Si alguno de los cromos recibidos fue obtenido también en otro intercambio, igual se descontará uno del total.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={sheet.actions}>
            <Pressable
              style={({ pressed }) => [sheet.btnCancel, pressed && { opacity: 0.7 }]}
              onPress={onCancel}
            >
              <Text style={sheet.btnCancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [sheet.btnConfirm, pressed && { opacity: 0.7 }]}
              onPress={onConfirm}
            >
              <Trash size={15} color={Colors.white} weight="fill" />
              <Text style={sheet.btnConfirmText}>Revertir</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type DaySection = { title: string; data: TradeEntry[] };

export default function IntercambiosScreen() {
  const { trades, deleteTrade, quantities } = useStickers();
  const [modalOpen, setModalOpen]           = useState(false);
  const [pendingDelete, setPendingDelete]   = useState<TradeEntry | null>(null);

  const sections: DaySection[] = useMemo(() => {
    const groups: Record<string, TradeEntry[]> = {};
    for (const t of trades) {
      const key = formatDay(t.timestamp);
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  }, [trades]);

  const handleDelete = (id: string) => {
    const trade = trades.find(t => t.id === id);
    if (trade) setPendingDelete(trade);
  };

  const confirmDelete = () => {
    if (pendingDelete) deleteTrade(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <View style={styles.screen}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Intercambios</Text>
        {trades.length > 0 && (
          <Text style={styles.headerSub}>{trades.length} registrado{trades.length !== 1 ? 's' : ''}</Text>
        )}
      </View>

      {trades.length === 0 ? (
        <EmptyState onPress={() => setModalOpen(true)} />
      ) : (
        <>
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderSectionHeader={({ section }) => (
              <View style={styles.dayHeader}>
                <Text style={styles.dayTitle}>{section.title}</Text>
                <Text style={styles.dayCount}>{section.data.length} intercambio{section.data.length !== 1 ? 's' : ''}</Text>
              </View>
            )}
            renderItem={({ item }) => (
              <TradeCard trade={item} onDelete={() => handleDelete(item.id)} />
            )}
            stickySectionHeadersEnabled={false}
          />

          {/* FAB — solo visible cuando hay trades */}
          <Pressable
            style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
            onPress={() => setModalOpen(true)}
          >
            <Plus size={20} color={Colors.white} weight="bold" />
            <Text style={styles.fabText}>Registrar intercambio</Text>
          </Pressable>
        </>
      )}

      <TradeModal visible={modalOpen} onClose={() => setModalOpen(false)} />

      {pendingDelete && (
        <DeleteConfirmSheet
          trade={pendingDelete}
          quantities={quantities}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.titleXL, color: Colors.textPrimary },
  headerSub:   { ...Typography.bodyS, color: Colors.textMuted, marginTop: 4 },

  listContent: { padding: Spacing.lg, paddingBottom: TAB_OFFSET + 60 },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.sm, marginTop: Spacing.md,
  },
  dayTitle: { ...Typography.labelM, color: Colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  dayCount: { ...Typography.bodyS, color: Colors.textMuted },

  tradeCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.sm, overflow: 'hidden',
  },
  tradeCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  tradeIconWrap: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.trade + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  tradeTime:  { ...Typography.bodyS, color: Colors.textMuted, flex: 1 },
  deleteBtn:  { padding: 4 },

  tradeBody:         { flexDirection: 'row', padding: Spacing.md },
  tradeSection:      { flex: 1 },
  tradeSectionLabel: { ...Typography.labelS, letterSpacing: 1.5, marginBottom: 6 },
  tradeRow:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  tradeCode:         { ...Typography.codeM, color: Colors.textPrimary, minWidth: 46 },
  tradeName:         { ...Typography.bodyS, color: Colors.textSecondary, flex: 1 },
  tradeMore:         { ...Typography.bodyS, color: Colors.textMuted, marginTop: 2 },

  tradeSepCol: { width: 28, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
  tradeSepLine: { flex: 1, width: 1, backgroundColor: Colors.border },
  tradeSepIcon: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.trade + '20', borderWidth: 1, borderColor: Colors.trade + '40',
    alignItems: 'center', justifyContent: 'center', marginVertical: 4,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, paddingBottom: TAB_OFFSET,
  },

  emptyGlowOuter: {
    width: 180, height: 180, borderRadius: 90,
    backgroundColor: Colors.trade + '08',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  emptyGlowMid: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: Colors.trade + '12',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyGlowInner: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.trade + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  emptyIconGrad: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center', justifyContent: 'center',
  },

  emptyLabel: {
    ...Typography.labelS, color: Colors.trade, letterSpacing: 4,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.displayM, color: Colors.textPrimary,
    textAlign: 'center', marginBottom: Spacing.md, lineHeight: 44,
  },
  emptyBody: {
    ...Typography.bodyM, color: Colors.textMuted,
    textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl,
  },

  emptyPills: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    marginBottom: Spacing.xl, gap: 0,
  },
  emptyPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 6 },
  emptyPillDot: { width: 6, height: 6, borderRadius: 3 },
  emptyPillText: { ...Typography.labelS, color: Colors.textMuted },
  emptyPillSep: { width: 1, height: 14, backgroundColor: Colors.border },

  emptyBtn:     { borderRadius: Radii.full, overflow: 'hidden', width: '100%' },
  emptyBtnGrad: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 16, paddingHorizontal: Spacing.xl, borderRadius: Radii.full,
  },
  emptyBtnText: { ...Typography.labelL, color: Colors.white, letterSpacing: 0.5 },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: TAB_OFFSET + Spacing.md,
    left: Spacing.lg, right: Spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.trade, borderRadius: Radii.full,
    paddingVertical: 15,
    shadowColor: Colors.trade,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: { ...Typography.labelL, color: Colors.white, letterSpacing: 0.5 },
});

// ── Delete sheet styles ────────────────────────────────────────────────────────
const sheet = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%', backgroundColor: Colors.bgCard,
    borderRadius: Radii.xl, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.lg, gap: 12,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.red + '18',
    borderWidth: 1, borderColor: Colors.red + '30',
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    ...Typography.titleM, color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.bodyS, color: Colors.textMuted,
    textAlign: 'center', lineHeight: 18,
  },
  listsRow: {
    flexDirection: 'row', gap: 0,
    backgroundColor: Colors.bg,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginVertical: 4,
  },
  listCol:    { flex: 1, padding: Spacing.sm },
  listDivider: { width: 1, backgroundColor: Colors.border },
  listHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginBottom: 6,
  },
  listTitle: {
    ...Typography.labelS, letterSpacing: 1.2,
  },
  stickerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3,
  },
  stickerCode: {
    ...Typography.codeM, color: Colors.textSecondary,
    minWidth: 38,
  },
  stickerName: {
    ...Typography.bodyS, color: Colors.textMuted, flex: 1,
  },
  actions: {
    flexDirection: 'row', gap: 10, marginTop: 4,
  },
  btnCancel: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 13, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
  },
  btnCancelText: {
    ...Typography.labelM, color: Colors.textSecondary,
  },
  btnConfirm: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: Radii.full,
    backgroundColor: Colors.red,
  },
  btnConfirmText: {
    ...Typography.labelM, color: Colors.white,
  },
  note: {
    backgroundColor: Colors.bgCardAlt,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  noteText: {
    ...Typography.bodyS, color: Colors.textMuted, lineHeight: 17,
  },
});
