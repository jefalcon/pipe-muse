// pipe-muse render — escena HD 960x600 (adaptador fino sobre el estado).
import { CONFIG } from '../config';
import { t } from '../i18n';
import { passwordForLevel } from '../core/password';
import type { Game } from '../game/Game';
import {
  COLORS,
  baseSprite,
  blit,
  drawFilling,
  ensureArt,
  fullSprite,
  obstacleSprite,
  paintPanel,
  paintWell,
  rr,
} from './sprites';

const FONT_UI = '"Segoe UI", system-ui, -apple-system, sans-serif';
const FONT_NUM = 'ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';

/** Marcador con 6 dígitos y signo (000400 / -00050). */
function fmtScore(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(n)).padStart(6, '0');
}

export function render(
  g: Game,
  ctx: CanvasRenderingContext2D,
  timeMs: number,
  artScale: number,
  muted = false,
): void {
  ensureArt(artScale);
  paintBackground(ctx, timeMs);

  if (g.screen === 'title') {
    drawTitle(ctx, timeMs);
    drawMute(g, ctx, muted);
    return;
  }
  if (g.screen === 'select') {
    drawSelect(g, ctx, timeMs);
    drawMute(g, ctx, muted);
    return;
  }

  // Sacudida por explosiones (determinista, decae con el ttl).
  const s = g.shake();
  ctx.save();
  if (s > 0.05) ctx.translate(Math.sin(timeMs * 0.09) * s, Math.cos(timeMs * 0.113) * s);
  drawHUD(g, ctx);
  drawDispenser(g, ctx, timeMs);
  drawBoard(g, ctx, timeMs);
  drawSidePanel(g, ctx, timeMs);
  drawBottomHints(g, ctx);
  drawBooms(g, ctx);
  drawPopups(g, ctx);
  ctx.restore();

  if (g.screen === 'paused') drawOverlay(ctx, t('paused'), t('resume_hint'), COLORS.text);
  else if (g.endDelay > 0) {
    // Deja ver el derrame antes del panel.
  } else if (g.screen === 'clear') drawClear(g, ctx);
  else if (g.screen === 'over') drawGameOver(g, ctx);
  drawMute(g, ctx, muted);
}

/** Botón de silencio: altavoz con ondas o X. */
function drawMute(g: Game, ctx: CanvasRenderingContext2D, muted: boolean): void {
  const r = g.muteRect();
  ctx.fillStyle = muted ? '#3a2030' : '#1f4a2c';
  rr(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.strokeStyle = muted ? COLORS.danger : COLORS.ledOn;
  ctx.lineWidth = 2;
  ctx.stroke();
  const cx = r.x + 16;
  const cy = r.y + r.h / 2;
  ctx.fillStyle = COLORS.text;
  ctx.fillRect(cx - 7, cy - 5, 5, 10);
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 9);
  ctx.lineTo(cx + 6, cy - 3);
  ctx.lineTo(cx + 6, cy + 3);
  ctx.lineTo(cx - 2, cy + 9);
  ctx.closePath();
  ctx.fill();
  if (muted) {
    ctx.strokeStyle = COLORS.danger;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - 7);
    ctx.lineTo(cx + 20, cy + 7);
    ctx.moveTo(cx + 20, cy - 7);
    ctx.lineTo(cx + 10, cy + 7);
    ctx.stroke();
  } else {
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 2;
    for (const rad of [6, 11]) {
      ctx.beginPath();
      ctx.arc(cx + 6, cy, rad, -0.9, 0.9);
      ctx.stroke();
    }
  }
}

// ---------- fondo ----------

function paintBackground(ctx: CanvasRenderingContext2D, timeMs: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.VIEW_H);
  grad.addColorStop(0, COLORS.bgTop);
  grad.addColorStop(0.6, '#101a2b');
  grad.addColorStop(1, COLORS.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
  // Trama diagonal sutil.
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = '#8fa5c8';
  ctx.lineWidth = 1;
  const off = (timeMs / 80) % 28;
  for (let x = -CONFIG.VIEW_H + off; x < CONFIG.VIEW_W; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CONFIG.VIEW_H, CONFIG.VIEW_H);
    ctx.stroke();
  }
  ctx.restore();
  // Viñeta.
  const v = ctx.createRadialGradient(480, 300, 240, 480, 300, 640);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
}

