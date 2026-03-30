const telegram = window.Telegram?.WebApp;

if (telegram) {
  telegram.ready();
  try {
    telegram.expand();
  } catch (error) {
    console.warn("telegram expand failed", error);
  }
}

const state = {
  activeTab: "home",
  faqCategory: "technique",
  faqQuery: "",
  userQuotes: [],
  quoteOverlayOpen: false,
  quoteEditor: { mode: "create", editingIndex: -1 },
  myDataOverlayOpen: false,
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
    draft: { sets: 1, reps: 8 },
    date: todayValue(),
    saving: false,
  },
};

const HOME_QUOTES = [
  "Stay hard.",
  "Discipline beats motivation.",
  "Every workout counts.",
  "Progress is built daily.",
  "No excuses, only results.",
  "Small steps every day.",
  "Consistency builds strength.",
];
const MAX_CUSTOM_QUOTES = 5;
const QUOTE_DISPLAY_DURATION_MS = 3000;
const QUOTE_FADE_DURATION_MS = 180;
const QUOTE_TYPING_MIN_STEP_MS = 12;
const QUOTE_TYPING_MAX_STEP_MS = 34;
const QUOTE_TYPING_TARGET_DURATION_MS = 1600;

const TELEGRAM_BUTTON_ICON_ID = "5334882760735598374";
const navButtons = [...document.querySelectorAll(".nav-btn")];
const bottomNav = document.getElementById("bottom-nav");
const navPill = document.getElementById("nav-pill");
const panels = [...document.querySelectorAll(".panel")];
const faqTabs = document.getElementById("faq-tabs");
const faqList = document.getElementById("faq-list");
const faqSearch = document.getElementById("faq-search");
const overlay = document.getElementById("workout-overlay");
const recordOverlay = document.getElementById("record-overlay");
// Шаги workout-flow ограничиваем только его overlay, чтобы другие модалки не теряли `.active`.
const modalSteps = [...(overlay?.querySelectorAll(".modal-step[data-step]") || [])];
const modalTitle = document.getElementById("modal-title");
const dateInput = document.getElementById("workout-date-input");
const workoutNameInput = document.getElementById("workout-name-input");
const exerciseNameInput = document.getElementById("exercise-name-input");
const exerciseWeightInput = document.getElementById("exercise-weight-input");
const wellbeingNoteInput = document.getElementById("wellbeing-note");
const deleteWorkoutDayBtn = document.getElementById("delete-workout-day");
const removeRecordBtn = document.getElementById("delete-btn");
const addRecordBtn = document.getElementById("move-btn");
const quoteTextNode = document.getElementById("quote-text");
const quoteLiveCard = document.getElementById("quote-live-card");
const quoteOverlay = document.getElementById("quote-overlay");
const quoteModal = document.querySelector(".quote-modal");
const quoteModalTitle = document.getElementById("quote-modal-title");
const myDataOverlay = document.getElementById("my-data-overlay");
const myDataModal = document.querySelector(".my-data-modal");
const profileOverlay = document.getElementById("profile-overlay");
const profileModal = document.querySelector(".profile-modal");
const confirmOverlay = document.getElementById("confirm-overlay");
const confirmModal = document.querySelector(".confirm-modal");
const quoteInput = document.getElementById("quote-input");
const quoteAuthorInput = document.getElementById("quote-author-input");
const quoteFormHint = document.getElementById("quote-form-hint");
const quoteLibraryList = document.getElementById("quote-library-list");
const addQuoteBtn = document.getElementById("add-quote-overlay");
const deleteSelectedQuoteBtn = document.getElementById("delete-selected-quote-overlay");
const saveQuoteBtn = document.getElementById("save-quote-overlay");
const workoutModal = document.querySelector(".workout-modal");
const recordModal = document.querySelector(".record-modal");
const recordExerciseInput = document.getElementById("record-exercise-input");
const recordWeightInput = document.getElementById("record-weight-input");
const recordWeightDisplay = document.getElementById("record-weight-display");
const recordDateInput = document.getElementById("record-date-input");
const recordDateDisplay = document.getElementById("record-date-display");
const profileEditNameInput = document.getElementById("profile-edit-name");
const profileEditWeightInput = document.getElementById("profile-edit-weight");
const profileEditHeightInput = document.getElementById("profile-edit-height");
const profileEditExperienceInput = document.getElementById("profile-edit-experience");
const confirmDeleteText = document.getElementById("confirm-delete-text");
const confirmDeleteSubtext = document.getElementById("confirm-delete-subtext");
const historyManageToggle = document.getElementById("history-manage-toggle");
const historyBulkActions = document.getElementById("history-bulk-actions");
const historyDeleteSelectedBtn = document.getElementById("history-delete-selected");
const historyDeleteAllBtn = document.getElementById("history-delete-all");
const historyManageCancelBtn = document.getElementById("history-manage-cancel");
const recordsBulkActions = document.getElementById("records-bulk-actions");
const recordsDeleteSelectedBtn = document.getElementById("records-delete-selected");
const recordsDeleteAllBtn = document.getElementById("records-delete-all");
const recordsManageCancelBtn = document.getElementById("records-manage-cancel");
// Общие элементы аватара в шапке. Они живут вне экранов, поэтому доступны на всех вкладках.
const topbarUser = document.getElementById("topbar-user");
const topbarAvatar = document.getElementById("topbar-avatar");
const topbarAvatarFallback = document.getElementById("topbar-avatar-fallback");

const motionApi = window.Motion;
const motionAnimate = typeof motionApi?.animate === "function" ? motionApi.animate : null;
const motionStagger = typeof motionApi?.stagger === "function" ? motionApi.stagger : null;
const telegramMainButton = telegram?.MainButton || null;
const telegramSecondaryButton = telegram?.SecondaryButton || null;
const supportsTelegramButtonEmoji =
  typeof telegram?.isVersionAtLeast === "function" ? telegram.isVersionAtLeast("9.5") : false;

let stableViewportHeight = 0;
let wellbeingNoteSaving = false;
let lastWorkoutStep = "";
let viewportFreezeUntil = 0;
let quoteLoopTimer = 0;
let quoteTransitionTimer = 0;
let quoteIndex = 0;
let quoteTypingRunId = 0;
let quoteRotationPaused = false;
let recordFlowSaving = false;
let workoutFlowTransitioning = false;
let recordFlowTransitioning = false;
let profileSaving = false;
let confirmResolver = null;
let quoteDragState = createQuoteDragState();
const telegramButtonState = new WeakMap();

const enterFieldBehaviors = new WeakMap();

function createQuoteDragState() {
  return {
    active: false,
    pointerId: null,
    handle: null,
    draggedItem: null,
    sourceIndex: -1,
    selectedIndex: -1,
    startY: 0,
    didMove: false,
    ignoreClicksUntil: 0,
  };
}

const handleWorkoutBottomButtonClick = () => {
  if (state.workoutFlow.step === "form") {
    saveDraftItem();
    return;
  }
  handleSaveFlowButton();
};

const handleWorkoutSecondaryButtonClick = () => {
  const previousStep = previousWorkoutStep(state.workoutFlow.step);
  if (previousStep) {
    setWorkoutStep(previousStep);
    return;
  }
  void closeWorkoutFlow();
};

const handleRecordBottomButtonClick = () => {
  void submitRecordFlow();
};

const handleRecordSecondaryButtonClick = () => {
  closeRecordFlow();
};

function blurSubmittedField(node) {
  if (node instanceof HTMLElement && typeof node.blur === "function") {
    node.blur();
  }
  freezeViewportFor(220);
}

function registerEnterFieldBehavior(node, behavior = {}) {
  if (!(node instanceof HTMLElement)) {
    return;
  }
  enterFieldBehaviors.set(node, behavior);
}

function isEnterManagedField(node) {
  return (
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement
  );
}

function isEditableField(node) {
  return (
    node instanceof HTMLInputElement ||
    node instanceof HTMLTextAreaElement ||
    node instanceof HTMLSelectElement ||
    (node instanceof HTMLElement && node.isContentEditable)
  );
}

function isVisibleLayoutNode(node) {
  if (!(node instanceof HTMLElement) || node.hidden) {
    return false;
  }
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }
  return node.getClientRects().length > 0;
}

function blurActiveFieldInside(container) {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !container?.contains(active)) {
    return false;
  }
  if (!isEditableField(active) || typeof active.blur !== "function") {
    return false;
  }
  active.blur();
  freezeViewportFor(220);
  return true;
}

async function handleEnterFieldKeydown(event) {
  if (
    event.key !== "Enter" ||
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    !isEnterManagedField(event.target) ||
    event.target.disabled ||
    event.target.readOnly ||
    event.target.type === "hidden"
  ) {
    return;
  }

  event.preventDefault();

  const field = event.target;
  const behavior = enterFieldBehaviors.get(field);

  try {
    const result =
      typeof behavior?.submit === "function" ? await behavior.submit(field, event) : true;
    if (result === false) {
      return;
    }
  } catch (error) {
    console.error("enter field submission failed", error);
    return;
  }

  blurSubmittedField(field);
}

function focusWithoutScroll(node) {
  if (!node || typeof node.focus !== "function") {
    return;
  }
  try {
    node.focus({ preventScroll: true });
  } catch (error) {
    node.focus();
  }
}

function blurActiveField() {
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) {
    return;
  }
  if (!isEditableField(active) || typeof active.blur !== "function") {
    return;
  }
  active.blur();
  freezeViewportFor(220);
}

function shouldDismissKeyboard(target) {
  if (!(target instanceof Element)) {
    return false;
  }
  return !target.closest(
    "input, textarea, select, button, label, .counter-btn, .draft-action-btn, .action-card, .icon-btn, [role='button']"
  );
}

function preserveContentScroll(callback) {
  const contentNode = document.querySelector(".content");
  const previousScrollTop = contentNode ? contentNode.scrollTop : 0;
  callback();
  if (contentNode) {
    requestAnimationFrame(() => {
      contentNode.scrollTop = previousScrollTop;
    });
  }
}

function escapeSelectorValue(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function freezeViewportFor(ms = 240) {
  viewportFreezeUntil = Math.max(viewportFreezeUntil, Date.now() + ms);
}

function resetScrollableOverlayState(overlayNode, modalNode) {
  [overlayNode, modalNode].forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.scrollTop = 0;
    node.scrollLeft = 0;
  });
}

function restoreViewportAfterOverlayTransition() {
  requestAnimationFrame(() => {
    syncViewportHeight(false);
    syncNavPillPosition(state.activeTab, true);
  });
}

function resetMotionState(...nodes) {
  nodes.forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (typeof node.getAnimations === "function") {
      node.getAnimations().forEach((animation) => {
        try {
          animation.cancel();
        } catch (error) {
          console.warn("animation cancel failed", error);
        }
      });
    }
    node.style.opacity = "";
    node.style.transform = "";
  });
}

function setBottomButtonParams(button, params) {
  if (!button || typeof button.setParams !== "function") {
    return;
  }
  const nextParams = { ...params };
  if (!supportsTelegramButtonEmoji) {
    delete nextParams.icon_custom_emoji_id;
  }
  const runtime = telegramButtonState.get(button) || {
    paramsKey: null,
    clickHandler: null,
    visible: null,
    enabled: null,
    progressVisible: null,
  };
  telegramButtonState.set(button, runtime);
  const nextKey = JSON.stringify(
    Object.keys(nextParams)
      .sort()
      .reduce((accumulator, key) => {
        accumulator[key] = nextParams[key];
        return accumulator;
      }, {})
  );
  if (runtime.paramsKey === nextKey) {
    return;
  }
  button.setParams(nextParams);
  runtime.paramsKey = nextKey;
}

function setBottomButtonClickHandler(button, handler) {
  if (!button) {
    return;
  }
  const runtime = telegramButtonState.get(button) || {
    paramsKey: null,
    clickHandler: null,
    visible: null,
    enabled: null,
    progressVisible: null,
  };
  telegramButtonState.set(button, runtime);
  if (runtime.clickHandler === handler) {
    return;
  }
  if (runtime.clickHandler && typeof button.offClick === "function") {
    button.offClick(runtime.clickHandler);
  }
  if (handler && typeof button.onClick === "function") {
    button.onClick(handler);
  }
  runtime.clickHandler = handler || null;
}

function setBottomButtonProgressVisibility(button, visible) {
  if (!button) {
    return;
  }
  const runtime = telegramButtonState.get(button) || {
    paramsKey: null,
    clickHandler: null,
    visible: null,
    enabled: null,
    progressVisible: null,
  };
  telegramButtonState.set(button, runtime);
  if (runtime.progressVisible === visible) {
    return;
  }
  if (visible) {
    showButtonProgress(button);
  } else {
    hideButtonProgress(button);
  }
  runtime.progressVisible = visible;
}

function setBottomButtonEnabled(button, enabled) {
  if (!button) {
    return;
  }
  const runtime = telegramButtonState.get(button) || {
    paramsKey: null,
    clickHandler: null,
    visible: null,
    enabled: null,
    progressVisible: null,
  };
  telegramButtonState.set(button, runtime);
  if (runtime.enabled === enabled) {
    return;
  }
  if (enabled) {
    button.enable();
  } else {
    button.disable();
  }
  runtime.enabled = enabled;
}

