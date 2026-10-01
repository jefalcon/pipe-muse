import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createBoard, placePiece } from '../src/core/board';
import { createFlow, updateFlow } from '../src/core/flow';
import { generateBoard, getLevelConfig, randomPiece } from '../src/core/levels';
import { levelForPassword, passwordForLevel } from '../src/core/password';
import { applyCellFilled } from '../src/core/scoring';
import { OPPOSITE } from '../src/core/types';
import { makeRng } from '../src/core/rng';
import { Game } from '../src/game/Game';
import { addRecord, loadRecords, type StorageLike } from '../src/game/records';

function memStore(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('Hito 3: contraseñas', () => {
  it('roundtrip cada 4 niveles', () => {
    for (let lv = 4; lv <= 40; lv += 4) {
      const pwd = passwordForLevel(lv);
      expect(pwd).toMatch(/^[A-Z0-9]{4}$/);
      expect(levelForPassword(pwd!)).toBe(lv);
    }
  });
  it('rechaza códigos inválidos', () => {
    expect(levelForPassword('AAAA')).toBeNull(); // checksum mal
    expect(levelForPassword('ABC')).toBeNull(); // corta
    expect(levelForPassword('ABCDE')).toBeNull(); // larga
    expect(levelForPassword('AB*D')).toBeNull(); // carácter malo
    expect(passwordForLevel(3)).toBeNull();
    expect(passwordForLevel(5)).toBeNull();
  });
  it('tolera minúsculas y guiones', () => {
    const pwd = passwordForLevel(8)!;
    expect(levelForPassword(pwd.toLowerCase())).toBe(8);
    expect(levelForPassword(pwd.slice(0, 2) + '-' + pwd.slice(2))).toBe(8);
  });
});

describe('Hito 3: niveles avanzados', () => {
  it('config: bonus, final y wrap por nivel', () => {
    const b4 = getLevelConfig(4);
    expect(b4.bonusRound).toBe(true);
    expect(b4.distance).toBe(CONFIG.BONUS_DISTANCE);
    expect(b4.obstacles).toBe(0);
    expect(b4.endPiece).toBe(false);
    expect(getLevelConfig(3).endPiece).toBe(true);
    expect(getLevelConfig(2).endPiece).toBe(false);
    expect(getLevelConfig(8).wrap).toBe(true);
    expect(getLevelConfig(7).wrap).toBe(false);
  });
  it('la pieza final aparece lejos del start', () => {
    for (let s = 1; s <= 20; s++) {
      const b = generateBoard(makeRng(s), 3);
      let found = 0;
      for (let y = 0; y < b.rows; y++)
        for (let x = 0; x < b.cols; x++) {
          if (b.cells[y][x].piece?.kind === 'end') {
            found++;
            expect(Math.abs(x - b.startX) + Math.abs(y - b.startY)).toBeGreaterThanOrEqual(4);
          }
        }
      expect(found).toBe(1);
    }
  });
  it('la bonus precoloca tuberías básicas', () => {
    const b = generateBoard(makeRng(11), 4);
    let n = 0;
    for (let y = 0; y < b.rows; y++)
      for (let x = 0; x < b.cols; x++) {
        const p = b.cells[y][x].piece;
        if (p && p.kind !== 'start') n++;
      }
    expect(n).toBe(CONFIG.BONUS_PREPLACED);
  });
  it('unidireccionales y depósitos solo desde su nivel', () => {
    const kinds = (lv: number): Set<string> => {
      const rng = makeRng(7);
      const s = new Set<string>();
      for (let i = 0; i < 300; i++) s.add(randomPiece(rng, lv).kind);
      return s;
    };
    const l1 = kinds(1);
    expect([...l1].some((k) => k.startsWith('oneway') || k === 'reservoir')).toBe(false);
    expect([...kinds(5)].some((k) => k.startsWith('oneway'))).toBe(true);
    expect(kinds(6).has('reservoir')).toBe(true);
  });
});

describe('Hito 3: flujo avanzado', () => {
  it('wrap: el flooz cruza al lado opuesto', () => {
    const b = createBoard(10, 7, 9, 3, 'right');
    placePiece(b, 0, 3, { kind: 'straight-h' });
    placePiece(b, 1, 3, { kind: 'straight-h' });
    const f = createFlow(b, 0, 10, 20, true);
    updateFlow(b, f, 0.01);
    for (let i = 0; i < 60 && f.phase === 'flowing'; i++) updateFlow(b, f, 0.05);
    expect(f.filledCount).toBe(3); // start + 2 al otro lado
    // Sin wrap se derrama al salir.
    const b2 = createBoard(10, 7, 9, 3, 'right');
    const f2 = createFlow(b2, 0, 10, 20, false);
    updateFlow(b2, f2, 0.01);
    for (let i = 0; i < 60 && f2.phase === 'flowing'; i++) updateFlow(b2, f2, 0.05);
    expect(f2.filledCount).toBe(1);
    expect(f2.phase).toBe('spilled');
  });
  it('el depósito se llena más lento y da bonus', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'reservoir' });
    const f = createFlow(b, 0, 1, 20);
    updateFlow(b, f, 0.01);
    updateFlow(b, f, 1.0); // completa el start, frente al depósito
    expect(f.x).toBe(3);
    updateFlow(b, f, 0.5);
    expect(f.progress).toBeLessThan(0.3); // recta habría llegado a ~0.5
    const s = { score: 0, pipesFilled: 0, replaced: 0 };
    applyCellFilled(s, { kind: 'reservoir' }, false, false);
    expect(s.score).toBe(CONFIG.SCORE_PIPE + CONFIG.SCORE_RESERVOIR);
  });
  it('la pieza final termina con éxito aunque falte distancia', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    b.cells[2][3].piece = { kind: 'end', dir: 'left' };
    const f = createFlow(b, 0, 10, 20);
    updateFlow(b, f, 0.01);
    let sawEnd = false;
    for (let i = 0; i < 60 && f.phase === 'flowing'; i++) {
      const evs = updateFlow(b, f, 0.05);
      if (evs.some((e) => e.type === 'entered-end')) sawEnd = true;
    }
    expect(sawEnd).toBe(true);
    expect(f.phase).toBe('cleared');
    expect(f.distanceDone).toBe(true);
  });
});

