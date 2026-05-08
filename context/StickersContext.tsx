import React, { createContext, useContext, useEffect, useReducer, useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rawStickersData } from '@/constants/stickersData';

export type StickerType = 'player' | 'team_logo' | 'team_photo' | 'special';

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
  | { type: 'SET_QTY'; code: string; qty: number };

export interface ActivityEntry {
  code: string;
  name: string;
  teamName: string;
  action: 'add' | 'remove';
  qty: number;
  timestamp: number;
}

const STORAGE_KEY  = '@cromitos_quantities';
const HISTORY_KEY  = '@cromitos_history';
const MAX_HISTORY  = 100;

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LOAD':
      return { quantities: action.quantities, loaded: true };
    case 'SET_QTY':
      return {
        ...state,
        quantities: { ...state.quantities, [action.code]: action.qty },
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
  setQuantity: (code: string, qty: number) => void;
  increment: (code: string) => void;
  decrement: (code: string) => void;
  clearHistory: () => void;
  getStats: () => StickerStats;
  getSectionStats: (sectionCode: string) => StickerStats;
  getSectionStickers: (sectionCode: string) => Sticker[];
  getMissingStickers: () => Sticker[];
  getDuplicateStickers: () => Array<Sticker & { extras: number }>;
}

const StickersContext = createContext<ContextValue | null>(null);

const stickers: Sticker[] = rawStickersData.stickers;
const sections: Section[] = rawStickersData.sections;

export function StickersProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { quantities: {}, loaded: false });
  const [history, setHistory] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      const quantities = raw ? JSON.parse(raw) : {};
      dispatch({ type: 'LOAD', quantities });
    });
    AsyncStorage.getItem(HISTORY_KEY).then((raw) => {
      if (raw) setHistory(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    if (state.loaded) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.quantities));
    }
  }, [state.quantities, state.loaded]);

  const pushHistory = useCallback((code: string, action: 'add' | 'remove', qty: number) => {
    const sticker = stickers.find(s => s.code === code);
    if (!sticker) return;
    const sectionName = sections.find(sec => sec.code === sticker.teamCode)?.name ?? sticker.teamName;
    const entry: ActivityEntry = { code, name: sticker.name, teamName: sectionName, action, qty, timestamp: Date.now() };
    setHistory(prev => {
      // Colapsar solo si el registro anterior es el mismo cromo, misma acción,
      // Y ambos están en zona de repetidos (qty > 1). Así 0→1 y 1→2 siempre
      // generan entradas nuevas (son cambios de categoría).
      const last = prev[0];
      const shouldCollapse =
        last &&
        last.code === code &&
        last.action === action &&
        last.qty > 1 &&
        qty > 1;

      if (shouldCollapse) {
        const next = [{ ...entry }, ...prev.slice(1)];
        AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        return next;
      }
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
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
    AsyncStorage.removeItem(HISTORY_KEY);
  }, []);

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
        setQuantity,
        increment,
        decrement,
        clearHistory,
        getStats,
        getSectionStats,
        getSectionStickers,
        getMissingStickers,
        getDuplicateStickers,
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
