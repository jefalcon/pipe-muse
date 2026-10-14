// pipe-muse core — tipos puros (sin Canvas ni DOM).
export type Dir = 'up' | 'right' | 'down' | 'left';

export const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left'];

export const DX: Record<Dir, number> = { up: 0, right: 1, down: 0, left: -1 };
export const DY: Record<Dir, number> = { up: -1, right: 0, down: 1, left: 0 };

export const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
};

export type PieceKind =
  | 'straight-h'
  | 'straight-v'
  | 'cross'
  | 'elbow-ur'
  | 'elbow-rd'
  | 'elbow-dl'
  | 'elbow-lu'
  | 'start'
  // Reservados Hito 3 (avanzados):
  | 'oneway-up'
  | 'oneway-right'
  | 'oneway-down'
  | 'oneway-left'
  | 'reservoir'
  | 'end';

export interface Piece {
  kind: PieceKind;
  /** Dirección asociada: salida (start), sentido permitido (oneway), boca (end). */
  dir?: Dir;
}

export interface Cell {
  piece: Piece | null;
  obstacle: boolean;
  filled: boolean;
  /** 0..1 llenado progresivo (la actual en curso tiene 0<fill<1). */
  fill: number;
  /** Veces que el flujo entró (cruces: bonus al pasar 2 veces, Hito 2). */
  passCount: number;
}

export interface Board {
  cols: number;
  rows: number;
  cells: Cell[][]; // cells[y][x]
  startX: number;
  startY: number;
  startDir: Dir;
}

export type FlowPhase = 'countdown' | 'flowing' | 'spilled' | 'cleared';

export interface FlowState {
  /** true: los bordes conectan con el lado opuesto. */
  wrap: boolean;
  phase: FlowPhase;
  /** Tiempo restante de cuenta atrás (s). */
  countdown: number;
  /** Casilla actual del frente de flujo. */
  x: number;
  y: number;
  /** Lado por el que entró el flujo a la casilla actual. */
  entry: Dir;
  /** Progreso 0..1 dentro de la casilla actual. */
  progress: number;
  /** Casillas llenadas (incluye la inicial). */
  filledCount: number;
  /** Distancia restante para superar el nivel. */
  distanceLeft: number;
  /** Velocidad actual casillas/s. */
  speed: number;
  /** Posición del derrame (para animación). */
  spillX: number;
  spillY: number;
  spillDir: Dir;
  /** true si ya se alcanzó la distancia (el flujo sigue sumando). */
  distanceDone: boolean;
}

export interface LevelConfig {
  level: number;
  countdown: number;
  speed: number;
  distance: number;
  obstacles: number;
  bonusRound: boolean;
  /** true: el tablero incluye pieza final (destino con bonus). */
  endPiece: boolean;
  /** true: los bordes conectan con el lado opuesto. */
  wrap: boolean;
}
