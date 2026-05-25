import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Colors, Radii } from '@/constants/theme';
import { Sticker } from '@/context/StickersContext';

interface StickerBubbleProps {
  sticker: Sticker;
  qty: number;
  onTap: () => void;
  onLongPress: () => void;
}

function stickerNum(code: string): string {
  return code.match(/\d+/)?.[0] ?? '?';
}

function shortLabel(sticker: Sticker): string {
  if (sticker.type === 'team_logo') return 'ESCUDO';
  if (sticker.type === 'team_photo') {
    const m = sticker.name.match(/\(([^)]+)\)/);
    return m ? m[1].split(' ')[0].toUpperCase() : 'FOTO';
  }
  if (sticker.type === 'special') {
    return sticker.name.toUpperCase().split(' ')[0].slice(0, 8);
  }
  const parts = sticker.name.toUpperCase().split(' ');
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

const CIRCLE = 52;

export function StickerBubble({ sticker, qty, onTap, onLongPress }: StickerBubbleProps) {
  const missing = qty === 0;
  const dup = qty > 1;

  const ringColor = sticker.foil
    ? Colors.gold
    : missing
    ? Colors.border
    : Colors.owned;

  const bg = missing
    ? Colors.bgCardAlt
    : sticker.foil
    ? Colors.gold + '22'
    : Colors.owned + '1C';

  const numColor = missing
    ? sticker.foil ? Colors.gold : Colors.textMuted
    : Colors.white;

  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.wrap,
        pressed && { opacity: 0.6, transform: [{ scale: 0.9 }] },
      ]}
    >
      <View
        style={[
          styles.circle,
          { backgroundColor: bg, borderColor: ringColor, borderWidth: missing ? 1.5 : 2.5 },
        ]}
      >
        <Text style={[styles.num, { color: numColor }]}>{stickerNum(sticker.code)}</Text>
        {dup && (
          <View style={styles.dupBadge}>
            <Text style={styles.dupCount}>+{qty - 1}</Text>
          </View>
        )}
        {sticker.foil && (
          <View style={[styles.foilDot, missing && { backgroundColor: Colors.gold + 'AA' }]} />
        )}
      </View>
      <Text
        style={[styles.label, { color: missing ? Colors.textMuted : Colors.textSecondary }]}
        numberOfLines={1}
      >
        {shortLabel(sticker)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 5,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: {
    fontFamily: 'Oswald_600SemiBold',
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
  },
  label: {
    fontFamily: 'DMSans_500Medium',
    fontSize: 9,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.3,
    width: '100%',
    paddingHorizontal: 2,
  },
  dupBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: Colors.duplicate,
    borderRadius: Radii.full,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.bg,
  },
  dupCount: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 9,
    color: Colors.white,
    lineHeight: 11,
  },
  foilDot: {
    position: 'absolute',
    bottom: 5,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.gold,
  },
});
