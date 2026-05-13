import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, Share, Platform, TextInput,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { Colors, Spacing, Radii } from '@/constants/theme';
import { useStickers, Section, Sticker } from '@/context/StickersContext';
import { FlagImage } from '@/components/ui/FlagImage';
import {
  X, ShareNetwork, CheckSquare, Square, MagnifyingGlass, ClipboardText, Check,
} from 'phosphor-react-native';

export type ExportType = 'missing' | 'duplicates';

interface Props {
  visible: boolean;
  onClose: () => void;
  type: ExportType;
}

type StickerWithExtras = Sticker & { extras: number };

interface SectionGroup {
  section: Section;
  stickers: StickerWithExtras[];
  extrasCount: number;
}

function flagEmoji(iso: string | null): string {
  if (!iso || !/^[A-Za-z]{2}$/.test(iso)) return '';
  return iso.toUpperCase().split('').map(c =>
    String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)
  ).join('');
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function buildText(type: ExportType, selected: SectionGroup[], totalStickers: number, totalExtras: number): string {
  if (type === 'missing') {
    const lines = selected.map(g => {
      const flag = flagEmoji(g.section.isoCode);
      const items = g.stickers.map(s => `${s.code} - ${s.name}`).join('\n');
      return `${flag ? flag + ' ' : ''}${g.section.name} (${g.stickers.length})\n${items}`;
    });
    return [
      '🔍 BUSCO - Panini Mundial 2026',
      '',
      ...lines.flatMap((l, i) => i < lines.length - 1 ? [l, ''] : [l]),
      '',
      `Total: ${totalStickers} cromo${totalStickers !== 1 ? 's' : ''} que me faltan`,
    ].join('\n');
  } else {
    const lines = selected.map(g => {
      const flag = flagEmoji(g.section.isoCode);
      const items = g.stickers.map(s =>
        s.extras > 1 ? `${s.code} - ${s.name} (+${s.extras})` : `${s.code} - ${s.name}`
      ).join('\n');
      return `${flag ? flag + ' ' : ''}${g.section.name} (${g.stickers.length} cromo${g.stickers.length !== 1 ? 's' : ''} · ${g.extrasCount} extra${g.extrasCount !== 1 ? 's' : ''})\n${items}`;
    });
    return [
      '🔄 OFREZCO - Panini Mundial 2026',
      '',
      ...lines.flatMap((l, i) => i < lines.length - 1 ? [l, ''] : [l]),
      '',
      `Total: ${totalExtras} cromo${totalExtras !== 1 ? 's' : ''} para cambiar`,
    ].join('\n');
  }
}