function setBottomButtonVisibility(button, visible) {
  if (!button) {
    return;
  }
  const runtime = telegramButtonState.get(button) || {
    paramsKey: null,
    clickHandler: null,
    visible: null,
    enabled: null,
    progressVisible: null,
  };
  telegramButtonState.set(button, runtime);
  if (runtime.visible === visible) {
    return;
  }
  if (visible) {
    button.show();
  } else {
    button.hide();
    runtime.enabled = null;
    runtime.progressVisible = false;
  }
  runtime.visible = visible;
}

function applyBottomButtonState(button, config) {
  if (!button) {
    return;
  }
  if (!config || config.visible === false) {
    setBottomButtonClickHandler(button, null);
    setBottomButtonProgressVisibility(button, false);
    setBottomButtonVisibility(button, false);
    return;
  }
  setBottomButtonParams(button, config.params || {});
  setBottomButtonClickHandler(button, config.onClick || null);
  setBottomButtonEnabled(button, Boolean(config.enabled));
  setBottomButtonVisibility(button, true);
  setBottomButtonProgressVisibility(button, Boolean(config.progressVisible));
}

function hideButtonProgress(button) {
  if (button && typeof button.hideProgress === "function") {
    button.hideProgress();
  }
}

function showButtonProgress(button) {
  if (button && typeof button.showProgress === "function") {
    button.showProgress();
  }
}

function hideTelegramBottomButtons() {
  applyBottomButtonState(telegramMainButton, { visible: false });
  applyBottomButtonState(telegramSecondaryButton, { visible: false });
}

function syncTelegramBottomButtons() {
  if (!telegramMainButton || !telegramSecondaryButton) {
    return;
  }

  if (state.workoutFlow.open) {
    const workoutButtonText =
      state.workoutFlow.step === "form"
        ? "Сохранить упр."
        : state.workoutFlow.step === "date"
          ? "Сохранить"
          : state.workoutFlow.step === "done"
            ? "Готово"
            : "Далее";
    const workoutButtonDisabled =
      state.workoutFlow.saving ||
      (state.workoutFlow.step === "list" && !state.workoutFlow.items.length);

    applyBottomButtonState(telegramMainButton, {
      visible: true,
      params: {
        text: workoutButtonText,
        has_shine_effect: !workoutButtonDisabled,
        icon_custom_emoji_id: TELEGRAM_BUTTON_ICON_ID,
      },
      onClick: handleWorkoutBottomButtonClick,
      enabled: !state.workoutFlow.saving && !workoutButtonDisabled,
      progressVisible: state.workoutFlow.saving,
    });
    applyBottomButtonState(telegramSecondaryButton, {
      visible: true,
      params: {
        text: "Назад",
        position: "left",
      },
      onClick: handleWorkoutSecondaryButtonClick,
      enabled: !state.workoutFlow.saving,
      progressVisible: false,
    });
    return;
  }

  if (recordOverlay && !recordOverlay.hidden) {
    applyBottomButtonState(telegramMainButton, {
      visible: true,
      params: {
        text: "Сохранить",
        has_shine_effect: !recordFlowSaving,
        icon_custom_emoji_id: TELEGRAM_BUTTON_ICON_ID,
      },
      onClick: handleRecordBottomButtonClick,
      enabled: !recordFlowSaving,
      progressVisible: recordFlowSaving,
    });
    applyBottomButtonState(telegramSecondaryButton, {
      visible: true,
      params: {
        text: "Отмена",
        position: "left",
      },
      onClick: handleRecordSecondaryButtonClick,
      enabled: !recordFlowSaving,
      progressVisible: false,
    });
    return;
  }

  hideTelegramBottomButtons();
}

function clearQuoteLoopTimer() {
  if (!quoteLoopTimer) {
    return;
  }
  window.clearTimeout(quoteLoopTimer);
  quoteLoopTimer = 0;
}

function clearQuoteTransitionTimer() {
  if (!quoteTransitionTimer) {
    return;
  }
  window.clearTimeout(quoteTransitionTimer);
  quoteTransitionTimer = 0;
}

function scheduleQuoteTick(delay) {
  clearQuoteLoopTimer();
  quoteLoopTimer = window.setTimeout(runQuoteTick, delay);
}

function normalizeQuoteText(quote) {
  const text = String(quote?.text || "").trim();
  const author = String(quote?.author || "").trim();
  if (!text) {
    return "";
  }
  return author ? `${text} - ${author}` : text;
}

function currentQuotePool() {
  const customQuotes = Array.isArray(state.userQuotes)
    ? state.userQuotes.map(normalizeQuoteText).filter(Boolean)
    : [];
  if (customQuotes.length) {
    return customQuotes;
  }
  return HOME_QUOTES;
}

function syncQuoteIndexWithPool(quotePool) {
  if (!quotePool.length) {
    quoteIndex = 0;
    return;
  }
  if (!Number.isInteger(quoteIndex) || quoteIndex < 0) {
    quoteIndex = 0;
    return;
  }
  quoteIndex %= quotePool.length;
}

function currentCustomQuoteIndex() {
  if (!Array.isArray(state.userQuotes) || !state.userQuotes.length) {
    return -1;
  }
  return Math.min(quoteIndex, state.userQuotes.length - 1);
}

function currentEditableQuoteIndex() {
  const editingIndex = Number(state.quoteEditor?.editingIndex);
  if (Number.isInteger(editingIndex) && editingIndex >= 0 && state.userQuotes[editingIndex]) {
    return editingIndex;
  }
  return -1;
}

function canAnimateQuotes() {
  return Boolean(
    quoteTextNode &&
      quoteLiveCard &&
      !quoteLiveCard.hidden &&
      currentQuotePool().length &&
      !document.hidden &&
      state.activeTab === "home"
  );
}

function getQuoteTypingStepMs(text) {
  const length = Math.max(String(text || "").length, 1);
  const candidate = Math.round(QUOTE_TYPING_TARGET_DURATION_MS / length);
  return Math.max(QUOTE_TYPING_MIN_STEP_MS, Math.min(QUOTE_TYPING_MAX_STEP_MS, candidate));
}

function getQuoteTypingDurationMs(text) {
  const nextText = String(text || "");
  if (!nextText) {
    return 0;
  }
  const stepDelay = getQuoteTypingStepMs(nextText);
  return Math.min(90, stepDelay) + Math.max(nextText.length - 1, 0) * stepDelay;
}

function getQuoteTransitionDurationMs(text, { immediate = false } = {}) {
  if (immediate) {
    return 0;
  }
  return QUOTE_FADE_DURATION_MS + getQuoteTypingDurationMs(text);
}

function scheduleNextQuote(text, options = {}) {
  clearQuoteLoopTimer();
  if (quoteRotationPaused || !canAnimateQuotes()) {
    return;
  }

  const quotePool = currentQuotePool();
  if (quotePool.length <= 1) {
    return;
  }

  const delay = getQuoteTransitionDurationMs(text, options) + QUOTE_DISPLAY_DURATION_MS;
  scheduleQuoteTick(delay);
}

function renderQuoteText(text) {
  if (!quoteTextNode) {
    return;
  }
  quoteTypingRunId += 1;
  clearQuoteTransitionTimer();
  quoteTextNode.classList.remove("is-transitioning", "is-typing");
  quoteTextNode.textContent = String(text || "");
}

function transitionQuoteText(text, { immediate = false, restart = false } = {}) {
  if (!quoteTextNode) {
    return;
  }

  const nextText = String(text || "");
  const currentText = String(quoteTextNode.textContent || "");
  if (immediate) {
    renderQuoteText(nextText);
    return;
  }
  if (!restart && currentText === nextText && !quoteTextNode.classList.contains("is-typing")) {
    return;
  }

  quoteTypingRunId += 1;
  const typingRunId = quoteTypingRunId;
  clearQuoteTransitionTimer();
  quoteTextNode.classList.remove("is-typing");
  quoteTextNode.classList.add("is-transitioning");

  const startTyping = () => {
    if (typingRunId !== quoteTypingRunId || !quoteTextNode) {
      return;
    }

    quoteTextNode.classList.remove("is-transitioning");
    quoteTextNode.classList.add("is-typing");
    quoteTextNode.textContent = "";
    if (!nextText) {
      quoteTextNode.classList.remove("is-typing");
      quoteTransitionTimer = 0;
      return;
    }

    const stepDelay = getQuoteTypingStepMs(nextText);
    let visibleLength = 0;

    const typeNextCharacter = () => {
      if (typingRunId !== quoteTypingRunId || !quoteTextNode) {
        return;
      }

      visibleLength += 1;
      quoteTextNode.textContent = nextText.slice(0, visibleLength);

      if (visibleLength >= nextText.length) {
        quoteTextNode.classList.remove("is-typing");
        quoteTransitionTimer = 0;
        return;
      }

      quoteTransitionTimer = window.setTimeout(typeNextCharacter, stepDelay);
    };

    quoteTransitionTimer = window.setTimeout(typeNextCharacter, Math.min(90, stepDelay));
  };

  quoteTransitionTimer = window.setTimeout(startTyping, QUOTE_FADE_DURATION_MS);
}

function showCurrentQuote(options = {}) {
  const { restart = false, immediate = false } = options;
  const quotePool = currentQuotePool();
  syncQuoteIndexWithPool(quotePool);
  const nextText = quotePool[quoteIndex] || quotePool[0] || "";
  transitionQuoteText(nextText, { restart, immediate });
  scheduleNextQuote(nextText, { immediate });
}

function customQuotesStorageKey() {
  return `custom_quotes:${state.userId || "unknown"}`;
}

function normalizeCustomQuotes(items) {
  if (typeof items === "string") {
    return normalizeCustomQuotes([{ text: items }]);
  }
  if (items && typeof items === "object" && !Array.isArray(items)) {
    return normalizeCustomQuotes([items]);
  }
  if (!Array.isArray(items)) {
    return [];
  }
  return items
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text: text.slice(0, 240), author: "" } : null;
      }
      if (!item || typeof item !== "object") {
        return null;
      }
      const text = String(item.text || "").trim();
      const author = String(item.author || "").trim();
      if (!text) {
        return null;
      }
      return {
        text: text.slice(0, 240),
        author: author.slice(0, 80),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_CUSTOM_QUOTES);
}

function loadCustomQuotes() {
  try {
    const raw = localStorage.getItem(customQuotesStorageKey());
    if (!raw) {
      return [];
    }
    return normalizeCustomQuotes(JSON.parse(raw));
  } catch (error) {
    try {
      const raw = localStorage.getItem(customQuotesStorageKey());
      return raw ? normalizeCustomQuotes(raw) : [];
    } catch (nestedError) {
      return [];
    }
  }
}

function persistCustomQuotes(quotes) {
  const normalized = normalizeCustomQuotes(quotes);
  state.userQuotes = normalized;
  try {
    localStorage.setItem(customQuotesStorageKey(), JSON.stringify(normalized));
  } catch (error) {
    console.warn("custom quotes storage failed", error);
  }
}

function updateQuoteFormState() {
  const currentCount = state.userQuotes.length;
  const isEditing = state.quoteEditor?.mode === "edit" && currentEditableQuoteIndex() >= 0;
  const hasSelectedQuote = currentEditableQuoteIndex() >= 0;
  if (quoteFormHint) {
    quoteFormHint.textContent = isEditing
      ? "Измените текст или автора, затем сохраните. Порядок можно менять перетаскиванием."
      : currentCount >= MAX_CUSTOM_QUOTES
        ? `Лимит достигнут: можно хранить максимум ${MAX_CUSTOM_QUOTES} цитат.`
        : currentCount > 0
          ? "Введите новую цитату или выберите сохраненную ниже. Порядок меняется перетаскиванием."
          : `Можно добавить до ${MAX_CUSTOM_QUOTES} цитат.`;
  }
  if (saveQuoteBtn) {
    saveQuoteBtn.disabled = !String(quoteInput?.value || "").trim() || (!isEditing && currentCount >= MAX_CUSTOM_QUOTES);
  }
  if (addQuoteBtn) {
    addQuoteBtn.disabled = currentCount >= MAX_CUSTOM_QUOTES && !isEditing;
  }
  if (deleteSelectedQuoteBtn) {
    deleteSelectedQuoteBtn.disabled = !hasSelectedQuote;
  }
  if (quoteModalTitle) {
    quoteModalTitle.textContent = isEditing ? "Редактировать цитату" : "Новая цитата";
  }
  const quoteManageButton = document.getElementById("open-quote-overlay");
  if (quoteManageButton) {
    quoteManageButton.setAttribute("aria-label", "Управление цитатами");
  }
}

