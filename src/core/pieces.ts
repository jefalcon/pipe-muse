// pipe-muse core — conexiones de piezas (lógica pura).
import type { Dir, Piece } from './types';
import { OPPOSITE } from './types';

/** Lados abiertos de una pieza. */
export function getConnections(p: Piece): Dir[] {
  switch (p.kind) {
    case 'straight-h':
      return ['left', 'right'];
    case 'straight-v':
      return ['up', 'down'];
    case 'cross':
    case 'reservoir':
      return ['up', 'right', 'down', 'left'];
    case 'elbow-ur':
      return ['up', 'right'];
    case 'elbow-rd':
      return ['right', 'down'];
    case 'elbow-dl':
      return ['down', 'left'];
    case 'elbow-lu':
      return ['left', 'up'];
    case 'start':
      return p.dir ? [p.dir] : [];
    case 'end':
      return p.dir ? [p.dir] : [];
    case 'oneway-up':
      return ['up', 'down']; // entra por abajo, sale por arriba (recta vertical dirigida)
    case 'oneway-down':
      return ['up', 'down'];
    case 'oneway-right':
    case 'oneway-left':
      return ['left', 'right'];
    default:
      return [];
  }
}

export function connects(p: Piece, side: Dir): boolean {
  return getConnections(p).includes(side);
}

/**
 * Dado el lado de ENTRADA del flujo a la pieza, devuelve el lado de SALIDA,
 * o null si no conecta (derrame). Para 'start' no hay entrada: devuelve su salida.
 * Cruces: atraviesa recto (sale por el lado opuesto a la entrada).
 * Unidireccionales: solo permiten el sentido indicado; si se entra al revés → null.
 */
export function exitDir(p: Piece, entry: Dir): Dir | null {
  if (p.kind === 'start') return p.dir ?? null;

  const conns = getConnections(p);
  if (!conns.includes(entry)) return null;

  // Unidireccionales: la entrada debe ser el lado opuesto al sentido permitido.
  if (p.kind === 'oneway-up') return entry === 'down' ? 'up' : null;
  if (p.kind === 'oneway-down') return entry === 'up' ? 'down' : null;
  if (p.kind === 'oneway-right') return entry === 'left' ? 'right' : null;
  if (p.kind === 'oneway-left') return entry === 'right' ? 'left' : null;

  // Cruce y depósito: recto.
  if (p.kind === 'cross' || p.kind === 'reservoir') return OPPOSITE[entry];

  // Pieza final: el flujo termina aquí (sin salida) pero no derrama.
  if (p.kind === 'end') return null;

  // Rectas y codos: la otra boca.
  for (const c of conns) {
    if (c !== entry) return c;
  }
  return null;
}
