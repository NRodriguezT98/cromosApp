import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  ActivityIndicator, Platform, TextInput, KeyboardAvoidingView,
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers } from '@/context/StickersContext';
import {
  X, UploadSimple, DownloadSimple, CheckCircle,
  Warning, CloudArrowUp, ShieldCheck, ClipboardText, CaretLeft,
} from 'phosphor-react-native';

type Status = 'idle' | 'loading' | 'success' | 'error' | 'invalid';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'America/Bogota',
  });
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function BackupModal({ visible, onClose }: Props) {
  const { exportBackup, importBackup, lastBackupDate, getStats } = useStickers();
  const [exportStatus, setExportStatus] = useState<Status>('idle');
  const [exportErrorMsg, setExportErrorMsg] = useState('');
  const [importStatus, setImportStatus] = useState<Status>('idle');
  const [importErrorDetail, setImportErrorDetail] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const stats = getStats();

  const handleExport = async () => {
    setExportStatus('loading');
    setImportStatus('idle');
    const result = await exportBackup();
    if (result === 'ok') {
      setExportStatus('success');
    } else {
      setExportStatus('error');
      setExportErrorMsg(result);
    }
  };

  const handleImport = async () => {
    const text = pasteText.trim();
    if (!text) return;
    setImportStatus('loading');
    setExportStatus('idle');
    setImportErrorDetail('');

    // Pre-validate to give specific error messages
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const last10 = text.slice(-10).replace(/\n/g, '↵');
      setImportErrorDetail(`JSON inválido (${text.length} chars, termina en: "…${last10}"). El texto puede estar truncado.`);
      setImportStatus('invalid');
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      setImportErrorDetail('El JSON no es un objeto.');
      setImportStatus('invalid');
      return;
    }
    const quantities = parsed.quantities ?? parsed.data?.quantities;
    if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities)) {
      const keys = Object.keys(parsed).join(', ');
      setImportErrorDetail(`No se encontró "quantities". Claves encontradas: ${keys}`);
      setImportStatus('invalid');
      return;
    }

    const result = await importBackup(text);
    setImportStatus(result === 'ok' ? 'success' : result === 'invalid' ? 'invalid' : 'error');
    if (result !== 'ok') {
      setImportErrorDetail('Error interno al guardar los datos.');
    }
    if (result === 'ok') {
      setTimeout(() => {
        setIsPasting(false);
        setPasteText('');
        onClose();
      }, 1500);
    }
  };

  const handlePasteFromClipboard = async () => {
    const text = await ExpoClipboard.getStringAsync();
    if (text) setPasteText(text);
  };

  const statusIcon = (s: Status, successMsg: string, errorMsg: string) => {
    if (s === 'loading') return <ActivityIndicator size="small" color={Colors.textSecondary} />;
    if (s === 'success') return (
      <View style={styles.statusRow}>
        <CheckCircle size={14} color={Colors.owned} weight="fill" />
        <Text style={[styles.statusText, { color: Colors.owned }]}>{successMsg}</Text>
      </View>
    );
    if (s === 'error' || s === 'invalid') return (
      <View style={styles.statusRow}>
        <Warning size={14} color={Colors.red} weight="fill" />
        <Text style={[styles.statusText, { color: Colors.red }]}>
          {s === 'invalid' ? 'Archivo no válido' : errorMsg}
        </Text>
      </View>
    );
    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        {!isPasting ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <ShieldCheck size={22} color={Colors.owned} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Copia de Seguridad</Text>
                <Text style={styles.subtitle}>
                  {lastBackupDate
                    ? `Último backup: ${formatDate(lastBackupDate)}`
                    : 'Aún no has creado ningún backup'}
                </Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
                <X size={18} color={Colors.textMuted} weight="bold" />
              </Pressable>
            </View>

            {/* Data summary */}
            <View style={styles.summaryBar}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.owned}</Text>
                <Text style={styles.summaryLabel}>cromos</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.duplicateCount}</Text>
                <Text style={styles.summaryLabel}>repetidos</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{stats.completionPct}%</Text>
                <Text style={styles.summaryLabel}>completado</Text>
              </View>
            </View>

            {/* Export button */}
            <Pressable
              style={({ pressed }) => [styles.actionCard, styles.exportCard, pressed && { opacity: 0.8 }]}
              onPress={handleExport}
              disabled={exportStatus === 'loading'}
            >
              <View style={styles.actionIconWrap}>
                <CloudArrowUp size={26} color={Colors.owned} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Exportar backup</Text>
                <Text style={styles.actionDesc}>
                  Guarda tus datos como archivo para compartirlo
                </Text>
                {statusIcon(exportStatus, 'Exportado correctamente', exportErrorMsg || 'Error al exportar')}
              </View>
              <UploadSimple size={18} color={Colors.owned} weight="bold" />
            </Pressable>

            {/* Import button */}
            <Pressable
              style={({ pressed }) => [styles.actionCard, styles.importCard, pressed && { opacity: 0.8 }]}
              onPress={() => setIsPasting(true)}
              disabled={importStatus === 'loading'}
            >
              <View style={styles.actionIconWrap}>
                <ClipboardText size={26} color={Colors.textSecondary} weight="fill" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Restaurar desde texto</Text>
                <Text style={styles.actionDesc}>
                  Pega el texto de tu backup para recuperar todo
                </Text>
                {statusIcon(importStatus, 'Datos restaurados', 'Error al restaurar')}
              </View>
              <DownloadSimple size={18} color={Colors.textSecondary} weight="bold" />
            </Pressable>

            {/* Warning */}
            <View style={styles.warning}>
              <Warning size={13} color={Colors.duplicate} weight="fill" />
              <Text style={styles.warningText}>
                Al restaurar un backup se reemplazarán TODOS los datos actuales de la app.
              </Text>
            </View>
          </>
        ) : (
          /* PASTE UI */
          <View style={{ flex: 1, minHeight: 400 }}>
            <View style={styles.header}>
              <Pressable style={styles.closeBtn} onPress={() => setIsPasting(false)} hitSlop={8}>
                <CaretLeft size={18} color={Colors.textMuted} weight="bold" />
              </Pressable>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title}>Pegar Backup</Text>
                <Text style={styles.subtitle}>Pega el texto del backup o usa el portapapeles</Text>
              </View>
            </View>

            <Pressable style={styles.clipboardBtn} onPress={handlePasteFromClipboard}>
              <ClipboardText size={15} color={Colors.textSecondary} weight="fill" />
              <Text style={styles.clipboardBtnText}>Pegar desde portapapeles</Text>
            </Pressable>

            <TextInput
              style={styles.pasteArea}
              placeholder='{"version": 1, "app": "cromitos", ...}'
              placeholderTextColor={Colors.textMuted}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              value={pasteText}
              onChangeText={setPasteText}
              textAlignVertical="top"
            />
            {pasteText.length > 0 && (
              <Text style={styles.charCount}>{pasteText.length.toLocaleString()} caracteres</Text>
            )}

            <View style={styles.pasteActions}>
              <Pressable
                style={[styles.pasteBtn, styles.pasteBtnCancel]}
                onPress={() => setIsPasting(false)}
              >
                <Text style={[styles.pasteBtnText, { color: Colors.textMuted }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.pasteBtn, styles.pasteBtnConfirm, !pasteText.trim() && { opacity: 0.5 }]}
                onPress={handleImport}
                disabled={!pasteText.trim() || importStatus === 'loading'}
              >
                {importStatus === 'loading' ? (
                  <ActivityIndicator size="small" color={Colors.bg} />
                ) : (
                  <Text style={[styles.pasteBtnText, { color: Colors.bg }]}>Restaurar Datos</Text>
                )}
              </Pressable>
            </View>

            {importStatus === 'error' || importStatus === 'invalid' ? (
              <View style={[styles.warning, { marginTop: 12 }]}>
                <Warning size={13} color={Colors.red} weight="fill" />
                <Text style={[styles.warningText, { color: Colors.red }]}>
                  {importErrorDetail || (importStatus === 'invalid' ? 'El texto pegado no es un backup válido.' : 'Ocurrió un error al restaurar.')}
                </Text>
              </View>
            ) : null}
            {importStatus === 'success' ? (
              <View style={[styles.warning, { marginTop: 12, backgroundColor: Colors.owned + '10', borderColor: Colors.owned + '30' }]}>
                <CheckCircle size={13} color={Colors.owned} weight="fill" />
                <Text style={[styles.warningText, { color: Colors.owned }]}>Datos restaurados con éxito.</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={{ height: Platform.OS === 'ios' ? 24 : 12 }} />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: Colors.borderBright,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderBright,
    alignSelf: 'center', marginBottom: 18,
  },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.owned + '18',
    borderWidth: 1, borderColor: Colors.owned + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'Oswald_600SemiBold', fontSize: 20, color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  summaryBar: {
    flexDirection: 'row', backgroundColor: Colors.bg,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 12, marginBottom: 16,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: {
    fontFamily: 'Oswald_700Bold', fontSize: 22, color: Colors.textPrimary,
  },
  summaryLabel: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted, marginTop: 1,
  },
  summaryDivider: { width: 1, backgroundColor: Colors.border },

  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: Radii.lg, borderWidth: 1,
    padding: Spacing.md, marginBottom: 10,
  },
  exportCard: {
    backgroundColor: Colors.owned + '08',
    borderColor: Colors.owned + '30',
  },
  importCard: {
    backgroundColor: Colors.bgCardAlt,
    borderColor: Colors.border,
  },
  actionIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  actionTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.textPrimary, marginBottom: 2,
  },
  actionDesc: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted, lineHeight: 15,
  },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  statusText: { fontFamily: 'DMSans_500Medium', fontSize: 11 },

  warning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    backgroundColor: Colors.duplicate + '0D',
    borderWidth: 1, borderColor: Colors.duplicate + '25',
    borderRadius: Radii.md, padding: 10, marginTop: 4,
  },
  warningText: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 11,
    color: Colors.textMuted, lineHeight: 15,
  },

  charCount: {
    fontFamily: 'DMSans_400Regular', fontSize: 11,
    color: Colors.textMuted, textAlign: 'right', marginBottom: 8,
  },
  clipboardBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bgCardAlt,
    borderWidth: 1, borderColor: Colors.border,
    borderRadius: Radii.md, paddingVertical: 10, paddingHorizontal: 14,
    marginBottom: 10, alignSelf: 'flex-start',
  },
  clipboardBtnText: {
    fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.textSecondary,
  },
  pasteArea: {
    flex: 1, backgroundColor: Colors.bg,
    borderRadius: Radii.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md,
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.textPrimary,
    minHeight: 180, marginBottom: 16,
  },
  pasteActions: {
    flexDirection: 'row', gap: 10,
  },
  pasteBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radii.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  pasteBtnCancel: {
    backgroundColor: Colors.bg, borderColor: Colors.border,
  },
  pasteBtnConfirm: {
    backgroundColor: Colors.textPrimary, borderColor: Colors.textPrimary,
  },
  pasteBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 14,
  },
});