function renderQuoteLibrary() {
  if (!quoteLibraryList) {
    return;
  }

  const quotes = Array.isArray(state.userQuotes) ? state.userQuotes : [];
  if (!quotes.length) {
    quoteLibraryList.innerHTML = `<div class="quote-library-empty">Сохраненных цитат пока нет</div>`;
    return;
  }

  quoteLibraryList.innerHTML = quotes
    .map(
      (quote, index) => `
        <article
          class="quote-library-item ${currentEditableQuoteIndex() === index ? "is-selected" : ""}"
          data-quote-index="${index}"
          tabindex="0"
          role="button"
          aria-pressed="${currentEditableQuoteIndex() === index ? "true" : "false"}"
        >
          <div class="quote-library-copy">
            <p class="quote-library-text">${escapeHtml(quote.text)}</p>
            ${quote.author ? `<p class="quote-library-author">${escapeHtml(quote.author)}</p>` : ""}
          </div>
          <button
            class="quote-library-handle"
            type="button"
            data-quote-handle
            aria-label="Переместить цитату"
            title="Перетащите, чтобы изменить порядок"
          ></button>
        </article>
      `
    )
    .join("");

  quoteLibraryList.querySelectorAll(".quote-library-item").forEach((item) => {
    const openSelectedQuote = () => {
      if (Date.now() < quoteDragState.ignoreClicksUntil) {
        return;
      }
      const index = Number(item.dataset.quoteIndex);
      startEditCustomQuote(index);
    };
    item.addEventListener("click", openSelectedQuote);
    item.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      openSelectedQuote();
    });
  });

  quoteLibraryList.querySelectorAll("[data-quote-handle]").forEach((handle) => {
    handle.addEventListener("click", (event) => {
      event.stopPropagation();
    });
    handle.addEventListener("pointerdown", startQuoteReorder);
  });
}

function resetQuoteDragState() {
  const ignoreClicksUntil = quoteDragState.ignoreClicksUntil;
  document.removeEventListener("pointermove", handleQuoteReorderMove);
  document.removeEventListener("pointerup", finishQuoteReorder);
  document.removeEventListener("pointercancel", finishQuoteReorder);

  if (quoteDragState.handle && quoteDragState.pointerId !== null) {
    try {
      quoteDragState.handle.releasePointerCapture?.(quoteDragState.pointerId);
    } catch (error) {
      // noop: some browsers throw if capture was never established
    }
  }

  if (quoteDragState.draggedItem) {
    quoteDragState.draggedItem.classList.remove("is-dragging");
    quoteDragState.draggedItem.style.removeProperty("transform");
    quoteDragState.draggedItem.style.removeProperty("z-index");
  }

  quoteLibraryList?.classList.remove("is-reordering");
  quoteDragState = createQuoteDragState();
  quoteDragState.ignoreClicksUntil = ignoreClicksUntil;
}

function collectQuoteLibraryOrder() {
  if (!quoteLibraryList) {
    return [];
  }
  return [...quoteLibraryList.querySelectorAll(".quote-library-item")]
    .map((item) => Number(item.dataset.quoteIndex))
    .filter((index) => Number.isInteger(index) && index >= 0 && state.userQuotes[index]);
}

function applyQuoteLibraryOrder(order, selectedOriginalIndex = -1) {
  if (!Array.isArray(order) || order.length !== state.userQuotes.length) {
    return false;
  }

  const currentDraft = {
    text: String(quoteInput?.value || ""),
    author: String(quoteAuthorInput?.value || ""),
  };

  const nextQuotes = order.map((index) => state.userQuotes[index]).filter(Boolean);
  if (nextQuotes.length !== state.userQuotes.length) {
    return false;
  }

  persistCustomQuotes(nextQuotes);

  const nextEditingIndex = selectedOriginalIndex >= 0 ? order.indexOf(selectedOriginalIndex) : -1;
  if (nextEditingIndex >= 0) {
    setQuoteEditorMode("edit", nextEditingIndex);
  } else {
    setQuoteEditorMode("create");
  }

  renderQuotesSection({ resetLoop: true });

  if (quoteInput) {
    quoteInput.value = currentDraft.text;
    quoteInput.classList.remove("is-invalid");
  }
  if (quoteAuthorInput) {
    quoteAuthorInput.value = currentDraft.author;
  }
  updateQuoteFormState();
  triggerHaptic("selection");
  return true;
}

function handleQuoteReorderMove(event) {
  if (!quoteDragState.active || event.pointerId !== quoteDragState.pointerId || !quoteLibraryList || !quoteDragState.draggedItem) {
    return;
  }

  event.preventDefault();
  const deltaY = event.clientY - quoteDragState.startY;
  if (Math.abs(deltaY) > 4) {
    quoteDragState.didMove = true;
  }

  quoteDragState.draggedItem.style.transform = `translateY(${deltaY}px) scale(1.01)`;

  const hoveredItem = document.elementFromPoint(event.clientX, event.clientY)?.closest(".quote-library-item");
  const otherItems = [...quoteLibraryList.querySelectorAll(".quote-library-item:not(.is-dragging)")];

  if (hoveredItem && hoveredItem !== quoteDragState.draggedItem && quoteLibraryList.contains(hoveredItem)) {
    const hoveredRect = hoveredItem.getBoundingClientRect();
    const insertBeforeNode =
      event.clientY > hoveredRect.top + hoveredRect.height / 2 ? hoveredItem.nextElementSibling : hoveredItem;
    if (insertBeforeNode !== quoteDragState.draggedItem) {
      quoteLibraryList.insertBefore(quoteDragState.draggedItem, insertBeforeNode);
    }
    return;
  }

  if (!otherItems.length) {
    return;
  }

  const firstRect = otherItems[0].getBoundingClientRect();
  if (event.clientY <= firstRect.top) {
    quoteLibraryList.insertBefore(quoteDragState.draggedItem, otherItems[0]);
    return;
  }

  const lastItem = otherItems[otherItems.length - 1];
  const lastRect = lastItem.getBoundingClientRect();
  if (event.clientY >= lastRect.bottom) {
    quoteLibraryList.append(quoteDragState.draggedItem);
  }
}

function finishQuoteReorder(event) {
  if (!quoteDragState.active) {
    return;
  }
  if (event?.pointerId != null && quoteDragState.pointerId != null && event.pointerId !== quoteDragState.pointerId) {
    return;
  }

  const { didMove, selectedIndex } = quoteDragState;
  const nextOrder = collectQuoteLibraryOrder();
  const orderChanged = nextOrder.some((index, position) => index !== position);
  const ignoreClicksUntil = didMove ? Date.now() + 260 : quoteDragState.ignoreClicksUntil;

  quoteDragState.ignoreClicksUntil = ignoreClicksUntil;

  resetQuoteDragState();

  if (didMove && orderChanged) {
    applyQuoteLibraryOrder(nextOrder, selectedIndex);
    return;
  }

  renderQuoteLibrary();
  updateQuoteFormState();
}

function startQuoteReorder(event) {
  const handle = event.target.closest("[data-quote-handle]");
  const item = handle?.closest(".quote-library-item");
  if (!handle || !item || !quoteLibraryList) {
    return;
  }
  if (event.pointerType === "mouse" && event.button !== 0) {
    return;
  }

  const sourceIndex = Number(item.dataset.quoteIndex);
  if (!Number.isInteger(sourceIndex) || !state.userQuotes[sourceIndex]) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  blurActiveField();
  resetQuoteDragState();

  quoteDragState.active = true;
  quoteDragState.pointerId = event.pointerId;
  quoteDragState.handle = handle;
  quoteDragState.draggedItem = item;
  quoteDragState.sourceIndex = sourceIndex;
  quoteDragState.selectedIndex = currentEditableQuoteIndex();
  quoteDragState.startY = event.clientY;

  handle.setPointerCapture?.(event.pointerId);
  item.classList.add("is-dragging");
  item.style.zIndex = "3";
  quoteLibraryList.classList.add("is-reordering");

  document.addEventListener("pointermove", handleQuoteReorderMove);
  document.addEventListener("pointerup", finishQuoteReorder);
  document.addEventListener("pointercancel", finishQuoteReorder);
}

function renderQuotesSection(options = {}) {
  if (!quoteLiveCard) {
    return;
  }

  const { resetLoop = false } = options;
  const quotePool = currentQuotePool();

  quoteLiveCard.hidden = false;
  updateQuoteFormState();
  renderQuoteLibrary();

  if (resetLoop) {
    clearQuoteLoopTimer();
    clearQuoteTransitionTimer();
    quoteIndex = 0;
    showCurrentQuote({ restart: true });
    return;
  }

  syncQuoteIndexWithPool(quotePool);
  const activeQuoteText = quotePool[quoteIndex] || quotePool[0] || "";
  if (quoteTextNode?.classList.contains("is-typing")) {
    if (!quoteLoopTimer) {
      scheduleNextQuote(activeQuoteText);
    }
    return;
  }

  const currentText = String(quoteTextNode?.textContent || "");
  if (!currentText || !quotePool.includes(currentText)) {
    showCurrentQuote({ restart: true });
    return;
  }

  if (!quoteLoopTimer) {
    scheduleNextQuote(currentText);
  }
  syncQuoteLoop();
}

function resetQuoteForm() {
  if (quoteInput) {
    quoteInput.value = "";
    quoteInput.classList.remove("is-invalid");
  }
  if (quoteAuthorInput) {
    quoteAuthorInput.value = "";
  }
  updateQuoteFormState();
}

function setQuoteEditorMode(mode, editingIndex = -1) {
  const hasValidIndex = Number.isInteger(editingIndex) && editingIndex >= 0 && state.userQuotes[editingIndex];
  const isEditMode = mode === "edit" && hasValidIndex;
  state.quoteEditor = {
    mode: isEditMode ? "edit" : "create",
    editingIndex: hasValidIndex ? editingIndex : -1,
  };
  updateQuoteFormState();
}

function fillQuoteOverlayForm() {
  const editingIndex = currentEditableQuoteIndex();
  const editingQuote = state.quoteEditor?.mode === "edit" && editingIndex >= 0 ? state.userQuotes[editingIndex] : null;

  if (quoteInput) {
    quoteInput.value = editingQuote?.text || "";
    quoteInput.classList.remove("is-invalid");
  }
  if (quoteAuthorInput) {
    quoteAuthorInput.value = editingQuote?.author || "";
  }
  updateQuoteFormState();
}

function startCreateCustomQuote() {
  if (state.userQuotes.length >= MAX_CUSTOM_QUOTES) {
    updateQuoteFormState();
    showToast(`Можно сохранить максимум ${MAX_CUSTOM_QUOTES} цитат`);
    return;
  }
  setQuoteEditorMode("create");
  fillQuoteOverlayForm();
  renderQuoteLibrary();
  focusWithoutScroll(quoteInput);
}

function startEditCustomQuote(index = currentEditableQuoteIndex()) {
  if (!Number.isInteger(index) || index < 0 || !state.userQuotes[index]) {
    updateQuoteFormState();
    showToast("Выберите цитату из списка");
    return;
  }
  setQuoteEditorMode("edit", index);
  fillQuoteOverlayForm();
  renderQuoteLibrary();
  focusWithoutScroll(quoteInput);
}

function syncQuoteEditorAfterDelete() {
  setQuoteEditorMode("create");
  fillQuoteOverlayForm();
}

function runQuoteTick() {
  quoteLoopTimer = 0;
  if (!canAnimateQuotes() || quoteRotationPaused) {
    return;
  }

  const quotePool = currentQuotePool();
  syncQuoteIndexWithPool(quotePool);
  if (quotePool.length <= 1) {
    renderQuoteText(quotePool[0] || "");
    return;
  }
  quoteIndex = (quoteIndex + 1) % quotePool.length;
  showCurrentQuote();
}

function syncQuoteLoop() {
  if (!canAnimateQuotes()) {
    quoteLiveCard?.classList.remove("is-breathing");
    clearQuoteLoopTimer();
    clearQuoteTransitionTimer();
    return;
  }

  const quotePool = currentQuotePool();
  syncQuoteIndexWithPool(quotePool);
  if (!quotePool.length) {
    quoteLiveCard?.classList.remove("is-breathing");
    clearQuoteLoopTimer();
    renderQuoteText("");
    return;
  }

  quoteLiveCard?.classList.add("is-breathing");

  if (quoteRotationPaused) {
    clearQuoteLoopTimer();
    return;
  }

  const activeQuoteText = quotePool[quoteIndex] || quotePool[0] || "";
  if (quoteTextNode?.classList.contains("is-typing")) {
    if (!quoteLoopTimer) {
      scheduleNextQuote(activeQuoteText);
    }
    return;
  }

  const currentText = String(quoteTextNode?.textContent || "");
  if (!currentText || !quotePool.includes(currentText)) {
    showCurrentQuote({ restart: true });
    return;
  }

  if (quotePool.length === 1) {
    clearQuoteLoopTimer();
    return;
  }

  if (!quoteLoopTimer) {
    scheduleNextQuote(currentText);
  }
}

