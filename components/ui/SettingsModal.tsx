import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable,
  ActivityIndicator, Platform, Alert,
} from 'react-native';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import * as Updates from 'expo-updates';
import {
  X, Gear, CloudArrowDown, ShieldCheck, CheckCircle, Warning, ArrowsClockwise,
} from 'phosphor-react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  onOpenBackup: () => void;
}

type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'no_update' | 'error';

export function SettingsModal({ visible, onClose, onOpenBackup }: Props) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

  const handleCheckUpdates = async () => {
    try {
      if (__DEV__) {
        Alert.alert('Modo Desarrollo', 'Las actualizaciones OTA solo funcionan en builds de producción o preview.');
        return;
      }
      setUpdateStatus('checking');
      const update = await Updates.checkForUpdateAsync();
      
      if (update.isAvailable) {
        setUpdateStatus('downloading');
        await Updates.fetchUpdateAsync();
        setUpdateStatus('ready');
      } else {
        setUpdateStatus('no_update');
        setTimeout(() => setUpdateStatus('idle'), 3000);
      }
    } catch (e) {
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    }
  };

  const handleReload = async () => {
    await Updates.reloadAsync();
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

      <View style={styles.sheet}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Gear size={22} color={Colors.textPrimary} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Configuración</Text>
            <Text style={styles.subtitle}>Ajustes y mantenimiento</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <X size={18} color={Colors.textMuted} weight="bold" />
          </Pressable>
        </View>

        {/* Backup Option */}
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && { opacity: 0.8 }]}
          onPress={() => {
            onClose();
            onOpenBackup();
          }}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: Colors.owned + '15', borderColor: Colors.owned + '30' }]}>
            <ShieldCheck size={22} color={Colors.owned} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Copia de Seguridad</Text>
            <Text style={styles.actionDesc}>Exportar o restaurar tus cromos y el historial completo</Text>
          </View>
        </Pressable>

        {/* OTA Updates Option */}
        <Pressable
          style={({ pressed }) => [
            styles.actionCard,
            pressed && updateStatus === 'idle' && { opacity: 0.8 },
            updateStatus === 'ready' && { borderColor: Colors.gold, backgroundColor: Colors.gold + '0A' }
          ]}
          onPress={updateStatus === 'ready' ? handleReload : handleCheckUpdates}
          disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: Colors.bg, borderColor: Colors.border }]}>
            {updateStatus === 'checking' || updateStatus === 'downloading' ? (
              <ActivityIndicator size="small" color={Colors.textSecondary} />
            ) : updateStatus === 'ready' ? (
              <ArrowsClockwise size={22} color={Colors.gold} weight="fill" />
            ) : (
              <CloudArrowDown size={22} color={Colors.textSecondary} weight="fill" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>
              {updateStatus === 'ready' ? 'Reiniciar y Aplicar' : 'Buscar Actualizaciones'}
            </Text>
            <Text style={styles.actionDesc}>
              {updateStatus === 'checking' && 'Buscando nueva versión...'}
              {updateStatus === 'downloading' && 'Descargando actualización...'}
              {updateStatus === 'ready' && 'Actualización lista. Toca para reiniciar.'}
              {updateStatus === 'no_update' && <Text style={{ color: Colors.owned }}>Tienes la última versión.</Text>}
              {updateStatus === 'error' && <Text style={{ color: Colors.red }}>Error al buscar. Intenta luego.</Text>}
              {updateStatus === 'idle' && 'Verificar si hay mejoras o correcciones OTA disponibles'}
            </Text>
          </View>
        </Pressable>

        <View style={{ height: Platform.OS === 'ios' ? 24 : 12 }} />
      </View>
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
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
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
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: Radii.lg, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bgCardAlt,
    padding: Spacing.md, marginBottom: 10,
  },
  actionIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    borderWidth: 1,
  },
  actionTitle: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.textPrimary, marginBottom: 2,
  },
  actionDesc: {
    fontFamily: 'DMSans_400Regular', fontSize: 11, color: Colors.textMuted, lineHeight: 15,
  },
});
