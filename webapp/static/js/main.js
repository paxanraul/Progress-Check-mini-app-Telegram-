import { dom } from "./core/dom.js";
import { state } from "./core/state.js";
import * as api from "./services/api.js";
import { emptyCard } from "./shared/utils.js";
import {
  animateCollection,
  animateExerciseRows,
  animatePanelEnter,
  runMotion,
} from "./ui/animation.js";
import { createBottomButtonsController } from "./ui/bottomButtons.js";
import { createInteractionController } from "./ui/interaction.js";
import {
  updateBodyScrollLockFromVisibleOverlays,
} from "./ui/modalBase.js";
import { bindGlobalTapHaptics, getTelegramUser, renderTelegramAvatar, triggerHaptic } from "./ui/telegram.js";
import { showToast } from "./ui/toast.js";
import { createQuoteFeature } from "./features/quotes.js";
import { createConfirmModal } from "./modals/confirmModal.js";
import { createProfileModal } from "./modals/profileModal.js";
import { createQuotesModal } from "./modals/quotesModal.js";
import { createRecordModal } from "./modals/recordModal.js";
import { createWorkoutFlowModal } from "./modals/workoutFlow.js";
import { createBottomNavigation } from "./screens/bottomNav.js";
import { createFaqScreen } from "./screens/faq.js";
import { createHomeScreen } from "./screens/home.js";
import { createMyDataOverlay } from "./screens/myData.js";
import { createRecordsScreen } from "./screens/records.js";

const APP_DATA_REQUEST_TIMEOUT_MS = 4500;
const APP_DATA_RETRY_ATTEMPTS = 2;

