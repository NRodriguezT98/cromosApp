import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { CameraSlash } from 'phosphor-react-native';

interface ScannerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ScannerModal({ visible, onClose }: ScannerModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <CameraSlash size={44} color={Colors.textMuted} />
          </View>
          <Text style={[Typography.titleM, { color: Colors.textPrimary, textAlign: 'center', marginTop: 16 }]}>
            Solo disponible en móvil
          </Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 22 }]}>
            El escáner de cámara funciona en la app instalada en tu teléfono Android.
            {'\n\n'}
            Instala el APK y podrás escanear los códigos de tus cromos directamente con la cámara.
          </Text>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={[Typography.labelL, { color: Colors.textPrimary }]}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radii.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
    maxWidth: 360,
  },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  closeBtn: {
    backgroundColor: Colors.red,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: Radii.full,
    marginTop: 24,
  },
});
