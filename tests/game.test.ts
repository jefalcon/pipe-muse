import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game/Game';

describe('Game (Hito 1)', () => {
  it('nueva partida: 5 en cola, cuenta atrás y distancia del nivel 1', () => {
    const g = new Game(1234);
    g.newGame(1);
    expect(g.screen).toBe('playing');
    expect(g.queue).toHaveLength(CONFIG.QUEUE_SIZE);
    expect(g.flow.phase).toBe('countdown');
    expect(g.flow.distanceLeft).toBeGreaterThan(0);
  });
  it('colocar consume la actual y avanza la cola', () => {
    const g = new Game(42);
    g.newGame(1);
    // Busca una casilla libre que no sea el start.
    let tx = -1;
    let ty = -1;
    outer: for (let y = 0; y < g.board.rows; y++)
      for (let x = 0; x < g.board.cols; x++)
        if (!(x === g.board.startX && y === g.board.startY)) {
          tx = x;
          ty = y;
          break outer;
        }
    const first = { ...g.queue[0] };
    const second = { ...g.queue[1] };
    expect(g.tryPlace(tx, ty)).toBe(true);
    expect(g.board.cells[ty][tx].piece).toEqual(first);
    expect(g.queue[0]).toEqual(second);
    expect(g.queue).toHaveLength(CONFIG.QUEUE_SIZE);
    // Ocupada sin llenar (Hito 2): reemplaza, avanza y penaliza.
    const third = { ...g.queue[1] };
    expect(g.tryPlace(tx, ty)).toBe(true);
    expect(g.board.cells[ty][tx].piece).toEqual(second);
    expect(g.queue[0]).toEqual(third);
    expect(g.score.score).toBe(CONFIG.REPLACE_PENALTY);
  });
  it('sin tuberías: cuenta atrás → flujo → derrame → game over', () => {
    const g = new Game(7);
    g.newGame(1);
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('over');
    expect(g.flow.phase).toBe('spilled');
  });
});
