// pipe-muse — juego: máquina de estados (Hito 3).
// title → select → playing ⇄ paused → recount → clear / over,
// con switch (cambio de turno en 2P). Récords en localStorage.
import { CONFIG } from '../config';
import type { Board, FlowState } from '../core/types';
import type { Piece } from '../core/types';
import { createFlow, updateFlow } from '../core/flow';
import { generateBoard, getLevelConfig, randomPiece } from '../core/levels';
import { getCell, isFree, isReplaceable, listUnusedCells, replacePiece } from '../core/board';
import { applyCellFilled, applyReplace, applyUnusedPenalty, scoreForEnd, type ScoreState } from '../core/scoring';
import { levelForPassword } from '../core/password';
import { addRecord, loadRecords, type RecordEntry } from './records';
import { makeRng, type Rng } from '../core/rng';
import type { SfxName } from '../audio/audio';
import { t } from '../i18n';

export type Screen = 'title' | 'select' | 'playing' | 'paused' | 'recount' | 'switch' | 'clear' | 'over';
export type SelectMode = 'menu' | 'password';

export interface Popup {
  x: number;
  y: number;
  text: string;
  ttl: number;
  max: number;
  color: string;
}

export interface Explosion {
  x: number; // centro en coords. lógicas
  y: number;
  ttl: number;
  max: number;
}

export interface MenuRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const RECOUNT_STEP = 0.3; // s por tubería no usada
const BOOM_TTL = 0.55; // duración de la explosión (s)
const SWITCH_DELAY = 2.2; // s mostrando el derrame antes del cambio de turno

function freshScore(): ScoreState {
  return { score: 0, pipesFilled: 0, replaced: 0 };
}

export class Game {
  screen: Screen = 'title';
  /** Retardo (s) antes de mostrar el panel de fin (para ver el derrame). */
  endDelay = 0;
  level = 1;
  board: Board;
  flow: FlowState;
  queue: Piece[] = [];
  /** Puntuaciones por jugador (1P usa [0]); `score` = jugador actual. */
  scores: ScoreState[] = [freshScore(), freshScore()];
  players: 1 | 2 = 1;
  current: 0 | 1 = 0;
  failsThisLevel = 0;
  isBonus = false;
  cursor = { x: 0, y: 0 };
  fast = false;
  totalCountdown = 1;
  /** Bloqueo de colocación tras reemplazo (s restantes). */
  lockTimer = 0;
  popups: Popup[] = [];
  booms: Explosion[] = [];
  // Recuento de fin de nivel.
  recountQueue: Array<{ x: number; y: number }> = [];
  recounted: Set<string> = new Set();
  recountCurrent: { x: number; y: number } | null = null;
  recountTimer = 0;
  // Selección y contraseña.
  selectMode: SelectMode = 'menu';
  pwdBuffer = '';
  pwdError = false;
  records: RecordEntry[] = [];
  /** Cola de efectos pendientes (main.ts la drena hacia el AudioMan). */
  audioEvents: SfxName[] = [];
  /** Última posición del ratón (coords. lógicas) para resaltados. */
  hover: { x: number; y: number } | null = null;
  private lastTick = -1;
  private rng: Rng;

  constructor(seed?: number) {
    this.rng = makeRng(seed ?? ((Math.random() * 0xffffffff) >>> 0));
    this.board = generateBoard(this.rng, this.level);
    const cfg = getLevelConfig(this.level);
    this.flow = createFlow(this.board, cfg.countdown, cfg.speed, cfg.distance, cfg.wrap);
    this.totalCountdown = cfg.countdown;
    this.queue = [];
    for (let i = 0; i < CONFIG.QUEUE_SIZE; i++) this.queue.push(randomPiece(this.rng, this.level));
    this.cursor = { x: Math.floor(this.board.cols / 2), y: Math.floor(this.board.rows / 2) };
    this.records = loadRecords();
  }

  get score(): ScoreState {
    return this.scores[this.current];
  }

  newGame(level = 1, players: 1 | 2 = 1): void {
    this.players = players;
    this.current = 0;
    this.failsThisLevel = 0;
    this.scores = [freshScore(), freshScore()];
    this.startLevel(level);
    this.screen = 'playing';
  }

