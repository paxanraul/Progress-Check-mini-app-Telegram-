import {
  DEFAULT_WORKOUT_DRAFT,
  INITIAL_ACTIVE_TAB,
  INITIAL_FAQ_CATEGORY,
} from "./constants.js";
import { todayValue } from "../shared/utils.js";

export const state = {
  activeTab: INITIAL_ACTIVE_TAB,
  faqCategory: INITIAL_FAQ_CATEGORY,
  faqQuery: "",
  userQuotes: [],
  quoteOverlayOpen: false,
  quoteEditor: { mode: "create", editingIndex: -1 },
  profileOverlayOpen: false,
  confirmOverlayOpen: false,
  recordsEditMode: false,
  selectedRecordExercises: new Set(),
  historyEditMode: false,
  selectedWorkoutSessions: new Set(),
  payload: null,
  userId: "",
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