function triggerHaptic(type = "selection") {
  try {
    const haptic = telegram?.HapticFeedback;
    if (haptic) {
      if (type === "selection" && typeof haptic.selectionChanged === "function") {
        haptic.selectionChanged();
        return;
      }
      if (type === "success" && typeof haptic.notificationOccurred === "function") {
        haptic.notificationOccurred("success");
        return;
      }
      if (typeof haptic.impactOccurred === "function") {
        haptic.impactOccurred("light");
        return;
      }
    }
  } catch (error) {
    console.warn("haptic failed", error);
  }

  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

let lastHapticAt = 0;
function triggerLightTapHaptic() {
  const now = Date.now();
  if (now - lastHapticAt < 45) {
    return;
  }
  lastHapticAt = now;
  triggerHaptic("selection");
}

function syncViewportHeight(force = false) {
  if (!force && (Date.now() < viewportFreezeUntil || document.documentElement.classList.contains("modal-open"))) {
    return;
  }

  const next = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  if (!next) {
    return;
  }
  const active = document.activeElement;
  const keyboardLikelyOpen =
    isEditableField(active) && isVisibleLayoutNode(active);

  // Keep viewport height stable while keyboard is open, but allow corrections after Telegram recalculates viewport.
  if (!force && stableViewportHeight) {
    if (keyboardLikelyOpen) {
      freezeViewportFor(320);
      return;
    }

    // On mobile WebViews we treat height drops as transient unless force=true.
    // This prevents the shell from shrinking and bouncing during keyboard / chrome animations.
    if (next < stableViewportHeight) {
      return;
    }

    const delta = next - stableViewportHeight;
    if (delta < 32) {
      return;
    }
  }
  stableViewportHeight = next;
  document.documentElement.style.setProperty("--app-vh", `${stableViewportHeight}px`);
}

function setBodyScrollLock(locked) {
  document.documentElement.classList.toggle("modal-open", locked);
  document.body.classList.toggle("modal-open", locked);
}

function runMotion(target, keyframes, options) {
  if (!motionAnimate || !target) {
    return null;
  }
  try {
    return motionAnimate(target, keyframes, options);
  } catch (error) {
    console.warn("motion animate failed", error);
    return null;
  }
}

async function waitForMotionFinish(...animations) {
  const pending = animations
    .filter((animation) => animation?.finished)
    .map((animation) => animation.finished.catch(() => undefined));
  if (!pending.length) {
    return;
  }
  await Promise.all(pending);
}

function animatePanelEnter(tab) {
  const panel = panels.find((node) => node.dataset.panel === tab);
  if (!panel) {
    return;
  }
  runMotion(
    panel,
    {
      opacity: [0, 1],
      transform: ["translateY(12px)", "translateY(0px)"],
    },
    {
      duration: 0.28,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

function animateCollection(root, selector) {
  if (!root) {
    return;
  }
  const nodes = [...root.querySelectorAll(selector)];
  if (!nodes.length) {
    return;
  }
  runMotion(
    nodes,
    {
      opacity: [0, 1],
      transform: ["translateY(10px)", "translateY(0px)"],
    },
    {
      duration: 0.24,
      delay: motionStagger ? motionStagger(0.04) : 0,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

function animateExerciseRows(root) {
  if (!root) {
    return;
  }
  const rows = [...root.querySelectorAll(".exercise-row")];
  if (!rows.length) {
    return;
  }
  runMotion(
    rows,
    {
      opacity: [0, 1],
      transform: ["translateX(-8px)", "translateX(0px)"],
    },
    {
      duration: 0.2,
      delay: motionStagger ? motionStagger(0.03) : 0,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

function animateModalOpen() {
  const overlayAnimation = runMotion(
    overlay,
    { opacity: [0, 1] },
    { duration: 0.2, easing: "ease-out" }
  );
  const modalAnimation = runMotion(
    workoutModal,
    {
      opacity: [0.6, 1],
      transform: ["translateY(24px) scale(0.98)", "translateY(0px) scale(1)"],
    },
    { duration: 0.28, easing: [0.22, 1, 0.36, 1] }
  );
  return { overlayAnimation, modalAnimation };
}

function animateWorkoutStep(step) {
  const activeStep = modalSteps.find((node) => node.dataset.step === step);
  if (!activeStep) {
    return;
  }
  runMotion(
    activeStep,
    {
      opacity: [0, 1],
      transform: ["translateY(12px)", "translateY(0px)"],
    },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
}

syncViewportHeight(true);
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => syncViewportHeight(true), 120);
}, { passive: true });
window.addEventListener("resize", () => {
  syncViewportHeight(false);
  syncNavPillPosition(state.activeTab, true);
}, { passive: true });
window.visualViewport?.addEventListener("resize", () => {
  syncViewportHeight(false);
  syncNavPillPosition(state.activeTab, true);
}, { passive: true });
document.addEventListener("visibilitychange", syncQuoteLoop, { passive: true });
document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const tappable = target.closest(
      "button, [role='button'], .nav-btn, .action-card, .draft-action-btn, .history-edit-btn, .chip, .topbar-user"
    );
    if (!tappable) {
      return;
    }
    triggerLightTapHaptic();
  },
  { capture: true, passive: true }
);

function bindClick(id, handler) {
  const node = document.getElementById(id);
  if (node) {
    node.addEventListener("click", handler);
  }
}

function preventTapFocusShift(node) {
  if (!node) {
    return;
  }
  node.addEventListener("pointerdown", (event) => {
    event.preventDefault();
  });
}

bindClick("open-workout-flow", openWorkoutFlow);
bindClick("close-workout-flow", closeWorkoutFlow);
bindClick("add-draft-item", openDraftFormForCreate);
bindClick("confirm-draft-item", saveDraftItem);
bindClick("save-workout-flow", handleSaveFlowButton);
bindClick("history-manage-toggle", toggleHistoryManageMode);
bindClick("history-manage-cancel", disableHistoryManageMode);
bindClick("history-delete-selected", deleteSelectedHistoryWorkouts);
bindClick("history-delete-all", deleteAllHistoryWorkouts);
bindClick("save-record-flow", submitRecordFlow);
bindClick("records-delete-selected", deleteSelectedRecords);
bindClick("records-delete-all", deleteAllRecords);
bindClick("records-manage-cancel", disableRecordsManageMode);
bindClick("topbar-user", openMyDataOverlay);
bindClick("close-my-data-overlay", closeMyDataOverlay);
bindClick("open-quote-overlay", openQuoteOverlay);
bindClick("close-quote-overlay", closeQuoteOverlay);
bindClick("cancel-quote-overlay", closeQuoteOverlay);
bindClick("add-quote-overlay", startCreateCustomQuote);
bindClick("delete-selected-quote-overlay", deleteQuoteFromOverlay);
bindClick("save-quote-overlay", saveCustomQuote);
bindClick("open-profile-overlay", openProfileEditorFromMyData);
bindClick("close-profile-overlay", closeProfileOverlay);
bindClick("cancel-profile-overlay", closeProfileOverlay);
bindClick("save-profile-overlay", saveProfileOverlay);
bindClick("clear-profile-data", clearProfileData);
bindClick("close-confirm-overlay", cancelDeleteConfirmation);
bindClick("cancel-confirm-overlay", cancelDeleteConfirmation);
bindClick("approve-confirm-overlay", approveDeleteConfirmation);

deleteWorkoutDayBtn?.addEventListener("click", handleDeleteWorkoutDay);
addRecordBtn?.addEventListener("click", openRecordFlow);
removeRecordBtn?.addEventListener("click", toggleRecordsManageMode);
preventTapFocusShift(document.getElementById("open-workout-flow"));
preventTapFocusShift(topbarUser);

recordOverlay?.addEventListener("click", (event) => {
  if (event.target === recordOverlay) {
    closeRecordFlow();
  }
});

quoteOverlay?.addEventListener("click", (event) => {
  if (event.target === quoteOverlay) {
    closeQuoteOverlay();
  }
});

quoteLiveCard?.addEventListener("pointerenter", () => {
  quoteRotationPaused = true;
  clearQuoteLoopTimer();
});

quoteLiveCard?.addEventListener("pointerleave", () => {
  quoteRotationPaused = false;
  syncQuoteLoop();
});

myDataOverlay?.addEventListener("click", (event) => {
  if (event.target === myDataOverlay) {
    closeMyDataOverlay();
  }
});

profileOverlay?.addEventListener("click", (event) => {
  if (event.target === profileOverlay) {
    closeProfileOverlay();
  }
});

confirmOverlay?.addEventListener("click", (event) => {
  if (event.target === confirmOverlay) {
    cancelDeleteConfirmation();
  }
});

overlay?.addEventListener(
  "pointerdown",
  (event) => {
    if (shouldDismissKeyboard(event.target)) {
      blurActiveField();
    }
  },
  { passive: true }
);

recordOverlay?.addEventListener(
  "pointerdown",
  (event) => {
    if (shouldDismissKeyboard(event.target)) {
      blurActiveField();
    }
  },
  { passive: true }
);

quoteOverlay?.addEventListener(
  "pointerdown",
  (event) => {
    if (shouldDismissKeyboard(event.target)) {
      blurActiveField();
    }
  },
  { passive: true }
);

myDataOverlay?.addEventListener(
  "pointerdown",
  (event) => {
    if (shouldDismissKeyboard(event.target)) {
      blurActiveField();
    }
  },
  { passive: true }
);

profileOverlay?.addEventListener(
  "pointerdown",
  (event) => {
    if (shouldDismissKeyboard(event.target)) {
      blurActiveField();
    }
  },
  { passive: true }
);

confirmOverlay?.addEventListener(
  "pointerdown",
  (event) => {
    if (shouldDismissKeyboard(event.target)) {
      blurActiveField();
    }
  },
  { passive: true }
);

quoteInput?.addEventListener("input", () => {
  quoteInput.classList.remove("is-invalid");
  updateQuoteFormState();
});

quoteAuthorInput?.addEventListener("input", updateQuoteFormState);

dateInput.addEventListener("change", (event) => {
  if (!event.target.value) {
    return;
  }
  state.workoutFlow.date = event.target.value;
});

document.querySelectorAll(".counter-btn").forEach((button) => {
  preventTapFocusShift(button);
  button.addEventListener("click", () => {
    const counter = button.dataset.counter;
    const direction = Number(button.dataset.direction);
    const key = counter === "sets" ? "sets" : "reps";
    const next = Math.max(1, Number(state.workoutFlow.draft[key] || 1) + direction);
    state.workoutFlow.draft[key] = next;
    renderDraftCounters();
  });
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

faqSearch.addEventListener("input", (event) => {
  state.faqQuery = event.target.value.trim().toLowerCase();
  renderFaq();
});

registerEnterFieldBehavior(faqSearch, {
  submit: () => {
    state.faqQuery = faqSearch.value.trim().toLowerCase();
    renderFaq();
    return true;
  },
});
registerEnterFieldBehavior(workoutNameInput);
registerEnterFieldBehavior(exerciseNameInput);
registerEnterFieldBehavior(exerciseWeightInput);
registerEnterFieldBehavior(dateInput, {
  submit: () => {
    if (dateInput?.value) {
      state.workoutFlow.date = dateInput.value;
    }
    return true;
  },
});
registerEnterFieldBehavior(wellbeingNoteInput);
registerEnterFieldBehavior(recordExerciseInput);
registerEnterFieldBehavior(recordWeightInput);
registerEnterFieldBehavior(recordDateInput);
recordWeightInput?.addEventListener("change", syncRecordWeightDisplay);
recordWeightInput?.addEventListener("input", syncRecordWeightDisplay);
recordDateInput?.addEventListener("change", syncRecordDateDisplay);
recordDateInput?.addEventListener("input", syncRecordDateDisplay);
syncRecordWeightDisplay();
syncRecordDateDisplay();
registerEnterFieldBehavior(quoteInput, {
  submit: () => {
    quoteInput.classList.remove("is-invalid");
    updateQuoteFormState();
    return true;
  },
});
registerEnterFieldBehavior(quoteAuthorInput, {
  submit: () => {
    updateQuoteFormState();
    return true;
  },
});
registerEnterFieldBehavior(profileEditNameInput);
registerEnterFieldBehavior(profileEditWeightInput);
registerEnterFieldBehavior(profileEditHeightInput);
registerEnterFieldBehavior(profileEditExperienceInput);

document.addEventListener(
  "keydown",
  (event) => {
    void handleEnterFieldKeydown(event);
  },
  true
);

syncQuoteLoop();

bootstrap().catch((error) => {
  console.error(error);
  showToast(`Не удалось загрузить Mini App: ${error.message || "unknown error"}`);
});

async function bootstrap() {
  requestAnimationFrame(() => {
    syncViewportHeight(true);
    syncNavPillPosition(state.activeTab, true);
  });
  setTimeout(() => syncViewportHeight(true), 150);
  setTimeout(() => syncViewportHeight(true), 500);

  const userId = resolveUserId();
  if (!userId) {
    showToast("Не удалось определить пользователя");
    return;
  }
  state.userId = userId;
  // Рисуем avatar сразу по данным Telegram, чтобы верхняя шапка не была пустой до ответа API.
  renderTelegramAvatar();
  state.userQuotes = loadCustomQuotes();
  renderQuotesSection({ resetLoop: true });

  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    let message = "";
    try {
      const errorPayload = await response.json();
      message = errorPayload?.error ? `: ${errorPayload.error}` : "";
    } catch (error) {
      message = "";
    }
    throw new Error(`api/app-data ${response.status}${message}`);
  }

  let payload = {};
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("invalid app-data json");
  }
  state.payload = payload;
  // После загрузки payload уточняем fallback-букву уже с учётом имени из профиля.
  renderTelegramAvatar(payload.user || null);

  if (!payload.ready) {
    document.getElementById("profile-name").textContent = "Нет данных";
    document.getElementById("weight-value").textContent = "—";
    document.getElementById("height-value").textContent = "—";
    document.getElementById("experience-value").textContent = "—";
    document.getElementById("workouts-value").textContent = "0";
    syncUserLevelWidget({});
    document.getElementById("history-list").innerHTML = emptyCard(payload.message || "Сначала открой бота и заполни профиль.");
    document.getElementById("records-list").innerHTML = emptyCard("Рекорды появятся после первых тренировок.");
    switchTab("home");
    return;
  }

  renderApp(payload);
}

function renderApp(payload) {
  renderProfile(payload.user);
  renderHistory(payload.history);
  renderRecords(payload.records);
  renderFaqTabs(payload.faq);
  renderFaq();
  state.workoutFlow.items = convertHistoryToDraft(payload.history[0]);
  renderWorkoutFlow();
  renderQuotesSection();
}

function resolveUserId() {
  const params = new URLSearchParams(window.location.search);
  const queryUserId = params.get("user_id");
  if (queryUserId) {
    return queryUserId;
  }
  const tgUserId = telegram?.initDataUnsafe?.user?.id;
  return tgUserId ? String(tgUserId) : "";
}

// Если фото Telegram недоступно, используем первую букву имени как безопасный fallback.
function avatarFallbackLetter(profileUser = null) {
  const telegramUser = telegram?.initDataUnsafe?.user;
  const candidate = String(
    telegramUser?.first_name ||
      telegramUser?.username ||
      profileUser?.name ||
      "U"
  ).trim();

  return (candidate[0] || "U").toUpperCase();
}

// Аватар читаем из payload Telegram/бота и откатываемся к буквенной заглушке при любом сбое.
function renderTelegramAvatar(profileUser = null) {
  if (!topbarAvatar || !topbarAvatarFallback) {
    return;
  }

  const telegramUser = telegram?.initDataUnsafe?.user;
  const photoUrl = String(
    profileUser?.avatar_url || telegramUser?.photo_url || ""
  ).trim();

  topbarAvatarFallback.textContent = avatarFallbackLetter(profileUser);
  topbarAvatarFallback.hidden = false;

  // В privacy-сценарии Telegram может не прислать фото, поэтому прячем img и оставляем fallback.
  if (!photoUrl) {
    topbarAvatar.hidden = true;
    topbarAvatar.removeAttribute("src");
    topbarAvatar.onload = null;
    topbarAvatar.onerror = null;
    return;
  }

  // Скрываем fallback только после успешной загрузки изображения; при ошибке возвращаем заглушку.
  topbarAvatar.onload = () => {
    topbarAvatarFallback.hidden = true;
  };
  topbarAvatar.onerror = () => {
    topbarAvatar.hidden = true;
    topbarAvatar.removeAttribute("src");
    topbarAvatarFallback.hidden = false;
  };
  topbarAvatar.src = photoUrl;
  topbarAvatar.hidden = false;
}

function normalizeWorkoutCountForLevelWidget(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

function syncUserLevelWidget(profileUser = {}) {
  const userLevelRoots = document.querySelectorAll("[data-user-level-widget]");
  const levelPayload = {
    workoutCount: normalizeWorkoutCountForLevelWidget(profileUser.workout_days ?? 0),
    userName: String(profileUser.name || "").trim(),
  };

  window.__USER_LEVEL_WIDGET_PROFILE__ = levelPayload;

  userLevelRoots.forEach((rootNode) => {
    rootNode.dataset.workoutCount = String(levelPayload.workoutCount);
    rootNode.dataset.userName = levelPayload.userName;
  });

  if (typeof window.dispatchEvent === "function" && typeof window.CustomEvent === "function") {
    window.dispatchEvent(new window.CustomEvent("user-level:sync", { detail: levelPayload }));
  }
}

function renderProfile(user) {
  // Поля профиля больше не живут на отдельной вкладке: они обновляют summary-overlay, открываемый по аватару.
  document.getElementById("profile-name").textContent = user.name || "Пользователь";
  document.getElementById("weight-value").textContent = user.weight ? `${user.weight} кг` : "—";
  document.getElementById("height-value").textContent = user.height ? `${user.height} см` : "—";
  document.getElementById("experience-value").textContent = user.experience || "—";
  document.getElementById("workouts-value").textContent = String(user.workout_days ?? 0);
  syncUserLevelWidget(user);
}

function renderHistory(history, options = {}) {
  const { animate = true } = options;
  // История тренировок теперь рендерится в Home-секцию, но id контейнера оставлен прежним для переиспользования логики.
  const root = document.getElementById("history-list");
  root.innerHTML = "";
  updateHistoryManageControls();

  if (!history.length) {
    state.selectedWorkoutSessions.clear();
    disableHistoryManageMode(true);
    updateHistoryManageControls();
    root.innerHTML = emptyCard("Пока нет тренировок.");
    return;
  }

  history.forEach((day, index) => {
    const title = day.workout_name || trainingDayTitle(index);
    const sessionKey = day.session_key || `legacy:${day.date}`;
    const isSelected = state.selectedWorkoutSessions.has(sessionKey);
    const noteBlock = day.note
      ? `<div class="history-note" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}">${escapeHtml(day.note)}</div>`
      : "";
    const rows = day.exercises
      .map(
        (item) => `
          <div class="exercise-row">
            <span>${escapeHtml(item.exercise)}</span>
            <span>${item.weight} кг · ${item.sets || 1}×${item.reps}</span>
          </div>
        `
      )
      .join("");

    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="history-card${state.historyEditMode && isSelected ? " selected" : ""}" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}">
          <div class="history-head">
            <div class="history-main" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}">
              ${state.historyEditMode ? `<span class="history-select-indicator">${isSelected ? "✓" : ""}</span>` : ""}
              ${escapeHtml(title)}
            </div>
            <div class="history-head-right">
              <div class="history-date">${formatDate(day.date)}</div>
              <button class="history-edit-btn" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}" type="button" aria-label="Изменить тренировку"${state.historyEditMode ? " hidden" : ""}>
                <i class='bx bx-cog'></i>
              </button>
            </div>
          </div>
          <div class="exercise-list">${rows}</div>
          ${noteBlock}
        </article>
      `
    );
  });

  root.querySelectorAll(".history-edit-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (state.historyEditMode) {
        return;
      }
      openEditWorkoutFlow(button.dataset.sessionKey || "", button.dataset.date || "");
    });
  });
  root.querySelectorAll(".history-card[data-session-key]").forEach((card) => {
    card.addEventListener("click", () => {
      if (!state.historyEditMode) {
        return;
      }
      const key = card.dataset.sessionKey || "";
      if (!key) {
        return;
      }
      toggleHistoryWorkoutSelection(key);
    });
  });
  if (!state.historyEditMode) {
    root.querySelectorAll(".history-note[data-date][data-session-key]").forEach((noteNode) => {
      attachLongPress(noteNode, 100, () => {
        void promptEditWorkoutComment(noteNode.dataset.sessionKey || "", noteNode.dataset.date || "");
      });
    });
    root.querySelectorAll(".history-main[data-date][data-session-key]").forEach((titleNode) => {
      const card = titleNode.closest(".history-card");
      attachLongPress(titleNode, 200, () => {
        triggerHaptic("selection");
        if (card) {
          card.classList.add("focus-edit");
        }
        promptEditWorkoutTitle(titleNode.dataset.sessionKey || "", titleNode.dataset.date || "").finally(() => {
          if (card) {
            card.classList.remove("focus-edit");
          }
        });
      });
    });
  }
  if (animate) {
    animateCollection(root, ".history-card");
    animateExerciseRows(root);
  }
}

function toggleHistoryManageMode() {
  state.historyEditMode = !state.historyEditMode;
  if (!state.historyEditMode) {
    state.selectedWorkoutSessions.clear();
  }
  preserveContentScroll(() => {
    renderHistory(state.payload?.history || [], { animate: false });
  });
}

function disableHistoryManageMode(silent = false) {
  state.historyEditMode = false;
  state.selectedWorkoutSessions.clear();
  if (!silent) {
    preserveContentScroll(() => {
      renderHistory(state.payload?.history || [], { animate: false });
    });
  }
}

function toggleHistoryWorkoutSelection(sessionKey) {
  if (!sessionKey) {
    return;
  }

  const wasSelected = state.selectedWorkoutSessions.has(sessionKey);
  if (wasSelected) {
    state.selectedWorkoutSessions.delete(sessionKey);
  } else {
    state.selectedWorkoutSessions.add(sessionKey);
  }

  const cards = document.querySelectorAll(`.history-card[data-session-key="${escapeSelectorValue(sessionKey)}"]`);
  cards.forEach((card) => {
    card.classList.toggle("selected", !wasSelected);
    const indicator = card.querySelector(".history-select-indicator");
    if (indicator) {
      indicator.textContent = !wasSelected ? "✓" : "";
    }
  });

  updateHistoryManageControls();
}

function updateHistoryManageControls() {
  if (!historyManageToggle || !historyBulkActions) {
    return;
  }
  historyManageToggle.classList.toggle("is-text-mode", state.historyEditMode);
  historyManageToggle.setAttribute(
    "aria-label",
    state.historyEditMode ? "Завершить редактирование истории тренировок" : "Изменить историю тренировок"
  );
  historyManageToggle.innerHTML = state.historyEditMode ? "Готово" : "<i class='bx bx-cog'></i>";
  historyBulkActions.hidden = !state.historyEditMode;

  if (historyDeleteSelectedBtn) {
    historyDeleteSelectedBtn.disabled = state.selectedWorkoutSessions.size === 0;
  }
}

async function deleteSelectedHistoryWorkouts() {
  if (!state.historyEditMode || state.selectedWorkoutSessions.size === 0) {
    return;
  }
  const confirmed = window.confirm(
    `Удалить выбранные тренировки: ${state.selectedWorkoutSessions.size} шт.?`
  );
  if (!confirmed) {
    return;
  }

  const keys = [...state.selectedWorkoutSessions];
  let deleted = 0;
  for (const key of keys) {
    try {
      const response = await fetch("/api/workouts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(state.userId),
          session_key: key,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && result.ok) {
        deleted += 1;
      }
    } catch (error) {
      console.error(error);
    }
  }

  await refreshAppDataStable();
  disableHistoryManageMode(true);
  renderHistory(state.payload?.history || []);
  showToast(deleted > 0 ? `Удалено тренировок: ${deleted}` : "Не удалось удалить выбранные тренировки");
}

async function deleteAllHistoryWorkouts() {
  if (!state.historyEditMode) {
    return;
  }
  const count = (state.payload?.history || []).length;
  const confirmed = window.confirm(`Удалить все тренировки (${count})?`);
  if (!confirmed) {
    return;
  }

  try {
    const response = await fetch("/api/workouts/all", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: Number(state.userId),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to delete all workouts");
    }

    await refreshAppDataStable();
    disableHistoryManageMode(true);
    renderHistory(state.payload?.history || []);
    showToast("Все тренировки удалены");
  } catch (error) {
    console.error(error);
    showToast("Не удалось удалить все тренировки");
  }
}

function renderRecords(records, options = {}) {
  const { animate = true } = options;
  const root = document.getElementById("records-list");
  updateRecordsManageControls();
  root.innerHTML = "";

  if (!records.length) {
    state.recordsEditMode = false;
    state.selectedRecordExercises.clear();
    updateRecordsManageControls();
    root.innerHTML = emptyCard("Рекордов пока нет.");
    return;
  }

  records.forEach((record, index) => {
    const exerciseKey = String(record.exercise || "");
    const isSelected = state.selectedRecordExercises.has(exerciseKey);
    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="record-card${index === 0 ? " highlight" : ""}${state.recordsEditMode && isSelected ? " selected" : ""}" data-exercise="${escapeHtml(exerciseKey)}">
          <div class="record-main">
            <div>
              <div class="record-title-row">
                ${state.recordsEditMode ? `<span class="history-select-indicator">${isSelected ? "✓" : ""}</span>` : ""}
                <div class="record-title">${escapeHtml(record.exercise)}</div>
              </div>
              <div class="record-date">${record.date ? formatDate(record.date) : "последний лучший результат"}</div>
            </div>
            <div class="record-weight">${record.best_weight} кг</div>
          </div>
        </article>
      `
    );
  });

  root.querySelectorAll(".record-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (!state.recordsEditMode) {
        return;
      }
      const exercise = decodeHtml(card.dataset.exercise || "");
      if (!exercise) {
        return;
      }
      toggleRecordSelection(exercise);
    });
  });
  if (animate) {
    animateCollection(root, ".record-card");
  }
}

