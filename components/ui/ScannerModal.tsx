import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Sticker } from '@/context/StickersContext';
import {
  XIcon, CheckCircleIcon, ArrowCounterClockwiseIcon, CameraSlashIcon,
  CheckSquareIcon, SquareIcon, KeyboardIcon, PlusIcon, ArrowLeftIcon,
  WarningCircleIcon,
} from 'phosphor-react-native';

// Matches "ARG 1", "ARG1", "ECU 3", "FWC4", etc.
const CODE_RE = /\b([A-Z]{2,4})\s*(\d{1,2})\b/g;

type Phase = 'camera' | 'review' | 'manual';
type Candidate = { sticker: Sticker; selected: boolean };
type Registered = { sticker: Sticker; qty: number };

interface Props { visible: boolean; onClose: () => void; }

export function ScannerModal({ visible, onClose }: Props) {
  const { stickers, increment, quantities } = useStickers();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase]           = useState<Phase>('camera');
  const [capturing, setCapturing]   = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [noMatch, setNoMatch]       = useState(false);
  const [registered, setRegistered] = useState<Registered[]>([]);
  const [manualQuery, setManualQuery] = useState('');

  const stickerMap = useMemo(() => {
    const m = new Map<string, Sticker>();
    stickers.forEach(s => m.set(s.code.toUpperCase(), s));
    return m;
  }, [stickers]);

  // ── manual search ──────────────────────────────────────────────────────────
  const manualResults = useMemo(() => {
    const q = manualQuery.trim().toUpperCase();
    if (q.length < 1) return [];
    return stickers
      .filter(s => s.code.toUpperCase().startsWith(q) || s.code.toUpperCase().includes(q))
      .slice(0, 6);
  }, [manualQuery, stickers]);

  // ── capture ────────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setNoMatch(false);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, skipProcessing: true });
      const result = await TextRecognition.recognize(photo.uri);

      if (result?.text) {
        const upper = result.text.toUpperCase();
        const found: Sticker[] = [];
        let m: RegExpExecArray | null;
        CODE_RE.lastIndex = 0;
        while ((m = CODE_RE.exec(upper)) !== null) {
          const key = m[1] + m[2]; // e.g. "ARG" + "1" = "ARG1"
          const s = stickerMap.get(key);
          if (s && !found.some(f => f.code === s.code)) found.push(s);
        }
        if (found.length > 0) {
          setCandidates(found.map(s => ({ sticker: s, selected: true })));
          setPhase('review');
        } else {
          setNoMatch(true);
        }
      } else {
        setNoMatch(true);
      }
    } catch {
      setNoMatch(true);
    }
    setCapturing(false);
  }, [capturing, stickerMap]);

  // ── toggle selection ───────────────────────────────────────────────────────
  const toggleCandidate = (code: string) => {
    setCandidates(prev => prev.map(c =>
      c.sticker.code === code ? { ...c, selected: !c.selected } : c,
    ));
  };

  // ── confirm selected ───────────────────────────────────────────────────────
  const handleConfirmSelected = () => {
    const selected = candidates.filter(c => c.selected);
    selected.forEach(c => increment(c.sticker.code));
    setRegistered(prev => {
      const next = [...prev];
      selected.forEach(({ sticker }) => {
        const qty = (quantities[sticker.code] ?? 0) + 1;
        const idx = next.findIndex(r => r.sticker.code === sticker.code);
        if (idx >= 0) next[idx] = { sticker, qty };
        else next.unshift({ sticker, qty });
      });
      return next;
    });
    setCandidates([]);
    setPhase('camera');
    setNoMatch(false);
  };

  // ── add single from manual ─────────────────────────────────────────────────
  const handleManualAdd = (sticker: Sticker) => {
    increment(sticker.code);
    const qty = (quantities[sticker.code] ?? 0) + 1;
    setRegistered(prev => {
      const idx = prev.findIndex(r => r.sticker.code === sticker.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { sticker, qty };
        return next;
      }
      return [{ sticker, qty }, ...prev];
    });
    setManualQuery('');
  };

  // ── close ──────────────────────────────────────────────────────────────────
  const handleClose = () => {
    setPhase('camera'); setCandidates([]); setNoMatch(false);
    setRegistered([]); setManualQuery(''); onClose();
  };

  const selectedCount = candidates.filter(c => c.selected).length;

  // ── permission loading ─────────────────────────────────────────────────────
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
        <View style={styles.centered}><ActivityIndicator color={Colors.red} size="large" /></View>
      </Modal>
    );
  }

  // ── permission denied ──────────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
        <View style={styles.centered}>
          <View style={styles.permCard}>
            <CameraSlashIcon size={40} color={Colors.textMuted} />
            <Text style={[Typography.titleM, { color: Colors.textPrimary, textAlign: 'center', marginTop: 16 }]}>
              Se necesita la cámara
            </Text>
            <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
              Permite el acceso para escanear los códigos de tus cromos.
            </Text>
            <Pressable style={styles.permBtn} onPress={requestPermission}>
              <Text style={[Typography.labelL, { color: Colors.textPrimary }]}>Permitir cámara</Text>
            </Pressable>
            <Pressable onPress={handleClose} style={{ marginTop: 12 }}>
              <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>

        {/* Camera always in background */}
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

        {/* ── PHASE: camera ── */}
        {phase === 'camera' && (
          <>
            {/* Scan frame */}
            <View style={[styles.frameWrap, { pointerEvents: 'none' }]}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>

            {noMatch && (
              <View style={styles.noMatchBanner}>
                <WarningCircleIcon size={16} color={Colors.red} weight="fill" />
                <Text style={styles.noMatchText}>No se detectaron códigos. Intenta con mejor iluminación.</Text>
              </View>
            )}

            <Text style={styles.scanHint}>
              Apunta a los cromos y toca el botón para capturar
            </Text>

            <View style={styles.captureWrap}>
              {capturing
                ? <ActivityIndicator size="large" color={Colors.red} />
                : (
                  <Pressable
                    style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
                    onPress={handleCapture}
                  >
                    <View style={styles.captureBtnInner} />
                  </Pressable>
                )
              }
            </View>

            {/* Manual entry shortcut */}
            <Pressable style={styles.manualFab} onPress={() => setPhase('manual')}>
              <KeyboardIcon size={16} color="#fff" weight="bold" />
              <Text style={styles.manualFabLabel}>Ingresar manualmente</Text>
            </Pressable>
          </>
        )}

        {/* ── PHASE: review ── */}
        {phase === 'review' && (
          <KeyboardAvoidingView
            style={StyleSheet.absoluteFill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.resultSheet}>
              <Text style={[Typography.labelM, { color: Colors.textMuted, letterSpacing: 2, textAlign: 'center', marginBottom: 4 }]}>
                {candidates.length === 1 ? 'CROMO DETECTADO' : `${candidates.length} CROMOS DETECTADOS`}
              </Text>
              <Text style={[Typography.bodyS, { color: Colors.textMuted, textAlign: 'center', marginBottom: 14 }]}>
                Selecciona los que quieras agregar
              </Text>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {candidates.map(({ sticker: s, selected }) => {
                  const qty = quantities[s.code] ?? 0;
                  return (
                    <Pressable
                      key={s.code}
                      style={[styles.candidateRow, selected && styles.candidateRowSelected]}
                      onPress={() => toggleCandidate(s.code)}
                    >
                      {selected
                        ? <CheckSquareIcon size={22} color={Colors.owned} weight="fill" />
                        : <SquareIcon size={22} color={Colors.textMuted} weight="regular" />
                      }
                      <View style={[styles.candidateCode, s.foil && { borderColor: Colors.gold }]}>
                        <Text style={[Typography.codeM, { color: s.foil ? Colors.gold : Colors.textSecondary }]}>{s.code}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>{s.name}</Text>
                        <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>
                          {s.teamName}
                          {s.foil ? '  ✦ FOIL' : ''}
                          {qty > 0 ? `  ·  ya tienes ${qty}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                style={[styles.confirmBtn, selectedCount === 0 && styles.confirmBtnDisabled]}
                onPress={selectedCount > 0 ? handleConfirmSelected : undefined}
              >
                <CheckCircleIcon size={18} color={Colors.textPrimary} weight="fill" />
                <Text style={[Typography.labelL, { color: Colors.textPrimary, marginLeft: 8 }]}>
                  {selectedCount > 0 ? `Agregar ${selectedCount} cromo${selectedCount > 1 ? 's' : ''}` : 'Selecciona al menos uno'}
                </Text>
              </Pressable>

              <View style={styles.reviewActions}>
                <Pressable style={styles.reviewActionBtn} onPress={() => { setCandidates([]); setPhase('camera'); }}>
                  <ArrowCounterClockwiseIcon size={14} color={Colors.textMuted} />
                  <Text style={[Typography.bodyS, { color: Colors.textMuted, marginLeft: 6 }]}>Volver a escanear</Text>
                </Pressable>
                <Pressable style={styles.reviewActionBtn} onPress={() => setPhase('manual')}>
                  <KeyboardIcon size={14} color={Colors.textMuted} />
                  <Text style={[Typography.bodyS, { color: Colors.textMuted, marginLeft: 6 }]}>Agregar manualmente</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ── PHASE: manual ── */}
        {phase === 'manual' && (
          <KeyboardAvoidingView
            style={StyleSheet.absoluteFill}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.resultSheet}>
              <Text style={[Typography.labelM, { color: Colors.textMuted, letterSpacing: 2, textAlign: 'center', marginBottom: 14 }]}>
                INGRESAR MANUALMENTE
              </Text>

              <View style={styles.manualInput}>
                <KeyboardIcon size={16} color={Colors.textMuted} />
                <TextInput
                  style={styles.manualInputText}
                  placeholder="Código del cromo (ej: ARG1, MEX3...)"
                  placeholderTextColor={Colors.textMuted}
                  value={manualQuery}
                  onChangeText={setManualQuery}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
              </View>

              <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {manualResults.map(s => {
                  const qty = quantities[s.code] ?? 0;
                  return (
                    <Pressable
                      key={s.code}
                      style={({ pressed }) => [styles.candidateRow, pressed && { opacity: 0.7 }]}
                      onPress={() => handleManualAdd(s)}
                    >
                      <PlusIcon size={20} color={Colors.owned} weight="bold" />
                      <View style={styles.candidateCode}>
                        <Text style={[Typography.codeM, { color: Colors.textSecondary }]}>{s.code}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>{s.name}</Text>
                        <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>
                          {s.teamName}{qty > 0 ? `  ·  ya tienes ${qty}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {manualQuery.length > 0 && manualResults.length === 0 && (
                  <View style={{ alignItems: 'center', padding: 20 }}>
                    <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>Sin resultados para "{manualQuery}"</Text>
                  </View>
                )}
              </ScrollView>

              <Pressable style={styles.backBtn} onPress={() => { setManualQuery(''); setPhase(candidates.length > 0 ? 'review' : 'camera'); }}>
                <ArrowLeftIcon size={14} color={Colors.textMuted} />
                <Text style={[Typography.bodyS, { color: Colors.textMuted, marginLeft: 6 }]}>
                  {candidates.length > 0 ? 'Volver a los detectados' : 'Volver a la cámara'}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}

        {/* ── Top bar (always visible) ── */}
        <View style={styles.topBar}>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <XIcon size={18} color="#fff" weight="bold" />
          </Pressable>
          {registered.length > 0 && (
            <View style={styles.counterBadge}>
              <Text style={[Typography.labelM, { color: Colors.textPrimary }]}>
                {registered.length} registrado{registered.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>

        {/* ── Registered chips (camera phase only) ── */}
        {phase === 'camera' && registered.length > 0 && (
          <View style={styles.chipsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
              {registered.map(e => (
                <View key={e.sticker.code} style={[styles.chip, e.qty > 1 && styles.chipDup]}>
                  <Text style={styles.chipCode}>{e.sticker.code}</Text>
                  {e.qty > 1 && <Text style={styles.chipQty}>×{e.qty}</Text>}
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </Modal>
  );
}

const FRAME = 240;
const CORNER_SIZE = 24;
const CORNER_W = 4;

const styles = StyleSheet.create({
  centered: {
    flex: 1, backgroundColor: Colors.bg,
    alignItems: 'center', justifyContent: 'center', padding: Spacing.xl,
  },
  permCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.xl,
    padding: Spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, width: '100%', maxWidth: 340,
  },
  permBtn: {
    backgroundColor: Colors.red, paddingHorizontal: 28, paddingVertical: 12,
    borderRadius: Radii.full, marginTop: 20,
  },

  frameWrap: {
    position: 'absolute', top: '38%', left: '50%',
    width: FRAME, height: FRAME,
    marginTop: -FRAME / 2, marginLeft: -FRAME / 2,
  },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.red },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderBottomRightRadius: 4 },

  noMatchBanner: {
    position: 'absolute', top: '62%', alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.red + '50',
  },
  noMatchText: { fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#fff', maxWidth: 260 },

  scanHint: {
    position: 'absolute', bottom: '28%', alignSelf: 'center',
    color: 'rgba(255,255,255,0.9)', fontFamily: 'DMSans_400Regular', fontSize: 13,
    textAlign: 'center', paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8,
  },

  captureWrap: {
    position: 'absolute', bottom: 80, alignSelf: 'center',
    width: 72, height: 72, alignItems: 'center', justifyContent: 'center',
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.red },

  manualFab: {
    position: 'absolute', bottom: 88, right: 24,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radii.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  manualFabLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#fff' },

  resultSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },

  candidateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg, borderRadius: Radii.md,
    padding: Spacing.md, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  candidateRowSelected: { borderColor: Colors.owned + '60', backgroundColor: Colors.owned + '08' },
  candidateCode: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.sm,
    borderWidth: 1, borderColor: Colors.border,
    minWidth: 58, alignItems: 'center', backgroundColor: Colors.bgCardAlt,
  },

  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.owned, paddingVertical: 13,
    borderRadius: Radii.full, marginTop: 10, gap: 6,
  },
  confirmBtnDisabled: { backgroundColor: Colors.bgCardAlt },

  reviewActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: 12,
  },
  reviewActionBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 12,
  },

  manualInput: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg, borderRadius: Radii.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border, marginBottom: 12,
  },
  manualInputText: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 15, color: Colors.textPrimary,
  },

  backBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, paddingVertical: 8,
  },

  topBar: {
    position: 'absolute', top: 52, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  counterBadge: {
    backgroundColor: Colors.red, paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radii.full,
  },
  chipsRow: { position: 'absolute', top: 108, left: 0, right: 0 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.owned + '30', borderWidth: 1, borderColor: Colors.owned + '60',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.full, gap: 4,
  },
  chipDup: { backgroundColor: Colors.duplicate + '30', borderColor: Colors.duplicate + '60' },
  chipCode: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: '#fff' },
  chipQty: { fontFamily: 'DMSans_500Medium', fontSize: 11, color: Colors.duplicate },
});
