// pipe-muse render — arte HD ORIGINAL procedural (Canvas 2D vectorial).
// Tema industrial: acero + latón sobre fondo nocturno, flooz verde vivo.
// Las bases se prerenderizan a sprites offscreen (rápido); el llenado
// parcial y efectos se dibujan en dinámico.
import type { Dir, Piece } from '../core/types';

export const COLORS = {
  bgTop: '#182636',
  bgBottom: '#0a111c',
  panel: '#1d2940',
  panelEdge: '#3a4a68',
  panelHi: '#5c7194',
  well: '#0d1524',
  wellEdge: '#05090f',
  steelHi: '#f4f7fc',
  steelMid: '#b9c5d8',
  steelDark: '#6b7891',
  steelLine: '#232c3f',
  brassHi: '#ffe9a8',
  brass: '#d8a53c',
  brassDark: '#7c5a17',
  floozHi: '#9df7c0',
  flooz: '#2fd465',
  floozDark: '#148040',
  channel: '#1b2436',
  text: '#eef2f8',
  dim: '#93a0b8',
  accent: '#ffb02e',
  danger: '#ff5252',
  ledOn: '#51ff7e',
  ledOff: '#274b33',
};

const S = 64; // tamaño de tile lógico
const C = S / 2;
const OUTER = 36; // grosor carcasa
const CHAN = 20; // grosor canal

let artScale = 0;
const cache = new Map<string, HTMLCanvasElement>();

/** Invalida la caché si cambia la escala (DPR). Llamar cada frame (barato). */
export function ensureArt(scale: number): void {
  if (scale !== artScale) {
    artScale = scale;
    cache.clear();
  }
}

function sprite(key: string, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = S * artScale;
  cv.height = S * artScale;
  const g = cv.getContext('2d')!;
  g.scale(artScale, artScale);
  paint(g);
  cache.set(key, cv);
  return cv;
}

export function blit(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, px: number, py: number): void {
  ctx.drawImage(cv, px, py, S, S);
}

// ---------- geometría ----------

type Pt = { x: number; y: number };
const EDGE: Record<Dir, Pt> = {
  left: { x: 0, y: C },
  right: { x: S, y: C },
  up: { x: C, y: 0 },
  down: { x: C, y: S },
};
const CTR: Pt = { x: C, y: C };

function armsOf(p: Piece): Dir[] {
  switch (p.kind) {
    case 'straight-h':
      return ['left', 'right'];
    case 'straight-v':
      return ['up', 'down'];
    case 'cross':
    case 'reservoir':
      return ['left', 'right', 'up', 'down'];
    case 'elbow-ur':
      return ['up', 'right'];
    case 'elbow-rd':
      return ['right', 'down'];
    case 'elbow-dl':
      return ['down', 'left'];
    case 'elbow-lu':
      return ['left', 'up'];
    case 'start':
    case 'end':
      return p.dir ? [p.dir] : [];
    case 'oneway-up':
    case 'oneway-down':
      return ['up', 'down'];
    case 'oneway-right':
    case 'oneway-left':
      return ['left', 'right'];
    default:
      return [];
  }
}

function strokeSeg(g: CanvasRenderingContext2D, a: Pt, b: Pt, w: number, style: string | CanvasGradient): void {
  g.strokeStyle = style;
  g.lineWidth = w;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.stroke();
}

function steelGrad(g: CanvasRenderingContext2D, horizontal: boolean): CanvasGradient {
  const gr = horizontal ? g.createLinearGradient(0, C - OUTER / 2, 0, C + OUTER / 2) : g.createLinearGradient(C - OUTER / 2, 0, C + OUTER / 2, 0);
  gr.addColorStop(0, COLORS.steelHi);
  gr.addColorStop(0.35, COLORS.steelMid);
  gr.addColorStop(0.75, COLORS.steelDark);
  gr.addColorStop(1, '#4a5468');
  return gr;
}