function toggleRecordsManageMode() {
  state.recordsEditMode = !state.recordsEditMode;
  if (!state.recordsEditMode) {
    state.selectedRecordExercises.clear();
  }
  preserveContentScroll(() => {
    renderRecords(state.payload?.records || [], { animate: false });
  });
}

function disableRecordsManageMode() {
  state.recordsEditMode = false;
  state.selectedRecordExercises.clear();
  preserveContentScroll(() => {
    renderRecords(state.payload?.records || [], { animate: false });
  });
}

function toggleRecordSelection(exercise) {
  if (!exercise) {
    return;
  }
  const wasSelected = state.selectedRecordExercises.has(exercise);
  if (wasSelected) {
    state.selectedRecordExercises.delete(exercise);
  } else {
    state.selectedRecordExercises.add(exercise);
  }

  const cards = document.querySelectorAll(`.record-card[data-exercise="${escapeSelectorValue(exercise)}"]`);
  cards.forEach((card) => {
    card.classList.toggle("selected", !wasSelected);
    const indicator = card.querySelector(".history-select-indicator");
    if (indicator) {
      indicator.textContent = !wasSelected ? "✓" : "";
    }
  });

  updateRecordsManageControls();
}

function updateRecordsManageControls() {
  removeRecordBtn?.classList.toggle("active-tool", state.recordsEditMode);
  if (removeRecordBtn) {
    removeRecordBtn.textContent = state.recordsEditMode ? "Готово" : "Изменить";
  }
  if (recordsBulkActions) {
    recordsBulkActions.hidden = !state.recordsEditMode;
  }
  if (recordsDeleteSelectedBtn) {
    recordsDeleteSelectedBtn.disabled = state.selectedRecordExercises.size === 0;
  }
}

