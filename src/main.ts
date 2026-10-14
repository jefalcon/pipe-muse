// pipe-muse — arranque: Canvas HD con DPR, bucle de paso fijo, idioma, audio.
import { CONFIG } from './config';
import { Game } from './game/Game';
import { attachInput } from './input/input';
import { render } from './render/renderer';
import { AudioMan } from './audio/audio';
import { getLang } from './i18n';
import './style.css';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const hint = document.getElementById('hint') as HTMLDivElement;
const ctx = canvas.getContext('2d')!;

// Parámetros de desarrollo: ?seed=N (partida reproducible), ?auto=1 (salta
// el título), ?debug=1 (expone window.__pipeMuse para verificación).
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const game = new Game(seedParam ? Number(seedParam) : undefined);
const audio = new AudioMan();
if (params.has('debug')) {
  (window as unknown as { __pipeMuse: Game }).__pipeMuse = game;
  (window as unknown as { __pipeMuseAudio: AudioMan }).__pipeMuseAudio = audio;
}
if (params.get('auto') === '1') game.newGame(1);
attachInput(canvas, game, audio);

// El audio se desbloquea con el primer gesto (política de autoplay).
const unlockOnce = (): void => audio.unlock();
window.addEventListener('pointerdown', unlockOnce, { once: true });
window.addEventListener('keydown', unlockOnce, { once: true });
canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

let artScale = 1;

function fitCanvas(): void {
  const availW = window.innerWidth;
  const availH = window.innerHeight - 28;
  const scale = Math.min(availW / CONFIG.VIEW_W, availH / CONFIG.VIEW_H);
  canvas.style.width = `${Math.floor(CONFIG.VIEW_W * scale)}px`;
  canvas.style.height = `${Math.floor(CONFIG.VIEW_H * scale)}px`;
  // Backing nítido en pantallas HiDPI (máx 2x).
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  artScale = dpr;
  canvas.width = Math.round(CONFIG.VIEW_W * dpr);
  canvas.height = Math.round(CONFIG.VIEW_H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const portrait = window.innerHeight > window.innerWidth;
  const base =
    getLang() === 'es'
      ? 'Clic/toque o flechas+Espacio · F rápido · P pausa · M sonido · L idioma'
      : 'Click/tap or arrows+Space · F fast · P pause · M sound · L language';
  hint.textContent = portrait ? `↻ ${getLang() === 'es' ? 'Gira para jugar mejor' : 'Rotate for best play'} · ${base}` : base;
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', fitCanvas);
setInterval(fitCanvas, 500);
fitCanvas();

// Bucle con paso de tiempo fijo: la velocidad no depende de los FPS.
let last = performance.now();
let acc = 0;
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > CONFIG.MAX_FRAME_DT) dt = CONFIG.MAX_FRAME_DT;
  acc += dt;
  let steps = 0;
  while (acc >= CONFIG.FIXED_DT && steps < 40) {
    game.update(CONFIG.FIXED_DT);
    acc -= CONFIG.FIXED_DT;
    steps++;
  }
  if (steps === 40) acc = 0;
  // Drena efectos de sonido.
  if (game.audioEvents.length > 0) {
    const evs = game.audioEvents.splice(0, game.audioEvents.length);
    for (const e of evs) audio.play(e);
  }
  render(game, ctx, now, artScale, audio.muted);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
