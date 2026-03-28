/*
 * Централизованный набор констант mini-app.
 * Здесь лежат стартовые значения для UI, дефолты для сценариев тренировки,
 * тексты базовых цитат и тайминги для их анимации.
 * Остальные модули импортируют эти значения, чтобы не дублировать "магические числа"
 * и держать общие настройки в одном месте.
 */
export const INITIAL_ACTIVE_TAB = "home";
export const INITIAL_FAQ_CATEGORY = "technique";
export const DEFAULT_WORKOUT_DRAFT = { sets: 1, reps: 8 };

export const HOME_QUOTES = [
  "Stay hard.",
  "Discipline beats motivation.",
  "Every workout counts.",
  "Progress is built daily.",
  "No excuses, only results.",
  "Small steps every day.",
  "Consistency builds strength.",
];

export const MAX_CUSTOM_QUOTES = 5;
export const QUOTE_DISPLAY_DURATION_MS = 3000;
export const QUOTE_FADE_DURATION_MS = 180;
export const QUOTE_TYPING_MIN_STEP_MS = 12;
export const QUOTE_TYPING_MAX_STEP_MS = 34;
export const QUOTE_TYPING_TARGET_DURATION_MS = 1600;

export const TELEGRAM_BUTTON_ICON_ID = "5334882760735598374";