function renderFaqTabs(faqData) {
  faqTabs.innerHTML = "";
  Object.keys(faqData).forEach((key) => {
    const button = document.createElement("button");
    button.className = `chip${key === state.faqCategory ? " active" : ""}`;
    button.type = "button";
    button.textContent = faqTitle(key);
    button.addEventListener("click", () => {
      state.faqCategory = key;
      renderFaqTabs(faqData);
      renderFaq();
    });
    faqTabs.appendChild(button);
  });
}

function renderFaq() {
  const faqData = state.payload?.faq || {};
  const items = faqData[state.faqCategory] || [];
  const filtered = items.filter((item) => {
    if (!state.faqQuery) {
      return true;
    }
    const fullText = `${item.question} ${item.answer}`.toLowerCase();
    return fullText.includes(state.faqQuery);
  });

  faqList.innerHTML = "";
  if (!filtered.length) {
    faqList.innerHTML = emptyCard("Ничего не найдено.");
    return;
  }

  filtered.forEach((item, index) => {
    faqList.insertAdjacentHTML(
      "beforeend",
      `
        <details class="faq-card"${index === 0 ? " open" : ""}>
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>
      `
    );
  });
  animateCollection(faqList, ".faq-card");
}

function switchTab(tab) {
  if (!tab || state.activeTab === tab) {
    return;
  }
  if (state.activeTab === "home" && tab !== "home" && state.historyEditMode) {
    disableHistoryManageMode(true);
  }
  if (state.activeTab === "records" && tab !== "records" && state.recordsEditMode) {
    state.recordsEditMode = false;
    state.selectedRecordExercises.clear();
  }
  state.activeTab = tab;
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  syncNavPillPosition(tab, false);
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  document.getElementById("screen-title").textContent = titleForTab(tab);
  if (tab === "records") {
    renderRecords(state.payload?.records || [], { animate: false });
  }
  if (tab === "home") {
    renderQuotesSection();
    renderHistory(state.payload?.history || [], { animate: false });
  }
  syncQuoteLoop();
  animatePanelEnter(tab);
}

