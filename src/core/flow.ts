// pipe-muse core — avance del flujo (lógica pura, paso fijo).
// El líquido avanza casilla a casilla con llenado progresivo 0..1 dentro
// de cada tubería. Derrama al llegar a borde, vacío o pieza que no conecta.
import { CONFIG } from '../config';
import type { Board, Dir, FlowState, Piece } from './types';
import { DX, DY, OPPOSITE } from './types';
import { connects, exitDir } from './pieces';
import { getCell } from './board';

export type FlowEvent =
  | { type: 'cell-filled'; x: number; y: number; piece: Piece; crossedTwice: boolean }
  | { type: 'distance-done' }
  | { type: 'entered-end'; x: number; y: number }
  | { type: 'spilled'; x: number; y: number; dir: Dir };

export function createFlow(
  b: Board,
  countdown: number,
  speed: number,
  distance: number,
  wrap = false,
): FlowState {
  return {
    wrap,
    phase: 'countdown',
    countdown,
    x: b.startX,
    y: b.startY,
    entry: OPPOSITE[b.startDir], // ficticia: la salida del start es startDir
    progress: 0,
    filledCount: 0,
    distanceLeft: distance,
    speed,
    spillX: b.startX,
    spillY: b.startY,
    spillDir: b.startDir,
    distanceDone: false,
  };
}

/**
 * Avanza la simulación dt segundos. Mutación contenida en board+flow.
 * Devuelve eventos para puntuación/animación. `speedOverride` permite avance rápido.
 */
export function updateFlow(
  b: Board,
  f: FlowState,
  dt: number,
  speedOverride?: number,
): FlowEvent[] {
  const events: FlowEvent[] = [];
  if (f.phase === 'spilled' || f.phase === 'cleared') return events;

  if (f.phase === 'countdown') {
    f.countdown -= dt;
    if (f.countdown > 0) return events;
    // Consume solo el tiempo sobrante tras expirar la cuenta atrás.
    dt = Math.max(0, -f.countdown);
    f.phase = 'flowing';
    f.countdown = 0;
    // El frente empieza llenando la casilla inicial.
    f.x = b.startX;
    f.y = b.startY;
    f.entry = OPPOSITE[b.startDir];
    f.progress = 0;
    if (dt <= 0) return events;
  }

  let speed = speedOverride ?? f.speed;
  // El depósito tarda más en llenarse.
  const head = getCell(b, f.x, f.y);
  if (head?.piece?.kind === 'reservoir') speed /= CONFIG.RESERVOIR_FILL_TIME_MULT;
  f.progress += dt * speed;

  // Refleja el progreso en la celda actual (para render).
  const cur = getCell(b, f.x, f.y);
  if (cur) cur.fill = Math.min(1, f.progress);

  // Puede completar varias casillas si dt*speed > 1 (avance rápido).
  while (f.progress >= 1 && f.phase === 'flowing') {
    f.progress -= 1;
    completeCell(b, f, events);
  }
  // Actualiza el fill de la (posible) nueva celda actual.
  const now = getCell(b, f.x, f.y);
  if (now && f.phase === 'flowing') now.fill = Math.min(1, Math.max(now.fill, f.progress));
  return events;
}

function completeCell(b: Board, f: FlowState, events: FlowEvent[]): void {
  const cell = getCell(b, f.x, f.y);
  if (!cell || !cell.piece) {
    spill(f, f.x, f.y, OPPOSITE[f.entry], events);
    return;
  }
  cell.filled = true;
  cell.fill = 1;
  cell.passCount += 1;
  f.filledCount += 1;

  const piece = cell.piece;
  const crossedTwice = piece.kind === 'cross' && cell.passCount >= 2;
  events.push({ type: 'cell-filled', x: f.x, y: f.y, piece: { ...piece }, crossedTwice });

  if (!f.distanceDone) {
    f.distanceLeft -= 1;
    if (f.distanceLeft <= 0) {
      f.distanceLeft = 0;
      f.distanceDone = true;
      events.push({ type: 'distance-done' });
    }
  }

  // Pieza final: termina el nivel con éxito (Hito 3).
  if (piece.kind === 'end') {
    events.push({ type: 'entered-end', x: f.x, y: f.y });
    if (!f.distanceDone) {
      f.distanceDone = true;
      f.distanceLeft = 0;
      events.push({ type: 'distance-done' });
    }
    f.phase = 'cleared';
    return;
  }

  // Calcula la salida según la entrada.
  const out = piece.kind === 'start' ? piece.dir! : exitDir(piece, f.entry);
  if (!out) {
    spill(f, f.x, f.y, OPPOSITE[f.entry], events);
    return;
  }

  let nx = f.x + DX[out];
  let ny = f.y + DY[out];
  const needSide: Dir = OPPOSITE[out];
  if (nx < 0 || ny < 0 || nx >= b.cols || ny >= b.rows) {
    // Borde: derrame… salvo niveles con wrap (conecta al lado opuesto).
    if (!f.wrap) {
      spill(f, f.x, f.y, out, events);
      return;
    }
    nx = (nx + b.cols) % b.cols;
    ny = (ny + b.rows) % b.rows;
  }
  const next = getCell(b, nx, ny);
  if (!next || next.obstacle || !next.piece || !connects(next.piece, needSide)) {
    // El flujo intenta salir hacia (nx,ny): derrame en el borde de la actual.
    spill(f, f.x, f.y, out, events);
    return;
  }
  // Avanza el frente.
  f.x = nx;
  f.y = ny;
  f.entry = needSide;
  // Si la siguiente ya estaba llena (bucle sobre cruce), el passCount lo detectará
  // al completarla; el render puede mostrar doble paso.
}
function spill(f: FlowState, x: number, y: number, dir: Dir, events: FlowEvent[]): void {
  f.phase = f.distanceDone ? 'cleared' : 'spilled';
  f.spillX = x;
  f.spillY = y;
  f.spillDir = dir;
  events.push({ type: 'spilled', x, y, dir });
}
