// pipe-muse — tabla de récords en localStorage (con store inyectable para tests).
import { CONFIG } from '../config';

export interface RecordEntry {
  score: number;
  level: number;
  date: string; // ISO yyyy-mm-dd
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultStore(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadRecords(store?: StorageLike | null): RecordEntry[] {
  const s = store === undefined ? defaultStore() : store;
  if (!s) return [];
  try {
    const raw = s.getItem(CONFIG.RECORDS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecordEntry[];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => typeof e?.score === 'number' && typeof e?.level === 'number')
      .sort((a, b) => b.score - a.score)
      .slice(0, CONFIG.RECORDS_MAX);
  } catch {
    return [];
  }
}

/** Añade un resultado y devuelve la tabla actualizada. */
export function addRecord(score: number, level: number, store?: StorageLike | null): RecordEntry[] {
  const recs = loadRecords(store);
  recs.push({ score, level, date: new Date().toISOString().slice(0, 10) });
  recs.sort((a, b) => b.score - a.score);
  const top = recs.slice(0, CONFIG.RECORDS_MAX);
  const s = store === undefined ? defaultStore() : store;
  if (s) {
    try {
      s.setItem(CONFIG.RECORDS_KEY, JSON.stringify(top));
    } catch {
      // Almacenamiento no disponible: la tabla vive solo en memoria.
    }
  }
  return top;
}
