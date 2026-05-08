import { View, Text, StyleSheet, TextInput, FlatList, Pressable } from 'react-native';
import { useState, useMemo } from 'react';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Sticker } from '@/context/StickersContext';
import { FlagImage } from '@/components/ui/FlagImage';
import { MagnifyingGlass } from 'phosphor-react-native';
import { useRouter } from 'expo-router';

function ResultRow({ sticker, qty, onPress }: { sticker: Sticker; qty: number; onPress: () => void }) {
  const statusColor = qty === 0 ? Colors.missing : qty === 1 ? Colors.owned : Colors.duplicate;
  const statusLabel = qty === 0 ? 'FALTA' : qty === 1 ? 'TENGO' : `x${qty}`;

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]} onPress={onPress}>
      <View style={[styles.codeBadge, sticker.foil && styles.codeBadgeFoil]}>
        <Text style={[Typography.codeM, { color: sticker.foil ? Colors.gold : Colors.textSecondary }]}>
          {sticker.code}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>{sticker.name}</Text>
        <View style={styles.teamRow}>
          <FlagImage isoCode={sticker.isoCode} size={14} style={{ borderRadius: 2 }} />
          <Text style={[Typography.bodyS, { color: Colors.textMuted, marginLeft: 6 }]}>{sticker.teamName}</Text>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '50' }]}>
        <Text style={[Typography.labelS, { color: statusColor }]}>{statusLabel}</Text>
      </View>
    </Pressable>
  );
}

export default function BuscarScreen() {
  const { stickers, quantities } = useStickers();
  const [query, setQuery] = useState('');
  const router = useRouter();

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    return stickers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.teamName.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [query, stickers]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[Typography.labelM, { color: Colors.red, letterSpacing: 3 }]}>ÁLBUM 2026</Text>
        <Text style={[Typography.titleXL, { color: Colors.textPrimary, marginTop: 4 }]}>Buscar</Text>
      </View>

      <View style={styles.searchBox}>
        <MagnifyingGlass size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.input}
          placeholder="Jugador, código o selección..."
          placeholderTextColor={Colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 40 }}>🔍</Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 12 }]}>
            Sin resultados para "{query}"
          </Text>
        </View>
      )}

      {query.trim().length < 2 && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 40 }}>⌨️</Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 12 }]}>
            Escribe al menos 2 letras para buscar
          </Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={item => item.code}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ResultRow
            sticker={item}
            qty={quantities[item.code] ?? 0}
            onPress={() => router.push(`/seleccion/${item.teamCode}`)}
          />
        )}
        ListFooterComponent={<View style={{ height: 100 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 56, paddingBottom: 16, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, margin: Spacing.lg,
    borderRadius: Radii.lg, paddingHorizontal: Spacing.md, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: {
    flex: 1, ...Typography.bodyL, color: Colors.textPrimary,
  },
  list: { paddingHorizontal: Spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    padding: Spacing.md, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  codeBadge: {
    backgroundColor: Colors.bgCardAlt, paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radii.sm, minWidth: 52, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  codeBadgeFoil: { borderColor: Colors.gold + '60', backgroundColor: Colors.gold + '15' },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.full, borderWidth: 1,
  },
  emptyState: { alignItems: 'center', marginTop: 60 },
  teamRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
