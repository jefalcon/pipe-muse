// pipe-muse — ÚNICO fichero de constantes de juego.
// Ajustar aquí tiempos, velocidades, distancias y puntuación sin tocar la lógica.
// Valores iniciales aproximados: cada uno marcado para contraste con el original.

export const CONFIG = {
  // ---- Tablero y resolución lógica ----
  // Rediseño HD: 960x600 (3x del 16:10 original), arte vectorial suave.
  COLS: 10,
  ROWS: 7,
  VIEW_W: 960,
  VIEW_H: 600,
  TILE: 64,
  BOARD_X: 176,
  BOARD_Y: 96,
  // Dispensador: panel izquierdo, ranuras de arriba (nueva) a abajo (actual).
  DISP_X: 48, // esquina izq. del tile dentro del panel
  DISP_Y: 118, // borde sup. de la ranura superior
  DISP_GAP: 88, // distancia vertical entre ranuras

  // ---- Dispensador ----
  QUEUE_SIZE: 5,
  // Pesos de piezas aleatorias (suma libre, se normaliza). TODO verificar contra original
  PIECE_WEIGHTS: {
    'straight-h': 16,
    'straight-v': 16,
    'elbow-ur': 12,
    'elbow-rd': 12,
    'elbow-dl': 12,
    'elbow-lu': 12,
    cross: 8,
  } as Record<string, number>,

  // ---- Cuenta atrás inicial por nivel (segundos antes del flooz) ----
  // TODO verificar contra original (todos los valores de ritmo)
  COUNTDOWN_BY_LEVEL: [12, 10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1],

  // ---- Velocidad del flujo (casillas por segundo) por nivel ----
  // TODO verificar contra original
  SPEED_BY_LEVEL: [1.1, 1.25, 1.4, 1.55, 1.7, 1.85, 2.0, 2.15, 2.3, 2.45, 2.6, 2.75, 2.9, 3.05, 3.2],

  // ---- Distancia objetivo (tuberías mínimas) por nivel ----
  // TODO verificar contra original
  DISTANCE_BY_LEVEL: [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36],

  // ---- Avance rápido ----
  FAST_MULTIPLIER: 4, // TODO verificar contra original (el flujo va al máximo)

  // ---- Reemplazo (Hito 2; constante reservada) ----
  REPLACE_LOCK_MS: 350, // TODO verificar contra original (bloqueo del cursor)
  REPLACE_PENALTY: -50, // TODO verificar contra original

  // ---- Puntuación ----
  // TODO verificar contra original (todos los valores de puntos)
  SCORE_PIPE: 50,
  SCORE_FAST_MULT: 2,
  SCORE_CROSS_DOUBLE: 200,
  SCORE_UNUSED_PENALTY: -100,
  SCORE_END_BONUS: 500,
  SCORE_RESERVOIR: 300,

  // ---- Elementos avanzados (Hito 3) ----
  // TODO verificar contra original (niveles de aparición y frecuencias)
  OBSTACLES_BY_LEVEL: [0, 0, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  END_FROM_LEVEL: 3, // pieza final (destino con bonus)
  ONEWAY_FROM_LEVEL: 5, // unidireccionales en el dispensador
  ONEWAY_WEIGHT: 3, // peso por dirección
  RESERVOIR_FROM_LEVEL: 6, // depósitos en el dispensador
  RESERVOIR_WEIGHT: 4,
  RESERVOIR_FILL_TIME_MULT: 2.5, // tarda más en llenarse
  WRAP_FROM_LEVEL: 8, // bordes que conectan con el lado opuesto
  // ---- Ronda bonus (cada 4): tablero especial precolocado, puntos x2 ----
  BONUS_ROUND_EVERY: 4,
  BONUS_PREPLACED: 8, // TODO verificar contra original (diseño de la bonus)
  BONUS_DISTANCE: 6, // TODO verificar contra original
  BONUS_SCORE_MULT: 2, // TODO verificar contra original
  BONUS_MIN_COUNTDOWN: 12, // TODO verificar contra original
  // ---- Contraseñas y récords ----
  PASSWORD_EVERY: 4,
  RECORDS_KEY: 'pipe-muse-records',
  RECORDS_MAX: 8,

  // ---- Bucle ----
  FIXED_DT: 1 / 120, // paso de tiempo fijo (s)
  MAX_FRAME_DT: 0.25, // clamp para pestañas inactivas
} as const;

export type Config = typeof CONFIG;

/** Devuelve el valor por nivel (1-based) con clamp al último definido. */
export function perLevel(arr: readonly number[], level: number): number {
  if (level < 1) level = 1;
  const i = Math.min(level - 1, arr.length - 1);
  return arr[i];
}