export function ExportModal({ visible, onClose, type }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const { getMissingStickers, getDuplicateStickers, sections } = useStickers();
  const [search, setSearch]           = useState('');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [copied, setCopied]           = useState(false);
  const copiedTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sectionData = useMemo((): SectionGroup[] => {
    if (type === 'missing') {
      const missing = getMissingStickers().map(s => ({ ...s, extras: 0 }));
      return sections
        .map(sec => ({ section: sec, stickers: missing.filter(s => s.teamCode === sec.code), extrasCount: 0 }))
        .filter(g => g.stickers.length > 0);
    } else {
      const duplicates = getDuplicateStickers();
      return sections
        .map(sec => {
          const stickers = duplicates.filter(s => s.teamCode === sec.code);
          return { section: sec, stickers, extrasCount: stickers.reduce((sum, s) => sum + s.extras, 0) };
        })
        .filter(g => g.stickers.length > 0);
    }
  }, [type, getMissingStickers, getDuplicateStickers, sections]);

  const allCodes = useMemo(() => new Set(sectionData.map(g => g.section.code)), [sectionData]);

  useEffect(() => {
    if (visible) {
      setSelectedCodes(new Set(allCodes));
      setSearch('');
      setCopied(false);
    }
  }, [visible]);

  const filteredData = useMemo(() => {
    const q = norm(search.trim());
    if (!q) return sectionData;
    return sectionData.filter(g => norm(g.section.name).includes(q));
  }, [sectionData, search]);

  const allSelected = selectedCodes.size > 0 && selectedCodes.size === allCodes.size;

  const toggleSection = useCallback((code: string) => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedCodes(allSelected ? new Set() : new Set(allCodes));
  }, [allSelected, allCodes]);

  const { selectedStickerCount, selectedExtrasCount, selectedGroups } = useMemo(() => {
    const selected = sectionData.filter(g => selectedCodes.has(g.section.code));
    return {
      selectedGroups:       selected,
      selectedStickerCount: selected.reduce((sum, g) => sum + g.stickers.length, 0),
      selectedExtrasCount:  selected.reduce((sum, g) => sum + g.extrasCount, 0),
    };
  }, [sectionData, selectedCodes]);

  const accentColor = type === 'missing' ? Colors.red : Colors.duplicate;
  const disabled    = selectedCodes.size === 0;

  const getExportText = useCallback(() =>
    buildText(type, selectedGroups, selectedStickerCount, selectedExtrasCount),
    [type, selectedGroups, selectedStickerCount, selectedExtrasCount],
  );

  const handleShare = useCallback(async () => {
    if (disabled) return;
    await Share.share({ message: getExportText() });
    onClose();
  }, [disabled, getExportText, onClose]);

  const handleCopy = useCallback(async () => {
    if (disabled) return;
    await Clipboard.setStringAsync(getExportText());
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [disabled, getExportText]);

  const summaryText = type === 'missing'
    ? `${selectedStickerCount} cromo${selectedStickerCount !== 1 ? 's' : ''}`
    : `${selectedStickerCount} · ${selectedExtrasCount} extras`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalContainer}>
        {/* Visual backdrop — pointerEvents none so it never intercepts touches */}
        <View style={styles.backdrop} pointerEvents="none" />

        {/* Dismiss area — only covers space ABOVE the sheet, no overlap */}
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={[styles.sheet, { height: windowHeight * 0.82 }]}>
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.headerIcon, { backgroundColor: accentColor + '18', borderColor: accentColor + '30' }]}>
            <ShareNetwork size={20} color={accentColor} weight="fill" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {type === 'missing' ? 'Exportar · Me Faltan' : 'Exportar · Repetidos'}
            </Text>
            <Text style={styles.subtitle}>Elige qué selecciones incluir</Text>
          </View>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <X size={18} color={Colors.textMuted} weight="bold" />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <MagnifyingGlass size={14} color={Colors.textMuted} weight="bold" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar selección…"
            placeholderTextColor={Colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={13} color={Colors.textMuted} weight="bold" />
            </Pressable>
          )}
        </View>

        {/* Toggle all — solo cuando no hay búsqueda activa */}
        {!search && (
          <Pressable style={styles.toggleAllRow} onPress={toggleAll}>
            {allSelected
              ? <CheckSquare size={20} color={accentColor} weight="fill" />
              : <Square size={20} color={Colors.textMuted} weight="regular" />
            }
            <Text style={styles.toggleAllText}>
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </Text>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </Pressable>
        )}

        {/* Section list — flex:1 so it fills remaining space and action buttons stay pinned */}
        <View style={{ flex: 1 }}>
          <FlashList
            data={filteredData}
            estimatedItemSize={50}
            keyExtractor={g => g.section.code}
            extraData={selectedCodes}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 4 }} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Sin resultados para "{search}"</Text>
              </View>
            }
            renderItem={({ item: g }) => {
              const selected = selectedCodes.has(g.section.code);
              return (
                <Pressable
                  style={[
                    styles.sectionRow,
                    selected && { borderColor: accentColor + '40', backgroundColor: accentColor + '08' },
                  ]}
                  onPress={() => toggleSection(g.section.code)}
                >
                  <FlagImage isoCode={g.section.isoCode} size={22} />
                  <Text style={styles.sectionName} numberOfLines={1}>{g.section.name}</Text>
                  <View style={[
                    styles.badge,
                    selected && { backgroundColor: accentColor + '20', borderColor: accentColor + '40' },
                  ]}>
                    <Text style={[styles.badgeText, selected && { color: accentColor }]}>
                      {type === 'missing' ? g.stickers.length : `${g.stickers.length} (+${g.extrasCount})`}
                    </Text>
                  </View>
                  {selected
                    ? <CheckSquare size={18} color={accentColor} weight="fill" />
                    : <Square size={18} color={Colors.textMuted} weight="regular" />
                  }
                </Pressable>
              );
            }}
          />
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {/* Copiar */}
          <Pressable
            style={[styles.copyBtn, disabled && { opacity: 0.4 }, copied && { borderColor: Colors.owned }]}
            onPress={handleCopy}
            disabled={disabled}
          >
            {copied
              ? <Check size={16} color={Colors.owned} weight="bold" />
              : <ClipboardText size={16} color={Colors.textSecondary} weight="bold" />
            }
            <Text style={[styles.copyBtnText, copied && { color: Colors.owned }]}>
              {copied ? '¡Copiado!' : 'Copiar'}
            </Text>
          </Pressable>

          {/* Compartir */}
          <Pressable
            style={[styles.shareBtn, { backgroundColor: accentColor }, disabled && { opacity: 0.4 }]}
            onPress={handleShare}
            disabled={disabled}
          >
            <ShareNetwork size={16} color={Colors.white} weight="bold" />
            <Text style={styles.shareBtnText}>Compartir</Text>
          </Pressable>
        </View>

        <View style={{ height: Platform.OS === 'ios' ? 24 : 12 }} />
      </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderTopColor: Colors.borderBright,
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
    maxHeight: '82%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderBright,
    alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
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
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.bg, borderRadius: Radii.md,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 13,
    color: Colors.textPrimary, padding: 0, margin: 0,
  },
  toggleAllRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: Colors.bg, borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8,
  },
  toggleAllText: {
    flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.textSecondary,
  },
  summaryText: {
    fontFamily: 'DMSans_500Medium', fontSize: 11, color: Colors.textMuted,
  },
  sectionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
    backgroundColor: Colors.bgCardAlt,
    borderRadius: Radii.md,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 6,
  },
  sectionName: {
    flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13, color: Colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.border, backgroundColor: Colors.bg,
  },
  badgeText: {
    fontFamily: 'DMSans_700Bold', fontSize: 11, color: Colors.textMuted,
  },
  empty: {
    paddingVertical: 24, alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'DMSans_400Regular', fontSize: 13, color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row', gap: 10, marginTop: 12,
  },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    flex: 1, paddingVertical: 13,
    borderRadius: Radii.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  copyBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.textSecondary,
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    flex: 2, paddingVertical: 13,
    borderRadius: Radii.full,
  },
  shareBtnText: {
    fontFamily: 'DMSans_700Bold', fontSize: 14, color: Colors.white,
  },
});
