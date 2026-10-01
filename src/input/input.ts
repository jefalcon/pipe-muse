// pipe-muse input — ratón/toque + teclado (adaptador fino).
import { CONFIG } from '../config';
import type { Game } from '../game/Game';
import type { AudioMan } from '../audio/audio';
import { toggleLang } from '../i18n';

export function attachInput(canvas: HTMLCanvasElement, g: Game, audio?: AudioMan): void {
  // OJO: mapea contra el tamaño LÓGICO (el backing puede ir a 2x por DPR).
  const toLogical = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (CONFIG.VIEW_W / r.width),
      y: (clientY - r.top) * (CONFIG.VIEW_H / r.height),
    };
  };

  const press = (lx: number, ly: number): void => {
    if (g.inMuteButton(lx, ly)) {
      audio?.toggleMute();
      return;
    }
    if (g.screen === 'title') {
      g.goSelect();
      return;
    }
    if (g.screen === 'select') {
      if (g.selectMode === 'menu') {
        const row = g.inMenuRow(lx, ly);
        if (row >= 0) g.pickSelect(row);
      }
      return;
    }
    if (g.screen === 'clear' || g.screen === 'over') {
      if (g.endDelay > 0) {
        g.endDelay = 0; // primer toque: salta la animación del derrame
        return;
      }
      if (g.screen === 'clear') g.nextLevel();
      else g.retry();
      return;
    }
    if (g.screen !== 'playing') return;
    if (g.inFastButton(lx, ly)) {
      g.toggleFast();
      return;
    }
    const cell = g.cellFromPixel(lx, ly);
    if (cell) {
      g.cursor.x = cell.x;
      g.cursor.y = cell.y;
      g.tryPlace(cell.x, cell.y);
    }
  };

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    const p = toLogical(ev.clientX, ev.clientY);
    press(p.x, p.y);
    canvas.focus?.();
  });

  canvas.addEventListener('pointermove', (ev) => {
    g.hover = toLogical(ev.clientX, ev.clientY);
  });
  canvas.addEventListener('pointerleave', () => {
    g.hover = null;
  });

  window.addEventListener('keydown', (ev) => {
    const k = ev.key;
    // Modo contraseña: las teclas alimentan el código (sin atajos).
    if (g.screen === 'select' && g.selectMode === 'password') {
      if (k === 'Escape') g.backToMenu();
      else if (k === 'Enter') g.submitPassword();
      else if (k === 'Backspace') g.erasePassword();
      else if (k.length === 1) g.typePassword(k);
      return;
    }
    if (k === 'l' || k === 'L') {
      toggleLang();
      return;
    }
    if (k === 'm' || k === 'M') {
      audio?.toggleMute();
      return;
    }
    if (g.screen === 'title' && (k === 'Enter' || k === ' ')) {
      ev.preventDefault();
      g.goSelect();
      return;
    }
    if (g.screen === 'select' && g.selectMode === 'menu') {
      if (k === '1' || k === '2' || k === '3') g.pickSelect(Number(k) - 1);
      else if (k === 'Escape') g.screen = 'title';
      return;
    }
    if ((g.screen === 'clear' || g.screen === 'over') && (k === 'Enter' || k === ' ')) {
      ev.preventDefault();
      if (g.endDelay > 0) {
        g.endDelay = 0;
        return;
      }
      if (g.screen === 'clear') g.nextLevel();
      else g.retry();
      return;
    }
    if (k === 'p' || k === 'P' || k === 'Escape') {
      g.togglePause();
      return;
    }
    if (g.screen !== 'playing') return;
    if (k === 'ArrowUp') {
      ev.preventDefault();
      g.moveCursor(0, -1);
    } else if (k === 'ArrowDown') {
      ev.preventDefault();
      g.moveCursor(0, 1);
    } else if (k === 'ArrowLeft') {
      ev.preventDefault();
      g.moveCursor(-1, 0);
    } else if (k === 'ArrowRight') {
      ev.preventDefault();
      g.moveCursor(1, 0);
    } else if (k === ' ' || k === 'Enter') {
      ev.preventDefault();
      g.placeAtCursor();
    } else if (k === 'f' || k === 'F') {
      g.toggleFast();
    }
  });
}
