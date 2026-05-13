import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react';
import {
  Modal, View, Text, Pressable, StyleSheet, ActivityIndicator,
  ScrollView, TextInput, KeyboardAvoidingView, Platform, Animated,
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

// ── OCR detection constants ────────────────────────────────────────────────
const NUM_SHOTS = 3;        // photos per capture burst
const SHOT_DELAY_MS = 450;  // ms between shots

/** Normalize characters that ML-Kit commonly mis-reads in sticker codes */
function normalizeOcrText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[|!]/g, 'I')   // pipe / exclamation → I
    .replace(/\bl\b/g, 'I')  // lone lowercase-l → I
    .replace(/\$/g, 'S');
}

/**
 * Single-char substitution table.
 * Key = what OCR produces → values = real chars to try.
 */
const CHAR_SUBS: Record<string, string[]> = {
  'O': ['Q'],
  'Q': ['O'],
  '0': ['O', 'Q'],
  '1': ['I'],
  'I': ['1'],
  'G': ['Q', 'C'],
  'B': ['R'],
};

/** Try prefix+num directly, then with single-char substitutions in the prefix */
function findStickerFuzzy(
  prefix: string,
  numStr: string,
  stickerMap: Map<string, Sticker>,
): Sticker | null {
  const direct = stickerMap.get(prefix + numStr);
  if (direct) return direct;
  const chars = prefix.split('');
  for (let i = 0; i < chars.length; i++) {
    for (const alt of (CHAR_SUBS[chars[i]] ?? [])) {
      const candidate = [...chars.slice(0, i), alt, ...chars.slice(i + 1)].join('') + numStr;
      const s = stickerMap.get(candidate);
      if (s) return s;
    }
  }
  return null;
}

/**
 * Full extraction pipeline:
 *  Pass 1 – regex on normalized flat text
 *  Pass 2 – word-pair scan (prefix/number split by OCR whitespace)
 *  Pass 3 – ML Kit element scan (processes each individual OCR element
 *           and consecutive element pairs within a line — most precise)
 */