/** Trazos unidos (sin muescas): rectas de borde a borde, codos con join redondo. */
function tracePipe(g: CanvasRenderingContext2D, arms: Dir[]): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  const has = (d: Dir) => arms.includes(d);
  g.beginPath();
  if (has('left') && has('right')) {
    g.moveTo(EDGE.left.x, EDGE.left.y);
    g.lineTo(EDGE.right.x, EDGE.right.y);
  }
  if (has('up') && has('down')) {
    g.moveTo(EDGE.up.x, EDGE.up.y);
    g.lineTo(EDGE.down.x, EDGE.down.y);
  }
  const straightH = has('left') && has('right') && arms.length === 2;
  const straightV = has('up') && has('down') && arms.length === 2;
  if (arms.length === 2 && !straightH && !straightV) {
    // Codo: une los dos brazos por el centro.
    g.moveTo(EDGE[arms[0]].x, EDGE[arms[0]].y);
    g.lineTo(CTR.x, CTR.y);
    g.lineTo(EDGE[arms[1]].x, EDGE[arms[1]].y);
  }
  if (arms.length === 1) {
    g.moveTo(EDGE[arms[0]].x, EDGE[arms[0]].y);
    g.lineTo(CTR.x, CTR.y);
  }
}

function paintCasing(g: CanvasRenderingContext2D, arms: Dir[]): void {
  // Contorno oscuro (trazo unido).
  g.strokeStyle = COLORS.steelLine;
  g.lineWidth = OUTER + 5;
  tracePipe(g, arms);
  g.stroke();
  // Acero con degradado por brazo (el contorno unido ya da la silueta).
  for (const d of arms) {
    const horiz = d === 'left' || d === 'right';
    strokeSeg(g, EDGE[d], CTR, OUTER, steelGrad(g, horiz));
  }
  // Brillos especulares sobre el acero.
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 3;
  g.beginPath();
  const spec = (d: Dir) => {
    if (d === 'left') {
      g.moveTo(9, C - 11);
      g.lineTo(C, C - 11);
    } else if (d === 'right') {
      g.moveTo(C, C - 11);
      g.lineTo(S - 9, C - 11);
    } else if (d === 'up') {
      g.moveTo(C - 11, 9);
      g.lineTo(C - 11, C);
    } else {
      g.moveTo(C - 11, C);
      g.lineTo(C - 11, S - 9);
    }
  };
  if (arms.length === 4) {
    // Cruce: líneas continuas (evita el pegote central).
    g.moveTo(9, C - 11);
    g.lineTo(S - 9, C - 11);
    g.moveTo(C - 11, 9);
    g.lineTo(C - 11, S - 9);
  } else {
    for (const d of arms) spec(d);
  }
  g.stroke();
  // Bridas en los bordes abiertos.
  for (const d of arms) paintFlange(g, d);
}

function paintChannel(g: CanvasRenderingContext2D, arms: Dir[], filled: boolean): void {
  const passes: Array<[number, string]> = filled
    ? [
        [CHAN + 3, COLORS.floozDark],
        [CHAN, COLORS.flooz],
        [CHAN - 8, '#46e87e'],
        [4, 'rgba(232,255,240,0.6)'],
      ]
    : [
        [CHAN + 3, '#0b111d'],
        [CHAN, COLORS.channel],
      ];
  for (const [w, style] of passes) {
    g.strokeStyle = style;
    g.lineWidth = w;
    tracePipe(g, arms);
    g.stroke();
  }
  // Bandas de acoplamiento en rectas (detalle mecánico, evita el "elipse flotante").
  const horiz = arms.length === 2 && arms.includes('left') && arms.includes('right');
  const vert = arms.length === 2 && arms.includes('up') && arms.includes('down');
  if (horiz || vert) {
    g.fillStyle = 'rgba(10,14,22,0.55)';
    if (horiz) {
      g.fillRect(C - 9, C - OUTER / 2, 3, OUTER);
      g.fillRect(C + 6, C - OUTER / 2, 3, OUTER);
    } else {
      g.fillRect(C - OUTER / 2, C - 9, OUTER, 3);
      g.fillRect(C - OUTER / 2, C + 6, OUTER, 3);
    }
  }
}

function paintFlange(g: CanvasRenderingContext2D, d: Dir): void {
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#6b7891');
  grad.addColorStop(0.5, '#47536e');
  grad.addColorStop(1, '#2f3a52');
  g.fillStyle = grad;
  g.strokeStyle = COLORS.steelLine;
  g.lineWidth = 1.5;
  const w = 7;
  const h = OUTER;
  let x = 0;
  let y = 0;
  if (d === 'left') {
    x = 1;
    y = C - h / 2;
  } else if (d === 'right') {
    x = S - 1 - w;
    y = C - h / 2;
  } else if (d === 'up') {
    x = C - h / 2;
    y = 1;
  } else {
    x = C - h / 2;
    y = S - 1 - w;
  }
  const horiz = d === 'left' || d === 'right';
  g.beginPath();
  if (horiz) g.roundRect(x, y, w, h, 3);
  else g.roundRect(x, y, h, w, 3);
  g.fill();
  g.stroke();
}