// ---------- HUD ----------

function drawHUD(g: Game, ctx: CanvasRenderingContext2D): void {
  // Nivel + puntos.
  paintPanel(ctx, 16, 8, 296, 72);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 12px ${FONT_UI}`;
  const who = g.players === 2 ? `${g.playerTag()} · ` : '';
  const bonus = g.isBonus ? ` ${t('bonus')}` : '';
  ctx.fillText(`${who}${t('level').toUpperCase()} ${g.level}${bonus}`, 30, 32);
  ctx.fillStyle = g.score.score < 0 ? COLORS.danger : COLORS.text;
  ctx.font = `700 26px ${FONT_NUM}`;
  ctx.fillText(fmtScore(g.score.score), 30, 62);

  // Distancia.
  paintPanel(ctx, 324, 8, 312, 72);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 12px ${FONT_UI}`;
  ctx.fillText(t('need').toUpperCase(), 338, 32);
  ctx.fillStyle = g.flow.distanceDone ? COLORS.ledOn : COLORS.accent;
  ctx.font = `700 26px ${FONT_NUM}`;
  ctx.fillText(g.flow.distanceDone ? 'OK' : String(g.flow.distanceLeft), 338, 62);
  // Barra de progreso.
  const total = g.flow.distanceLeft + g.flow.filledCount;
  const frac = total > 0 ? 1 - g.flow.distanceLeft / total : 0;
  ctx.fillStyle = '#0a0f1a';
  rr(ctx, 420, 40, 200, 14, 7);
  ctx.fill();
  const wf = Math.round(200 * Math.min(1, Math.max(0, frac)));
  if (wf > 0) {
    const fg = ctx.createLinearGradient(0, 40, 0, 54);
    fg.addColorStop(0, COLORS.flujoHi);
    fg.addColorStop(1, COLORS.flujoDark);
    ctx.fillStyle = fg;
    rr(ctx, 420, 40, wf, 14, 7);
    ctx.fill();
  }

  // Cuenta atrás / caudal.
  paintPanel(ctx, 648, 8, 296, 72);
  if (g.flow.phase === 'countdown') {
    ctx.fillStyle = COLORS.dim;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText(t('countdown').toUpperCase(), 662, 32);
    const urgent = g.flow.countdown <= 3.2;
    ctx.fillStyle = urgent ? COLORS.danger : COLORS.accent;
    ctx.font = `700 ${urgent ? 30 : 26}px ${FONT_NUM}`;
    ctx.fillText(`${Math.ceil(g.flow.countdown)}s`, 662, 62);
    const frac2 = Math.max(0, g.flow.countdown / g.totalCountdown);
    ctx.fillStyle = '#0a0f1a';
    rr(ctx, 786, 40, 144, 14, 7);
    ctx.fill();
    ctx.fillStyle = COLORS.accent;
    rr(ctx, 786, 40, Math.round(144 * frac2), 14, 7);
    ctx.fill();
  } else {
    ctx.fillStyle = COLORS.dim;
    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillText(g.fast ? t('fast') : 'FLOW', 662, 32);
    ctx.fillStyle = g.fast ? COLORS.danger : COLORS.flujo;
    ctx.font = `700 26px ${FONT_NUM}`;
    ctx.fillText(g.fast ? 'x2' : `${g.flow.speed.toFixed(1)}/s`, 662, 62);
    ctx.fillStyle = '#0a0f1a';
    rr(ctx, 786, 40, 144, 14, 7);
    ctx.fill();
    const fg = ctx.createLinearGradient(0, 40, 0, 54);
    fg.addColorStop(0, COLORS.flujoHi);
    fg.addColorStop(1, COLORS.flujoDark);
    ctx.fillStyle = fg;
    rr(ctx, 786, 40, Math.round(144 * Math.min(1, g.flow.progress)), 14, 7);
    ctx.fill();
  }
}

// ---------- dispensador ----------

