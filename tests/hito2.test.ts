import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { listUnusedCells } from '../src/core/board';
import { Game } from '../src/game/Game';

function freeCell(g: Game): { x: number; y: number } {
  for (let y = 0; y < g.board.rows; y++)
    for (let x = 0; x < g.board.cols; x++)
      if (!(x === g.board.startX && y === g.board.startY)) return { x, y };
  throw new Error('sin celdas libres');
}

describe('Hito 2: reemplazo', () => {
  it('reemplaza tubería no llena: -50, explosión y bloqueo breve', () => {
    const g = new Game(99);
    g.newGame(1);
    const c = freeCell(g);
    expect(g.tryPlace(c.x, c.y)).toBe(true);
    expect(g.score.score).toBe(0);
    expect(g.tryPlace(c.x, c.y)).toBe(true); // reemplazo
    expect(g.score.score).toBe(CONFIG.REPLACE_PENALTY);
    expect(g.score.replaced).toBe(1);
    expect(g.booms).toHaveLength(1);
    expect(g.lockTimer).toBeGreaterThan(0);
    expect(g.popups.some((p) => p.text === '-50')).toBe(true);
  });
  it('bloquea colocar durante REPLACE_LOCK_MS', () => {
    const g = new Game(99);
    g.newGame(1);
    const a = { x: 0, y: 0 };
    const b = { x: 1, y: 0 };
    // Evita el start si cae en esas celdas.
    if (g.board.startX === 0 && g.board.startY === 0) return;
    g.tryPlace(a.x, a.y);
    g.tryPlace(a.x, a.y); // reemplazo → bloqueo
    expect(g.tryPlace(b.x, b.y)).toBe(false);
    g.update(CONFIG.REPLACE_LOCK_MS / 1000 + 0.05);
    expect(g.tryPlace(b.x, b.y)).toBe(true);
  });
  it('no reemplaza tuberías llenas ni el start', () => {
    const g = new Game(5);
    g.newGame(1);
    expect(g.tryPlace(g.board.startX, g.board.startY)).toBe(false);
    const c = freeCell(g);
    g.tryPlace(c.x, c.y);
    g.board.cells[c.y][c.x].filled = true;
    expect(g.tryPlace(c.x, c.y)).toBe(false);
    expect(g.booms).toHaveLength(0);
  });
});

describe('Hito 2: recuento de fin de nivel', () => {
  // Camino válido de 8 (semilla 11, start 6,3 → derecha) + 2 sin usar.
  function setupClear(g: Game): void {
    const P = (x: number, y: number, kind: 'straight-h' | 'straight-v' | 'elbow-dl' | 'elbow-lu') => {
      g.board.cells[y][x].piece = { kind };
    };
    P(7, 3, 'straight-h');
    P(8, 3, 'straight-h');
    P(9, 3, 'elbow-dl');
    P(9, 4, 'straight-v');
    P(9, 5, 'elbow-lu');
    P(8, 5, 'straight-h');
    P(7, 5, 'straight-h');
    // Sin usar:
    g.board.cells[0][0].piece = { kind: 'cross' };
    g.board.cells[0][1].piece = { kind: 'straight-v' };
    g.flow.countdown = 0.01;
  }

  it('lista las no usadas (excluye start, llenas y en curso)', () => {
    const g = new Game(11);
    g.newGame(1);
    setupClear(g);
    // 7 del camino + 2 sueltas, todas sin llenar todavía.
    const unused = listUnusedCells(g.board);
    expect(unused).toHaveLength(9);
    expect(unused).toContainEqual({ x: 0, y: 0 });
    expect(unused).toContainEqual({ x: 1, y: 0 });
    expect(unused).not.toContainEqual({ x: g.board.startX, y: g.board.startY });
    // Tras llenar una, deja de listarse.
    g.board.cells[0][0].filled = true;
    expect(listUnusedCells(g.board)).toHaveLength(8);
  });

  it('tras superar: recount aplica -100 por no usada y pasa a clear', () => {
    const g = new Game(11);
    g.newGame(1);
    setupClear(g);
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('recount');
    expect(g.recountQueue).toHaveLength(2);
    guard = 0;
    while (g.screen === 'recount' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('clear');
    // 8 tuberías x50 = 400, menos 2x100 = 200.
    expect(g.score.score).toBe(200);
    expect(g.recounted.size).toBe(2);
  });

  it('sin superar: no hay recuento ni penalización', () => {
    const g = new Game(7);
    g.newGame(1);
    g.board.cells[0][0].piece = { kind: 'cross' };
    g.flow.countdown = 0.01;
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('over');
    expect(g.score.score).toBeGreaterThanOrEqual(0);
  });
});

describe('Hito 2: cruce doble y niveles', () => {
  it('pasar de nivel aumenta exigencia', () => {
    const g = new Game(3);
    g.newGame(1);
    const d1 = g.flow.distanceLeft;
    const s1 = g.flow.speed;
    g.nextLevel();
    expect(g.level).toBe(2);
    expect(g.flow.distanceLeft).toBeGreaterThanOrEqual(d1);
    expect(g.flow.speed).toBeGreaterThanOrEqual(s1);
  });
});