function resolveUserId() {
  const params = new URLSearchParams(window.location.search);
  const queryUserId = params.get("user_id");
  if (queryUserId) {
    return queryUserId;
  }

  const tgUserId = getTelegramUser()?.id;
  return tgUserId ? String(tgUserId) : "";
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

function bootstrapStatusCard(message, action = null) {
  const actionBlock =
    action && action.id && action.label
      ? `
          <div class="bootstrap-status-actions">
            <button class="history-bulk-btn subtle bootstrap-retry-btn" id="${action.id}" type="button">${action.label}</button>
          </div>
        `
      : "";

  return `
    <div class="history-card empty-card bootstrap-status-card">
      <div class="history-main empty-card-text">${message}</div>
      ${actionBlock}
    </div>
  `;
}

const interaction = createInteractionController();

function getBlockingOverlays() {
  return [
    dom.modals.workout.overlay,
    dom.modals.record.overlay,
    dom.modals.quote.overlay,
    dom.modals.myData.overlay,
    dom.modals.profile.overlay,
    dom.modals.confirm.overlay,
  ].filter(Boolean);
}

function updateOverlayScrollLock() {
  updateBodyScrollLockFromVisibleOverlays(
    getBlockingOverlays(),
    interaction.setBodyScrollLock
  );
}

let appDataBootstrapLoading = false;

const quoteFeature = createQuoteFeature({
  state,
  dom,
  focusWithoutScroll: interaction.focusWithoutScroll,
  showToast,
  triggerHaptic,
});

let bottomButtons;
let homeScreen;
let recordsScreen;

const confirmModal = createConfirmModal({
  state,
  dom,
  interaction,
  getBlockingOverlays,
});

const profileModal = createProfileModal({
  state,
  dom,
  api,
  interaction,
  showToast,
  triggerHaptic,
  refreshAppDataStable,
  getBlockingOverlays,
});

const myDataOverlay = createMyDataOverlay({
  state,
  dom,
  showToast,
  openProfileOverlay: () => profileModal.open(),
  setBodyScrollLock: interaction.setBodyScrollLock,
  freezeViewportFor: interaction.freezeViewportFor,
  runMotion,
  updateBodyScrollLockFromVisibleOverlays: updateOverlayScrollLock,
});

const quotesModal = createQuotesModal({
  state,
  dom,
  interaction,
  quoteFeature,
  showToast,
  getBlockingOverlays,
});

const recordModal = createRecordModal({
  state,
  dom,
  api,
  interaction,
  showToast,
  refreshAppDataStable,
  syncBottomButtons: () => bottomButtons?.sync(),
  getBlockingOverlays,
});

const workoutFlowModal = createWorkoutFlowModal({
  state,
  dom,
  api,
  interaction,
  showToast,
  refreshAppData,
  refreshAppDataStable,
  syncBottomButtons: () => bottomButtons?.sync(),
  getBlockingOverlays,
});

bottomButtons = createBottomButtonsController({
  state,
  dom,
  getRecordFlowSaving: () => recordModal.isSaving(),
  onWorkoutPrimary: () => dom.modals.workout.primaryActionButton?.click(),
  onWorkoutSecondary: () => dom.modals.workout.secondaryActionButton?.click(),
  onRecordPrimary: () => dom.modals.record.primaryActionButton?.click(),
  onRecordSecondary: () => dom.modals.record.secondaryActionButton?.click(),
});

homeScreen = createHomeScreen({
  state,
  dom,
  api,
  quoteFeature,
  showToast,
  triggerHaptic,
  animateCollection,
  animateExerciseRows,
  openWorkoutFlow: () => workoutFlowModal.open(),
  openQuoteOverlay: () => quotesModal.open(),
  openEditWorkoutFlow: (sessionKey, date) => workoutFlowModal.openEditWorkoutFlow(sessionKey, date),
  refreshAppDataStable,
  preventTapFocusShift: interaction.preventTapFocusShift,
});

recordsScreen = createRecordsScreen({
  state,
  dom,
  api,
  showToast,
  animateCollection,
  openRecordFlow: () => recordModal.open(),
});

const faqScreen = createFaqScreen({
  state,
  dom,
  animateCollection,
});

const bottomNav = createBottomNavigation({
  state,
  dom,
  animatePanelEnter,
  onLeavingHome: () => homeScreen.disableHistoryManageMode(true),
  onLeavingRecords: () => recordsScreen.disableManageMode(true),
  onActivateHome: () => homeScreen.render(),
  onActivateRecords: () => recordsScreen.render(state.payload?.records || [], { animate: false }),
  onTabChanged: () => {
    bottomButtons.sync();
    quoteFeature.syncLoop();
  },
});

function renderBootstrapLoadingState(message = "Загружаем данные...") {
  if (dom.modals.myData.name) {
    dom.modals.myData.name.textContent = "Загрузка...";
  }
  if (dom.modals.myData.weight) {
    dom.modals.myData.weight.textContent = "—";
  }
  if (dom.modals.myData.height) {
    dom.modals.myData.height.textContent = "—";
  }
  if (dom.modals.myData.experience) {
    dom.modals.myData.experience.textContent = "—";
  }
  if (dom.modals.myData.workouts) {
    dom.modals.myData.workouts.textContent = "—";
  }
  syncUserLevelWidget({});
  dom.home.historyList.innerHTML = bootstrapStatusCard(message);
  dom.records.list.innerHTML = bootstrapStatusCard("Загружаем рекорды...");
  dom.faq.tabs.innerHTML = "";
  dom.faq.list.innerHTML = bootstrapStatusCard("Загружаем FAQ...");
}

function renderBootstrapErrorState(error) {
  const message =
    error?.message === "request timeout"
      ? "Сервер отвечает слишком долго."
      : "Не удалось загрузить данные.";

  dom.home.historyList.innerHTML = bootstrapStatusCard(message, {
    id: "retry-app-bootstrap",
    label: "Повторить",
  });
  dom.records.list.innerHTML = emptyCard("Повторите загрузку приложения.");
  dom.faq.tabs.innerHTML = "";
  dom.faq.list.innerHTML = emptyCard("FAQ загрузится после восстановления соединения.");
  bottomNav.switchTab("home");

  const retryButton = document.getElementById("retry-app-bootstrap");
  retryButton?.addEventListener(
    "click",
    () => {
      void retryInitialAppDataLoad();
    },
    { once: true }
  );
}

function renderReadyApp(payload) {
  myDataOverlay.renderProfileSummary(payload.user || {});
  syncUserLevelWidget(payload.user || {});
  homeScreen.render();
  recordsScreen.render(payload.records || []);
  faqScreen.renderTabs(payload.faq || {});
  faqScreen.render();
  if (payload.history?.[0]) {
    workoutFlowModal.seedDraftFromHistory(payload.history[0]);
  }
}

function renderNotReadyApp(payload) {
  myDataOverlay.renderProfileSummary({});
  syncUserLevelWidget({});
  dom.home.historyList.innerHTML = emptyCard(
    payload.message || "Сначала открой бота и заполни профиль."
  );
  dom.records.list.innerHTML = emptyCard("Рекорды появятся после первых тренировок.");
  dom.faq.tabs.innerHTML = "";
  dom.faq.list.innerHTML = emptyCard("FAQ станет доступен после загрузки данных.");
  bottomNav.switchTab("home");
}

function applyAppPayload(payload) {
  state.payload = payload;
  renderTelegramAvatar(dom, payload?.user || null);
  quoteFeature.loadForUser(payload?.custom_quotes || null);

  if (!payload?.ready) {
    renderNotReadyApp(payload || {});
    homeScreen.renderQuotes();
    bottomButtons.sync();
    return payload;
  }

  renderReadyApp(payload);
  bottomButtons.sync();
  return payload;
}

async function loadInitialAppData(options = {}) {
  if (!state.userId || appDataBootstrapLoading) {
    return null;
  }

  appDataBootstrapLoading = true;
  if (options.loadingMessage) {
    renderBootstrapLoadingState(options.loadingMessage);
  }

  try {
    const payload = await api.fetchAppData(state.userId);
    return applyAppPayload(payload);
  } catch (error) {
    renderBootstrapErrorState(error);
    showToast("Не удалось загрузить Mini App");
    throw error;
  } finally {
    appDataBootstrapLoading = false;
  }
}

async function retryInitialAppDataLoad() {
  if (appDataBootstrapLoading) {
    return;
  }

  renderBootstrapLoadingState("Повторно загружаем данные...");
  try {
    await loadInitialAppData({
      attempts: APP_DATA_RETRY_ATTEMPTS,
      timeoutMs: APP_DATA_REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    console.error(error);
  }
}

async function refreshAppData() {
  if (!state.userId) {
    return;
  }

  const payload = await api.fetchAppData(state.userId);
  applyAppPayload(payload);
}

async function refreshAppDataStable() {
  const contentNode = dom.app.content;
  const contentScrollTop = contentNode ? contentNode.scrollTop : 0;
  const activeTab = state.activeTab;

  await refreshAppData();

  if (state.activeTab !== activeTab) {
    bottomNav.switchTab(activeTab);
  }

  requestAnimationFrame(() => {
    if (contentNode) {
      contentNode.scrollTop = contentScrollTop;
    }
  });
}

function registerEnterBehaviors() {
  interaction.registerEnterFieldBehavior(dom.faq.search, {
    submit: () => {
      state.faqQuery = String(dom.faq.search?.value || "").trim().toLowerCase();
      faqScreen.render();
      return true;
    },
  });

  interaction.registerEnterFieldBehavior(dom.modals.workout.workoutNameInput);
  interaction.registerEnterFieldBehavior(dom.modals.workout.exerciseNameInput);
  interaction.registerEnterFieldBehavior(dom.modals.workout.exerciseWeightInput);
  interaction.registerEnterFieldBehavior(dom.modals.workout.dateInput, {
    submit: () => {
      const nextValue = String(dom.modals.workout.dateInput?.value || "").trim();
      if (nextValue) {
        state.workoutFlow.date = nextValue;
      }
      return true;
    },
  });
  interaction.registerEnterFieldBehavior(dom.modals.workout.wellbeingNoteInput);
  interaction.registerEnterFieldBehavior(dom.modals.record.exerciseInput);
  interaction.registerEnterFieldBehavior(dom.modals.record.weightInput);
  interaction.registerEnterFieldBehavior(dom.modals.record.dateInput);
  interaction.registerEnterFieldBehavior(dom.modals.quote.input, {
    submit: () => {
      dom.modals.quote.input?.classList.remove("is-invalid");
      quoteFeature.updateFormState();
      return true;
    },
  });
  interaction.registerEnterFieldBehavior(dom.modals.quote.authorInput, {
    submit: () => {
      quoteFeature.updateFormState();
      return true;
    },
  });
  interaction.registerEnterFieldBehavior(dom.modals.profile.nameInput);
  interaction.registerEnterFieldBehavior(dom.modals.profile.weightInput);
  interaction.registerEnterFieldBehavior(dom.modals.profile.heightInput);
  interaction.registerEnterFieldBehavior(dom.modals.profile.experienceInput);
}

function bindApplication() {
  bindGlobalTapHaptics();
  interaction.bindGlobalEnterHandler();
  interaction.bindKeyboardDismissSurface(dom.app.content);
  interaction.bindViewportListeners(() => {
    bottomNav.syncNavPillPosition(state.activeTab, true);
    bottomButtons.sync();
  });
  document.addEventListener("visibilitychange", () => {
    quoteFeature.syncLoop();
  }, { passive: true });

  registerEnterBehaviors();

  bottomNav.bindEvents();
  faqScreen.bindEvents();
  homeScreen.bindEvents();
  recordsScreen.bindEvents({ refreshAppDataStable });
  myDataOverlay.bindEvents();
  profileModal.bindEvents();
  quotesModal.bindEvents();
  workoutFlowModal.bindEvents();
  recordModal.bindEvents();
  confirmModal.bindEvents();
}

async function bootstrap() {
  requestAnimationFrame(() => {
    interaction.syncViewportHeight(true);
    bottomNav.syncNavPillPosition(state.activeTab, true);
  });
  window.setTimeout(() => interaction.syncViewportHeight(true), 150);
  window.setTimeout(() => interaction.syncViewportHeight(true), 500);

  const userId = resolveUserId();
  if (!userId) {
    showToast("Не удалось определить пользователя");
    return;
  }

  state.userId = userId;
  renderTelegramAvatar(dom);
  quoteFeature.loadForUser();
  quoteFeature.renderSection({ resetLoop: true });
  renderBootstrapLoadingState();

  try {
    await loadInitialAppData({
      attempts: APP_DATA_RETRY_ATTEMPTS,
      timeoutMs: APP_DATA_REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    console.error(error);
  }
}

bindApplication();
void bootstrap();
