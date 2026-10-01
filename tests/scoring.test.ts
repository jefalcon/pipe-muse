import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { applyCellFilled, applyReplace, applyUnusedPenalty } from '../src/core/scoring';

describe('scoring básico (Hito 1)', () => {
  it('+50 por tubería, x2 en rápido', () => {
    const s = { score: 0, pipesFilled: 0, replaced: 0 };
    applyCellFilled(s, { kind: 'straight-h' }, false, false);
    expect(s.score).toBe(CONFIG.SCORE_PIPE);
    applyCellFilled(s, { kind: 'straight-h' }, true, false);
    expect(s.score).toBe(CONFIG.SCORE_PIPE * 3);
  });
  it('reemplazo y no usadas restan', () => {
    const s = { score: 1000, pipesFilled: 0, replaced: 0 };
    applyReplace(s);
    expect(s.score).toBe(1000 + CONFIG.REPLACE_PENALTY);
    applyUnusedPenalty(s, 2);
    expect(s.score).toBe(1000 + CONFIG.REPLACE_PENALTY + 2 * CONFIG.SCORE_UNUSED_PENALTY);
  });
});