  startLevel(level: number): void {
    this.level = level;
    const cfg = getLevelConfig(level);
    this.isBonus = cfg.bonusRound;
    this.board = generateBoard(this.rng, level);
    this.flow = createFlow(this.board, cfg.countdown, cfg.speed, cfg.distance, cfg.wrap);
    this.totalCountdown = cfg.countdown;
    // En bonus, respiro: solo piezas básicas.
    const qLevel = cfg.bonusRound ? 1 : level;
    this.queue = [];
    for (let i = 0; i < CONFIG.QUEUE_SIZE; i++) this.queue.push(randomPiece(this.rng, qLevel));
    this.queueLevel = qLevel;
    this.fast = false;
    this.lockTimer = 0;
    this.popups = [];
    this.booms = [];
    this.recountQueue = [];
    this.recounted = new Set();
    this.recountCurrent = null;
    this.recountTimer = 0;
    this.endDelay = 0;
    this.lastTick = -1;
  }

  private queueLevel = 1;

  nextLevel(): void {
    this.failsThisLevel = 0;
    if (this.players === 2) this.current = this.other();
    this.startLevel(this.level + 1);
    this.screen = 'playing';
    if (this.players === 2) this.turnPopup();
  }

  retry(): void {
    this.scores = [freshScore(), freshScore()];
    this.current = 0;
    this.failsThisLevel = 0;
    this.startLevel(this.level);
    this.screen = 'playing';
  }

  other(): 0 | 1 {
    return this.current === 0 ? 1 : 0;
  }

  playerTag(p?: 0 | 1): string {
    return `${t('player')}${(p ?? this.current) + 1}`;
  }

  private turnPopup(): void {
    this.spawnPopup(CONFIG.VIEW_W / 2, 300, `${t('turn')} ${this.playerTag()}`, '#ffb02e', 2.0);
    this.audioEvents.push('turn');
  }

  goSelect(): void {
    this.screen = 'select';
    this.selectMode = 'menu';
    this.pwdBuffer = '';
    this.pwdError = false;
    this.records = loadRecords();
  }

  /** Filas del menú (compartidas con renderer e input). */
  selectRects(): MenuRect[] {
    return [
      { x: 230, y: 196, w: 500, h: 48 },
      { x: 230, y: 256, w: 500, h: 48 },
      { x: 230, y: 316, w: 500, h: 48 },
    ];
  }

  pickSelect(index: number): void {
    if (this.screen !== 'select' || this.selectMode !== 'menu') return;
    this.audioEvents.push('click');
    if (index === 0) this.newGame(1, 1);
    else if (index === 1) this.newGame(1, 2);
    else if (index === 2) {
      this.selectMode = 'password';
      this.pwdBuffer = '';
      this.pwdError = false;
    }
  }

  backToMenu(): void {
    this.selectMode = 'menu';
    this.pwdBuffer = '';
    this.pwdError = false;
  }

  typePassword(ch: string): void {
    if (this.selectMode !== 'password') return;
    const c = ch.toUpperCase();
    if (/^[A-Z0-9]$/.test(c) && this.pwdBuffer.length < 4) {
      this.pwdBuffer += c;
      this.pwdError = false;
    }
  }

  erasePassword(): void {
    this.pwdBuffer = this.pwdBuffer.slice(0, -1);
    this.pwdError = false;
  }

  submitPassword(): void {
    const lv = levelForPassword(this.pwdBuffer);
    if (lv === null) {
      this.pwdError = true;
      this.audioEvents.push('bad');
      return;
    }
    this.audioEvents.push('click');
    this.backToMenu();
    this.newGame(lv, 1);
  }

  togglePause(): void {
    if (this.screen === 'playing') {
      this.screen = 'paused';
      this.audioEvents.push('click');
    } else if (this.screen === 'paused') {
      this.screen = 'playing';
      this.audioEvents.push('click');
    }
  }

  toggleFast(): void {
    if (this.screen === 'playing' && this.flow.phase === 'flowing') {
      this.fast = !this.fast;
      this.audioEvents.push('click');
    }
  }

  currentPiece(): Piece {
    return this.queue[0];
  }

