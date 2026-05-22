import React, { createContext, useContext, useEffect, useReducer, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMMKV } from 'react-native-mmkv';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { rawStickersData } from '@/constants/stickersData';

export type StickerType = 'player' | 'team_logo' | 'team_photo' | 'special';

export interface TradeSticker {
  code: string;
  name: string;
  teamName: string;
}

export interface TradeEntry {
  id: string;
  timestamp: number;
  given: TradeSticker[];
  received: TradeSticker[];
}

export interface Sticker {
  albumNumber: number;
  code: string;
  section: string;
  name: string;
  teamCode: string;
  teamName: string;
  isoCode: string | null;
  type: StickerType;
  foil: boolean;
  quantity: number;
}

export interface Section {
  code: string;
  name: string;
  isoCode: string | null;
  total: number;
  group: string | null;
}

export interface StickerStats {
  total: number;
  owned: number;
  missing: number;
  duplicates: number;
  duplicateCount: number;
  completionPct: number;
}

interface State {
  quantities: Record<string, number>;
  loaded: boolean;
}

type Action =
  | { type: 'LOAD'; quantities: Record<string, number> }
  | { type: 'SET_QTY'; code: string; qty: number }
  | { type: 'BATCH_SET_QTY'; updates: Record<string, number> };

export interface ActivityEntry {
  code: string;
  name: string;
  teamName: string;
  action: 'add' | 'remove' | 'trade_in' | 'trade_out';
  qty: number;
  timestamp: number;
}

const STORAGE_KEY     = 'cromitos_quantities';
const HISTORY_KEY     = 'cromitos_history';
const TRADES_KEY      = 'cromitos_trades';
const BACKUP_META_KEY = 'cromitos_last_backup';
const MIGRATED_KEY    = 'cromitos_migrated_v1';
const BACKUP_VERSION  = 1;

// Legacy AsyncStorage keys (only used during one-time migration)
const AS_STORAGE_KEY     = '@cromitos_quantities';
const AS_HISTORY_KEY     = '@cromitos_history';
const AS_BACKUP_META_KEY = '@cromitos_last_backup';

const storage = createMMKV();

function loadInitialState(): State {
  if (!storage.getBoolean(MIGRATED_KEY)) {
    return { quantities: {}, loaded: false };
  }
  const raw = storage.getString(STORAGE_KEY);
  return { quantities: raw ? JSON.parse(raw) : {}, loaded: true };
}

