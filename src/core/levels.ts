// pipe-muse core — generación de niveles (lógica pura).
import { CONFIG, perLevel } from '../config';
import type { Board, Dir, LevelConfig, Piece, PieceKind } from './types';
import { createBoard } from './board';
import { intRange, weightedPick, type Rng } from './rng';

const START_DIRS: Dir[] = ['up', 'right', 'down', 'left'];

export function getLevelConfig(level: number): LevelConfig {
  const bonusRound = level % CONFIG.BONUS_ROUND_EVERY === 0;
  return {
    level,
    countdown: bonusRound
      ? Math.max(perLevel(CONFIG.COUNTDOWN_BY_LEVEL, level), CONFIG.BONUS_MIN_COUNTDOWN)
      : perLevel(CONFIG.COUNTDOWN_BY_LEVEL, level),
    speed: perLevel(CONFIG.SPEED_BY_LEVEL, level),
    distance: bonusRound ? CONFIG.BONUS_DISTANCE : perLevel(CONFIG.DISTANCE_BY_LEVEL, level),
    obstacles: bonusRound ? 0 : perLevel(CONFIG.OBSTACLES_BY_LEVEL, level),
    bonusRound,
    endPiece: !bonusRound && level >= CONFIG.END_FROM_LEVEL,
    wrap: level >= CONFIG.WRAP_FROM_LEVEL,
  };
}

/** Pieza inicial en posición/orientación aleatorias, nunca inútil contra un borde. */
export function randomStart(rng: Rng, cols: number, rows: number): { x: number; y: number; dir: Dir } {
  for (let tries = 0; tries < 64; tries++) {
    const x = intRange(rng, 0, cols);
    const y = intRange(rng, 0, rows);
    const dir = START_DIRS[intRange(rng, 0, 4)];
    if (startIsUseful(x, y, dir, cols, rows)) return { x, y, dir };
  }
  // Fallback céntrico seguro.
  return { x: Math.floor(cols / 2), y: Math.floor(rows / 2), dir: 'right' };
}

/** La salida del start debe apuntar a una casilla dentro del tablero. */
export function startIsUseful(x: number, y: number, dir: Dir, cols: number, rows: number): boolean {
  if (dir === 'up') return y > 0;
  if (dir === 'down') return y < rows - 1;
  if (dir === 'left') return x > 0;
  return x < cols - 1;
}

/**
 * Pieza aleatoria del dispensador. Desde ciertos niveles incluye
 * unidireccionales y depósitos (pesos en config).
 */
export function randomPiece(rng: Rng, level = 1): Piece {
  const weights: Record<string, number> = { ...(CONFIG.PIECE_WEIGHTS as Record<string, number>) };
  if (level >= CONFIG.ONEWAY_FROM_LEVEL) {
    weights['oneway-up'] = CONFIG.ONEWAY_WEIGHT;
    weights['oneway-right'] = CONFIG.ONEWAY_WEIGHT;
    weights['oneway-down'] = CONFIG.ONEWAY_WEIGHT;
    weights['oneway-left'] = CONFIG.ONEWAY_WEIGHT;
  }
  if (level >= CONFIG.RESERVOIR_FROM_LEVEL) {
    weights['reservoir'] = CONFIG.RESERVOIR_WEIGHT;
  }
  const kind = weightedPick(rng, weights) as PieceKind;
  return { kind };
}

export function randomBasicPiece(rng: Rng): Piece {
  const kind = weightedPick(rng, CONFIG.PIECE_WEIGHTS as Record<string, number>) as PieceKind;
  return { kind };
}

export function randomQueue(rng: Rng, n: number, level = 1): Piece[] {
  const q: Piece[] = [];
  for (let i = 0; i < n; i++) q.push(randomPiece(rng, level));
  return q;
}

/**
 * Genera el tablero del nivel: start aleatorio + obstáculos + pieza final
 * (niveles avanzados). La ronda bonus precoloca tuberías básicas y respira.
 */
export function generateBoard(rng: Rng, level: number): Board {
  const cols = CONFIG.COLS;
  const rows = CONFIG.ROWS;
  const cfg = getLevelConfig(level);
  const s = randomStart(rng, cols, rows);
  const b = createBoard(cols, rows, s.x, s.y, s.dir);
  let placed = 0;
  let guard = 0;
  while (placed < cfg.obstacles && guard++ < 500) {
    const x = intRange(rng, 0, cols);
    const y = intRange(rng, 0, rows);
    if (x === s.x && y === s.y) continue;
    if (b.cells[y][x].obstacle) continue;
    b.cells[y][x].obstacle = true;
    placed++;
  }
  if (cfg.endPiece) {
    // Destino con bonus: boca de entrada aleatoria, lejos del start.
    guard = 0;
    while (guard++ < 200) {
      const x = intRange(rng, 0, cols);
      const y = intRange(rng, 0, rows);
      if (x === s.x && y === s.y) continue;
      if (b.cells[y][x].obstacle || b.cells[y][x].piece) continue;
      if (Math.abs(x - s.x) + Math.abs(y - s.y) < 4) continue;
      const dir = START_DIRS[intRange(rng, 0, 4)];
      b.cells[y][x].piece = { kind: 'end', dir };
      break;
    }
  }
  if (cfg.bonusRound) {
    // Tablero especial: tuberías básicas precolocadas.
    let n = 0;
    guard = 0;
    while (n < CONFIG.BONUS_PREPLACED && guard++ < 300) {
      const x = intRange(rng, 0, cols);
      const y = intRange(rng, 0, rows);
      if (b.cells[y][x].piece) continue;
      b.cells[y][x].piece = randomBasicPiece(rng);
      n++;
    }
  }
  return b;
}
