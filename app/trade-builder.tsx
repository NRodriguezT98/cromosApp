import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  TextInput, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Sticker } from '@/context/StickersContext';
import {
  X, ArrowLeft, ArrowRight, Check, MagnifyingGlass, ArrowsLeftRight,
  ArrowDown, Swap, WarningCircle
} from 'phosphor-react-native';
import { FlagImage } from '@/components/ui/FlagImage';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ── helpers ────────────────────────────────────────────────────────────────

const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

function matchesQuery(s: Sticker, q: string): boolean {
  const n = normalize(q);
  return (
    normalize(s.code).includes(n) ||
    normalize(s.name).includes(n) ||
    normalize(s.teamName).includes(n)
  );
}

// ── Sticker row ─────────────────────────────────────────────────────────────

function StickerRow({
  sticker,
  selected,
  badge,
  onToggle,
}: {
  sticker: Sticker;
  selected: boolean;
  badge?: string;
  onToggle: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && { opacity: 0.75 }]}
      onPress={onToggle}
    >
      <FlagImage isoCode={sticker.isoCode} size={28} style={{ borderRadius: 4 }} />
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowCode}>{sticker.code}</Text>
          {badge ? (
            <View style={styles.badgeDup}>
              <Text style={styles.badgeDupText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowName} numberOfLines={1}>{sticker.name}</Text>
        <Text style={styles.rowTeam} numberOfLines={1}>{sticker.teamName}</Text>
      </View>
      <View style={[styles.checkCircle, selected && styles.checkCircleSelected]}>
        {selected && <Check size={12} color={Colors.white} weight="bold" />}
      </View>
    </Pressable>
  );
}

// ── Search bar ───────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const focusAnim = useRef(new Animated.Value(0)).current;
  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.textSecondary + '80'],
  });
  return (
    <Animated.View style={[styles.searchWrap, { borderColor }]}>
      <MagnifyingGlass size={14} color={Colors.textMuted} weight="bold" />
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por código, nombre o equipo…"
        placeholderTextColor={Colors.textMuted}
        value={value}
        onChangeText={onChange}
        autoCapitalize="characters"
        returnKeyType="search"
        onFocus={() => Animated.spring(focusAnim, { toValue: 1, useNativeDriver: false, tension: 100, friction: 12 }).start()}
        onBlur={() => Animated.spring(focusAnim, { toValue: 0, useNativeDriver: false, tension: 100, friction: 12 }).start()}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8}>
          <X size={14} color={Colors.textMuted} />
        </Pressable>
      )}
    </Animated.View>
  );
}

// ── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ step }: { step: number }) {
  return (
    <View style={styles.stepDots}>
      {[0, 1, 2].map(i => (
        <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
      ))}
    </View>
  );
}

// ── Selected chips (compact preview) ─────────────────────────────────────────

