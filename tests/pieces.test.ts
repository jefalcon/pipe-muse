import { describe, expect, it } from 'vitest';
import { exitDir, getConnections } from '../src/core/pieces';

describe('pieces: conexiones', () => {
  it('recta horizontal abre izquierda/derecha', () => {
    expect(getConnections({ kind: 'straight-h' }).sort()).toEqual(['left', 'right']);
    expect(exitDir({ kind: 'straight-h' }, 'left')).toBe('right');
    expect(exitDir({ kind: 'straight-h' }, 'right')).toBe('left');
    expect(exitDir({ kind: 'straight-h' }, 'up')).toBeNull();
  });
  it('recta vertical abre arriba/abajo', () => {
    expect(exitDir({ kind: 'straight-v' }, 'up')).toBe('down');
    expect(exitDir({ kind: 'straight-v' }, 'down')).toBe('up');
    expect(exitDir({ kind: 'straight-v' }, 'left')).toBeNull();
  });
  it('los 4 codos conectan sus dos lados', () => {
    expect(exitDir({ kind: 'elbow-ur' }, 'up')).toBe('right');
    expect(exitDir({ kind: 'elbow-ur' }, 'right')).toBe('up');
    expect(exitDir({ kind: 'elbow-rd' }, 'right')).toBe('down');
    expect(exitDir({ kind: 'elbow-rd' }, 'down')).toBe('right');
    expect(exitDir({ kind: 'elbow-dl' }, 'down')).toBe('left');
    expect(exitDir({ kind: 'elbow-dl' }, 'left')).toBe('down');
    expect(exitDir({ kind: 'elbow-lu' }, 'left')).toBe('up');
    expect(exitDir({ kind: 'elbow-lu' }, 'up')).toBe('left');
  });
  it('cruce atraviesa recto', () => {
    expect(exitDir({ kind: 'cross' }, 'left')).toBe('right');
    expect(exitDir({ kind: 'cross' }, 'up')).toBe('down');
  });
  it('start devuelve su salida', () => {
    expect(exitDir({ kind: 'start', dir: 'right' }, 'left')).toBe('right');
  });
});