describe('Hito 3: récords', () => {
  it('guarda ordenados y corta al máximo', () => {
    const st = memStore();
    addRecord(100, 1, st);
    addRecord(500, 3, st);
    addRecord(300, 2, st);
    const recs = loadRecords(st);
    expect(recs.map((r) => r.score)).toEqual([500, 300, 100]);
    for (let i = 0; i < 20; i++) addRecord(i, 1, st);
    expect(loadRecords(st).length).toBeLessThanOrEqual(CONFIG.RECORDS_MAX);
  });
  it('store corrupto → tabla vacía sin romper', () => {
    const st = memStore();
    st.setItem(CONFIG.RECORDS_KEY, 'no-json{{{');
    expect(loadRecords(st)).toEqual([]);
    expect(loadRecords(null)).toEqual([]);
  });
});

describe('Hito 3: Game (final, bonus, 2P)', () => {
  function neighborOfStart(g: Game): { x: number; y: number; h: boolean } {
    const d = g.board.startDir;
    const dx = d === 'right' ? 1 : d === 'left' ? -1 : 0;
    const dy = d === 'down' ? 1 : d === 'up' ? -1 : 0;
    return { x: g.board.startX + dx, y: g.board.startY + dy, h: dx !== 0 };
  }

  it('alcanzar el final da +500 y pasa a recuento', () => {
    const g = new Game(21);
    g.newGame(1);
    const nb = neighborOfStart(g);
    g.board.cells[nb.y][nb.x].piece = { kind: 'end', dir: OPPOSITE[g.board.startDir] };
    g.flow.countdown = 0.01;
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('recount');
    // start 50 + final 50 + bonus 500, sin no usadas.
    expect(g.score.score).toBe(600);
  });

  it('la bonus puntúa doble', () => {
    const g = new Game(4);
    g.newGame(4);
    expect(g.isBonus).toBe(true);
    expect(g.flow.distanceLeft).toBe(CONFIG.BONUS_DISTANCE);
    // Limpia precolocadas y deja un camino mínimo de 2.
    for (let y = 0; y < g.board.rows; y++)
      for (let x = 0; x < g.board.cols; x++) {
        const c = g.board.cells[y][x];
        if (c.piece && c.piece.kind !== 'start') c.piece = null;
      }
    const nb = neighborOfStart(g);
    g.board.cells[nb.y][nb.x].piece = { kind: nb.h ? 'straight-h' : 'straight-v' };
    g.flow.countdown = 0.01;
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('over'); // distancia 6 no alcanzada
    expect(g.score.score).toBe(2 * CONFIG.SCORE_PIPE * CONFIG.BONUS_SCORE_MULT);
  });

  it('2P: al fallar pasa el turno; doble fallo termina', () => {
    const g = new Game(7);
    g.newGame(1, 2);
    g.scores[0].score = 100;
    g.flow.countdown = 0.01;
    let guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('switch');
    expect(g.current).toBe(0);
    guard = 0;
    while (g.screen === 'switch' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('playing');
    expect(g.current).toBe(1);
    expect(g.scores[0].score).toBe(150); // J1 conserva sus puntos (+50 del start)
    g.flow.countdown = 0.01;
    guard = 0;
    while (g.screen === 'playing' && guard++ < 20000) g.update(CONFIG.FIXED_DT);
    expect(g.screen).toBe('over'); // segundo fallo en el nivel → fin real
    expect(g.failsThisLevel).toBe(2);
  });
});
