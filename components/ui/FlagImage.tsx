import { Image, View, StyleSheet } from 'react-native';
import { Globe } from 'phosphor-react-native';
import { Colors } from '@/constants/theme';

interface FlagImageProps {
  isoCode: string | null;
  size?: number;
  style?: object;
}

// flagcdn.com solo acepta estos anchos específicos
function nearestFlagSize(px: number): number {
  const valid = [20, 40, 80, 160, 320];
  return valid.find(v => v >= px * 2) ?? 80;
}

export function FlagImage({ isoCode, size = 32, style }: FlagImageProps) {
  if (!isoCode) {
    return (
      <View style={[styles.base, { width: size * 1.5, height: size, borderRadius: 4 }, style]}>
        <Globe size={size * 0.55} color={Colors.textMuted} />
      </View>
    );
  }

  const w = nearestFlagSize(size);
  const uri = `https://flagcdn.com/w${w}/${isoCode}.png`;

  return (
    <Image
      source={{ uri }}
      style={[styles.base, { width: size * 1.5, height: size, borderRadius: 4 }, style]}
      resizeMode="cover"
      defaultSource={{ uri: `https://flagcdn.com/w40/${isoCode}.png` }}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
