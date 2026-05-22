import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, Sticker } from '@/context/StickersContext';
import { ArrowLeft, MagnifyingGlass, Swap, WarningCircle, UserPlus, Trash } from 'phosphor-react-native';
import { FlagImage } from '@/components/ui/FlagImage';

interface Profile {
  id: string;
  name: string;
  text: string;
}

interface MatchResult {
  sticker: Sticker;
  friends: string[];
}

function parseMultipleLists(profiles: Profile[], allStickers: Sticker[]) {
  const needsMap: Record<string, string[]> = {};
  const swapsMap: Record<string, string[]> = {};

  const addToMap = (map: Record<string, string[]>, code: string, friendName: string) => {
    if (!map[code]) map[code] = [];
    if (!map[code].includes(friendName)) {
      map[code].push(friendName);
    }
  };

  profiles.forEach(profile => {
    let mode: 'need' | 'swaps' | null = null;
    const lines = profile.text.split('\n');

    for (const line of lines) {
      const lower = line.toLowerCase().trim();
      if (lower.includes('i need') || lower.includes('faltan') || lower.includes('busco')) {
        mode = 'need';
        continue;
      }
      if (lower.includes('swaps') || lower.includes('repetidas') || lower.includes('tengo') || lower.includes('cambios')) {
        mode = 'swaps';
        continue;
      }
      
      if (!mode) continue;

      const match = line.match(/^([A-Z]{2,4})\s*.*?:\s*(.*)$/i);
      if (match) {
        const prefix = match[1].toUpperCase();
        const numbersStr = match[2];
        const numbers = numbersStr.split(/[,-\s]+/).map(n => n.trim()).filter(Boolean);
        
        for (const num of numbers) {
          let code = `${prefix}${num}`;
          if (num === '00' || code === 'FWC00') code = '00';
          
          const found = allStickers.find(s => s.code.toUpperCase() === code.toUpperCase());
          if (found) {
            if (mode === 'need') addToMap(needsMap, found.code, profile.name || 'Sin nombre');
            if (mode === 'swaps') addToMap(swapsMap, found.code, profile.name || 'Sin nombre');
          }
        }
      }
    }
  });

  return { needsMap, swapsMap };
}