function extractStickers(
  ocrResult: { text: string; blocks?: Array<{
    lines?: Array<{ elements?: Array<{ text: string }> }>
  }> },
  stickerMap: Map<string, Sticker>,
): Sticker[] {
  const found: Sticker[] = [];
  const addIfNew = (s: Sticker) => { if (!found.some(f => f.code === s.code)) found.push(s); };

  const text = normalizeOcrText(ocrResult.text);

  // Pass 1: regex over full concatenated text (handles inline "QAT4" or "QAT 4")
  const re = /\b([A-Z0-9]{2,4})\s{0,3}(\d{1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const s = findStickerFuzzy(m[1], m[2], stickerMap);
    if (s) addIfNew(s);
  }

  // Pass 2: word-pair scan on the flat text
  const words = text.split(/\s+/);
  for (let i = 0; i < words.length - 1; i++) {
    if (/^[A-Z0-9]{2,4}$/.test(words[i]) && /^\d{1,2}$/.test(words[i + 1])) {
      const s = findStickerFuzzy(words[i], words[i + 1], stickerMap);
      if (s) addIfNew(s);
    }
  }

  // Pass 3: ML Kit element-level scan (most granular — catches codes that
  // OCR places in separate bounding-box elements within a line)
  if (ocrResult.blocks) {
    for (const block of ocrResult.blocks) {
      for (const line of (block.lines ?? [])) {
        const elems = line.elements ?? [];
        for (let i = 0; i < elems.length; i++) {
          const eText = normalizeOcrText(elems[i].text);
          // Full code in one element: "QAT4"
          const full = /^([A-Z0-9]{2,4})(\d{1,2})$/.exec(eText);
          if (full) {
            const s = findStickerFuzzy(full[1], full[2], stickerMap);
            if (s) { addIfNew(s); continue; }
          }
          // Prefix in this element, number in the next: ["QAT"] ["4"]
          if (/^[A-Z0-9]{2,4}$/.test(eText) && i + 1 < elems.length) {
            const nextText = normalizeOcrText(elems[i + 1].text);
            if (/^\d{1,2}$/.test(nextText)) {
              const s = findStickerFuzzy(eText, nextText, stickerMap);
              if (s) addIfNew(s);
            }
          }
        }
      }
    }
  }

  // Remove codes that are a strict prefix of another found code.
  // e.g. FWC1 gets dropped when FWC11 is also detected (OCR split "11" → "1"+"1").
  return found.filter(s => !found.some(o => o.code !== s.code && o.code.startsWith(s.code)));
}

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
  const [shotProgress, setShotProgress] = useState(0); // 0=idle, 1-3=current shot

  // Toast
  const [toastMsg, setToastMsg]   = useState('');
  const toastAnim                  = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [toastAnim]);

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

  // ── capture (multi-shot burst) ────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    setNoMatch(false);
    setShotProgress(0);

    const allFound: Sticker[] = [];

    try {
      for (let shot = 1; shot <= NUM_SHOTS; shot++) {
        setShotProgress(shot);
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.92,
          skipProcessing: false,
          shutterSound: false,
        });
        const result = await TextRecognition.recognize(photo.uri);
        if (result?.text) {
          extractStickers(result, stickerMap).forEach(s => {
            if (!allFound.some(f => f.code === s.code)) allFound.push(s);
          });
        }
        if (shot < NUM_SHOTS) {
          await new Promise<void>(resolve => setTimeout(resolve, SHOT_DELAY_MS));
        }
      }
    } catch { /* continúa con lo que haya encontrado */ }

    if (allFound.length > 0) {
      setCandidates(allFound.map(s => ({ sticker: s, selected: true })));
      setPhase('review');
    } else {
      setNoMatch(true);
    }
    setShotProgress(0);
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
    showToast(`¡Agregaste ${selected.length} cromo${selected.length > 1 ? 's' : ''}! 🎉`);
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
    showToast(`✓ ${sticker.code} – ${sticker.name}`);
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
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" zoom={0.12} />

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
              {capturing ? (
                <View style={styles.burstWrap}>
                  <View style={styles.burstDots}>
                    {[1, 2, 3].map(n => (
                      <View
                        key={n}
                        style={[
                          styles.burstDot,
                          shotProgress >= n && styles.burstDotActive,
                        ]}
                      />
                    ))}
                  </View>
                  <Text style={styles.burstLabel}>
                    {shotProgress > 0 ? `Capturando ${shotProgress}/3…` : 'Preparando…'}
                  </Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.captureBtn, pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] }]}
                  onPress={handleCapture}
                >
                  <View style={styles.captureBtnInner} />
                </Pressable>
              )}
            </View>

            {/* Manual entry shortcut — below capture button, centrado */}
            <Pressable style={styles.manualFab} onPress={() => setPhase('manual')}>
              <KeyboardIcon size={14} color="rgba(255,255,255,0.8)" weight="bold" />
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
              {/* Drag handle */}
              <View style={styles.sheetHandle} />

              {/* Title */}
              <Text style={[Typography.titleS, { color: Colors.textPrimary, textAlign: 'center', letterSpacing: 1.5, marginBottom: 6 }]}>
                {candidates.length === 1 ? '1 CROMO DETECTADO' : `${candidates.length} CROMOS DETECTADOS`}
              </Text>

              {/* Nuevos · Repetidos summary */}
              {(() => {
                const newCount = candidates.filter(c => (quantities[c.sticker.code] ?? 0) === 0).length;
                const dupCount = candidates.length - newCount;
                return (
                  <View style={styles.detectionSummary}>
                    <Text style={[Typography.labelM, { color: Colors.owned }]}>
                      {newCount} Nuevo{newCount !== 1 ? 's' : ''}
                    </Text>
                    <Text style={[Typography.bodyS, { color: Colors.textMuted }]}> — </Text>
                    <Text style={[Typography.labelM, { color: dupCount > 0 ? Colors.duplicate : Colors.textSecondary }]}>
                      {dupCount} Repetido{dupCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                );
              })()}

              <Text style={[Typography.bodyS, { color: Colors.textSecondary, textAlign: 'center', marginBottom: 14 }]}>
                Selecciona los que quieras agregar
              </Text>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {candidates.map(({ sticker: s, selected }) => {
                  const qty = quantities[s.code] ?? 0;
                  return (
                    <Pressable
                      key={s.code}
                      style={[
                        styles.candidateRow,
                        qty > 0 && styles.candidateRowDuplicate,
                        selected && styles.candidateRowSelected,
                      ]}
                      onPress={() => toggleCandidate(s.code)}
                    >
                      {selected
                        ? <CheckSquareIcon size={22} color={qty > 0 ? Colors.duplicate : Colors.owned} weight="fill" />
                        : <SquareIcon size={22} color={Colors.textMuted} weight="regular" />
                      }
                      <View style={[styles.candidateCode, s.foil && { borderColor: Colors.gold }, qty > 0 && { borderColor: Colors.duplicate + '60' }]}>
                        <Text style={[Typography.codeM, { color: s.foil ? Colors.gold : qty > 0 ? Colors.duplicate : Colors.textSecondary }]}>{s.code}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>{s.name}</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                          <Text style={[Typography.bodyS, { color: Colors.textSecondary }]}>
                            {s.teamName}{s.foil ? '  ✦ FOIL' : ''}
                          </Text>
                          {qty > 0 && (
                            <Text style={[Typography.bodyS, { color: Colors.duplicate, fontFamily: 'DMSans_500Medium' }]}>
                              · ya tienes {qty} {qty === 1 ? 'repetido' : 'repetidos'}
                            </Text>
                          )}
                        </View>
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
                  <ArrowCounterClockwiseIcon size={14} color={Colors.textSecondary} />
                  <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginLeft: 6 }]}>Volver a escanear</Text>
                </Pressable>
                <Pressable style={styles.reviewActionBtn} onPress={() => setPhase('manual')}>
                  <KeyboardIcon size={14} color={Colors.textSecondary} />
                  <Text style={[Typography.bodyS, { color: Colors.textSecondary, marginLeft: 6 }]}>Agregar manualmente</Text>
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

        {/* ── Toast ── */}
        {toastMsg !== '' && (
          <Animated.View
            style={[
              styles.toast,
              {
                opacity: toastAnim,
                transform: [{
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                }],
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.toastText}>{toastMsg}</Text>
          </Animated.View>
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
    width: 120, height: 72, alignItems: 'center', justifyContent: 'center',
  },
  burstWrap: {
    alignItems: 'center', gap: 8,
  },
  burstDots: {
    flexDirection: 'row', gap: 8,
  },
  burstDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
  },
  burstDotActive: {
    backgroundColor: Colors.red,
    borderColor: Colors.red,
  },
  burstLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontFamily: 'DMSans_500Medium',
    fontSize: 12,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.red },

  manualFab: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: Radii.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  manualFabLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  toast: {
    position: 'absolute', bottom: 170, alignSelf: 'center',
    backgroundColor: 'rgba(15,20,35,0.92)',
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.owned + '60',
    shadowColor: Colors.owned, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  toastText: {
    fontFamily: 'DMSans_700Bold', fontSize: 14,
    color: Colors.owned, textAlign: 'center',
  },

  resultSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, paddingTop: 12, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: Colors.borderBright,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderBright,
    alignSelf: 'center', marginBottom: 14,
  },
  detectionSummary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },

  candidateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bg, borderRadius: Radii.md,
    padding: Spacing.md, marginBottom: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  candidateRowSelected: { borderColor: Colors.owned + '60', backgroundColor: Colors.owned + '08' },
  candidateRowDuplicate: { borderColor: Colors.duplicate + '35', backgroundColor: Colors.duplicate + '06' },
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