function SelectedChips({ codes, label, color }: { codes: string[]; label: string; color: string }) {
  if (codes.length === 0) return null;
  return (
    <View style={styles.chipsRow}>
      <Text style={[styles.chipsLabel, { color }]}>{label}:</Text>
      <Text style={[styles.chipsValue, { color }]} numberOfLines={1}>
        {codes.join(', ')}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TradeBuilderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendName?: string; filterGiven?: string; filterReceive?: string }>();
  
  const friendName = params.friendName;
  const filterGivenCodes = params.filterGiven ? params.filterGiven.split(',') : null;
  const filterReceiveCodes = params.filterReceive ? params.filterReceive.split(',') : null;

  const { getDuplicateStickers, getMissingStickers, stickers, addTrade } = useStickers();

  const [step, setStep] = useState(0);
  const [givenCodes, setGivenCodes] = useState<string[]>([]);
  const [receivedCodes, setReceivedCodes] = useState<string[]>([]);
  const [query1, setQuery1] = useState('');
  const [query2, setQuery2] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const successScale = useRef(new Animated.Value(0.8)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  // Filter the base datasets if we received a curated list
  const duplicates = useMemo(() => {
    const allDups = getDuplicateStickers();
    if (filterGivenCodes) {
      return allDups.filter(s => filterGivenCodes.includes(s.code));
    }
    return allDups;
  }, [getDuplicateStickers, filterGivenCodes]);

  const missing = useMemo(() => {
    const allMissing = getMissingStickers();
    if (filterReceiveCodes) {
      return allMissing.filter(s => filterReceiveCodes.includes(s.code));
    }
    return allMissing;
  }, [getMissingStickers, filterReceiveCodes]);
  
  const allAvailableReceive = useMemo(() => {
    if (filterReceiveCodes) {
      return stickers.filter(s => filterReceiveCodes.includes(s.code));
    }
    return stickers;
  }, [stickers, filterReceiveCodes]);

  const filteredDuplicates = useMemo(() => {
    const base = duplicates;
    return query1 ? base.filter(s => matchesQuery(s, query1)) : base;
  }, [duplicates, query1]);

  const filteredReceive = useMemo(() => {
    const base = showAll ? allAvailableReceive : missing;
    return query2 ? base.filter(s => matchesQuery(s, query2)) : base;
  }, [missing, allAvailableReceive, query2, showAll]);

  const toggleGiven = (code: string) => {
    setGivenCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleReceived = (code: string) => {
    setReceivedCodes(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleConfirm = () => {
    addTrade(givenCodes, receivedCodes, friendName || undefined);
    setConfirmed(true);
    Animated.parallel([
      Animated.spring(successScale,   { toValue: 1, useNativeDriver: true, tension: 70, friction: 9 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setTimeout(() => router.navigate('/(tabs)/intercambios'), 1800);
  };

  const givenStickers    = givenCodes.map(c => stickers.find(s => s.code === c)!).filter(Boolean);
  const receivedStickers = receivedCodes.map(c => stickers.find(s => s.code === c)!).filter(Boolean);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable
          style={styles.headerBtn}
          onPress={step === 0 ? () => router.back() : () => setStep(s => s - 1)}
          hitSlop={8}
        >
          {step === 0
            ? <X size={20} color={Colors.textSecondary} weight="bold" />
            : <ArrowLeft size={20} color={Colors.textSecondary} weight="bold" />
          }
        </Pressable>

        <View style={{ alignItems: 'center' }}>
          <View style={styles.headerIconWrap}>
            <Swap size={18} color={Colors.trade} weight="fill" />
          </View>
          <Text style={styles.headerTitle}>
            {step === 0 ? 'Lo que diste' : step === 1 ? 'Lo que recibiste' : 'Confirmar'}
          </Text>
        </View>

        <StepDots step={step} />
      </View>

      {/* ── Step 0: Select given (from duplicates) ── */}
      {step === 0 && (
        <View style={{ flex: 1 }}>
          <View style={styles.padH}>
            <Text style={styles.stepHint}>
              Seleccioná los cromos repetidos que vas a entregar.
            </Text>
            
            {friendName && (
              <View style={styles.curatedAlert}>
                <WarningCircle size={16} color={Colors.trade} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.curatedAlertText}>Mostrando solo cromos solicitados por {friendName}</Text>
                  {filterReceiveCodes && filterReceiveCodes.length > 0 && (
                    <Text style={[styles.curatedAlertText, { opacity: 0.8, marginTop: 2 }]}>
                      Te ofrece hasta {filterReceiveCodes.length} cromos a cambio.
                    </Text>
                  )}
                </View>
              </View>
            )}

            {filterReceiveCodes && filterReceiveCodes.length > 0 && givenCodes.length > filterReceiveCodes.length && (
              <View style={[styles.curatedAlert, { borderColor: Colors.duplicate + '40', backgroundColor: Colors.duplicate + '15' }]}>
                <WarningCircle size={16} color={Colors.duplicate} />
                <Text style={[styles.curatedAlertText, { color: Colors.duplicate }]}>
                  Estás seleccionando entregar más cromos ({givenCodes.length}) de los que tu amigo te ofrece a cambio ({filterReceiveCodes.length}).
                </Text>
              </View>
            )}

            <SearchBar value={query1} onChange={setQuery1} />
            <SelectedChips codes={givenCodes} label="Seleccionados" color={Colors.duplicate} />
          </View>

          {filteredDuplicates.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {duplicates.length === 0
                  ? 'No hay resultados disponibles en esta lista.'
                  : 'Sin resultados para esa búsqueda.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredDuplicates}
              keyExtractor={s => s.code}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <StickerRow
                  sticker={item}
                  selected={givenCodes.includes(item.code)}
                  badge={`+${item.extras}`}
                  onToggle={() => toggleGiven(item.code)}
                />
              )}
            />
          )}

          <View style={styles.footer}>
            <Pressable
              style={[styles.btn, givenCodes.length === 0 && styles.btnDisabled]}
              disabled={givenCodes.length === 0}
              onPress={() => setStep(1)}
            >
              <Text style={styles.btnText}>
                {givenCodes.length === 0
                  ? 'Elegí al menos uno'
                  : `Continuar (${givenCodes.length} seleccionado${givenCodes.length !== 1 ? 's' : ''})`}
              </Text>
              {givenCodes.length > 0 && <ArrowRight size={16} color={Colors.white} weight="bold" />}
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 1: Select received ── */}
      {step === 1 && (
        <View style={{ flex: 1 }}>
          <View style={styles.padH}>
            <Text style={styles.stepHint}>
              Seleccioná los cromos que recibís a cambio.
            </Text>

            {/* Balance en tiempo real */}
            <View style={styles.balanceBar}>
              <View style={styles.balanceSide}>
                <Text style={[styles.balanceCount, { color: Colors.duplicate }]}>{givenCodes.length}</Text>
                <Text style={styles.balanceTag}>DISTE</Text>
              </View>

              <View style={styles.balanceCenter}>
                <ArrowsLeftRight size={16} color={Colors.textMuted} />
                {receivedCodes.length === 0 && (
                  <Text style={styles.balanceHint}>0 sel.</Text>
                )}
                {receivedCodes.length > 0 && receivedCodes.length < givenCodes.length && (
                  <View style={[styles.balancePill, { backgroundColor: Colors.duplicate + '20', borderColor: Colors.duplicate + '50' }]}>
                    <Text style={[styles.balancePillText, { color: Colors.duplicate }]}>
                      {givenCodes.length - receivedCodes.length} pendiente{givenCodes.length - receivedCodes.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                )}
                {receivedCodes.length === givenCodes.length && receivedCodes.length > 0 && (
                  <View style={[styles.balancePill, { backgroundColor: Colors.owned + '20', borderColor: Colors.owned + '50' }]}>
                    <Check size={10} color={Colors.owned} weight="bold" />
                    <Text style={[styles.balancePillText, { color: Colors.owned }]}>Equilibrado</Text>
                  </View>
                )}
                {receivedCodes.length > givenCodes.length && (
                  <View style={[styles.balancePill, { backgroundColor: Colors.trade + '20', borderColor: Colors.trade + '50' }]}>
                    <Text style={[styles.balancePillText, { color: Colors.trade }]}>
                      +{receivedCodes.length - givenCodes.length} a tu favor
                    </Text>
                  </View>
                )}
              </View>

              <View style={[styles.balanceSide, { alignItems: 'flex-end' }]}>
                <Text style={[styles.balanceCount, { color: receivedCodes.length === givenCodes.length && receivedCodes.length > 0 ? Colors.owned : Colors.textPrimary }]}>
                  {receivedCodes.length}
                </Text>
                <Text style={styles.balanceTag}>RECIBIRÁS</Text>
              </View>
            </View>

            {friendName && (
              <View style={styles.curatedAlert}>
                <WarningCircle size={16} color={Colors.trade} />
                <Text style={styles.curatedAlertText}>Mostrando solo cromos ofrecidos por {friendName}</Text>
              </View>
            )}

            <SearchBar value={query2} onChange={setQuery2} />

            {/* Toggle: sólo faltantes / todos */}
            <View style={styles.toggleRow}>
              <Pressable
                style={[styles.toggleBtn, !showAll && styles.toggleBtnActive]}
                onPress={() => { setShowAll(false); setQuery2(''); }}
              >
                <Text style={[styles.toggleBtnText, !showAll && styles.toggleBtnTextActive]}>
                  Mis faltantes
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, showAll && styles.toggleBtnActive]}
                onPress={() => { setShowAll(true); setQuery2(''); }}
              >
                <Text style={[styles.toggleBtnText, showAll && styles.toggleBtnTextActive]}>
                  {friendName ? `Toda la oferta` : `Todos los cromos`}
                </Text>
              </Pressable>
            </View>

            <SelectedChips codes={receivedCodes} label="Seleccionados" color={Colors.owned} />
          </View>

          {filteredReceive.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>Sin resultados para esa búsqueda.</Text>
            </View>
          ) : (
            <FlatList
              data={filteredReceive}
              keyExtractor={s => s.code}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <StickerRow
                  sticker={item}
                  selected={receivedCodes.includes(item.code)}
                  onToggle={() => toggleReceived(item.code)}
                />
              )}
            />
          )}

          <View style={styles.footer}>
            <Pressable
              style={[styles.btn, receivedCodes.length === 0 && styles.btnDisabled]}
              disabled={receivedCodes.length === 0}
              onPress={() => setStep(2)}
            >
              <Text style={styles.btnText}>
                {receivedCodes.length === 0
                  ? 'Elegí al menos uno'
                  : `Ver resumen (${receivedCodes.length} seleccionado${receivedCodes.length !== 1 ? 's' : ''})`}
              </Text>
              {receivedCodes.length > 0 && <ArrowRight size={16} color={Colors.white} weight="bold" />}
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Step 2: Confirm ── */}
      {step === 2 && (
        <View style={{ flex: 1 }}>
          <View style={[styles.padH, { flex: 1 }]}>
            <Text style={styles.stepHint}>
              Revisá el intercambio antes de confirmarlo. Se actualizarán tus cantidades automáticamente.
            </Text>
            
            {friendName && (
              <Text style={[styles.stepHint, { marginTop: 0, color: Colors.trade }]}>
                Intercambio con: {friendName}
              </Text>
            )}

            {givenCodes.length > 0 && receivedCodes.length > 0 && givenCodes.length !== receivedCodes.length && (
              <View style={[styles.curatedAlert, { borderColor: Colors.duplicate + '40', backgroundColor: Colors.duplicate + '15', marginTop: Spacing.sm }]}>
                <WarningCircle size={16} color={Colors.duplicate} />
                <Text style={[styles.curatedAlertText, { color: Colors.duplicate }]}>
                  El intercambio no es equitativo.
                  {receivedCodes.length > givenCodes.length 
                    ? ` Estás pidiendo ${receivedCodes.length} por ${givenCodes.length}.`
                    : ` Estás dando ${givenCodes.length} por ${receivedCodes.length}.`}
                </Text>
              </View>
            )}

            <View style={styles.summaryCard}>
              {/* Diste */}
              <View style={styles.summarySection}>
                <View style={styles.summaryLabelRow}>
                  <View style={[styles.summaryDot, { backgroundColor: Colors.duplicate }]} />
                  <Text style={[styles.summaryLabel, { color: Colors.duplicate }]}>
                    DISTE ({givenStickers.length})
                  </Text>
                </View>
                {givenStickers.map(s => (
                  <View key={s.code} style={styles.summaryRow}>
                    <Text style={styles.summaryCode}>{s.code}</Text>
                    <Text style={styles.summaryName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.summaryTeam} numberOfLines={1}>{s.teamName}</Text>
                  </View>
                ))}
              </View>

              {/* Separator */}
              <View style={styles.summarySep}>
                <View style={styles.separatorLine} />
                <View style={styles.separatorIcon}>
                  <ArrowDown size={14} color={Colors.trade} weight="bold" />
                </View>
                <View style={styles.separatorLine} />
              </View>

              {/* Recibiste */}
              <View style={styles.summarySection}>
                <View style={styles.summaryLabelRow}>
                  <View style={[styles.summaryDot, { backgroundColor: Colors.owned }]} />
                  <Text style={[styles.summaryLabel, { color: Colors.owned }]}>
                    RECIBISTE ({receivedStickers.length})
                  </Text>
                </View>
                {receivedStickers.map(s => (
                  <View key={s.code} style={styles.summaryRow}>
                    <Text style={styles.summaryCode}>{s.code}</Text>
                    <Text style={styles.summaryName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.summaryTeam} numberOfLines={1}>{s.teamName}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Pressable style={styles.btn} onPress={handleConfirm}>
              <ArrowsLeftRight size={16} color={Colors.white} weight="bold" />
              <Text style={styles.btnText}>Confirmar intercambio</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ── Success overlay ── */}
      {confirmed && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]}>
          <Animated.View style={[styles.successCard, { transform: [{ scale: successScale }] }]}>
            <View style={styles.successIconWrap}>
              <Check size={38} color={Colors.white} weight="bold" />
            </View>
            <Text style={styles.successTitle}>¡Intercambio registrado!</Text>
            <Text style={styles.successSub}>
              {givenCodes.length} cromo{givenCodes.length !== 1 ? 's' : ''} dado{givenCodes.length !== 1 ? 's' : ''}
              {' · '}
              {receivedCodes.length} recibido{receivedCodes.length !== 1 ? 's' : ''}
            </Text>
          </Animated.View>
        </Animated.View>
      )}

    </KeyboardAvoidingView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.trade + '20',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  headerTitle: { ...Typography.labelL, color: Colors.textPrimary },

  stepDots: { flexDirection: 'row', gap: 5, width: 36, justifyContent: 'flex-end' },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.trade },

  padH:      { paddingHorizontal: Spacing.lg },
  stepHint:  { ...Typography.bodyS, color: Colors.textMuted, marginTop: Spacing.md, marginBottom: Spacing.md },
  
  curatedAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.trade + '15', padding: Spacing.sm,
    borderRadius: Radii.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.trade + '40'
  },
  curatedAlertText: { ...Typography.bodyS, color: Colors.trade, flex: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1, ...Typography.bodyM, color: Colors.textPrimary, padding: 0,
  },

  toggleRow:   { flexDirection: 'row', gap: 8, marginBottom: Spacing.sm },
  toggleBtn:   {
    flex: 1, paddingVertical: 8, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: Colors.trade + '20', borderColor: Colors.trade + '60' },
  toggleBtnText:   { ...Typography.labelM, color: Colors.textMuted },
  toggleBtnTextActive: { color: Colors.trade },

  balanceBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  balanceSide:   { flex: 1 },
  balanceCenter: { alignItems: 'center', paddingHorizontal: Spacing.md, gap: 6 },
  balanceCount:  { fontFamily: 'Oswald_700Bold', fontSize: 30, lineHeight: 32 },
  balanceTag:    { fontFamily: 'DMSans_500Medium', fontSize: 9, letterSpacing: 1.5, color: Colors.textMuted, marginTop: 2 },
  balanceHint:   { fontFamily: 'DMSans_400Regular', fontSize: 10, color: Colors.textMuted },
  balancePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: Radii.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  balancePillText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },

  chipsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    marginBottom: Spacing.sm,
  },
  chipsLabel: { ...Typography.labelS, letterSpacing: 1 },
  chipsValue: { ...Typography.bodyS, flex: 1 },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxxl },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md, marginBottom: 4,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowSelected: { borderColor: Colors.trade + '60', backgroundColor: Colors.trade + '10' },
  rowCode:  { ...Typography.codeL, color: Colors.textPrimary },
  rowName:  { ...Typography.bodyS, color: Colors.textSecondary, marginTop: 1 },
  rowTeam:  { ...Typography.bodyS, color: Colors.textMuted },

  badgeDup: {
    backgroundColor: Colors.duplicate + '22', borderWidth: 1, borderColor: Colors.duplicate + '55',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radii.full,
  },
  badgeDupText: { ...Typography.labelS, color: Colors.duplicate },

  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkCircleSelected: { backgroundColor: Colors.trade, borderColor: Colors.trade },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyText:  { ...Typography.bodyM, color: Colors.textMuted, textAlign: 'center' },

  footer: {
    paddingHorizontal: Spacing.lg, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.trade, borderRadius: Radii.full,
    paddingVertical: 14, paddingHorizontal: Spacing.xl,
  },
  btnDisabled: { backgroundColor: Colors.bgCardAlt },
  btnText:     { ...Typography.labelL, color: Colors.white, letterSpacing: 0.5 },

  summaryCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: Spacing.sm, padding: Spacing.lg,
  },
  summarySection:  {},
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  summaryDot:      { width: 8, height: 8, borderRadius: 4 },
  summaryLabel:    { ...Typography.labelS, letterSpacing: 1.5 },
  summaryRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  summaryCode:     { ...Typography.codeM, color: Colors.textPrimary, minWidth: 48 },
  summaryName:     { ...Typography.bodyS, color: Colors.textSecondary, flex: 1 },
  summaryTeam:     { ...Typography.bodyS, color: Colors.textMuted },

  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,17,32,0.88)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
  },
  successCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.xl,
    borderWidth: 1, borderColor: Colors.owned + '50',
    paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xxxl,
    alignItems: 'center', gap: 10, minWidth: 260,
  },
  successIconWrap: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: Colors.owned,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    shadowColor: Colors.owned, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
  },
  successTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 20,
    color: Colors.textPrimary, textAlign: 'center',
  },
  successSub: {
    fontFamily: 'DMSans_400Regular', fontSize: 13,
    color: Colors.textMuted, textAlign: 'center',
  },

  summarySep: {
    flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  separatorIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.trade + '20', borderWidth: 1, borderColor: Colors.trade + '40',
    alignItems: 'center', justifyContent: 'center', marginHorizontal: 8,
  },
});
