import { Pressable, View, Text, StyleSheet } from 'react-native';
import { CheckCircle } from 'phosphor-react-native';
import { Colors, Typography, Radii } from '@/constants/theme';
import { Sticker } from '@/context/StickersContext';

export type ViewMode = 'tiny' | 'small' | 'medium' | 'list';

interface StickerCellProps {
  sticker: Sticker;
  qty: number;
  mode: ViewMode;
  onTap: () => void;
  onLongPress: () => void;
}

function shortName(sticker: Sticker, tiny = false): string {
  if (sticker.type === 'team_logo') return 'ESCUDO';

  if (sticker.type === 'team_photo') {
    // Si tiene contenido entre paréntesis (ej: "Foto del Equipo (Italia 1934)"),
    // muestra ese contenido en lugar del label genérico
    const match = sticker.name.match(/\(([^)]+)\)/);
    if (match) return match[1].toUpperCase();
    return tiny ? 'FOTO EQ.' : 'FOTO DE EQUIPO';
  }

  if (sticker.type === 'special') {
    const up = sticker.name.toUpperCase();
    if (tiny) return up.split(' ')[0];
    // Truncación inteligente por palabras (límite 16 chars)
    const words = up.split(' ');
    let result = '';
    for (const word of words) {
      const next = result ? `${result} ${word}` : word;
      if (next.length > 18) break;
      result = next;
    }
    return result || up.slice(0, 16);
  }

  const parts = sticker.name.toUpperCase().split(' ');
  if (tiny) {
    const full = parts.join(' ');
    return full.length <= 10 ? full : parts.slice(-2).join(' ').slice(0, 10);
  }
  return parts.length > 1 ? `${parts[0]} ${parts[1]}` : parts[0];
}