  cellCenter(x: number, y: number): { x: number; y: number } {
    return {
      x: CONFIG.BOARD_X + x * CONFIG.TILE + CONFIG.TILE / 2,
      y: CONFIG.BOARD_Y + y * CONFIG.TILE + CONFIG.TILE / 2,
    };
  }

  spawnPopup(x: number, y: number, text: string, color: string, ttl = 1.1): void {
    const jitter = ((this.popups.length % 3) - 1) * 20;
    this.popups.push({ x: x + jitter, y, text, ttl, max: ttl, color });
  }

  /**
   * Coloca la pieza actual en (x,y). Sobre tubería no llena: reemplazo
   * destructivo con explosión, -50 pts y bloqueo breve. Nunca sobre llenas.
   */
  tryPlace(x: number, y: number): boolean {
    if (this.screen !== 'playing') return false;
    if (this.lockTimer > 0) return false;
    if (this.flow.phase !== 'countdown' && this.flow.phase !== 'flowing') return false;
    const cell = getCell(this.board, x, y);
    if (!cell) return false;
    const advance = (): void => {
      this.queue.shift();
      this.queue.push(randomPiece(this.rng, this.queueLevel));
    };
    if (isFree(this.board, x, y)) {
      cell.piece = { ...this.currentPiece() };
      advance();
      this.audioEvents.push('place');
      return true;
    }
    if (isReplaceable(this.board, x, y)) {
      replacePiece(this.board, x, y, this.currentPiece());
      advance();
      applyReplace(this.score);
      this.audioEvents.push('boom');
      const c = this.cellCenter(x, y);
      this.booms.push({ x: c.x, y: c.y, ttl: BOOM_TTL, max: BOOM_TTL });
      this.spawnPopup(c.x, c.y - 24, '-50', '#ff6b6b', 1.0);
      this.lockTimer = CONFIG.REPLACE_LOCK_MS / 1000;
      return true;
    }
    return false;
  }

  moveCursor(dx: number, dy: number): void {
    this.cursor.x = Math.max(0, Math.min(this.board.cols - 1, this.cursor.x + dx));
    this.cursor.y = Math.max(0, Math.min(this.board.rows - 1, this.cursor.y + dy));
  }

  placeAtCursor(): boolean {
    return this.tryPlace(this.cursor.x, this.cursor.y);
  }

  cellFromPixel(px: number, py: number): { x: number; y: number } | null {
    const bx = Math.floor((px - CONFIG.BOARD_X) / CONFIG.TILE);
    const by = Math.floor((py - CONFIG.BOARD_Y) / CONFIG.TILE);
    if (bx < 0 || by < 0 || bx >= this.board.cols || by >= this.board.rows) return null;
    return { x: bx, y: by };
  }

  /** Botón FAST táctil (panel derecho). */
  fastButtonRect(): { x: number; y: number; w: number; h: number } {
    return { x: 836, y: 452, w: 100, h: 68 };
  }

  /** Botón de silencio (esquina inferior derecha, visible en todo). */
  muteRect(): { x: number; y: number; w: number; h: number } {
    return { x: 908, y: 548, w: 44, h: 44 };
  }

  inMuteButton(px: number, py: number): boolean {
    const r = this.muteRect();
    return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
  }

  inFastButton(px: number, py: number): boolean {
    const r = this.fastButtonRect();
    return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
  }