function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, style: string | CanvasGradient): void {
  g.fillStyle = style;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

// ---------- sprites públicos ----------

export function baseSprite(p: Piece): HTMLCanvasElement {
  return sprite(`b|${p.kind}|${p.dir ?? ''}`, (g) => {
    if (p.kind === 'start') return paintStart(g, p.dir ?? 'right', false);
    if (p.kind === 'end') return paintEnd(g, p.dir ?? 'left', false);
    if (p.kind === 'reservoir') return paintReservoir(g, false);
    const arms = armsOf(p);
    paintCasing(g, arms);
    paintChannel(g, arms, false);
    if (p.kind.startsWith('oneway')) paintChevrons(g, p.kind);
  });
}

export function fullSprite(p: Piece): HTMLCanvasElement {
  return sprite(`f|${p.kind}|${p.dir ?? ''}`, (g) => {
    if (p.kind === 'start') return paintStart(g, p.dir ?? 'right', true);
    if (p.kind === 'end') return paintEnd(g, p.dir ?? 'left', true);
    if (p.kind === 'reservoir') return paintReservoir(g, true);
    const arms = armsOf(p);
    paintCasing(g, arms);
    paintChannel(g, arms, true);
    if (p.kind.startsWith('oneway')) paintChevrons(g, p.kind);
  });
}

export function obstacleSprite(): HTMLCanvasElement {
  return sprite('obstacle', (g) => {
    // Bloque de acero remachado con franja de peligro.
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#4d5a76');
    grad.addColorStop(0.5, '#333f58');
    grad.addColorStop(1, '#202839');
    g.fillStyle = grad;
    g.strokeStyle = '#0a0e16';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(3, 3, S - 6, S - 6, 8);
    g.fill();
    g.stroke();
    // Franja peligro.
    g.save();
    g.beginPath();
    g.roundRect(8, 24, S - 16, 16, 3);
    g.clip();
    for (let i = -2; i < 10; i++) {
      g.fillStyle = i % 2 ? '#c9a227' : '#1a2030';
      g.save();
      g.translate(8 + i * 8, 24);
      g.transform(1, 0, -0.6, 1, 0, 0);
      g.fillRect(0, 0, 8, 16);
      g.restore();
    }
    g.restore();
    // Remaches.
    for (const [x, y] of [[12, 12], [S - 12, 12], [12, S - 12], [S - 12, S - 12]] as const) {
      dot(g, x, y, 4, '#121826');
      dot(g, x - 1, y - 1, 2.4, '#8b99b5');
    }
  });
}

function paintStart(g: CanvasRenderingContext2D, dir: Dir, filled: boolean): void {
  // Válvula de latón + brazo de salida.
  const horiz = dir === 'left' || dir === 'right';
  strokeSeg(g, EDGE[dir], CTR, OUTER + 5, COLORS.steelLine);
  strokeSeg(g, EDGE[dir], CTR, OUTER, steelGrad(g, horiz));
  paintChannel(g, [dir], filled);
  paintFlange(g, dir);
  // Cuerpo brida latón.
  const rad = g.createRadialGradient(C - 5, C - 6, 2, C, C, 24);
  rad.addColorStop(0, COLORS.brassHi);
  rad.addColorStop(0.5, COLORS.brass);
  rad.addColorStop(1, COLORS.brassDark);
  dot(g, C, C, 23, '#3a2c0c');
  dot(g, C, C, 20, rad);
  dot(g, C, C, 9, filled ? COLORS.flooz : '#241c08');
  if (filled) dot(g, C - 2, C - 2, 4, COLORS.floozHi);
  // Volante: 3 radios.
  g.strokeStyle = '#5c430f';
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * 10, C + Math.sin(a) * 10);
    g.lineTo(C + Math.cos(a) * 19, C + Math.sin(a) * 19);
    g.stroke();
  }
}

