// pipe-muse core — tablero (lógica pura).
import type { Board, Cell, Dir, Piece } from './types';

export function emptyCell(): Cell {
  return { piece: null, obstacle: false, filled: false, fill: 0, passCount: 0 };
}

export function createBoard(
  cols: number,
  rows: number,
  startX: number,
  startY: number,
  startDir: Dir,
): Board {
  const cells: Cell[][] = [];
  for (let y = 0; y < rows; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < cols; x++) row.push(emptyCell());
    cells.push(row);
  }
  const b: Board = { cols, rows, cells, startX, startY, startDir };
  cells[startY][startX].piece = { kind: 'start', dir: startDir };
  return b;
}

export function inBounds(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.cols && y < b.rows;
}

export function getCell(b: Board, x: number, y: number): Cell | null {
  if (!inBounds(b, x, y)) return null;
  return b.cells[y][x];
}

/** Casilla libre = dentro, sin obstáculo, sin pieza y no llenada. */
export function isFree(b: Board, x: number, y: number): boolean {
  const c = getCell(b, x, y);
  return !!c && !c.obstacle && c.piece === null && !c.filled;
}

/** ¿Se puede reemplazar? Pieza presente, no obstáculo, aún NO llena. */
export function isReplaceable(b: Board, x: number, y: number): boolean {
  const c = getCell(b, x, y);
  if (!c || c.obstacle || !c.piece) return false;
  if (c.piece.kind === 'start') return false;
  return !c.filled;
}

export function placePiece(b: Board, x: number, y: number, p: Piece): boolean {
  if (!isFree(b, x, y)) return false;
  getCell(b, x, y)!.piece = { ...p };
  return true;
}

/** Reemplazo destructivo (Hito 2): solo si isReplaceable. Devuelve true si reemplazó. */
export function replacePiece(b: Board, x: number, y: number, p: Piece): boolean {
  if (!isReplaceable(b, x, y)) return false;
  const c = getCell(b, x, y)!;
  c.piece = { ...p };
  c.fill = 0;
  c.filled = false;
  c.passCount = 0;
  return true;
}

/** Posiciones de tuberías colocadas pero no usadas (ni llenas ni en curso). */
export function listUnusedCells(b: Board): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      const c = b.cells[y][x];
      if (c.piece && c.piece.kind !== 'start' && !c.filled && c.fill <= 0) out.push({ x, y });
    }
  }
  return out;
}

/** Cuenta tuberías colocadas pero no usadas (ni llenas ni en curso). */
export function countUnused(b: Board): number {
  let n = 0;
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      const c = b.cells[y][x];
      if (c.piece && c.piece.kind !== 'start' && !c.filled && c.fill <= 0) n++;
    }
  }
  return n;
}

/** Lista de casillas con obstáculo (para tests). */
export function obstaclePositions(b: Board): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < b.rows; y++)
    for (let x = 0; x < b.cols; x++) if (b.cells[y][x].obstacle) out.push({ x, y });
  return out;
}