function loadInitialHistory(): ActivityEntry[] {
  if (!storage.getBoolean(MIGRATED_KEY)) return [];
  const raw = storage.getString(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

function loadInitialBackupDate(): number | null {
  if (!storage.getBoolean(MIGRATED_KEY)) return null;
  const raw = storage.getString(BACKUP_META_KEY);
  return raw ? Number(raw) : null;
}

function loadInitialTrades(): TradeEntry[] {
  if (!storage.getBoolean(MIGRATED_KEY)) return [];
  const raw = storage.getString(TRADES_KEY);
  return raw ? JSON.parse(raw) : [];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return { quantities: action.quantities, loaded: true };
    case 'SET_QTY':
      return {
        ...state,
        quantities: { ...state.quantities, [action.code]: action.qty },
      };
    case 'BATCH_SET_QTY':
      return {
        ...state,
        quantities: { ...state.quantities, ...action.updates },
      };
    default:
      return state;
  }
}

interface ContextValue {
  stickers: Sticker[];
  sections: Section[];
  quantities: Record<string, number>;
  loaded: boolean;
  history: ActivityEntry[];
  trades: TradeEntry[];
  setQuantity: (code: string, qty: number) => void;
  increment: (code: string) => void;
  decrement: (code: string) => void;
  clearHistory: () => void;
  addTrade: (given: string[], received: string[]) => void;
  deleteTrade: (id: string) => void;
  getStats: () => StickerStats;
  getSectionStats: (sectionCode: string) => StickerStats;
  getSectionStickers: (sectionCode: string) => Sticker[];
  getMissingStickers: () => Sticker[];
  getDuplicateStickers: () => Array<Sticker & { extras: number }>;
  exportBackup: () => Promise<'ok' | string>;
  importBackup: (jsonString: string) => Promise<'ok' | 'invalid' | 'error'>;
  lastBackupDate: number | null;
}

const StickersContext = createContext<ContextValue | null>(null);

const stickers: Sticker[] = rawStickersData.stickers;
const sections: Section[] = rawStickersData.sections;

export function StickersProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch]         = useReducer(reducer, undefined, loadInitialState);
  const [history, setHistory]     = useState<ActivityEntry[]>(loadInitialHistory);
  const [trades, setTrades]       = useState<TradeEntry[]>(loadInitialTrades);
  const [lastBackupDate, setLastBackupDate] = useState<number | null>(loadInitialBackupDate);

  // ── One-time migration from AsyncStorage → MMKV ───────────────────────────
  useEffect(() => {
    if (storage.getBoolean(MIGRATED_KEY)) return;

    Promise.all([
      AsyncStorage.getItem(AS_STORAGE_KEY),
      AsyncStorage.getItem(AS_HISTORY_KEY),
      AsyncStorage.getItem(AS_BACKUP_META_KEY),
    ]).then(([rawQty, rawHist, rawBackup]) => {
      const quantities = rawQty ? JSON.parse(rawQty) : {};
      const hist: ActivityEntry[] = rawHist ? JSON.parse(rawHist) : [];
      const backupDate = rawBackup ? Number(rawBackup) : null;

      storage.set(STORAGE_KEY, JSON.stringify(quantities));
      if (rawHist)   storage.set(HISTORY_KEY, rawHist);
      if (rawBackup) storage.set(BACKUP_META_KEY, rawBackup);
      storage.set(MIGRATED_KEY, true);

      dispatch({ type: 'LOAD', quantities });
      setHistory(hist);
      if (backupDate) setLastBackupDate(backupDate);

      AsyncStorage.multiRemove([AS_STORAGE_KEY, AS_HISTORY_KEY, AS_BACKUP_META_KEY]);
    });
  }, []);

  // ── Persist quantities ─────────────────────────────────────────────────────
  useEffect(() => {
    if (state.loaded) {
      storage.set(STORAGE_KEY, JSON.stringify(state.quantities));
    }
  }, [state.quantities, state.loaded]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const pushHistory = useCallback((code: string, action: 'add' | 'remove', qty: number) => {
    const sticker = stickers.find(s => s.code === code);
    if (!sticker) return;
    const sectionName = sections.find(sec => sec.code === sticker.teamCode)?.name ?? sticker.teamName;
    const entry: ActivityEntry = { code, name: sticker.name, teamName: sectionName, action, qty, timestamp: Date.now() };
    setHistory(prev => {
      const next = [entry, ...prev];
      storage.set(HISTORY_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setQuantity = useCallback((code: string, qty: number) => {
    dispatch({ type: 'SET_QTY', code, qty: Math.max(0, qty) });
  }, []);

  const increment = useCallback((code: string) => {
    const newQty = (state.quantities[code] ?? 0) + 1;
    dispatch({ type: 'SET_QTY', code, qty: newQty });
    pushHistory(code, 'add', newQty);
  }, [state.quantities, pushHistory]);

  const decrement = useCallback((code: string) => {
    const current = state.quantities[code] ?? 0;
    if (current === 0) return;
    const newQty = current - 1;
    dispatch({ type: 'SET_QTY', code, qty: newQty });
    pushHistory(code, 'remove', newQty);
  }, [state.quantities, pushHistory]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    storage.remove(HISTORY_KEY);
  }, []);

  const addTrade = useCallback((givenCodes: string[], receivedCodes: string[]) => {
    const now = Date.now();
    const stickerInfo = (code: string): TradeSticker => {
      const s = stickers.find(st => st.code === code)!;
      const sectionName = sections.find(sec => sec.code === s.teamCode)?.name ?? s.teamName;
      return { code, name: s.name, teamName: sectionName };
    };

    // Compute final quantities for all involved stickers
    const updates: Record<string, number> = {};
    for (const code of givenCodes) {
      updates[code] = Math.max(0, (state.quantities[code] ?? 0) - 1);
    }
    for (const code of receivedCodes) {
      const current = updates[code] ?? (state.quantities[code] ?? 0);
      updates[code] = current + 1;
    }
    dispatch({ type: 'BATCH_SET_QTY', updates });

    // Register history entries for all stickers involved in the trade
    const historyEntries: ActivityEntry[] = [
      ...givenCodes.map(code => {
        const s = stickers.find(st => st.code === code)!;
        const sectionName = sections.find(sec => sec.code === s.teamCode)?.name ?? s.teamName;
        return { code, name: s.name, teamName: sectionName, action: 'trade_out' as const, qty: updates[code], timestamp: now };
      }),
      ...receivedCodes.map(code => {
        const s = stickers.find(st => st.code === code)!;
        const sectionName = sections.find(sec => sec.code === s.teamCode)?.name ?? s.teamName;
        return { code, name: s.name, teamName: sectionName, action: 'trade_in' as const, qty: updates[code], timestamp: now };
      }),
    ];
    setHistory(prev => {
      const next = [...historyEntries, ...prev];
      storage.set(HISTORY_KEY, JSON.stringify(next));
      return next;
    });

    // Save trade record
    const entry: TradeEntry = {
      id: `trade_${now}_${Math.random().toString(36).slice(2)}`,
      timestamp: now,
      given: givenCodes.map(stickerInfo),
      received: receivedCodes.map(stickerInfo),
    };
    setTrades(prev => {
      const next = [entry, ...prev];
      storage.set(TRADES_KEY, JSON.stringify(next));
      return next;
    });
  }, [state.quantities]);

  const deleteTrade = useCallback((id: string) => {
    setTrades(prev => {
      const trade = prev.find(t => t.id === id);
      if (!trade) return prev;

      // Revert quantities: stickers given come back (+1), stickers received leave (-1)
      const updates: Record<string, number> = {};
      for (const s of trade.given) {
        const cur = updates[s.code] ?? (state.quantities[s.code] ?? 0);
        updates[s.code] = cur + 1;
      }
      for (const s of trade.received) {
        const cur = updates[s.code] ?? (state.quantities[s.code] ?? 0);
        updates[s.code] = Math.max(0, cur - 1);
      }
      dispatch({ type: 'BATCH_SET_QTY', updates });

      // Remove the trade_in/trade_out history entries that belong to this trade
      setHistory(hist => {
        const next = hist.filter(
          e => !(e.timestamp === trade.timestamp &&
                 (e.action === 'trade_in' || e.action === 'trade_out')),
        );
        storage.set(HISTORY_KEY, JSON.stringify(next));
        return next;
      });

      const next = prev.filter(t => t.id !== id);
      storage.set(TRADES_KEY, JSON.stringify(next));
      return next;
    });
  }, [state.quantities]);

  // ── Backup / Restore ───────────────────────────────────────────────────────
  const exportBackup = useCallback(async (): Promise<'ok' | string> => {
    try {
      const backup = {
        version: BACKUP_VERSION,
        app: 'cromitos',
        createdAt: Date.now(),
        quantities: state.quantities,
        history,
        trades,
      };
      // ASCII-safe: escape non-ASCII chars so copy-paste encoding bugs can't corrupt the JSON
      const json = JSON.stringify(backup).replace(
        /[^\x00-\x7F]/g,
        c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
      );
      const date = new Date().toISOString().split('T')[0];
      const filename = `cromitos_backup_${date}.txt`;
      const uri = (FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? '') + filename;
      await FileSystem.writeAsStringAsync(uri, json);
      await Sharing.shareAsync(uri, {
        mimeType: 'text/plain',
        dialogTitle: 'Guardar copia de seguridad',
        UTI: 'public.plain-text',
      });
      const now = Date.now();
      setLastBackupDate(now);
      storage.set(BACKUP_META_KEY, String(now));
      return 'ok';
    } catch (e: any) {
      return e?.message || 'Error desconocido al exportar';
    }
  }, [state.quantities, history, trades]);

  const importBackup = useCallback(async (jsonString: string): Promise<'ok' | 'invalid' | 'error'> => {
    try {
      const text = (jsonString ?? '').trim();
      if (!text) return 'invalid';

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        return 'invalid';
      }

      if (!data || typeof data !== 'object' || Array.isArray(data)) return 'invalid';

      // Accept any JSON with a quantities object — any app version, any format
      const quantities = data.quantities ?? data.data?.quantities;
      if (!quantities || typeof quantities !== 'object' || Array.isArray(quantities)) return 'invalid';

      dispatch({ type: 'LOAD', quantities });
      storage.set(STORAGE_KEY, JSON.stringify(quantities));

      const history = data.history ?? data.data?.history;
      if (Array.isArray(history)) {
        setHistory(history);
        storage.set(HISTORY_KEY, JSON.stringify(history));
      }

      const tradesData = data.trades ?? data.data?.trades;
      if (Array.isArray(tradesData)) {
        setTrades(tradesData);
        storage.set(TRADES_KEY, JSON.stringify(tradesData));
      }
      return 'ok';
    } catch {
      return 'error';
    }
  }, []);

  // ── Derived data ──────────────────────────────────────────────────────────
  const getStats = useCallback((): StickerStats => {
    let owned = 0, duplicateCount = 0;
    for (const s of stickers) {
      const qty = state.quantities[s.code] ?? 0;
      if (qty > 0) owned++;
      if (qty > 1) duplicateCount += qty - 1;
    }
    const missing = stickers.length - owned;
    return {
      total: stickers.length,
      owned,
      missing,
      duplicates: stickers.filter(s => (state.quantities[s.code] ?? 0) > 1).length,
      duplicateCount,
      completionPct: Math.round((owned / stickers.length) * 100),
    };
  }, [state.quantities]);

  const getSectionStats = useCallback((sectionCode: string): StickerStats => {
    const sectionStickers = stickers.filter(s => s.teamCode === sectionCode);
    let owned = 0, duplicateCount = 0;
    for (const s of sectionStickers) {
      const qty = state.quantities[s.code] ?? 0;
      if (qty > 0) owned++;
      if (qty > 1) duplicateCount += qty - 1;
    }
    const missing = sectionStickers.length - owned;
    return {
      total: sectionStickers.length,
      owned,
      missing,
      duplicates: sectionStickers.filter(s => (state.quantities[s.code] ?? 0) > 1).length,
      duplicateCount,
      completionPct: sectionStickers.length > 0 ? Math.round((owned / sectionStickers.length) * 100) : 0,
    };
  }, [state.quantities]);

  const getSectionStickers = useCallback((sectionCode: string): Sticker[] => {
    return stickers.filter(s => s.teamCode === sectionCode);
  }, []);

  const getMissingStickers = useCallback((): Sticker[] => {
    return stickers.filter(s => (state.quantities[s.code] ?? 0) === 0);
  }, [state.quantities]);

  const getDuplicateStickers = useCallback(() => {
    return stickers
      .filter(s => (state.quantities[s.code] ?? 0) > 1)
      .map(s => ({ ...s, extras: (state.quantities[s.code] ?? 0) - 1 }));
  }, [state.quantities]);

  return (
    <StickersContext.Provider
      value={{
        stickers,
        sections,
        quantities: state.quantities,
        loaded: state.loaded,
        history,
        trades,
        setQuantity,
        increment,
        decrement,
        clearHistory,
        addTrade,
        deleteTrade,
        getStats,
        getSectionStats,
        getSectionStickers,
        getMissingStickers,
        getDuplicateStickers,
        exportBackup,
        importBackup,
        lastBackupDate,
      }}
    >
      {children}
    </StickersContext.Provider>
  );
}

export function useStickers() {
  const ctx = useContext(StickersContext);
  if (!ctx) throw new Error('useStickers must be inside StickersProvider');
  return ctx;
}