function paintEnd(g: CanvasRenderingContext2D, dir: Dir, filled: boolean): void {
  // Desagüe: rejilla circular + boca.
  paintCasing(g, [dir]);
  paintChannel(g, [dir], filled);
  paintFlange(g, dir);
  dot(g, C, C, 22, '#0c121e');
  dot(g, C, C, 19, '#2b3650');
  g.fillStyle = filled ? COLORS.floozDark : '#0a0f1a';
  for (let i = -1; i <= 1; i++) {
    g.save();
    g.translate(C, C);
    g.rotate((i * Math.PI) / 3);
    g.fillRect(-3, -15, 6, 30);
    g.restore();
  }
  dot(g, C, C, 5, '#48557a');
}

function paintReservoir(g: CanvasRenderingContext2D, filled: boolean): void {
  // Depósito esférico con mirilla.
  paintCasing(g, ['left', 'right', 'up', 'down']);
  paintChannel(g, ['left', 'right', 'up', 'down'], filled);
  const rad = g.createRadialGradient(C - 6, C - 7, 2, C, C, 22);
  rad.addColorStop(0, '#ffffff');
  rad.addColorStop(0.4, '#b9c5d8');
  rad.addColorStop(1, '#5d6a85');
  dot(g, C, C, 21, COLORS.steelLine);
  dot(g, C, C, 18, rad);
  // Mirilla de nivel.
  g.fillStyle = '#101827';
  g.beginPath();
  g.roundRect(C - 6, C - 12, 12, 24, 6);
  g.fill();
  const lvl = filled ? 20 : 5;
  g.fillStyle = filled ? COLORS.flooz : COLORS.floozDark;
  g.beginPath();
  g.roundRect(C - 4, C + 10 - lvl, 8, lvl, 4);
  g.fill();
}

function paintChevrons(g: CanvasRenderingContext2D, kind: string): void {
  // Flechas de sentido único dentro del canal.
  g.fillStyle = 'rgba(240,244,252,0.85)';
  const draw = (x: number, y: number, ang: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(-6, -8);
    g.lineTo(6, 0);
    g.lineTo(-6, 8);
    g.lineTo(-6, 3);
    g.lineTo(1, 0);
    g.lineTo(-6, -3);
    g.closePath();
    g.fill();
    g.restore();
  };
  if (kind === 'oneway-right') {
    draw(C - 10, C, 0);
    draw(C + 10, C, 0);
  } else if (kind === 'oneway-left') {
    draw(C - 10, C, Math.PI);
    draw(C + 10, C, Math.PI);
  } else if (kind === 'oneway-down') {
    draw(C, C - 10, Math.PI / 2);
    draw(C, C + 10, Math.PI / 2);
  } else {
    draw(C, C - 10, -Math.PI / 2);
    draw(C, C + 10, -Math.PI / 2);
  }
}

// ---------- llenado progresivo dinámico ----------

function exitOf(p: Piece, entry: Dir): Dir | null {
  switch (p.kind) {
    case 'straight-h':
      return entry === 'left' ? 'right' : entry === 'right' ? 'left' : null;
    case 'straight-v':
      return entry === 'up' ? 'down' : entry === 'down' ? 'up' : null;
    case 'cross':
    case 'reservoir':
      if (entry === 'left') return 'right';
      if (entry === 'right') return 'left';
      if (entry === 'up') return 'down';
      return 'up';
    case 'elbow-ur':
      return entry === 'up' ? 'right' : entry === 'right' ? 'up' : null;
    case 'elbow-rd':
      return entry === 'right' ? 'down' : entry === 'down' ? 'right' : null;
    case 'elbow-dl':
      return entry === 'down' ? 'left' : entry === 'left' ? 'down' : null;
    case 'elbow-lu':
      return entry === 'left' ? 'up' : entry === 'up' ? 'left' : null;
    case 'start':
      return p.dir ?? null;
    case 'oneway-up':
      return entry === 'down' ? 'up' : null;
    case 'oneway-down':
      return entry === 'up' ? 'down' : null;
    case 'oneway-right':
      return entry === 'left' ? 'right' : null;
    case 'oneway-left':
      return entry === 'right' ? 'left' : null;
    default:
      return null;
  }
}

/** Punto del brazo `d` a fracción t (0=borde, 1=centro). */
function armPoint(d: Dir, t: number): Pt {
  const e = EDGE[d];
  return { x: e.x + (CTR.x - e.x) * t, y: e.y + (CTR.y - e.y) * t };
}

