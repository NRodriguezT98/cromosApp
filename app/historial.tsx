import React, { useMemo } from 'react';
import { View, Text, SectionList, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Typography, Spacing, Radii } from '@/constants/theme';
import { useStickers, ActivityEntry } from '@/context/StickersContext';
import { ArrowLeft, Plus, Minus, Trash } from 'phosphor-react-native';

function formatDay(ts: number): string {
  const d    = new Date(ts);
  const now  = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString())  return 'Hoy';
  if (d.toDateString() === yest.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function entryLabel(entry: ActivityEntry): string {
  if (entry.action === 'add') {
    if (entry.qty === 1) return 'Añadido';
    return `${entry.qty - 1} repetido${entry.qty - 1 !== 1 ? 's' : ''}`;
  }
  if (entry.qty === 0) return 'Eliminado';
  if (entry.qty === 1) return 'Sin repetidos';
  return `${entry.qty - 1} repetido${entry.qty - 1 !== 1 ? 's' : ''}`;
}

type DaySection = { title: string; timestamp: number; data: ActivityEntry[] };

export default function HistorialScreen() {
  const { history, clearHistory } = useStickers();
  const router = useRouter();

  const sections: DaySection[] = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    const timestamps: Record<string, number> = {};
    for (const entry of history) {
      const key = new Date(entry.timestamp).toDateString();
      if (!groups[key]) { groups[key] = []; timestamps[key] = entry.timestamp; }
      groups[key].push(entry);
    }
    return Object.entries(groups).map(([key, data]) => ({
      title: formatDay(new Date(key).getTime()),
      timestamp: timestamps[key],
      data,
    }));
  }, [history]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={Colors.textPrimary} weight="bold" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[Typography.labelM, { color: Colors.textMuted, letterSpacing: 3 }]}>REGISTRO</Text>
          <Text style={[Typography.titleXL, { color: Colors.textPrimary, marginTop: 2 }]}>Historial</Text>
        </View>
        {history.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={clearHistory}>
            <Trash size={15} color={Colors.red} weight="bold" />
            <Text style={[Typography.labelM, { color: Colors.red, marginLeft: 5 }]}>Borrar todo</Text>
          </Pressable>
        )}
      </View>

      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[Typography.titleM, { color: Colors.textSecondary, textAlign: 'center' }]}>Sin actividad</Text>
          <Text style={[Typography.bodyM, { color: Colors.textMuted, textAlign: 'center', marginTop: 8 }]}>
            Aquí aparecerán los cromos que añadas o elimines
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => `${item.code}-${item.timestamp}-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.dayHeader}>
              <Text style={[Typography.labelM, { color: Colors.textMuted, letterSpacing: 2, flex: 1 }]}>
                {title.toUpperCase()}
              </Text>
              <Text style={[Typography.labelS, { color: Colors.textMuted }]}>{data.length} movimiento{data.length !== 1 ? 's' : ''}</Text>
            </View>
          )}
          renderItem={({ item: entry, index, section }) => {
            const isAdd  = entry.action === 'add';
            const color  = isAdd ? Colors.owned : Colors.red;
            const isLast = index === section.data.length - 1;
            return (
              <View style={[styles.entryRow, !isLast && styles.entryBorder]}>
                <View style={[styles.icon, { backgroundColor: color + '20' }]}>
                  {isAdd
                    ? <Plus size={13} color={color} weight="bold" />
                    : <Minus size={13} color={color} weight="bold" />}
                </View>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={[Typography.labelL, { color: Colors.textPrimary }]} numberOfLines={1}>
                    {entry.code} · {entry.name}
                  </Text>
                  <Text style={[Typography.bodyS, { color: Colors.textMuted }]} numberOfLines={1}>
                    {entry.teamName}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 3 }}>
                  <Text style={[Typography.labelS, { color }]}>{entryLabel(entry)}</Text>
                  <Text style={[Typography.bodyS, { color: Colors.textMuted, fontSize: 11 }]}>
                    {formatTime(entry.timestamp)}
                  </Text>
                </View>
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 60 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    paddingTop: 52, paddingBottom: 12, paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  clearBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: Radii.full, borderWidth: 1,
    borderColor: Colors.red + '40', backgroundColor: Colors.red + '10',
  },
  list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  dayHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, marginTop: Spacing.md, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgCard, marginBottom: 1,
  },
  entryBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  icon: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
});
