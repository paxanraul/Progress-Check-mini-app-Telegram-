/*
 * Единое in-memory состояние mini-app.
 * Этот объект хранит текущую вкладку, загруженные данные пользователя,
 * режимы редактирования и пошаговое состояние модальных сценариев.
 * Большинство UI-модулей читают и изменяют именно этот объект,
 * чтобы экран, модалки и служебные контроллеры работали согласованно.
 */
import {
  DEFAULT_WORKOUT_DRAFT,
  INITIAL_ACTIVE_TAB,
  INITIAL_FAQ_CATEGORY,
} from "./constants.js";
import { todayValue } from "../shared/utils.js";

export const state = {
  // Навигация и фильтры экранов.
  activeTab: INITIAL_ACTIVE_TAB,
  faqCategory: INITIAL_FAQ_CATEGORY,
  faqQuery: "",

  // Пользовательские цитаты и режим работы редактора цитат.
  userQuotes: [],
  quoteOverlayOpen: false,
  quoteEditor: { mode: "create", editingIndex: -1 },

  // Состояние вспомогательных оверлеев.
  myDataOverlayOpen: false,
  profileOverlayOpen: false,
  confirmOverlayOpen: false,

  // Режимы массового редактирования списков.
  recordsEditMode: false,
  selectedRecordExercises: new Set(),
  historyEditMode: false,
  selectedWorkoutSessions: new Set(),

  // Данные, загруженные с backend для текущего пользователя.
  payload: null,
  userId: "",

  // Пошаговое состояние мастера создания/редактирования тренировки.
  workoutFlow: {
    open: false,
    mode: "create",
    sourceDate: "",
    sourceSessionKey: "",
    editingIndex: null,
    step: "list",
    items: [],
    draft: { ...DEFAULT_WORKOUT_DRAFT },
    date: todayValue(),
    saving: false,
  },
};
