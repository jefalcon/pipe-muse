// pipe-muse core — puntuación (lógica pura).
import { CONFIG } from '../config';
import type { Piece } from './types';

export interface ScoreState {
  score: number;
  pipesFilled: number;
  replaced: number;
}

/** Puntos por tubería llena (x2 en avance rápido). */
export function scoreForPipe(fast: boolean): number {
  return CONFIG.SCORE_PIPE * (fast ? CONFIG.SCORE_FAST_MULT : 1);
}

/** Bonus por cruce recorrido dos veces (bucle). */
export function scoreForCrossDouble(): number {
  return CONFIG.SCORE_CROSS_DOUBLE;
}

/** Bonus por depósito lleno. */
export function scoreForReservoir(): number {
  return CONFIG.SCORE_RESERVOIR;
}

/** Bonus por alcanzar la pieza final. */
export function scoreForEnd(): number {
  return CONFIG.SCORE_END_BONUS;
}

export function applyCellFilled(s: ScoreState, piece: Piece, fast: boolean, crossedTwice: boolean): number {
  let gained = scoreForPipe(fast);
  if (crossedTwice) gained += scoreForCrossDouble();
  if (piece.kind === 'reservoir') gained += scoreForReservoir();
  s.score += gained;
  s.pipesFilled += 1;
  return gained;
}

/** Penalización por reemplazo destructivo. */
export function applyReplace(s: ScoreState): number {
  s.score += CONFIG.REPLACE_PENALTY;
  s.replaced += 1;
  return CONFIG.REPLACE_PENALTY;
}

/** Penalización global por tuberías colocadas y no usadas al final. */
export function applyUnusedPenalty(s: ScoreState, unusedCount: number): number {
  const delta = CONFIG.SCORE_UNUSED_PENALTY * unusedCount;
  s.score += delta;
  return delta;
}