function floozLine(g: CanvasRenderingContext2D, a: Pt, b: Pt): void {
  strokeSeg(g, a, b, CHAN, COLORS.floozDark);
  strokeSeg(g, a, b, CHAN - 7, COLORS.flooz);
  strokeSeg(g, a, b, 5, 'rgba(230,255,238,0.75)');
}

/**
 * Dibuja base + flooz parcial (entrada→centro→salida) + burbujas animadas.
 * (px,py) en coords. lógicas; timeMs para animación.
 */
export function drawFilling(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  p: Piece,
  entry: Dir,
  progress: number,
  timeMs: number,
): void {
  blit(ctx, baseSprite(p), px, py);
  if (progress <= 0.001) return;
  ctx.save();
  ctx.translate(px, py);
  if (p.kind === 'start') {
    const d = p.dir ?? 'right';
    const tip = armPoint(d, 1 - progress); // del centro hacia fuera
    floozLine(ctx, CTR, tip);
    dot(ctx, CTR.x, CTR.y, 9, COLORS.flooz);
    dot(ctx, CTR.x - 2, CTR.y - 2, 4, COLORS.floozHi);
    ctx.restore();
    return;
  }
  const aLen = Math.min(1, progress * 2);
  const bLen = Math.max(0, progress * 2 - 1);
  // Tramo A: borde de entrada → centro.
  floozLine(ctx, EDGE[entry], armPoint(entry, aLen));
  // Tramo B: centro → salida.
  const exit = exitOf(p, entry);
  if (exit && bLen > 0) {
    const tip = armPoint(exit, 1 - bLen);
    floozLine(ctx, CTR, tip);
  }
  if (progress > 0.45) dot(ctx, CTR.x, CTR.y, CHAN / 2 - 3, COLORS.flooz);
  if (p.kind === 'reservoir') {
    // Mirilla del depósito: nivel proporcional al progreso.
    ctx.fillStyle = '#101827';
    ctx.beginPath();
    ctx.roundRect(C - 6, C - 12, 12, 24, 6);
    ctx.fill();
    const lvl = 3 + 17 * progress;
    ctx.fillStyle = COLORS.flooz;
    ctx.beginPath();
    ctx.roundRect(C - 4, C + 10 - lvl, 8, lvl, 4);
    ctx.fill();
  }
  // Burbujas que viajan con el frente.
  const t = timeMs / 1000;
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.9 + i / 3) % 1;
    const bpos = ph * Math.min(1, progress * 1.15);
    let bp: Pt;
    if (bpos < 0.5 || !exit) {
      bp = armPoint(entry, bpos * 2 * aLen);
    } else {
      bp = armPoint(exit, 1 - (bpos - 0.5) * 2 * bLen - 0.001);
    }
    const wob = Math.sin(t * 9 + i * 2.2) * 3;
    dot(ctx, bp.x + wob * 0.4, bp.y + wob * 0.3, 3, 'rgba(255,255,255,0.8)');
  }
  ctx.restore();
}

// ---------- helpers UI ----------

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Panel metálico con remaches y brillo superior. */
export function paintPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#26334e');
  grad.addColorStop(0.12, COLORS.panel);
  grad.addColorStop(1, '#141d31');
  rr(ctx, x, y, w, h, 10);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = COLORS.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(140,165,205,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 10, y + 1.5);
  ctx.lineTo(x + w - 10, y + 1.5);
  ctx.stroke();
  // Remaches.
  const rivets: Array<[number, number]> = [
    [x + 9, y + 9],
    [x + w - 9, y + 9],
    [x + 9, y + h - 9],
    [x + w - 9, y + h - 9],
  ];
  for (const [rx, ry] of rivets) {
    dot(ctx, rx, ry, 3.4, '#0b101b');
    dot(ctx, rx - 0.8, ry - 0.8, 2, '#7f8fb0');
  }
}

/** Pozo oscuro para celdas del tablero. */
export function paintWell(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = COLORS.well;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, s, 3);
  ctx.fillRect(x, y, 3, s);
  ctx.fillStyle = 'rgba(120,150,200,0.14)';
  ctx.fillRect(x, y + s - 2, s, 2);
  ctx.fillRect(x + s - 2, y, 2, s);
}