function MatchRow({ match, badge, warning }: { match: MatchResult; badge?: string; warning?: string }) {
  const { sticker, friends } = match;
  return (
    <View style={[styles.row, warning ? styles.rowWarning : null]}>
      <FlagImage isoCode={sticker.isoCode} size={28} style={{ borderRadius: 4 }} />
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rowCode}>{sticker.code}</Text>
          {badge ? (
            <View style={styles.badgeDup}>
              <Text style={styles.badgeDupText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.rowName} numberOfLines={1}>{sticker.name}</Text>
        <Text style={styles.rowFriends} numberOfLines={2}>
          {friends.join(', ')}
        </Text>
        {warning ? (
          <Text style={styles.warningText}>{warning}</Text>
        ) : null}
      </View>
    </View>
  );
}

export default function AnalizadorScreen() {
  const router = useRouter();
  const { stickers, quantities } = useStickers();
  
  const [profiles, setProfiles] = useState<Profile[]>([
    { id: '1', name: 'Amigo 1', text: '' }
  ]);
  const [analyzed, setAnalyzed] = useState(false);
  
  const [canGive, setCanGive] = useState<MatchResult[]>([]);
  const [canReceive, setCanReceive] = useState<MatchResult[]>([]);

  const addProfile = () => {
    setProfiles(prev => [...prev, { id: Date.now().toString(), name: `Amigo ${prev.length + 1}`, text: '' }]);
  };

  const removeProfile = (id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
  };

  const updateProfile = (id: string, field: 'name' | 'text', value: string) => {
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleAnalyze = () => {
    // Solo analizamos perfiles que tengan texto
    const validProfiles = profiles.filter(p => p.text.trim().length > 0);
    if (validProfiles.length === 0) return;
    
    const { needsMap, swapsMap } = parseMultipleLists(validProfiles, stickers);
    
    // Lo que le puedes dar: cromos que ellos necesitan y tú tienes repetidos (> 1)
    const giveResults: MatchResult[] = [];
    Object.entries(needsMap).forEach(([code, friends]) => {
      const qty = quantities[code] ?? 0;
      if (qty > 1) {
        const sticker = stickers.find(s => s.code === code);
        if (sticker) giveResults.push({ sticker, friends });
      }
    });
    
    // Lo que puedes recibir: cromos que ellos tienen repetidos y a ti te faltan (== 0)
    const receiveResults: MatchResult[] = [];
    Object.entries(swapsMap).forEach(([code, friends]) => {
      const qty = quantities[code] ?? 0;
      if (qty === 0) {
        const sticker = stickers.find(s => s.code === code);
        if (sticker) receiveResults.push({ sticker, friends });
      }
    });

    setCanGive(giveResults);
    setCanReceive(receiveResults);
    setAnalyzed(true);
  };

  const handleClear = () => {
    setAnalyzed(false);
  };

  const hasAnyText = profiles.some(p => p.text.trim().length > 0);

  // Computar amigos únicos para la sección final
  const uniqueFriends = new Set<string>();
  canGive.forEach(m => m.friends.forEach(f => uniqueFriends.add(f)));
  canReceive.forEach(m => m.friends.forEach(f => uniqueFriends.add(f)));
  const friendsList = Array.from(uniqueFriends);

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={18} color={Colors.textPrimary} weight="bold" />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={styles.headerLabel}>MATCHMAKER GRUPAL</Text>
          <Text style={styles.headerTitle}>Analizador de Listas</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {!analyzed ? (
          <View style={styles.padH}>
            <Text style={styles.instruction}>
              Pega las listas de tus amigos aquí para encontrar los cruces perfectos.
            </Text>
            
            {profiles.map((profile, index) => (
              <View key={profile.id} style={styles.profileCard}>
                <View style={styles.profileHeader}>
                  <TextInput
                    style={styles.profileNameInput}
                    value={profile.name}
                    onChangeText={(val) => updateProfile(profile.id, 'name', val)}
                    placeholder="Nombre del amigo"
                    placeholderTextColor={Colors.textMuted}
                  />
                  {profiles.length > 1 && (
                    <Pressable onPress={() => removeProfile(profile.id)} hitSlop={8}>
                      <Trash size={16} color={Colors.textMuted} />
                    </Pressable>
                  )}
                </View>
                <TextInput
                  style={styles.profileTextInput}
                  multiline
                  placeholder="Pega su lista aquí (I need..., Swaps...)"
                  placeholderTextColor={Colors.textMuted}
                  value={profile.text}
                  onChangeText={(val) => updateProfile(profile.id, 'text', val)}
                  textAlignVertical="top"
                  autoCorrect={false}
                />
              </View>
            ))}

            <Pressable style={styles.addBtn} onPress={addProfile}>
              <UserPlus size={16} color={Colors.trade} />
              <Text style={styles.addBtnText}>Añadir amigo</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.analyzeBtn, (!hasAnyText || pressed) && { opacity: 0.7 }]}
              onPress={handleAnalyze}
              disabled={!hasAnyText}
            >
              <MagnifyingGlass size={18} color={Colors.white} weight="bold" />
              <Text style={styles.analyzeBtnText}>Analizar Listas</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.padH}>
            <View style={styles.resultsHeader}>
              <View style={styles.resultsIconWrap}>
                <Swap size={24} color={Colors.trade} weight="fill" />
              </View>
              <Text style={styles.resultsTitle}>¡Análisis Completo!</Text>
              <Text style={styles.resultsSub}>Estos son los intercambios viables en tu grupo.</Text>
            </View>

            {/* Tú puedes darle */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors.duplicate }]}>TÚ LES PUEDES DAR ({canGive.length})</Text>
                <Text style={styles.sectionDesc}>Ellos los buscan y tú los tienes repetidos</Text>
              </View>
              {canGive.length === 0 ? (
                <View style={styles.emptyMatch}>
                  <WarningCircle size={20} color={Colors.textMuted} />
                  <Text style={styles.emptyMatchText}>No tienes ninguno de los cromos que buscan.</Text>
                </View>
              ) : (
                canGive.map(match => {
                  const extras = (quantities[match.sticker.code] ?? 0) - 1;
                  const isScarce = match.friends.length > extras;
                  return (
                    <MatchRow 
                      key={match.sticker.code} 
                      match={match} 
                      badge={`Tienes ${extras} Repetido${extras !== 1 ? 's' : ''}`} 
                      warning={isScarce ? `⚠️ Tienes ${extras} para ${match.friends.length} interesados` : undefined}
                    />
                  );
                })
              )}
            </View>

            {/* Tú puedes recibir */}
            <View style={[styles.sectionCard, { marginTop: Spacing.lg }]}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: Colors.owned }]}>TÚ PUEDES RECIBIR ({canReceive.length})</Text>
                <Text style={styles.sectionDesc}>Ellos los tienen repetidos y a ti te faltan</Text>
              </View>
              {canReceive.length === 0 ? (
                <View style={styles.emptyMatch}>
                  <WarningCircle size={20} color={Colors.textMuted} />
                  <Text style={styles.emptyMatchText}>Ninguno tiene un cromo que te sirva.</Text>
                </View>
              ) : (
                canReceive.map(match => <MatchRow key={match.sticker.code} match={match} />)
              )}
            </View>

            {/* Creador de Tratos Rápidos */}
            {friendsList.length > 0 && (
              <View style={[styles.sectionCard, { marginTop: Spacing.xl, borderColor: Colors.trade, backgroundColor: Colors.trade + '08' }]}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: Colors.trade }]}>ARMAR INTERCAMBIOS</Text>
                  <Text style={styles.sectionDesc}>Ir directo al registro pre-filtrado</Text>
                </View>
                {friendsList.map(friend => {
                  const givenStr = canGive.filter(m => m.friends.includes(friend)).map(m => m.sticker.code).join(',');
                  const receiveStr = canReceive.filter(m => m.friends.includes(friend)).map(m => m.sticker.code).join(',');
                  return (
                    <Pressable
                      key={friend}
                      style={({ pressed }) => [styles.tradeBuilderBtn, pressed && { opacity: 0.8 }]}
                      onPress={() => router.push(`/trade-builder?friendName=${encodeURIComponent(friend)}&filterGiven=${encodeURIComponent(givenStr)}&filterReceive=${encodeURIComponent(receiveStr)}`)}
                    >
                      <Swap size={18} color={Colors.white} weight="bold" />
                      <Text style={styles.tradeBuilderBtnText}>Armar trato con {friend}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.resetBtn, pressed && { opacity: 0.7 }]}
              onPress={handleClear}
            >
              <Text style={styles.resetBtnText}>Volver a editar listas</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  padH: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  
  header: {
    paddingTop: 52, paddingBottom: 16,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.bgCard,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitles: { gap: 1 },
  headerLabel: {
    fontFamily: 'DMSans_500Medium', fontSize: 11,
    color: Colors.trade, letterSpacing: 3,
  },
  headerTitle: {
    fontFamily: 'Oswald_700Bold', fontSize: 24,
    color: Colors.textPrimary, letterSpacing: 0,
  },

  instruction: {
    ...Typography.bodyM, color: Colors.textSecondary, marginBottom: Spacing.md,
  },
  
  profileCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.md, overflow: 'hidden',
  },
  profileHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bgCardAlt, paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  profileNameInput: {
    flex: 1, ...Typography.labelM, color: Colors.textPrimary, padding: 0,
  },
  profileTextInput: {
    height: 120, padding: Spacing.md, ...Typography.bodyS, color: Colors.textPrimary,
  },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: Radii.full,
    borderWidth: 1, borderColor: Colors.trade + '60', backgroundColor: Colors.trade + '10',
    marginBottom: Spacing.xl,
  },
  addBtnText: { ...Typography.labelM, color: Colors.trade },

  analyzeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.trade, borderRadius: Radii.full,
    paddingVertical: 14,
  },
  analyzeBtnText: { ...Typography.labelL, color: Colors.white },

  resultsHeader: { alignItems: 'center', marginBottom: Spacing.xl, marginTop: Spacing.sm },
  resultsIconWrap: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.trade + '20',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  resultsTitle: { ...Typography.titleL, color: Colors.textPrimary },
  resultsSub: { ...Typography.bodyM, color: Colors.textSecondary, textAlign: 'center' },

  sectionCard: {
    backgroundColor: Colors.bgCard, borderRadius: Radii.lg,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.md,
  },
  sectionHeader: { marginBottom: Spacing.md },
  sectionTitle: { ...Typography.labelM, letterSpacing: 1.5, marginBottom: 2 },
  sectionDesc: { ...Typography.bodyS, color: Colors.textMuted },
  
  emptyMatch: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: Spacing.sm },
  emptyMatchText: { ...Typography.bodyS, color: Colors.textMuted, flex: 1 },

  tradeBuilderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.trade, paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: Radii.md, marginBottom: Spacing.sm,
  },
  tradeBuilderBtnText: { ...Typography.labelM, color: Colors.white, flex: 1 },

  resetBtn: {
    marginTop: Spacing.xxl, paddingVertical: 14,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', backgroundColor: Colors.bgCardAlt,
  },
  resetBtnText: { ...Typography.labelL, color: Colors.textSecondary },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: Spacing.sm,
    borderRadius: Radii.md, marginBottom: 2,
    backgroundColor: Colors.bg,
    borderWidth: 1, borderColor: Colors.border,
  },
  rowWarning: { borderColor: Colors.duplicate + '80', backgroundColor: Colors.duplicate + '10' },
  rowCode:  { ...Typography.codeL, color: Colors.textPrimary },
  rowName:  { ...Typography.bodyM, color: Colors.textPrimary, marginTop: 1 },
  rowFriends: { ...Typography.bodyS, color: Colors.textSecondary, marginTop: 3 },
  warningText: { ...Typography.labelM, color: Colors.duplicate, marginTop: 2, fontStyle: 'italic' },
  
  badgeDup: {
    backgroundColor: Colors.duplicate + '22', borderWidth: 1, borderColor: Colors.duplicate + '55',
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radii.full,
  },
  badgeDupText: { ...Typography.labelS, color: Colors.duplicate },
});
