// pipe-muse — textos bilingües ES/EN. Todos los textos visibles del juego aquí.
export type Lang = 'es' | 'en';

const STRINGS = {
  es: {
    title: 'PIPE-MUSE',
    subtitle: 'homenaje no oficial a Pipe Mania (1989)',
    press_start: 'Pulsa ENTER / toca para empezar',
    new_game: 'Nueva partida (Enter)',
    lang_hint: 'L: idioma',
    level: 'Nivel',
    score: 'Puntos',
    need: 'Faltan',
    next: 'Siguiente',
    speed_hint: 'F: rápido',
    pause_hint: 'P: pausa',
    paused: 'PAUSA',
    resume_hint: 'P/Esc: seguir',
    countdown: 'Sale el flujo en',
    level_clear: '¡NIVEL SUPERADO!',
    spill: '¡DERRAME!',
    game_over: 'FIN DE PARTIDA',
    press_enter_next: 'Enter: siguiente nivel',
    press_enter_retry: 'Enter: reintentar',
    records: 'Récords',
    empty_records: '(sin récords)',
    level_bonus_note: '-100 por tubería sin usar',
    fast: '¡RÁPIDO x2!',
    distance_ok: '¡Distancia OK, sigue sumando!',
    recount: 'Recuento',
    cross_bonus: '¡Cruce x2!',
    menu_title: 'Nueva partida',
    menu_1: '1 jugador',
    menu_2: '2 jugadores (alternos)',
    menu_pwd: 'Contraseña',
    pwd_prompt: 'Introduce la contraseña',
    pwd_bad: 'Contraseña incorrecta',
    pwd_back: 'Esc: volver',
    pwd_code: 'Contraseña',
    turn: 'Turno',
    bonus: 'BONUS',
    player: 'J',
  },
  en: {
    title: 'PIPE-MUSE',
    subtitle: 'unofficial Pipe Mania (1989) tribute',
    press_start: 'Press ENTER / tap to start',
    new_game: 'New game (Enter)',
    lang_hint: 'L: language',
    level: 'Level',
    score: 'Score',
    need: 'Need',
    next: 'Next',
    speed_hint: 'F: fast',
    pause_hint: 'P: pause',
    paused: 'PAUSED',
    resume_hint: 'P/Esc: resume',
    countdown: 'Flujo in',
    level_clear: 'LEVEL CLEAR!',
    spill: 'SPILL!',
    game_over: 'GAME OVER',
    press_enter_next: 'Enter: next level',
    press_enter_retry: 'Enter: retry',
    records: 'Records',
    empty_records: '(no records)',
    level_bonus_note: '-100 per unused pipe',
    fast: 'FAST x2!',
    distance_ok: 'Distance OK, keep scoring!',
    recount: 'Count',
    cross_bonus: 'Cross x2!',
    menu_title: 'New game',
    menu_1: '1 player',
    menu_2: '2 players (alternate)',
    menu_pwd: 'Password',
    pwd_prompt: 'Enter password',
    pwd_bad: 'Wrong password',
    pwd_back: 'Esc: back',
    pwd_code: 'Password',
    turn: 'Turn',
    bonus: 'BONUS',
    player: 'P',
  },
} as const;

export type StringKey = keyof (typeof STRINGS)['es'];

let lang: Lang = 'es';

export function getLang(): Lang {
  return lang;
}
export function setLang(l: Lang): void {
  lang = l;
}
export function toggleLang(): Lang {
  lang = lang === 'es' ? 'en' : 'es';
  return lang;
}
export function t(key: StringKey): string {
  return STRINGS[lang][key];
}