function drawDispenser(g: Game, ctx: CanvasRenderingContext2D, timeMs: number): void {
  paintPanel(ctx, 16, 96, 144, 448);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `700 12px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.fillText(t('next').toUpperCase(), 88, 111);
  ctx.textAlign = 'left';
  // queue[0] abajo (actual), última arriba.
  for (let i = 0; i < g.queue.length; i++) {
    const slotFromTop = g.queue.length - 1 - i;
    const px = CONFIG.DISP_X;
    const py = CONFIG.DISP_Y + slotFromTop * CONFIG.DISP_GAP;
    const isCurrent = i === 0;
    paintWell(ctx, px - 4, py - 4, CONFIG.TILE + 8);
    if (isCurrent) {
      const pulse = 0.55 + 0.35 * Math.sin(timeMs / 240);
      ctx.strokeStyle = `rgba(81,255,126,${pulse.toFixed(2)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 5.5, py - 5.5, CONFIG.TILE + 11, CONFIG.TILE + 11);
    }
    blit(ctx, baseSprite(g.queue[i]), px, py);
    if (isCurrent) {
      // Flecha "colocar esta".
      ctx.fillStyle = COLORS.ledOn;
      const bob = Math.sin(timeMs / 200) * 2;
      ctx.beginPath();
      ctx.moveTo(px - 22 + bob, py + 24);
      ctx.lineTo(px - 12 + bob, py + 32);
      ctx.lineTo(px - 22 + bob, py + 40);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// ---------- tablero ----------

function drawBoard(g: Game, ctx: CanvasRenderingContext2D, timeMs: number): void {
  // Marco.
  paintPanel(ctx, CONFIG.BOARD_X - 12, CONFIG.BOARD_Y - 12, CONFIG.COLS * CONFIG.TILE + 24, CONFIG.ROWS * CONFIG.TILE + 24);
  if (g.flow.wrap) drawWrapArrows(ctx);
  for (let y = 0; y < g.board.rows; y++) {
    for (let x = 0; x < g.board.cols; x++) {
      const px = CONFIG.BOARD_X + x * CONFIG.TILE;
      const py = CONFIG.BOARD_Y + y * CONFIG.TILE;
      const cell = g.board.cells[y][x];
      paintWell(ctx, px, py, CONFIG.TILE);
      if (cell.obstacle) {
        blit(ctx, obstacleSprite(), px, py);
        continue;
      }
      if (!cell.piece) continue;
      const isHead = x === g.flow.x && y === g.flow.y && g.flow.phase === 'flowing' && !cell.filled;
      if (cell.filled) blit(ctx, fullSprite(cell.piece), px, py);
      else if (isHead) drawFilling(ctx, px, py, cell.piece, g.flow.entry, g.flow.progress, timeMs);
      else blit(ctx, baseSprite(cell.piece), px, py);
    }
  }
  // Marcas del recuento: actual parpadeante, contadas con X roja.
  if (g.screen === 'recount') {
    const flash = Math.floor(timeMs / 120) % 2 === 0;
    for (const key of g.recounted) {
      const [rx, ry] = key.split(',').map(Number);
      const px = CONFIG.BOARD_X + rx * CONFIG.TILE;
      const py = CONFIG.BOARD_Y + ry * CONFIG.TILE;
      const isCurrent = g.recountCurrent !== null && g.recountCurrent.x === rx && g.recountCurrent.y === ry;
      ctx.fillStyle = isCurrent && flash ? 'rgba(255,82,82,0.45)' : 'rgba(120,20,20,0.45)';
      ctx.fillRect(px, py, CONFIG.TILE, CONFIG.TILE);
      ctx.strokeStyle = isCurrent ? '#ff5252' : '#a02a2a';
      ctx.lineWidth = isCurrent ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(px + 12, py + 12);
      ctx.lineTo(px + CONFIG.TILE - 12, py + CONFIG.TILE - 12);
      ctx.moveTo(px + CONFIG.TILE - 12, py + 12);
      ctx.lineTo(px + 12, py + CONFIG.TILE - 12);
      ctx.stroke();
    }
  }
  // Resplandor del start antes del flujo.
  if (g.flow.phase === 'countdown') {
    const sx = CONFIG.BOARD_X + g.board.startX * CONFIG.TILE;
    const sy = CONFIG.BOARD_Y + g.board.startY * CONFIG.TILE;
    const pulse = 0.3 + 0.25 * Math.sin(timeMs / 180);
    ctx.strokeStyle = `rgba(255,176,46,${pulse.toFixed(2)})`;
    ctx.lineWidth = 4;
    ctx.strokeRect(sx + 2, sy + 2, CONFIG.TILE - 4, CONFIG.TILE - 4);
  }
  // Cursor teclado (gris mientras el reemplazo lo bloquea).
  if (g.screen === 'playing') {
    const cx = CONFIG.BOARD_X + g.cursor.x * CONFIG.TILE;
    const cy = CONFIG.BOARD_Y + g.cursor.y * CONFIG.TILE;
    const locked = g.lockTimer > 0;
    ctx.strokeStyle = locked ? 'rgba(120,130,150,0.7)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1, cy + 1, CONFIG.TILE - 2, CONFIG.TILE - 2);
    // Esquinas ámbar.
    ctx.strokeStyle = locked ? '#5a6478' : COLORS.accent;
    ctx.lineWidth = 4;
    const L = 14;
    const corners: Array<[number, number, number, number]> = [
      [cx, cy, 1, 1],
      [cx + CONFIG.TILE, cy, -1, 1],
      [cx, cy + CONFIG.TILE, 1, -1],
      [cx + CONFIG.TILE, cy + CONFIG.TILE, -1, -1],
    ];
    for (const [x, y, dx, dy] of corners) {
      ctx.beginPath();
      ctx.moveTo(x + dx * L, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * L);
      ctx.stroke();
    }
  }
  // Derrame animado.
  if (g.flow.phase === 'spilled' || g.flow.phase === 'cleared') drawSpill(g, ctx, timeMs);
}

/** Chevrones en el marco: los bordes conectan con el lado opuesto. */
function drawWrapArrows(ctx: CanvasRenderingContext2D): void {
  const x0 = CONFIG.BOARD_X - 12;
  const y0 = CONFIG.BOARD_Y - 12;
  const w = CONFIG.COLS * CONFIG.TILE + 24;
  const h = CONFIG.ROWS * CONFIG.TILE + 24;
  const tri = (cx: number, cy: number, dx: number, dy: number): void => {
    ctx.fillStyle = COLORS.brass;
    ctx.beginPath();
    ctx.moveTo(cx + dx * 7, cy + dy * 7);
    ctx.lineTo(cx - dy * 5 - dx * 3, cy - dx * 5 - dy * 3);
    ctx.lineTo(cx + dy * 5 - dx * 3, cy + dx * 5 - dy * 3);
    ctx.closePath();
    ctx.fill();
  };
  const mx = x0 + w / 2;
  const my = y0 + h / 2;
  tri(mx - 10, y0 + 6, 0, 1);
  tri(mx + 10, y0 + 6, 0, 1);
  tri(mx - 10, y0 + h - 6, 0, -1);
  tri(mx + 10, y0 + h - 6, 0, -1);
  tri(x0 + 6, my - 10, 1, 0);
  tri(x0 + 6, my + 10, 1, 0);
  tri(x0 + w - 6, my - 10, -1, 0);
  tri(x0 + w - 6, my + 10, -1, 0);
}

function drawSpill(g: Game, ctx: CanvasRenderingContext2D, timeMs: number): void {
  const sx = CONFIG.BOARD_X + g.flow.spillX * CONFIG.TILE + CONFIG.TILE / 2;
  const sy = CONFIG.BOARD_Y + g.flow.spillY * CONFIG.TILE + CONFIG.TILE / 2;
  const d = g.flow.spillDir;
  const dx = d === 'right' ? 1 : d === 'left' ? -1 : 0;
  const dy = d === 'down' ? 1 : d === 'up' ? -1 : 0;
  const t = (timeMs / 1000) % 1.2;
  // Chorro.
  const grad = ctx.createLinearGradient(sx, sy, sx + dx * 64, sy + dy * 64);
  grad.addColorStop(0, COLORS.flujo);
  grad.addColorStop(1, 'rgba(47,212,101,0)');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(sx + dx * 20, sy + dy * 20);
  ctx.lineTo(sx + dx * (20 + t * 44), sy + dy * (20 + t * 44));
  ctx.stroke();
  // Gotas deterministas.
  for (let i = 0; i < 7; i++) {
    const ph = ((timeMs / 700 + i * 0.37) % 1 + 1) % 1;
    const spread = (i - 3) * 7;
    const gx = sx + dx * (30 + ph * 46) + (dy !== 0 ? spread * ph : 0);
    const gy = sy + dy * (30 + ph * 46) + (dx !== 0 ? spread * ph : 0) + ph * ph * 22;
    ctx.fillStyle = i % 2 ? COLORS.flujo : COLORS.flujoHi;
    ctx.beginPath();
    ctx.arc(gx, gy, 5 - ph * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Charco.
  ctx.fillStyle = 'rgba(20,128,64,0.85)';
  ctx.beginPath();
  ctx.ellipse(sx + dx * 52, sy + dy * 52 + 14, 26, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(157,247,192,0.5)';
  ctx.beginPath();
  ctx.ellipse(sx + dx * 52 - 6, sy + dy * 52 + 12, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- panel lateral ----------

function drawSidePanel(g: Game, ctx: CanvasRenderingContext2D, timeMs: number): void {
  paintPanel(ctx, 828, 96, 116, 448);
  ctx.textAlign = 'center';
  // Botón FAST.
  const r = g.fastButtonRect();
  const active = g.flow.phase === 'flowing' && g.screen === 'playing';
  const bg = !active ? '#232e47' : g.fast ? '#5c1f1f' : '#1f4a2c';
  const edge = !active ? COLORS.panelEdge : g.fast ? COLORS.danger : COLORS.ledOn;
  ctx.fillStyle = bg;
  rr(ctx, r.x, r.y, r.w, r.h, 10);
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = active ? COLORS.text : COLORS.dim;
  ctx.font = `800 20px ${FONT_UI}`;
  ctx.fillText('FAST', r.x + r.w / 2, r.y + 28);
  // LED.
  const ledOn = g.fast && Math.floor(timeMs / 250) % 2 === 0;
  ctx.fillStyle = !active ? COLORS.ledOff : g.fast ? (ledOn ? COLORS.ledOn : '#1d5c30') : COLORS.ledOff;
  ctx.beginPath();
  ctx.arc(r.x + r.w / 2 - 26, r.y + 48, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = active ? COLORS.text : COLORS.dim;
  ctx.font = `700 13px ${FONT_UI}`;
  ctx.fillText(g.fast ? 'ON · x2' : 'OFF', r.x + r.w / 2 + 8, r.y + 53);
  // Datos + ayuda.
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 12px ${FONT_UI}`;
  ctx.fillText(t('speed_hint'), 886, 150);
  ctx.fillText(t('pause_hint'), 886, 170);
  ctx.fillText('L · ES/EN', 886, 190);
  ctx.fillStyle = COLORS.steelMid;
  ctx.font = `700 12px ${FONT_UI}`;
  ctx.fillText(String(g.score.pipesFilled), 886, 250);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 11px ${FONT_UI}`;
  ctx.fillText('PIPES', 886, 264);
  ctx.fillStyle = COLORS.steelMid;
  ctx.font = `700 12px ${FONT_UI}`;
  ctx.fillText(`${g.flow.speed.toFixed(1)}/s`, 886, 300);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 11px ${FONT_UI}`;
  ctx.fillText('FLOW', 886, 314);
  if (g.players === 2) {
    const order: Array<0 | 1> = [0, 1];
    for (const p of order) {
      const y = 350 + p * 26;
      ctx.fillStyle = p === g.current ? COLORS.accent : COLORS.dim;
      ctx.font = `700 12px ${FONT_UI}`;
      ctx.fillText(`${t('player')}${p + 1} ${fmtScore(g.scores[p].score)}`, 886, y);
    }
  }
  ctx.textAlign = 'left';
}

function drawBottomHints(g: Game, ctx: CanvasRenderingContext2D): void {
  if (g.screen === 'switch') {
    paintPanel(ctx, 330, 548, 300, 40);
    ctx.fillStyle = COLORS.accent;
    ctx.font = `800 16px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${t('turn').toUpperCase()} ${g.playerTag(g.other())}`, 480, 573);
    ctx.textAlign = 'left';
    return;
  }
  if (g.screen === 'recount') {
    // Pancarta del recuento en lugar de la ayuda.
    paintPanel(ctx, 330, 548, 300, 40);
    ctx.fillStyle = COLORS.danger;
    ctx.font = `800 16px ${FONT_UI}`;
    ctx.textAlign = 'center';
    const left = g.recountQueue.length + (g.recountCurrent ? 1 : 0);
    ctx.fillText(`${t('recount').toUpperCase()} · -100 × ${left}`, 480, 573);
    ctx.textAlign = 'left';
    return;
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 13px ${FONT_UI}`;
  ctx.textAlign = 'center';
  ctx.fillText('Click / tap · ←↑↓→ + Space · F fast · P pause · L lang', 480, 576);
  ctx.textAlign = 'left';
}

function drawPopups(g: Game, ctx: CanvasRenderingContext2D): void {
  for (const p of g.popups) {
    const age = p.max - p.ttl;
    const scale = age < 0.15 ? 0.6 + 0.4 * (age / 0.15) : 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, p.ttl * 2.2);
    ctx.fillStyle = p.color;
    ctx.font = `800 20px ${FONT_NUM}`;
    ctx.textAlign = 'center';
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Explosiones del reemplazo: destello + metralla + onda (determinista). */
function drawBooms(g: Game, ctx: CanvasRenderingContext2D): void {
  const cols = ['#fff3d0', '#ffb02e', '#ff5252'];
  for (const b of g.booms) {
    const p = 1 - b.ttl / b.max; // 0 → 1
    const fade = 1 - p;
    // Onda expansiva.
    ctx.strokeStyle = `rgba(255,210,63,${(fade * 0.9).toFixed(2)})`;
    ctx.lineWidth = 4 * fade + 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 10 + p * 56, 0, Math.PI * 2);
    ctx.stroke();
    // Destello central.
    const flash = ctx.createRadialGradient(b.x, b.y, 1, b.x, b.y, 30 * fade + 8);
    flash.addColorStop(0, `rgba(255,255,255,${fade.toFixed(2)})`);
    flash.addColorStop(0.4, `rgba(255,176,46,${(fade * 0.9).toFixed(2)})`);
    flash.addColorStop(1, 'rgba(255,82,82,0)');
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 30 * fade + 8, 0, Math.PI * 2);
    ctx.fill();
    // Metralla.
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + p * 2.2;
      const dist = 8 + p * 54;
      const x = b.x + Math.cos(ang) * dist;
      const y = b.y + Math.sin(ang) * dist - p * 10;
      ctx.fillStyle = cols[i % 3];
      ctx.globalAlpha = fade;
      ctx.beginPath();
      ctx.arc(x, y, fade * 6 + 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Humo.
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.5;
      const x = b.x + Math.cos(ang) * (12 + p * 30);
      const y = b.y + Math.sin(ang) * (12 + p * 30) - p * 34;
      ctx.fillStyle = '#3a4358';
      ctx.globalAlpha = fade * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, 5 + p * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- selección ----------

function drawSelect(g: Game, ctx: CanvasRenderingContext2D, timeMs: number): void {
  paintPanel(ctx, 180, 90, 600, 420);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.text;
  ctx.font = `800 24px ${FONT_UI}`;
  ctx.fillText(t('menu_title').toUpperCase(), 480, 132);
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 13px ${FONT_UI}`;
  ctx.fillText(t('subtitle'), 480, 156);
  if (g.selectMode === 'menu') {
    const labels = [t('menu_1'), t('menu_2'), t('menu_pwd')];
    const rows = g.selectRects();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const hov = g.hover !== null && g.hover.x >= r.x && g.hover.x < r.x + r.w && g.hover.y >= r.y && g.hover.y < r.y + r.h;
      ctx.fillStyle = hov ? '#2e3d5e' : '#232e47';
      rr(ctx, r.x, r.y, r.w, r.h, 8);
      ctx.fill();
      ctx.strokeStyle = hov ? COLORS.accent : COLORS.panelEdge;
      ctx.lineWidth = hov ? 3 : 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.accent;
      ctx.font = `800 18px ${FONT_NUM}`;
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1} ·`, r.x + 18, r.y + 31);
      ctx.fillStyle = COLORS.text;
      ctx.font = `700 17px ${FONT_UI}`;
      ctx.fillText(labels[i], r.x + 62, r.y + 31);
      ctx.textAlign = 'center';
    }
  } else {
    ctx.fillStyle = COLORS.dim;
    ctx.font = `600 14px ${FONT_UI}`;
    ctx.fillText(t('pwd_prompt').toUpperCase(), 480, 216);
    // Caja del código.
    ctx.fillStyle = '#0a0f1a';
    rr(ctx, 330, 232, 300, 64, 10);
    ctx.fill();
    ctx.strokeStyle = g.pwdError ? COLORS.danger : COLORS.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `800 34px ${FONT_NUM}`;
    const shown = (g.pwdBuffer + '____').slice(0, 4).split('').join(' ');
    ctx.fillStyle = g.pwdError ? COLORS.danger : COLORS.text;
    const blink = Math.floor(timeMs / 400) % 2 === 0;
    ctx.fillText(g.pwdBuffer.length < 4 && blink ? shown.replace(/_/g, ' ') : shown, 480, 276);
    if (g.pwdError) {
      ctx.fillStyle = COLORS.danger;
      ctx.font = `700 14px ${FONT_UI}`;
      ctx.fillText(t('pwd_bad'), 480, 326);
    }
    ctx.fillStyle = COLORS.dim;
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillText(`${t('pwd_back')} · Enter: OK`, 480, 352);
  }
  // Mini tabla de récords.
  ctx.fillStyle = COLORS.dim;
  ctx.font = `700 13px ${FONT_UI}`;
  ctx.fillText(`— ${t('records').toUpperCase()} —`, 480, 398);
  ctx.font = `600 13px ${FONT_NUM}`;
  if (g.records.length === 0) {
    ctx.fillStyle = '#5a6478';
    ctx.fillText(t('empty_records'), 480, 424);
  } else {
    g.records.slice(0, 5).forEach((r, i) => {
      ctx.fillStyle = i === 0 ? COLORS.accent : COLORS.dim;
      ctx.fillText(`${i + 1}. ${fmtScore(r.score)} · N${r.level} · ${r.date}`, 480, 422 + i * 17);
    });
  }
  ctx.textAlign = 'left';
}

// ---------- título y overlays ----------

function drawTitle(ctx: CanvasRenderingContext2D, timeMs: number): void {
  // Tubería decorativa animada.
  const y = 330;
  ctx.lineCap = 'round';
  ctx.strokeStyle = COLORS.steelLine;
  ctx.lineWidth = 46;
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(880, y);
  ctx.stroke();
  const steel = ctx.createLinearGradient(0, y - 20, 0, y + 20);
  steel.addColorStop(0, COLORS.steelHi);
  steel.addColorStop(0.5, COLORS.steelMid);
  steel.addColorStop(1, COLORS.steelDark);
  ctx.strokeStyle = steel;
  ctx.lineWidth = 38;
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(880, y);
  ctx.stroke();
  ctx.strokeStyle = COLORS.channel;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(880, y);
  ctx.stroke();
  // Flujo animado con dashes.
  ctx.strokeStyle = COLORS.flujo;
  ctx.lineWidth = 16;
  ctx.setLineDash([46, 30]);
  ctx.lineDashOffset = -(timeMs / 18);
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(880, y);
  ctx.stroke();
  ctx.setLineDash([]);
  // Logo.
  ctx.textAlign = 'center';
  const lg = ctx.createLinearGradient(0, 120, 0, 230);
  lg.addColorStop(0, '#fff3d0');
  lg.addColorStop(0.5, COLORS.accent);
  lg.addColorStop(1, '#8a5a10');
  ctx.fillStyle = lg;
  ctx.font = `800 96px ${FONT_UI}`;
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillText('PIPE-MUSE', 480, 200);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 17px ${FONT_UI}`;
  ctx.fillText(t('subtitle'), 480, 240);
  ctx.fillText('· 1989 tribute ·', 480, 268);
  const blink = Math.floor(timeMs / 530) % 2 === 0;
  if (blink) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 22px ${FONT_UI}`;
    ctx.fillText(t('press_start'), 480, 420);
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = `600 14px ${FONT_UI}`;
  ctx.fillText(`${t('new_game')}    ${t('lang_hint')}`, 480, 470);
  ctx.textAlign = 'left';
}

function drawOverlay(ctx: CanvasRenderingContext2D, line1: string, line2: string, color: string): void {
  ctx.fillStyle = 'rgba(4,8,14,0.72)';
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
  paintPanel(ctx, 230, 210, 500, 170);
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.font = `800 34px ${FONT_UI}`;
  ctx.fillText(line1, 480, 280);
  const blink = Math.floor(performance.now() / 530) % 2 === 0;
  if (blink) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 18px ${FONT_UI}`;
    ctx.fillText(line2, 480, 330);
  }
  ctx.textAlign = 'left';
}

function drawClear(g: Game, ctx: CanvasRenderingContext2D): void {
  const pwd = g.level % CONFIG.PASSWORD_EVERY === 0 ? passwordForLevel(g.level) : null;
  ctx.fillStyle = 'rgba(4,8,14,0.72)';
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
  if (pwd) {
    paintPanel(ctx, 230, 180, 500, 230);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ledOn;
    ctx.font = `800 34px ${FONT_UI}`;
    ctx.fillText(t('level_clear'), 480, 248);
    ctx.fillStyle = COLORS.accent;
    ctx.font = `800 22px ${FONT_NUM}`;
    ctx.fillText(`${t('pwd_code').toUpperCase()}: ${pwd}`, 480, 300);
    const blink = Math.floor(performance.now() / 530) % 2 === 0;
    if (blink) {
      ctx.fillStyle = COLORS.text;
      ctx.font = `700 18px ${FONT_UI}`;
      ctx.fillText(t('press_enter_next'), 480, 360);
    }
  } else {
    drawOverlay(ctx, t('level_clear'), t('press_enter_next'), COLORS.ledOn);
    return;
  }
  ctx.textAlign = 'left';
}

function drawGameOver(g: Game, ctx: CanvasRenderingContext2D): void {
  const title = g.flow.phase === 'spilled' ? `${t('spill')} ${t('game_over')}` : t('game_over');
  ctx.fillStyle = 'rgba(4,8,14,0.78)';
  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
  paintPanel(ctx, 180, 56, 600, 488);
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.danger;
  ctx.font = `800 30px ${FONT_UI}`;
  ctx.fillText(title, 480, 112);
  if (g.players === 2) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.fillText(
      `${t('player')}1 ${fmtScore(g.scores[0].score)}  ·  ${t('player')}2 ${fmtScore(g.scores[1].score)}`,
      480,
      142,
    );
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = `700 13px ${FONT_UI}`;
  ctx.fillText(`— ${t('records').toUpperCase()} —`, 480, g.players === 2 ? 168 : 158);
  ctx.font = `600 14px ${FONT_NUM}`;
  const topY = g.players === 2 ? 192 : 182;
  if (g.records.length === 0) {
    ctx.fillStyle = '#5a6478';
    ctx.fillText(t('empty_records'), 480, topY + 10);
  } else {
    g.records.forEach((r, i) => {
      ctx.fillStyle = i === 0 ? COLORS.accent : COLORS.dim;
      ctx.fillText(`${i + 1}. ${fmtScore(r.score)} · N${r.level} · ${r.date}`, 480, topY + i * 23);
    });
  }
  const blink = Math.floor(performance.now() / 530) % 2 === 0;
  if (blink) {
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 18px ${FONT_UI}`;
    ctx.fillText(t('press_enter_retry'), 480, 510);
  }
  ctx.textAlign = 'left';
}
