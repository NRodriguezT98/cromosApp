import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Sticker } from '@/context/StickersContext';
import { X, Package, CheckCircle, WarningCircle, Camera } from 'phosphor-react-native';
import { ScannerModal } from './ScannerModal';

const PACK_SIZE = 5;

type FieldState = { code: string; sticker: Sticker | null };

const emptyFields = (): FieldState[] =>
  Array.from({ length: PACK_SIZE }, () => ({ code: '', sticker: null }));

interface PackModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PackModal({ visible, onClose }: PackModalProps) {
  const { stickers, increment } = useStickers();
  const [fields, setFields] = useState<FieldState[]>(emptyFields());
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const stickerMap = useMemo(() => {
    const m = new Map<string, Sticker>();
    stickers.forEach(s => m.set(s.code.toUpperCase(), s));
    return m;
  }, [stickers]);

  const handleChange = useCallback((index: number, raw: string) => {
    const code = raw.toUpperCase().replace(/\s/g, '');
    const sticker = stickerMap.get(code) ?? null;

    setFields(prev => {
      const next = [...prev];
      next[index] = { code, sticker };
      return next;
    });

    if (sticker && index < PACK_SIZE - 1) {
      setTimeout(() => inputRefs.current[index + 1]?.focus(), 80);
    }
  }, [stickerMap]);

  const validFields = fields.filter(f => f.sticker !== null);

  const handleRegister = () => {
    validFields.forEach(f => increment(f.sticker!.code));
    setFields(emptyFields());
    onClose();
  };

  const handleClose = () => {
    setFields(emptyFields());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={handleClose} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Package size={20} color={Colors.red} weight="fill" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[Typography.titleM, { color: Colors.textPrimary }]}>
                Abrir Sobre
              </Text>
              <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>
                Escribe los códigos de los {PACK_SIZE} cromos
              </Text>
            </View>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <X size={18} color={Colors.textMuted} weight="bold" />
            </Pressable>
          </View>

          {/* Botón escanear */}
          <Pressable
            style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setScannerOpen(true)}
          >
            <Camera size={18} color={Colors.textPrimary} weight="fill" />
            <Text style={[Typography.labelL, { color: Colors.textPrimary, marginLeft: 8 }]}>
              Escanear con cámara
            </Text>
            {Platform.OS === 'web' && (
              <Text style={[Typography.labelS, { color: 'rgba(255,255,255,0.55)', marginLeft: 6 }]}>
                · solo móvil
              </Text>
            )}
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o ingresa manualmente</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Campos */}
          <ScrollView
            style={styles.fields}
            contentContainerStyle={{ paddingBottom: 8 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {fields.map((field, i) => {
              const hasText  = field.code.length > 0;
              const isValid  = field.sticker !== null;
              const isInvalid = hasText && !isValid;
              const borderColor = isValid
                ? Colors.owned
                : isInvalid
                ? Colors.red + '80'
                : Colors.border;

              return (
                <View key={i} style={styles.fieldRow}>
                  {/* Número / check */}
                  <View style={[
                    styles.fieldNum,
                    isValid && { backgroundColor: Colors.owned + '20' },
                  ]}>
                    {isValid
                      ? <CheckCircle size={15} color={Colors.owned} weight="fill" />
                      : <Text style={[Typography.labelS, { color: Colors.textMuted }]}>{i + 1}</Text>
                    }
                  </View>

                  {/* Input + preview */}
                  <View style={[styles.inputWrap, { borderColor }]}>
                    <TextInput
                      ref={r => { inputRefs.current[i] = r; }}
                      style={styles.input}
                      value={field.code}
                      onChangeText={v => handleChange(i, v)}
                      placeholder={`Código cromo ${i + 1}  (ej. ARG7)`}
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType={i < PACK_SIZE - 1 ? 'next' : 'done'}
                      onSubmitEditing={() => {
                        if (i < PACK_SIZE - 1) inputRefs.current[i + 1]?.focus();
                      }}
                    />
                    {isValid && (
                      <Text style={styles.preview} numberOfLines={1}>
                        {field.sticker!.name}
                        {field.sticker!.foil ? '  ✦ FOIL' : ''}
                      </Text>
                    )}
                    {isInvalid && (
                      <View style={styles.invalidRow}>
                        <WarningCircle size={11} color={Colors.red} />
                        <Text style={styles.invalidText}>Código no encontrado</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[Typography.bodyS, { color: Colors.textMuted }]}>
              {validFields.length} de {PACK_SIZE} válidos
            </Text>
            <Pressable
              style={[
                styles.registerBtn,
                validFields.length === 0 && styles.registerBtnDisabled,
              ]}
              onPress={handleRegister}
              disabled={validFields.length === 0}
            >
              <Package size={16} color={Colors.textPrimary} weight="fill" />
              <Text style={[Typography.labelL, { color: Colors.textPrimary, marginLeft: 8 }]}>
                Registrar{validFields.length > 0 ? ` ${validFields.length} cromo${validFields.length > 1 ? 's' : ''}` : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <ScannerModal visible={scannerOpen} onClose={() => setScannerOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 4,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.redSoft,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.red + '40',
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  fields: {
    marginTop: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  fieldNum: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Radii.md,
    backgroundColor: Colors.bg,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  input: {
    ...Typography.bodyL,
    color: Colors.textPrimary,
    padding: 0,
    letterSpacing: 1,
  },
  preview: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.owned,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  invalidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  invalidText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.red,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  registerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.red,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: Radii.full,
  },
  registerBtnDisabled: {
    backgroundColor: Colors.bgCardAlt,
    opacity: 0.5,
  },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1.5,
    borderColor: Colors.red + '60',
    borderRadius: Radii.md,
    paddingVertical: 13,
    marginTop: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
});
