import { describe, expect, it } from 'vitest';
import { createBoard, isFree, isReplaceable, placePiece, replacePiece } from '../src/core/board';

describe('board', () => {
  it('coloca en libre y rechaza ocupado', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    expect(isFree(b, 3, 2)).toBe(true);
    expect(placePiece(b, 3, 2, { kind: 'straight-h' })).toBe(true);
    expect(isFree(b, 3, 2)).toBe(false);
    expect(placePiece(b, 3, 2, { kind: 'straight-v' })).toBe(false);
  });
  it('el start no es reemplazable; una tubería sin llenar sí', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    expect(isReplaceable(b, 2, 2)).toBe(false);
    placePiece(b, 3, 2, { kind: 'straight-h' });
    expect(isReplaceable(b, 3, 2)).toBe(true);
    expect(replacePiece(b, 3, 2, { kind: 'straight-v' })).toBe(true);
    expect(b.cells[2][3].piece!.kind).toBe('straight-v');
  });
  it('una tubería llena no se puede reemplazar', () => {
    const b = createBoard(10, 7, 2, 2, 'right');
    placePiece(b, 3, 2, { kind: 'straight-h' });
    b.cells[2][3].filled = true;
    expect(isReplaceable(b, 3, 2)).toBe(false);
    expect(replacePiece(b, 3, 2, { kind: 'cross' })).toBe(false);
  });
});