function openQuoteOverlay() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }
  setQuoteEditorMode("create");
  freezeViewportFor(280);
  state.quoteOverlayOpen = true;
  fillQuoteOverlayForm();
  renderQuoteLibrary();
  setBodyScrollLock(true);
  quoteOverlay.hidden = false;
  runMotion(quoteOverlay, { opacity: [0, 1] }, { duration: 0.18, easing: "ease-out" });
  runMotion(
    quoteModal,
    { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
  requestAnimationFrame(() => {
    focusWithoutScroll(quoteInput);
  });
}

function closeQuoteOverlay() {
  if (!quoteOverlay || quoteOverlay.hidden) {
    return;
  }
  blurActiveFieldInside(quoteOverlay);
  finishQuoteReorder();
  state.quoteOverlayOpen = false;
  setQuoteEditorMode("create");
  freezeViewportFor(320);
  const overlayAnimation = runMotion(quoteOverlay, { opacity: [1, 0] }, { duration: 0.14, easing: "ease-out" });
  const modalAnimation = runMotion(
    quoteModal,
    { opacity: [1, 0.75], transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"] },
    { duration: 0.16, easing: "ease-in" }
  );
  if (overlayAnimation?.finished) {
    overlayAnimation.finished.catch(() => undefined);
  }
  if (modalAnimation?.finished) {
    modalAnimation.finished.catch(() => undefined);
  }
  setTimeout(() => {
    quoteOverlay.hidden = true;
    setBodyScrollLock(false);
  }, 170);
}

function hasVisibleBlockingOverlay() {
  return [overlay, recordOverlay, quoteOverlay, myDataOverlay, profileOverlay, confirmOverlay].some(
    (node) => node && !node.hidden
  );
}

function updateBodyScrollLockFromVisibleOverlays() {
  setBodyScrollLock(hasVisibleBlockingOverlay());
}

// Блок "Мои данные" больше не живёт на отдельном экране: аватар открывает этот summary-overlay.
function openMyDataOverlay() {
  if (!myDataOverlay || !myDataModal) {
    return;
  }
  freezeViewportFor(280);
  state.myDataOverlayOpen = true;
  setBodyScrollLock(true);
  myDataOverlay.hidden = false;
  runMotion(myDataOverlay, { opacity: [0, 1] }, { duration: 0.18, easing: "ease-out" });
  runMotion(
    myDataModal,
    { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
}

function closeMyDataOverlay() {
  if (!myDataOverlay || myDataOverlay.hidden) {
    return;
  }
  state.myDataOverlayOpen = false;
  freezeViewportFor(320);
  const overlayAnimation = runMotion(myDataOverlay, { opacity: [1, 0] }, { duration: 0.14, easing: "ease-out" });
  const modalAnimation = runMotion(
    myDataModal,
    { opacity: [1, 0.75], transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"] },
    { duration: 0.16, easing: "ease-in" }
  );
  if (overlayAnimation?.finished) {
    overlayAnimation.finished.catch(() => undefined);
  }
  if (modalAnimation?.finished) {
    modalAnimation.finished.catch(() => undefined);
  }
  setTimeout(() => {
    myDataOverlay.hidden = true;
    updateBodyScrollLockFromVisibleOverlays();
  }, 170);
}

function openProfileEditorFromMyData() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }
  if (myDataOverlay && !myDataOverlay.hidden) {
    state.myDataOverlayOpen = false;
    myDataOverlay.hidden = true;
  }
  openProfileOverlay();
}

function closeConfirmOverlayWithResult(confirmed) {
  if (!confirmOverlay || confirmOverlay.hidden) {
    if (confirmResolver) {
      const resolver = confirmResolver;
      confirmResolver = null;
      resolver(Boolean(confirmed));
    }
    return;
  }

  state.confirmOverlayOpen = false;
  const resolver = confirmResolver;
  confirmResolver = null;

  const overlayAnimation = runMotion(confirmOverlay, { opacity: [1, 0] }, { duration: 0.14, easing: "ease-out" });
  const modalAnimation = runMotion(
    confirmModal,
    { opacity: [1, 0.75], transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"] },
    { duration: 0.16, easing: "ease-in" }
  );
  if (overlayAnimation?.finished) {
    overlayAnimation.finished.catch(() => undefined);
  }
  if (modalAnimation?.finished) {
    modalAnimation.finished.catch(() => undefined);
  }
  setTimeout(() => {
    confirmOverlay.hidden = true;
    updateBodyScrollLockFromVisibleOverlays();
    if (resolver) {
      resolver(Boolean(confirmed));
    }
  }, 170);
}

function cancelDeleteConfirmation() {
  closeConfirmOverlayWithResult(false);
}

function approveDeleteConfirmation() {
  closeConfirmOverlayWithResult(true);
}

function fillProfileOverlayForm() {
  const user = state.payload?.user || {};
  profileEditNameInput.value = user.name || "";
  profileEditWeightInput.value = user.weight ? String(user.weight).replace(",", ".") : "";
  profileEditHeightInput.value = user.height ? String(user.height).replace(",", ".") : "";
  profileEditExperienceInput.value = user.experience && user.experience !== "Не заполнено" ? String(user.experience) : "";
}

function openProfileOverlay() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }
  freezeViewportFor(280);
  state.profileOverlayOpen = true;
  fillProfileOverlayForm();
  setBodyScrollLock(true);
  profileOverlay.hidden = false;
  runMotion(profileOverlay, { opacity: [0, 1] }, { duration: 0.18, easing: "ease-out" });
  runMotion(
    profileModal,
    { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
  requestAnimationFrame(() => {
    focusWithoutScroll(profileEditNameInput);
  });
}

function closeProfileOverlay() {
  if (!profileOverlay || profileOverlay.hidden) {
    return;
  }
  blurActiveFieldInside(profileOverlay);
  state.profileOverlayOpen = false;
  freezeViewportFor(320);
  const overlayAnimation = runMotion(profileOverlay, { opacity: [1, 0] }, { duration: 0.14, easing: "ease-out" });
  const modalAnimation = runMotion(
    profileModal,
    { opacity: [1, 0.75], transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"] },
    { duration: 0.16, easing: "ease-in" }
  );
  if (overlayAnimation?.finished) {
    overlayAnimation.finished.catch(() => undefined);
  }
  if (modalAnimation?.finished) {
    modalAnimation.finished.catch(() => undefined);
  }
  setTimeout(() => {
    profileOverlay.hidden = true;
    setBodyScrollLock(false);
  }, 170);
}

async function saveProfileOverlay() {
  blurActiveField();
  if (profileSaving || !state.userId) {
    return false;
  }

  const name = String(profileEditNameInput?.value || "").trim();
  const weight = Number(String(profileEditWeightInput?.value || "").replace(",", "."));
  const height = Number(String(profileEditHeightInput?.value || "").replace(",", "."));
  const experience = String(profileEditExperienceInput?.value || "").trim();

  if (!name) {
    showToast("Введите имя");
    focusWithoutScroll(profileEditNameInput);
    return false;
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    showToast("Введите корректный вес");
    focusWithoutScroll(profileEditWeightInput);
    return false;
  }
  if (!Number.isFinite(height) || height <= 0) {
    showToast("Введите корректный рост");
    focusWithoutScroll(profileEditHeightInput);
    return false;
  }
  try {
    profileSaving = true;
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        name,
        weight,
        height,
        experience,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to update profile");
    }
    triggerHaptic("success");
    closeProfileOverlay();
    showToast("Профиль обновлён");
    await refreshAppDataStable();
    return true;
  } catch (error) {
    console.error(error);
    showToast("Не удалось обновить профиль");
    return false;
  } finally {
    profileSaving = false;
  }
}

async function clearProfileData() {
  if (profileSaving || !state.userId) {
    return;
  }
  const confirmed = window.confirm("Очистить профиль, историю тренировок и рекорды?");
  if (!confirmed) {
    return;
  }

  try {
    profileSaving = true;
    const response = await fetch("/api/profile", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to clear profile");
    }
    triggerHaptic("warning");
    closeProfileOverlay();
    showToast("Все данные очищены");
    await refreshAppDataStable();
  } catch (error) {
    console.error(error);
    showToast("Не удалось очистить данные");
  } finally {
    profileSaving = false;
  }
}

async function saveCustomQuote() {
  blurActiveField();
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return false;
  }

  const text = String(quoteInput?.value || "").trim();
  const author = String(quoteAuthorInput?.value || "").trim();
  const isEditing = state.quoteEditor?.mode === "edit";
  const editingIndex = currentEditableQuoteIndex();

  if (!text) {
    if (quoteInput) {
      quoteInput.classList.add("is-invalid");
      focusWithoutScroll(quoteInput);
    }
    updateQuoteFormState();
    showToast("Введите текст цитаты");
    return false;
  }
  if (!isEditing && state.userQuotes.length >= MAX_CUSTOM_QUOTES) {
    showToast(`Можно сохранить максимум ${MAX_CUSTOM_QUOTES} цитат`);
    updateQuoteFormState();
    return false;
  }

  if (isEditing && editingIndex >= 0 && state.userQuotes[editingIndex]) {
    const nextQuotes = [...state.userQuotes];
    nextQuotes[editingIndex] = { text, author };
    persistCustomQuotes(nextQuotes);
  } else {
    persistCustomQuotes([...state.userQuotes, { text, author }]);
  }
  renderQuotesSection({ resetLoop: true });
  triggerHaptic("success");
  setQuoteEditorMode("create");
  resetQuoteForm();
  renderQuoteLibrary();
  focusWithoutScroll(quoteInput);
  showToast(isEditing ? "Цитата обновлена" : "Цитата добавлена");
  return true;
}

function deleteCustomQuote(index) {
  if (!Number.isInteger(index) || !state.userQuotes[index]) {
    return;
  }
  const nextQuotes = state.userQuotes.filter((_, quoteIndex) => quoteIndex !== index);
  persistCustomQuotes(nextQuotes);
  syncQuoteEditorAfterDelete();
  renderQuotesSection({ resetLoop: true });
  updateQuoteFormState();
  triggerHaptic("selection");
  showToast("Цитата удалена");
}

async function deleteQuoteFromOverlay() {
  const index = currentEditableQuoteIndex();
  if (index < 0 || !state.userQuotes[index]) {
    return;
  }
  const quote = state.userQuotes[index];
  const text = String(quote?.text || "").trim();
  const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
  const confirmed = window.confirm(
    preview ? `Удалить цитату?\n\n"${preview}"` : "Удалить текущую пользовательскую цитату?"
  );
  if (!confirmed) {
    return;
  }
  deleteCustomQuote(index);
}

function syncNavPillPosition(tab, immediate) {
  if (!bottomNav || !navPill) {
    return;
  }
  if (window.getComputedStyle(navPill).display === "none") {
    return;
  }
  const activeButton = navButtons.find((button) => button.dataset.tab === tab);
  if (!activeButton) {
    return;
  }

  const navRect = bottomNav.getBoundingClientRect();
  const btnRect = activeButton.getBoundingClientRect();
  const x = btnRect.left - navRect.left;

  navPill.style.width = `${btnRect.width}px`;
  if (immediate) {
    navPill.style.transition = "none";
    navPill.style.transform = `translateX(${x}px)`;
    void navPill.offsetWidth;
    navPill.style.transition = "";
    return;
  }

  navPill.style.transform = `translateX(${x}px)`;
}

function titleForTab(tab) {
  if (tab === "records") return "Рекорды";
  if (tab === "faq") return "Вопросы";
  return "Главная";
}


function previousWorkoutStep(step) {
  if (step === "form") return "list";
  if (step === "comment") return "list";
  if (step === "date") return "comment";
  return "";
}




async function openWorkoutFlow() {
  if (state.workoutFlow.open || workoutFlowTransitioning || !overlay || !workoutModal) {
    return false;
  }
  workoutFlowTransitioning = true;
  state.workoutFlow.open = true;
  freezeViewportFor(280);
  resetWorkoutFlowForNewEntry();
  setBodyScrollLock(true);
  resetMotionState(overlay, workoutModal);
  resetScrollableOverlayState(overlay, workoutModal);
  overlay.hidden = false;
  const { overlayAnimation, modalAnimation } = animateModalOpen();
  renderWorkoutFlow();
  resetScrollableOverlayState(overlay, workoutModal);
  syncTelegramBottomButtons();
  await waitForMotionFinish(overlayAnimation, modalAnimation);
  workoutFlowTransitioning = false;
  return true;
}

async function closeWorkoutFlow() {
  if (!state.workoutFlow.open || workoutFlowTransitioning || !overlay || !workoutModal) {
    return false;
  }
  workoutFlowTransitioning = true;
  blurActiveFieldInside(overlay);
  freezeViewportFor(320);
  state.workoutFlow.open = false;
  lastWorkoutStep = "";
  const overlayAnimation = runMotion(
    overlay,
    { opacity: [1, 0] },
    { duration: 0.16, easing: "ease-out" }
  );
  const modalAnimation = runMotion(
    workoutModal,
    {
      opacity: [1, 0.6],
      transform: ["translateY(0px) scale(1)", "translateY(18px) scale(0.98)"],
    },
    { duration: 0.18, easing: "ease-in" }
  );
  await waitForMotionFinish(overlayAnimation, modalAnimation);
  overlay.hidden = true;
  resetMotionState(overlay, workoutModal);
  resetScrollableOverlayState(overlay, workoutModal);
  setBodyScrollLock(false);
  restoreViewportAfterOverlayTransition();
  syncTelegramBottomButtons();
  workoutFlowTransitioning = false;
  return true;
}

function setWorkoutStep(step) {
  state.workoutFlow.step = step;
  renderWorkoutFlow();
}

function openDraftFormForCreate() {
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
  setWorkoutStep("form");
}

function openEditWorkoutFlow(sourceSessionKey, sourceDate = "") {
  if (state.workoutFlow.open || workoutFlowTransitioning || !overlay || !workoutModal) {
    return;
  }
  const day = findWorkoutEntry(sourceSessionKey, sourceDate);
  if (!day) {
    showToast("Не удалось открыть тренировку для редактирования");
    return;
  }

  workoutFlowTransitioning = true;
  state.workoutFlow.open = true;
  state.workoutFlow.mode = "edit";
  state.workoutFlow.sourceDate = day.date || sourceDate;
  state.workoutFlow.sourceSessionKey = day.session_key || sourceSessionKey;
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.step = "list";
  state.workoutFlow.items = convertHistoryToDraft(day);
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.date = day.date || sourceDate;
  state.workoutFlow.saving = false;
  freezeViewportFor(280);
  if (wellbeingNoteInput) {
    wellbeingNoteInput.value = day.note || "";
  }
  workoutNameInput.value = day.workout_name || "";
  setBodyScrollLock(true);
  resetMotionState(overlay, workoutModal);
  resetScrollableOverlayState(overlay, workoutModal);
  overlay.hidden = false;
  const { overlayAnimation, modalAnimation } = animateModalOpen();
  renderWorkoutFlow();
  resetScrollableOverlayState(overlay, workoutModal);
  syncTelegramBottomButtons();
  waitForMotionFinish(overlayAnimation, modalAnimation).finally(() => {
    workoutFlowTransitioning = false;
  });
}

function resetWorkoutFlowForNewEntry() {
  state.workoutFlow.mode = "create";
  state.workoutFlow.sourceDate = "";
  state.workoutFlow.sourceSessionKey = "";
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.items = [];
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.step = "list";
  state.workoutFlow.date = todayValue();
  state.workoutFlow.saving = false;
  lastWorkoutStep = "";

  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
  if (wellbeingNoteInput) {
    wellbeingNoteInput.value = "";
  }
  workoutNameInput.value = "";
}

function saveDraftItem() {
  const nameInput = exerciseNameInput;
  const weightInput = exerciseWeightInput;
  if (!nameInput || !weightInput) {
    return false;
  }
  const name = nameInput.value.trim();
  const weight = Number(weightInput.value);

  if (!name) {
    showToast("Введи название упражнения");
    focusWithoutScroll(nameInput);
    return false;
  }

  const nextItem = {
    exercise: name,
    weight: Number.isFinite(weight) && weight > 0 ? weight.toFixed(1) : "0.0",
    sets: state.workoutFlow.draft.sets,
    reps: state.workoutFlow.draft.reps,
  };

  if (state.workoutFlow.editingIndex === null) {
    state.workoutFlow.items.push(nextItem);
  } else if (state.workoutFlow.items[state.workoutFlow.editingIndex]) {
    state.workoutFlow.items[state.workoutFlow.editingIndex] = nextItem;
  }

  nameInput.value = "";
  weightInput.value = "";
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.step = "list";
  renderWorkoutFlow();
  return true;
}

async function handleSaveFlowButton() {
  blurActiveField();
  if (state.workoutFlow.step === "list") {
    if (!state.workoutFlow.items.length) {
      showToast("Сначала добавь хотя бы одно упражнение");
      return false;
    }
    state.workoutFlow.step = "comment";
    renderWorkoutFlow();
    return true;
  }

  if (state.workoutFlow.step === "comment") {
    state.workoutFlow.step = "date";
    renderWorkoutFlow();
    return true;
  }

  if (state.workoutFlow.step === "date") {
    return submitWorkoutFlow();
  }

  if (state.workoutFlow.step === "done") {
    closeWorkoutFlow();
    return true;
  }

  return false;
}

function renderWorkoutFlow() {
  if (!state.workoutFlow.open) {
    syncTelegramBottomButtons();
    return;
  }

  const step = state.workoutFlow.step;
  modalSteps.forEach((node) => node.classList.toggle("active", node.dataset.step === step));
  if (lastWorkoutStep !== step) {
    animateWorkoutStep(step);
    lastWorkoutStep = step;
  }
  modalTitle.textContent = workoutTitle(step);

  const saveButton = document.getElementById("save-workout-flow");
  if (saveButton) {
    saveButton.hidden = true;
    saveButton.innerHTML = saveButtonLabel(step, state.workoutFlow.saving);
    saveButton.disabled = true;
  }
  deleteWorkoutDayBtn.hidden = !(state.workoutFlow.mode === "edit" && step === "list");
  deleteWorkoutDayBtn.disabled = state.workoutFlow.saving;
  if (step === "list") {
    renderDraftList();
  }
  if (step === "comment" && wellbeingNoteInput) {
    requestAnimationFrame(() => {
      focusWithoutScroll(wellbeingNoteInput);
    });
  }
  renderDraftCounters();
  if (dateInput.value !== state.workoutFlow.date) {
    dateInput.value = state.workoutFlow.date;
  }
  const datePreview = document.getElementById("date-preview");
  if (datePreview) {
    datePreview.textContent = formatDate(state.workoutFlow.date).replaceAll(".", " ");
  }
  document.getElementById("saved-summary").textContent =
    `Сохранено упражнений: ${state.workoutFlow.items.length}. Дата: ${formatDate(state.workoutFlow.date)}.`;
  syncTelegramBottomButtons();
}

function renderDraftCounters() {
  document.getElementById("sets-value").textContent = String(state.workoutFlow.draft.sets);
  document.getElementById("reps-value").textContent = String(state.workoutFlow.draft.reps);
}

function renderDraftList() {
  const root = document.getElementById("draft-list");
  root.innerHTML = "";


  if (!state.workoutFlow.items.length) {

    return;
  }

  state.workoutFlow.items.forEach((item, index) => {
    root.insertAdjacentHTML(
      "beforeend",
      `
        <div class="draft-item" data-index="${index}" role="button" tabindex="0">
          <div>
            <div class="draft-title">${escapeHtml(item.exercise)}</div>
            <div class="draft-subtitle">${item.weight} кг • ${item.sets} подх. • ${item.reps} повт.</div>
          </div>
          <div class="draft-actions">
            <button class="draft-action-btn" type="button" data-action="edit" data-index="${index}" aria-label="Изменить">
              <i class='bx bx-edit'></i>
            </button>
            <button class="draft-action-btn danger" type="button" data-action="delete" data-index="${index}" aria-label="Удалить">
              <i class='bx bx-trash'></i>
            </button>
          </div>
        </div>
      `
    );
  });

  root.querySelectorAll(".draft-action-btn").forEach((actionBtn) => {
    actionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = Number(actionBtn.dataset.index);
      const action = actionBtn.dataset.action;
      if (!Number.isInteger(index) || !state.workoutFlow.items[index] || !action) {
        return;
      }
      if (action === "delete") {
        removeDraftItem(index);
        return;
      }
      const item = state.workoutFlow.items[index];
      state.workoutFlow.editingIndex = index;
      state.workoutFlow.draft = {
        sets: Number(item.sets) || 1,
        reps: Number(item.reps) || 1,
      };
      document.getElementById("exercise-name-input").value = item.exercise || "";
      document.getElementById("exercise-weight-input").value = item.weight || "";
      setWorkoutStep("form");
    });
  });
  runMotion(
    root.querySelectorAll(".draft-item"),
    {
      opacity: [0, 1],
      transform: ["translateY(12px)", "translateY(0px)"],
    },
    {
      duration: 0.24,
      delay: motionStagger ? motionStagger(0.05) : 0,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

function removeDraftItem(index) {
  if (!state.workoutFlow.items[index]) {
    return;
  }
  state.workoutFlow.items.splice(index, 1);
  if (state.workoutFlow.editingIndex === index) {
    state.workoutFlow.editingIndex = null;
  } else if (state.workoutFlow.editingIndex !== null && state.workoutFlow.editingIndex > index) {
    state.workoutFlow.editingIndex -= 1;
  }
  renderWorkoutFlow();
}

function workoutTitle(step) {
  if (step === "form") {
    return state.workoutFlow.editingIndex === null ? "Параметры упражнения" : "Изменить упражнение";
  }
  if (step === "comment") return "";
  if (step === "date") return "Дата";
  if (step === "done") return "Сохранено";
  if (state.workoutFlow.mode === "edit") return "Изменить тренировку";
  return "Добавить упражнения";
}

function convertHistoryToDraft(day) {
  if (!day) {
    return [];
  }
  return day.exercises.map((item) => ({
    exercise: item.exercise,
    weight: item.weight,
    sets: item.sets || 1,
    reps: item.reps,
  }));
}

function findWorkoutEntry(sessionKey, date = "") {
  const history = state.payload?.history || [];
  if (sessionKey) {
    const bySession = history.find((entry) => (entry.session_key || "") === sessionKey);
    if (bySession) {
      return bySession;
    }
  }
  if (date) {
    return history.find((entry) => entry.date === date) || null;
  }
  return null;
}

function saveButtonLabel(step, saving) {
  if (saving) {
    return "<i class='bx bxs-right-arrow'></i>";
  }
  if (step === "list") {
    return "<i class='bx bxs-right-arrow'></i>";
  }
  if (step === "comment") {
    return "<i class='bx bxs-right-arrow'></i>";
  }
  if (step === "date") {
    return "<i class='bx bxs-right-arrow'></i>";
  }
  return "<i class='bx bxs-right-arrow'></i>";
}

async function submitWorkoutFlow() {
  if (state.workoutFlow.saving) {
    return false;
  }

  state.workoutFlow.saving = true;
  renderWorkoutFlow();

  try {
    const isEditMode =
      state.workoutFlow.mode === "edit" &&
      Boolean(state.workoutFlow.sourceSessionKey || state.workoutFlow.sourceDate);
    const wellbeingNote = (wellbeingNoteInput?.value || "").trim();
    const workoutName = workoutNameInput.value.trim();
    const payload = {
      user_id: Number(state.userId),
      workout_date: state.workoutFlow.date,
      exercises: state.workoutFlow.items.map((item) => ({
        exercise: item.exercise,
        weight: Number(item.weight),
        sets: item.sets,
        reps: item.reps,
      })),
    };
    if (wellbeingNote) {
      payload.wellbeing_note = wellbeingNote;
    }
    if (workoutName) {
      payload.workout_name = workoutName;
    }
    if (isEditMode) {
      payload.source_workout_date = state.workoutFlow.sourceDate;
      payload.source_session_key = state.workoutFlow.sourceSessionKey;
      payload.session_key = state.workoutFlow.sourceSessionKey;
    }

    const response = await fetch("/api/workouts", {
      method: isEditMode ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "save failed");
    }

    await refreshAppData();
    resetWorkoutFlowForNewEntry();
    showToast("Тренировка сохранена. Можно добавить новую");
    renderWorkoutFlow();
    return true;
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить тренировку");
    return false;
  } finally {
    state.workoutFlow.saving = false;
    renderWorkoutFlow();
  }
}

async function promptEditWorkoutComment(sourceSessionKey, sourceDate = "") {
  if (wellbeingNoteSaving) {
    return;
  }
  if (!state.userId || (!sourceSessionKey && !sourceDate)) {
    return;
  }
  triggerHaptic("selection");

  const workoutDay = findWorkoutEntry(sourceSessionKey, sourceDate);
  if (!workoutDay || !Array.isArray(workoutDay.exercises) || !workoutDay.exercises.length) {
    showToast("Тренировка не найдена");
    return;
  }

  const currentNote = String(workoutDay.note || "");
  const nextNoteRaw = window.prompt("Измени комментарий:", currentNote);
  if (nextNoteRaw === null) {
    return;
  }
  const nextNote = nextNoteRaw.trim();
  if (nextNote === currentNote.trim()) {
    return;
  }

  wellbeingNoteSaving = true;
  try {
    const response = await fetch("/api/workouts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        source_session_key: workoutDay.session_key || sourceSessionKey || "",
        source_workout_date: workoutDay.date,
        session_key: workoutDay.session_key || sourceSessionKey || "",
        workout_date: workoutDay.date,
        workout_name: workoutDay.workout_name || "",
        wellbeing_note: nextNote,
        exercises: workoutDay.exercises.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: item.sets,
          reps: item.reps,
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to update comment");
    }

    showToast("Комментарий обновлен");
    await refreshAppDataStable();
  } catch (error) {
    console.error(error);
    showToast("Не удалось обновить комментарий");
  } finally {
    wellbeingNoteSaving = false;
  }
}

async function promptEditWorkoutTitle(sourceSessionKey, sourceDate = "") {
  if (wellbeingNoteSaving) {
    return;
  }
  if (!state.userId || (!sourceSessionKey && !sourceDate)) {
    return;
  }
  triggerHaptic("selection");

  const workoutDay = findWorkoutEntry(sourceSessionKey, sourceDate);
  if (!workoutDay || !Array.isArray(workoutDay.exercises) || !workoutDay.exercises.length) {
    showToast("Тренировка не найдена");
    return;
  }

  const currentName = String(workoutDay.workout_name || "");
  const nextNameRaw = window.prompt("Измени название тренировки:", currentName);
  if (nextNameRaw === null) {
    return;
  }
  const nextName = nextNameRaw.trim();
  if (nextName === currentName.trim()) {
    return;
  }

  wellbeingNoteSaving = true;
  try {
    const response = await fetch("/api/workouts", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        source_session_key: workoutDay.session_key || sourceSessionKey || "",
        source_workout_date: workoutDay.date,
        session_key: workoutDay.session_key || sourceSessionKey || "",
        workout_date: workoutDay.date,
        workout_name: nextName,
        wellbeing_note: workoutDay.note || "",
        exercises: workoutDay.exercises.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: item.sets,
          reps: item.reps,
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to update workout name");
    }

    showToast("Название обновлено");
    await refreshAppDataStable();
  } catch (error) {
    console.error(error);
    showToast("Не удалось обновить название");
  } finally {
    wellbeingNoteSaving = false;
  }
}

async function refreshAppData() {
  if (!state.userId) {
    return;
  }
  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(state.userId)}`);
  const payload = await response.json();
  if (!payload.ready) {
    return;
  }
  state.payload = payload;
  renderApp(payload);
}

async function handleDeleteWorkoutDay() {
  if (
    state.workoutFlow.mode !== "edit" ||
    (!state.workoutFlow.sourceDate && !state.workoutFlow.sourceSessionKey)
  ) {
    return;
  }
  if (state.workoutFlow.saving) {
    return;
  }
  const confirmed = window.confirm(`Удалить тренировку за ${formatDate(state.workoutFlow.sourceDate)}?`);
  if (!confirmed) {
    return;
  }

  state.workoutFlow.saving = true;
  renderWorkoutFlow();
  try {
    const response = await fetch("/api/workouts", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        workout_date: state.workoutFlow.sourceDate,
        session_key: state.workoutFlow.sourceSessionKey,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "delete failed");
    }
    showToast("Тренировка удалена");
    await refreshAppDataStable();
    closeWorkoutFlow();
  } catch (error) {
    console.error(error);
    showToast("Не удалось удалить тренировку");
  } finally {
    state.workoutFlow.saving = false;
    renderWorkoutFlow();
  }
}

async function refreshAppDataStable() {
  const contentNode = document.querySelector(".content");
  const contentScrollTop = contentNode ? contentNode.scrollTop : 0;
  const activeTab = state.activeTab;
  await refreshAppData();
  if (state.activeTab !== activeTab) {
    switchTab(activeTab);
  }
  requestAnimationFrame(() => {
    if (contentNode) {
      contentNode.scrollTop = contentScrollTop;
    }
  });
}

async function openRecordFlow() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return false;
  }
  if (!recordOverlay || !recordModal || !recordOverlay.hidden || recordFlowTransitioning) {
    return false;
  }
  recordFlowTransitioning = true;
  freezeViewportFor(280);
  recordFlowSaving = false;
  recordExerciseInput.value = "";
  recordWeightInput.value = "";
  if (recordDateInput) {
    recordDateInput.value = todayValue();
  }
  syncRecordWeightDisplay();
  syncRecordDateDisplay();
  setBodyScrollLock(true);
  resetMotionState(recordOverlay, recordModal);
  resetScrollableOverlayState(recordOverlay, recordModal);
  recordOverlay.hidden = false;
  const overlayAnimation = runMotion(recordOverlay, { opacity: [0, 1] }, { duration: 0.18, easing: "ease-out" });
  const modalAnimation = runMotion(
    recordModal,
    { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
  resetScrollableOverlayState(recordOverlay, recordModal);
  syncTelegramBottomButtons();
  requestAnimationFrame(() => {
    if (!recordOverlay.hidden) {
      focusWithoutScroll(recordExerciseInput);
    }
  });
  await waitForMotionFinish(overlayAnimation, modalAnimation);
  recordFlowTransitioning = false;
  return true;
}

async function closeRecordFlow() {
  if (!recordOverlay || !recordModal || recordOverlay.hidden || recordFlowTransitioning) {
    return false;
  }
  recordFlowTransitioning = true;
  recordFlowSaving = false;
  blurActiveFieldInside(recordOverlay);
  freezeViewportFor(320);
  const overlayAnimation = runMotion(recordOverlay, { opacity: [1, 0] }, { duration: 0.14, easing: "ease-out" });
  const modalAnimation = runMotion(
    recordModal,
    { opacity: [1, 0.75], transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"] },
    { duration: 0.16, easing: "ease-in" }
  );
  await waitForMotionFinish(overlayAnimation, modalAnimation);
  recordOverlay.hidden = true;
  resetMotionState(recordOverlay, recordModal);
  resetScrollableOverlayState(recordOverlay, recordModal);
  setBodyScrollLock(false);
  restoreViewportAfterOverlayTransition();
  syncTelegramBottomButtons();
  recordFlowTransitioning = false;
  return true;
}

async function submitRecordFlow() {
  blurActiveField();
  if (recordFlowSaving) {
    return false;
  }
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return false;
  }
  const exercise = String(recordExerciseInput?.value || "").trim();
  if (!exercise) {
    showToast("Введите название упражнения");
    focusWithoutScroll(recordExerciseInput);
    return false;
  }
  const bestWeight = Number(String(recordWeightInput?.value || "").replace(",", "."));
  if (!Number.isFinite(bestWeight) || bestWeight <= 0) {
    showToast("Введите корректный вес");
    focusWithoutScroll(recordWeightInput);
    return false;
  }
  const workoutDate = String(recordDateInput?.value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
    showToast("Выберите корректную дату");
    focusWithoutScroll(recordDateInput);
    return false;
  }

  try {
    recordFlowSaving = true;
    syncTelegramBottomButtons();
    const response = await fetch("/api/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        exercise,
        best_weight: bestWeight,
        workout_date: workoutDate,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to save record");
    }
    closeRecordFlow();
    showToast("Рекорд добавлен");
    await refreshAppDataStable();
    return true;
  } catch (error) {
    console.error(error);
    showToast("Не удалось добавить рекорд");
    return false;
  } finally {
    recordFlowSaving = false;
    syncTelegramBottomButtons();
  }
}

async function requestDeleteRecord(exercise) {
  if (!state.userId || !exercise) {
    return false;
  }
  const response = await fetch("/api/records", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: Number(state.userId),
      exercise,
    }),
  });
  const result = await response.json().catch(() => ({}));
  return Boolean(response.ok && result.ok);
}

async function deleteSelectedRecords() {
  if (!state.recordsEditMode || state.selectedRecordExercises.size === 0) {
    return;
  }
  const confirmed = window.confirm(
    `Удалить выбранные рекорды: ${state.selectedRecordExercises.size} шт.?`
  );
  if (!confirmed) {
    return;
  }

  let deleted = 0;
  for (const exercise of state.selectedRecordExercises) {
    try {
      const ok = await requestDeleteRecord(exercise);
      if (ok) {
        deleted += 1;
      }
    } catch (error) {
      console.error(error);
    }
  }

  await refreshAppDataStable();
  state.recordsEditMode = false;
  state.selectedRecordExercises.clear();
  renderRecords(state.payload?.records || []);
  showToast(deleted > 0 ? `Удалено рекордов: ${deleted}` : "Не удалось удалить выбранные рекорды");
}

async function deleteAllRecords() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }
  if (!state.recordsEditMode) {
    return;
  }
  const records = state.payload?.records || [];
  if (!records.length) {
    return;
  }
  const confirmed = window.confirm(`Удалить все рекорды (${records.length})?`);
  if (!confirmed) {
    return;
  }

  let deleted = 0;
  try {
    for (const record of records) {
      const exercise = String(record.exercise || "").trim();
      if (!exercise) {
        continue;
      }
      const ok = await requestDeleteRecord(exercise);
      if (ok) {
        deleted += 1;
      }
    }

    await refreshAppDataStable();
    state.recordsEditMode = false;
    state.selectedRecordExercises.clear();
    renderRecords(state.payload?.records || []);
    showToast(deleted > 0 ? "Все рекорды удалены" : "Не удалось удалить рекорды");
  } catch (error) {
    console.error(error);
    showToast(`Не удалось удалить рекорды: ${error.message || "unknown error"}`);
  }
}

function trainingDayTitle(index) {
  const names = ["День груди", "День спины", "День ног", "День плеч"];
  return names[index % names.length];
}

function faqTitle(key) {
  if (key === "nutrition") return "Питание";
  if (key === "programs") return "Программы";
  if (key === "recovery") return "Восстановление";
  return "Техника";
}

function formatDate(value) {
  if (!value) {
    return "сегодня";
  }
  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }
  return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
}

function syncRecordDateDisplay() {
  if (!recordDateDisplay) {
    return;
  }
  const value = String(recordDateInput?.value || "").trim();
  recordDateDisplay.textContent = value ? formatDate(value) : "сегодня";
}

function syncRecordWeightDisplay() {
  if (!recordWeightDisplay) {
    return;
  }
  const value = String(recordWeightInput?.value || "").trim();
  recordWeightDisplay.textContent = value || "100";
  recordWeightDisplay.classList.toggle("is-placeholder", !value);
}

function todayValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function emptyCard(text) {
  return `<div class="history-card empty-card"><div class="history-main empty-card-text">${escapeHtml(text)}</div></div>`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  runMotion(
    toast,
    {
      opacity: [0, 1],
      transform: ["translate(-50%, -8px)", "translate(-50%, 0px)"],
    },
    { duration: 0.2, easing: "ease-out" }
  );
  setTimeout(() => toast.remove(), 2200);
}

function attachLongPress(node, durationMs, onLongPress) {
  let timerId = null;
  let startX = 0;
  let startY = 0;
  let longPressed = false;

  const clear = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  node.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    longPressed = false;
    clear();
    timerId = setTimeout(() => {
      longPressed = true;
      onLongPress();
    }, durationMs);
  });

  node.addEventListener("pointermove", (event) => {
    const dx = Math.abs(event.clientX - startX);
    const dy = Math.abs(event.clientY - startY);
    if (dx > 8 || dy > 8) {
      clear();
    }
  });

  node.addEventListener("pointerup", clear);
  node.addEventListener("pointercancel", clear);
  node.addEventListener("pointerleave", clear);

  node.addEventListener("click", (event) => {
    if (longPressed) {
      event.preventDefault();
      event.stopPropagation();
      longPressed = false;
    }
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}
