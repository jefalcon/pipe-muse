import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { generateBoard, getLevelConfig, randomStart, startIsUseful } from '../src/core/levels';
import { makeRng } from '../src/core/rng';

describe('levels', () => {
  it('la config por nivel existe y progresa', () => {
    const l1 = getLevelConfig(1);
    const l5 = getLevelConfig(5);
    expect(l1.countdown).toBeGreaterThanOrEqual(l5.countdown);
    expect(l5.speed).toBeGreaterThanOrEqual(l1.speed);
    expect(l5.distance).toBeGreaterThanOrEqual(l1.distance);
  });
  it('el start aleatorio nunca es inútil (100 semillas)', () => {
    for (let s = 1; s <= 100; s++) {
      const rng = makeRng(s);
      const st = randomStart(rng, CONFIG.COLS, CONFIG.ROWS);
      expect(startIsUseful(st.x, st.y, st.dir, CONFIG.COLS, CONFIG.ROWS)).toBe(true);
    }
  });
  it('los obstáculos no caen sobre el start', () => {
    for (let s = 1; s <= 30; s++) {
      const b = generateBoard(makeRng(s * 7919), 8);
      expect(b.cells[b.startY][b.startX].obstacle).toBe(false);
    }
  });
});
