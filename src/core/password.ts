// pipe-muse core — contraseñas de nivel (lógica pura).
// Cada 4 niveles el juego muestra un código de 4 letras para continuar.
// Esquema propio: 2 caracteres de índice + 2 de verificación (base 32).
import { CONFIG } from '../config';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32, sin I/O/0/1

function idx(c: string): number {
  return ALPHA.indexOf(c);
}

/** Código para continuar en `level` (debe ser múltiplo de PASSWORD_EVERY). */
export function passwordForLevel(level: number): string | null {
  if (level < CONFIG.PASSWORD_EVERY || level % CONFIG.PASSWORD_EVERY !== 0) return null;
  const n = level / CONFIG.PASSWORD_EVERY - 1; // L4→0, L8→1...
  if (n < 0 || n > 32 * 32 - 1) return null;
  const a = (n >> 5) & 31;
  const b = n & 31;
  const c = (a * 3 + b * 7 + 5) % 32;
  const d = (a + b * 3 + 11) % 32;
  return ALPHA[a] + ALPHA[b] + ALPHA[c] + ALPHA[d];
}

/** Nivel al que lleva un código, o null si es inválido. */
export function levelForPassword(code: string): number | null {
  const s = code.toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== 4) return null;
  const v = [idx(s[0]), idx(s[1]), idx(s[2]), idx(s[3])];
  if (v.some((x) => x < 0)) return null;
  const [a, b, c, d] = v as [number, number, number, number];
  if (c !== (a * 3 + b * 7 + 5) % 32) return null;
  if (d !== (a + b * 3 + 11) % 32) return null;
  return (a * 32 + b + 1) * CONFIG.PASSWORD_EVERY;
}
