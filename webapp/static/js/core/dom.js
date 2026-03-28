/*
 * Реестр DOM-узлов приложения.
 * После рефактора Profile-экрана здесь больше нет отдельной profile-панели:
 * "Мои данные" живут в avatar-overlay, а "История тренировок" переехала на Home.
 */
function queryAll(root, selector) {
  return root ? [...root.querySelectorAll(selector)] : [];
}

const workoutOverlay = document.getElementById("workout-overlay");
const recordOverlay = document.getElementById("record-overlay");
const quoteOverlay = document.getElementById("quote-overlay");
const myDataOverlay = document.getElementById("my-data-overlay");
const profileOverlay = document.getElementById("profile-overlay");
const confirmOverlay = document.getElementById("confirm-overlay");

export const dom = {
  documentElement: document.documentElement,
  body: document.body,
  app: {
    content: document.querySelector(".content"),
    screenTitle: document.getElementById("screen-title"),
    topbarUser: document.getElementById("topbar-user"),
    topbarAvatar: document.getElementById("topbar-avatar"),
    topbarAvatarFallback: document.getElementById("topbar-avatar-fallback"),
  },
  navigation: {
    buttons: [...document.querySelectorAll(".nav-btn")],
    bottomNav: document.getElementById("bottom-nav"),
    navPill: document.getElementById("nav-pill"),
    panels: [...document.querySelectorAll(".panel")],
  },
  home: {
    panel: document.querySelector('[data-panel="home"]'),
    openWorkoutFlowButton: document.getElementById("open-workout-flow"),
    quoteManageButton: document.getElementById("open-quote-overlay"),
    quoteText: document.getElementById("quote-text"),
    quoteLiveCard: document.getElementById("quote-live-card"),
    historyList: document.getElementById("history-list"),
    historyManageToggle: document.getElementById("history-manage-toggle"),
    historyBulkActions: document.getElementById("history-bulk-actions"),
    historyDeleteSelectedButton: document.getElementById("history-delete-selected"),
    historyDeleteAllButton: document.getElementById("history-delete-all"),
    historyManageCancelButton: document.getElementById("history-manage-cancel"),
  },
  records: {
    panel: document.querySelector('[data-panel="records"]'),
    manageButton: document.getElementById("delete-btn"),
    addButton: document.getElementById("move-btn"),
    list: document.getElementById("records-list"),
    bulkActions: document.getElementById("records-bulk-actions"),
    deleteSelectedButton: document.getElementById("records-delete-selected"),
    deleteAllButton: document.getElementById("records-delete-all"),
    manageCancelButton: document.getElementById("records-manage-cancel"),
  },
  faq: {
    panel: document.querySelector('[data-panel="faq"]'),
    tabs: document.getElementById("faq-tabs"),
    list: document.getElementById("faq-list"),
    search: document.getElementById("faq-search"),
  },
  modals: {
    workout: {
      overlay: workoutOverlay,
      modal: workoutOverlay?.querySelector(".workout-modal") || null,
      steps: queryAll(workoutOverlay, ".modal-step[data-step]"),
      title: document.getElementById("modal-title"),
      dateInput: document.getElementById("workout-date-input"),
      workoutNameInput: document.getElementById("workout-name-input"),
      exerciseNameInput: document.getElementById("exercise-name-input"),
      exerciseWeightInput: document.getElementById("exercise-weight-input"),
      wellbeingNoteInput: document.getElementById("wellbeing-note"),
      deleteWorkoutDayButton: document.getElementById("delete-workout-day"),
      draftList: document.getElementById("draft-list"),
      addDraftItemButton: document.getElementById("add-draft-item"),
      confirmDraftItemButton: document.getElementById("confirm-draft-item"),
      closeButton: document.getElementById("close-workout-flow"),
      saveButton: document.getElementById("save-workout-flow"),
      flowActions: document.getElementById("workout-flow-actions"),
      primaryActionButton: document.getElementById("workout-primary-action"),
      secondaryActionButton: document.getElementById("workout-secondary-action"),
      setsValue: document.getElementById("sets-value"),
      repsValue: document.getElementById("reps-value"),
      counterButtons: queryAll(workoutOverlay, ".counter-btn"),
      savedSummary: document.getElementById("saved-summary"),
      datePreview: document.getElementById("date-preview"),
    },
    record: {
      overlay: recordOverlay,
      modal: recordOverlay?.querySelector(".record-modal") || null,
      exerciseInput: document.getElementById("record-exercise-input"),
      weightInput: document.getElementById("record-weight-input"),
      weightDisplay: document.getElementById("record-weight-display"),
      dateInput: document.getElementById("record-date-input"),
      dateDisplay: document.getElementById("record-date-display"),
      saveButton: document.getElementById("save-record-flow"),
      flowActions: document.getElementById("record-flow-actions"),
      primaryActionButton: document.getElementById("record-primary-action"),
      secondaryActionButton: document.getElementById("record-secondary-action"),
    },
    quote: {
      overlay: quoteOverlay,
      modal: quoteOverlay?.querySelector(".quote-modal") || null,
      title: document.getElementById("quote-modal-title"),
      closeButton: document.getElementById("close-quote-overlay"),
      cancelButton: document.getElementById("cancel-quote-overlay"),
      addButton: document.getElementById("add-quote-overlay"),
      deleteButton: document.getElementById("delete-selected-quote-overlay"),
      saveButton: document.getElementById("save-quote-overlay"),
      input: document.getElementById("quote-input"),
      authorInput: document.getElementById("quote-author-input"),
      formHint: document.getElementById("quote-form-hint"),
      libraryList: document.getElementById("quote-library-list"),
    },
    myData: {
      overlay: myDataOverlay,
      modal: myDataOverlay?.querySelector(".my-data-modal") || null,
      closeButton: document.getElementById("close-my-data-overlay"),
      openProfileOverlayButton: document.getElementById("open-profile-overlay"),
      name: document.getElementById("profile-name"),
      weight: document.getElementById("weight-value"),
      height: document.getElementById("height-value"),
      experience: document.getElementById("experience-value"),
      workouts: document.getElementById("workouts-value"),
    },
    profile: {
      overlay: profileOverlay,
      modal: profileOverlay?.querySelector(".profile-modal") || null,
      closeButton: document.getElementById("close-profile-overlay"),
      cancelButton: document.getElementById("cancel-profile-overlay"),
      saveButton: document.getElementById("save-profile-overlay"),
      clearButton: document.getElementById("clear-profile-data"),
      nameInput: document.getElementById("profile-edit-name"),
      weightInput: document.getElementById("profile-edit-weight"),
      heightInput: document.getElementById("profile-edit-height"),
      experienceInput: document.getElementById("profile-edit-experience"),
    },
    confirm: {
      overlay: confirmOverlay,
      modal: confirmOverlay?.querySelector(".confirm-modal") || null,
      closeButton: document.getElementById("close-confirm-overlay"),
      cancelButton: document.getElementById("cancel-confirm-overlay"),
      approveButton: document.getElementById("approve-confirm-overlay"),
      text: document.getElementById("confirm-delete-text"),
      subtext: document.getElementById("confirm-delete-subtext"),
    },
  },
};