  inMenuRow(px: number, py: number): number {
    const rows = this.selectRects();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
    }
    return -1;
  }

  /** Magnitud de sacudida (0 sin explosiones activas). */
  shake(): number {
    let m = 0;
    for (const b of this.booms) m = Math.max(m, (b.ttl / b.max) * 7);
    return m;
  }

  update(dt: number): void {
    if (this.screen === 'paused' || this.screen === 'title' || this.screen === 'select') return;
    this.tickFx(dt);
    if (this.screen === 'clear' || this.screen === 'over') {
      if (this.endDelay > 0) this.endDelay = Math.max(0, this.endDelay - dt);
      return;
    }
    if (this.screen === 'switch') {
      this.endDelay = Math.max(0, this.endDelay - dt);
      if (this.endDelay <= 0) {
        this.current = this.other();
        this.startLevel(this.level);
        this.screen = 'playing';
        this.turnPopup();
      }
      return;
    }
    if (this.screen === 'recount') {
      this.updateRecount(dt);
      return;
    }
    if (this.screen !== 'playing') return;
    if (this.lockTimer > 0) this.lockTimer = Math.max(0, this.lockTimer - dt);
    if (this.flow.phase === 'countdown') {
      const sec = Math.ceil(this.flow.countdown);
      if (sec <= 3 && sec > 0 && sec !== this.lastTick) {
        this.lastTick = sec;
        this.audioEvents.push('tick');
      }
    }
    const speedOverride = this.fast ? this.flow.speed * CONFIG.FAST_MULTIPLIER : undefined;
    const events = updateFlow(this.board, this.flow, dt, speedOverride);
    for (const e of events) {
      if (e.type === 'cell-filled') {
        this.audioEvents.push('glug');
        let gained = applyCellFilled(this.score, e.piece, this.fast, e.crossedTwice);
        if (this.isBonus) {
          this.score.score += gained * (CONFIG.BONUS_SCORE_MULT - 1);
          gained *= CONFIG.BONUS_SCORE_MULT;
        }
        const c = this.cellCenter(e.x, e.y);
        this.spawnPopup(c.x, c.y - 20, `+${gained}`, this.fast ? '#ffb02e' : '#9df7c0');
        if (e.crossedTwice) this.spawnPopup(c.x, c.y - 46, t('cross_bonus'), '#ffb02e', 1.3);
      } else if (e.type === 'entered-end') {
        const bonus = scoreForEnd();
        this.score.score += bonus;
        const c = this.cellCenter(e.x, e.y);
        this.spawnPopup(c.x, c.y - 46, `+${bonus}`, '#ffd23f', 1.6);
      } else if (e.type === 'spilled') {
        this.fast = false;
        if (this.flow.phase === 'cleared') this.startRecount();
        else this.onFailedLevel();
      }
    }
    // Red de seguridad: la pieza final termina sin evento 'spilled'.
    if (this.screen === 'playing') {
      if (this.flow.phase === 'cleared') {
        this.fast = false;
        this.startRecount();
      } else if (this.flow.phase === 'spilled') {
        this.fast = false;
        this.onFailedLevel();
      }
    }
  }

  private onFailedLevel(): void {
    this.failsThisLevel += 1;
    this.audioEvents.push('spill');
    if (this.players === 2 && this.failsThisLevel < 2) {
      this.screen = 'switch';
      this.endDelay = SWITCH_DELAY;
    } else {
      this.saveRecords();
      this.screen = 'over';
      this.endDelay = 1.5;
      this.audioEvents.push('over');
    }
  }

  private saveRecords(): void {
    if (this.scores[0].score > 0) addRecord(this.scores[0].score, this.level);
    if (this.players === 2 && this.scores[1].score > 0) addRecord(this.scores[1].score, this.level);
    this.records = loadRecords();
  }

  private tickFx(dt: number): void {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.ttl -= dt;
      p.y -= 54 * dt;
      if (p.ttl <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.booms.length - 1; i >= 0; i--) {
      this.booms[i].ttl -= dt;
      if (this.booms[i].ttl <= 0) this.booms.splice(i, 1);
    }
  }

  private startRecount(): void {
    this.screen = 'recount';
    this.recountQueue = listUnusedCells(this.board);
    this.recounted = new Set();
    this.recountCurrent = null;
    this.recountTimer = 0.6; // pausa dramática antes del primer -100
  }

  private updateRecount(dt: number): void {
    this.recountTimer -= dt;
    if (this.recountTimer > 0) return;
    const next = this.recountQueue.shift();
    if (!next) {
      this.recountCurrent = null;
      this.screen = 'clear';
      this.endDelay = 1.5;
      this.audioEvents.push('clear');
      return;
    }
    applyUnusedPenalty(this.score, 1);
    this.recounted.add(`${next.x},${next.y}`);
    this.recountCurrent = next;
    const c = this.cellCenter(next.x, next.y);
    this.spawnPopup(c.x, c.y - 20, '-100', '#ff6b6b', 0.9);
    this.recountTimer = RECOUNT_STEP;
  }
}
