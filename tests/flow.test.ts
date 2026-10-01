import { describe, expect, it } from 'vitest';
import { createBoard, placePiece } from '../src/core/board';
import { createFlow, updateFlow } from '../src/core/flow';

function stepUntil(b: Parameters<typeof updateFlow>[0], f: Parameters<typeof updateFlow>[1], max = 200) {
  for (let i = 0; i < max && f.phase === 'flowing'; i++) updateFlow(b, f, 0.05);
}

describe('flow', () => {
  it('respeta la cuenta atrás antes de fluir', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    const f = createFlow(b, 2, 2, 5);
    updateFlow(b, f, 0.5);
    expect(f.phase).toBe('countdown');
    updateFlow(b, f, 1.5);
    expect(f.phase).toBe('flowing');
    expect(f.filledCount).toBe(0);
  });
  it('avanza por tuberías conectadas y descuenta distancia', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'straight-h' });
    placePiece(b, 4, 2, { kind: 'straight-h' });
    const f = createFlow(b, 0, 10, 3);
    updateFlow(b, f, 0.01); // pasa a flowing
    stepUntil(b, f);
    // start + 2 tuberías = 3 llenadas → distancia 0 → cleared al derramar al vacío
    expect(f.filledCount).toBe(3);
    expect(f.distanceDone).toBe(true);
    expect(f.phase).toBe('cleared');
  });
  it('derrame a casilla vacía termina el nivel sin distancia', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    const f = createFlow(b, 0, 10, 8);
    updateFlow(b, f, 0.01);
    stepUntil(b, f);
    expect(f.phase).toBe('spilled');
    expect(f.distanceDone).toBe(false);
  });
  it('derrame si la pieza no conecta', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'straight-v' }); // no abre a la izquierda
    const f = createFlow(b, 0, 10, 8);
    updateFlow(b, f, 0.01);
    stepUntil(b, f);
    expect(f.phase).toBe('spilled');
    expect(f.filledCount).toBe(1); // solo el start
  });
  it('el cruce atraviesa recto', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'cross' });
    placePiece(b, 4, 2, { kind: 'straight-h' });
    const f = createFlow(b, 0, 10, 3);
    updateFlow(b, f, 0.01);
    stepUntil(b, f);
    expect(f.filledCount).toBe(3);
    expect(f.phase).toBe('cleared');
  });
  it('el codo gira el flujo', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'elbow-dl' }); // entra por izquierda, sale abajo
    placePiece(b, 3, 3, { kind: 'straight-v' });
    const f = createFlow(b, 0, 10, 3);
    updateFlow(b, f, 0.01);
    stepUntil(b, f);
    expect(f.filledCount).toBe(3);
  });
  it('segundo paso por un cruce emite crossedTwice (bucle)', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'cross' });
    placePiece(b, 4, 2, { kind: 'straight-h' });
    const f = createFlow(b, 0, 10, 20);
    updateFlow(b, f, 0.01);
    for (let i = 0; i < 50 && b.cells[2][3].passCount < 1; i++) updateFlow(b, f, 0.05);
    expect(b.cells[2][3].passCount).toBe(1);
    // Simula el retorno de un bucle: el frente vuelve al cruce desde arriba.
    f.x = 3;
    f.y = 2;
    f.entry = 'up';
    f.phase = 'flowing';
    f.progress = 0.99;
    const evs = updateFlow(b, f, 0.05);
    expect(evs.some((e) => e.type === 'cell-filled' && e.crossedTwice)).toBe(true);
    expect(b.cells[2][3].passCount).toBe(2);
  });
  it('llenado progresivo: no salta instantáneo', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'straight-h' });
    const f = createFlow(b, 0, 1, 8); // 1 casilla/s
    updateFlow(b, f, 0.01);
    updateFlow(b, f, 0.5);
    expect(f.filledCount).toBe(0);
    expect(f.progress).toBeGreaterThan(0.3);
    expect(f.progress).toBeLessThan(0.7);
  });
});
