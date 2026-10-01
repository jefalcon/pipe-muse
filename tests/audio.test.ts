import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { Game } from '../src/game/Game';

describe('Hito 4: eventos de audio', () => {
  it('colocar y reemplazar encolan place/boom', () => {
    const g = new Game(11);
    g.newGame(1);
    let c = { x: 0, y: 0 };
    if (g.board.startX === 0 && g.board.startY === 0) c = { x: 1, y: 0 };
    g.tryPlace(c.x, c.y);
    expect(g.audioEvents).toContain('place');
    g.tryPlace(c.x, c.y);
    expect(g.audioEvents).toContain('boom');
  });
  it('la cuenta atrás pita los últimos 3 segundos', () => {
    const g = new Game(11);
    g.newGame(1);
    g.flow.countdown = 2.5;
    for (let i = 0; i < 400; i++) g.update(CONFIG.FIXED_DT);
    const ticks = g.audioEvents.filter((e) => e === 'tick');
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.length).toBeLessThanOrEqual(3);
  });
  it('el derrame y el fin encolan spill/over', () => {
    const g = new Game(7);
    g.newGame(1);
    g.flow.countdown = 0.01;
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.audioEvents).toContain('spill');
    expect(g.audioEvents).toContain('over');
    expect(g.audioEvents).toContain('glug'); // al menos el start
  });
});