export function StickerCell({ sticker, qty, mode, onTap, onLongPress }: StickerCellProps) {
  const missing = qty === 0;
  const dup     = qty > 1;
  const owned   = qty === 1;

  const borderColor = sticker.foil
    ? Colors.gold
    : missing ? Colors.border
    : dup     ? Colors.duplicate
    : Colors.owned;

  const bgColor = sticker.foil && missing
    ? Colors.gold + '0D'
    : missing ? Colors.bgCard
    : dup     ? Colors.duplicate + '1A'
    : Colors.owned + '1A';

  const textColor = missing ? (sticker.foil ? Colors.gold : Colors.textSecondary) : Colors.textPrimary;
  const subColor  = missing ? Colors.textSecondary : Colors.white + 'D9'; // 85% opacity for owned name

  // ── MODO LISTA ────────────────────────────────────────────────
  if (mode === 'list') {
    return (
      <Pressable
        onPress={onTap}
        onLongPress={onLongPress}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.listRow,
          { borderLeftColor: borderColor, backgroundColor: bgColor },
          pressed && { opacity: 0.6 },
        ]}
      >
        <View style={[styles.listCodeBox, { borderColor }]}>
          <Text style={[styles.listCode, { color: textColor }]}>{sticker.code}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.listName, { color: textColor }]} numberOfLines={1}>
            {sticker.name.toUpperCase()}
          </Text>
          {sticker.foil && (
            <Text style={styles.foilLabel}>✦ FOIL</Text>
          )}
        </View>

        <View style={styles.listRight}>
          {dup && (
            <View style={styles.dupPill}>
              <Text style={styles.dupPillText}>{qty - 1} {qty - 1 === 1 ? 'repetido' : 'repetidos'}</Text>
            </View>
          )}
          {owned   && <CheckCircle size={18} color={Colors.owned} weight="fill" />}
          {missing && !sticker.foil && <View style={styles.emptyCircle} />}
          {missing && sticker.foil  && <Text style={styles.foilStar}>✦</Text>}
        </View>
      </Pressable>
    );
  }

  // ── MODOS GRID ────────────────────────────────────────────────
  const isTiny   = mode === 'tiny';
  const isMedium = mode === 'medium';
  const borderW  = sticker.foil ? 2 : isTiny ? 1 : 1.5;
  const stackOffset = isTiny ? 3 : 5;
  const cardRadius  = isTiny ? Radii.sm : isMedium ? Radii.lg : Radii.md;

  // Inner content shared between normal and stacked card
  const cardContent = (
    <>
      {sticker.foil && (
        <View style={[styles.foilCorner, isTiny && styles.foilCornerTiny]} />
      )}
      <Text style={[
        isTiny ? styles.codeTiny : isMedium ? styles.codeMedium : styles.codeSmall,
        { color: textColor },
      ]}>
        {sticker.code}
      </Text>
      <Text
        style={[
          isTiny ? styles.nameTiny : isMedium ? styles.nameMedium : styles.nameSmall,
          { color: subColor },
        ]}
        numberOfLines={2}
      >
        {shortName(sticker, isTiny)}
      </Text>

      {dup && (
        <View style={[styles.dupBadge, isTiny && styles.dupBadgeTiny]}>
          <Text style={[styles.dupText, isTiny && { fontSize: 7 }]}>+{qty - 1}</Text>
        </View>
      )}
      {owned && <View style={[styles.dot, { backgroundColor: Colors.owned }]} />}
    </>
  );

  // ── Duplicados: efecto apilado ────────────────────────────────
  if (dup) {
    const mainRight  = stackOffset;
    const mainBottom = stackOffset;

    return (
      <View style={[
        styles.stackWrapper,
        isTiny   && styles.stackWrapperTiny,
        isMedium && styles.stackWrapperMedium,
      ]}>
        {/* Capa más lejana — solo si qty > 2 */}
        {qty > 2 && (
          <View style={[styles.stackLayerBase, {
            top: stackOffset * 2, left: stackOffset * 2,
            borderRadius: cardRadius,
            borderWidth: 1,
            borderColor: Colors.duplicate + '1F',
            backgroundColor: Colors.duplicate + '08',
          }]} />
        )}

        {/* Capa intermedia */}
        <View style={[styles.stackLayerBase, {
          top: stackOffset, left: stackOffset,
          borderRadius: cardRadius,
          borderWidth: 1,
          borderColor: Colors.duplicate + '38',
          backgroundColor: Colors.duplicate + '10',
        }]} />

        {/* Tarjeta principal encima */}
        <Pressable
          onPress={onTap}
          onLongPress={onLongPress}
          delayLongPress={400}
          style={({ pressed }) => [
            styles.stackMain,
            {
              right: mainRight,
              bottom: mainBottom,
              borderRadius: cardRadius,
              borderColor,
              borderWidth: borderW,
              backgroundColor: bgColor,
              padding: isTiny ? 3 : isMedium ? 6 : 4,
            },
            pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] },
          ]}
        >
          {cardContent}
        </Pressable>
      </View>
    );
  }

  // ── Normal (no duplicado) ─────────────────────────────────────
  return (
    <Pressable
      onPress={onTap}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.cell,
        isTiny   && styles.cellTiny,
        isMedium && styles.cellMedium,
        { borderColor, borderWidth: borderW, backgroundColor: bgColor },
        pressed && { opacity: 0.6, transform: [{ scale: 0.94 }] },
      ]}
    >
      {sticker.foil && (
        <View style={[styles.foilCorner, isTiny && styles.foilCornerTiny]} />
      )}
      <Text style={[
        isTiny ? styles.codeTiny : isMedium ? styles.codeMedium : styles.codeSmall,
        { color: textColor },
      ]}>
        {sticker.code}
      </Text>
      <Text
        style={[
          isTiny ? styles.nameTiny : isMedium ? styles.nameMedium : styles.nameSmall,
          { color: subColor },
        ]}
        numberOfLines={2}
      >
        {shortName(sticker, isTiny)}
      </Text>
      {owned && <View style={[styles.dot, { backgroundColor: Colors.owned }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ── Grid normal ───────────────────────────────────────────────
  cell: {
    flex: 1,
    aspectRatio: 0.72,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  cellTiny: {
    borderRadius: Radii.sm,
    padding: 3,
    aspectRatio: 0.62,
  },
  cellMedium: {
    borderRadius: Radii.lg,
    padding: 6,
  },

  // ── Stack (duplicados) ────────────────────────────────────────
  stackWrapper: {
    flex: 1,
    aspectRatio: 0.72,
    position: 'relative',
  },
  stackWrapperTiny:   { aspectRatio: 0.62 },
  stackWrapperMedium: { aspectRatio: 0.72 },

  // Layers: se anclan en right:0, bottom:0 y se desplazan con top/left inline
  stackLayerBase: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },

  // Tarjeta principal: cubre el área top-left dejando espacio a las capas
  stackMain: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // ── FOIL corner triangle ──────────────────────────────────────
  foilCorner: {
    position: 'absolute',
    top: 0, right: 0,
    width: 0, height: 0,
    borderStyle: 'solid',
    borderRightWidth: 18, borderTopWidth: 18,
    borderRightColor: Colors.gold,
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  foilCornerTiny: { borderRightWidth: 10, borderTopWidth: 10 },

  // ── Texto ─────────────────────────────────────────────────────
  codeTiny: {
    fontFamily: 'DMSans_700Bold', fontSize: 9,
    letterSpacing: 0.3, textAlign: 'center',
  },
  codeSmall: {
    fontFamily: 'DMSans_700Bold', fontSize: 12,
    letterSpacing: 0.5, textAlign: 'center',
  },
  codeMedium: {
    fontFamily: 'Oswald_600SemiBold', fontSize: 14,
    letterSpacing: 0.5, textAlign: 'center',
  },
  nameTiny: {
    fontFamily: 'DMSans_500Medium', fontSize: 8,
    textAlign: 'center', marginTop: 2, lineHeight: 10, paddingHorizontal: 1,
  },
  nameSmall: {
    fontFamily: 'DMSans_500Medium', fontSize: 9,
    textAlign: 'center', marginTop: 3, lineHeight: 11, paddingHorizontal: 2,
  },
  nameMedium: {
    fontFamily: 'DMSans_500Medium', fontSize: 11,
    textAlign: 'center', marginTop: 4, lineHeight: 14, paddingHorizontal: 2,
  },

  // ── Badges grid ───────────────────────────────────────────────
  dupBadge: {
    position: 'absolute', bottom: 2, right: 2,
    backgroundColor: Colors.duplicate + '30',
    paddingHorizontal: 4, paddingVertical: 1,
    borderRadius: 4, borderWidth: 1,
    borderColor: Colors.duplicate + '70',
  },
  dupBadgeTiny: { paddingHorizontal: 2, paddingVertical: 0 },
  dupText: {
    fontFamily: 'DMSans_700Bold', fontSize: 8, color: Colors.duplicate,
  },
  dot: {
    position: 'absolute', bottom: 3, right: 3,
    width: 6, height: 6, borderRadius: 3,
  },

  // ── Lista ─────────────────────────────────────────────────────
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4,
    borderRadius: Radii.md, borderLeftWidth: 3,
    borderTopWidth: 1, borderRightWidth: 1, borderBottomWidth: 1,
    borderTopColor: Colors.border, borderRightColor: Colors.border, borderBottomColor: Colors.border,
  },
  listCodeBox: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.sm,
    borderWidth: 1, backgroundColor: Colors.bgCardAlt,
    minWidth: 58, alignItems: 'center',
  },
  listCode: { fontFamily: 'DMSans_500Medium', fontSize: 11, letterSpacing: 1 },
  listName: { fontFamily: 'DMSans_500Medium', fontSize: 13, letterSpacing: 0.3 },
  foilLabel: {
    fontFamily: 'DMSans_500Medium', fontSize: 9, color: Colors.gold,
    letterSpacing: 1.5, marginTop: 2,
  },
  foilStar: { fontFamily: 'DMSans_500Medium', fontSize: 14, color: Colors.gold },
  listRight: { alignItems: 'center', justifyContent: 'center', minWidth: 36 },
  dupPill: {
    backgroundColor: Colors.duplicate + '20',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.duplicate + '80',
  },
  dupPillText: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: Colors.duplicate },
  emptyCircle: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 1.5, borderColor: Colors.border,
  },
});
