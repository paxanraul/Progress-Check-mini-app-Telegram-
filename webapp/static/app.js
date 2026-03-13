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

const navButtons = [...document.querySelectorAll(".nav-btn")];
const bottomNav = document.getElementById("bottom-nav");
const navPill = document.getElementById("nav-pill");
const panels = [...document.querySelectorAll(".panel")];
const faqTabs = document.getElementById("faq-tabs");
const faqList = document.getElementById("faq-list");
const faqSearch = document.getElementById("faq-search");
const overlay = document.getElementById("workout-overlay");
const recordOverlay = document.getElementById("record-overlay");
const modalSteps = [...document.querySelectorAll(".modal-step")];
const modalTitle = document.getElementById("modal-title");
const dateInput = document.getElementById("workout-date-input");
const workoutNameInput = document.getElementById("workout-name-input");
const wellbeingNoteInput = document.getElementById("wellbeing-note");
const deleteWorkoutDayBtn = document.getElementById("delete-workout-day");
const removeRecordBtn = document.getElementById("delete-btn");
const addRecordBtn = document.getElementById("move-btn");
const workoutModal = document.querySelector(".workout-modal");
const recordModal = document.querySelector(".record-modal");
const recordExerciseInput = document.getElementById("record-exercise-input");
const recordWeightInput = document.getElementById("record-weight-input");
const historyManageToggle = document.getElementById("history-manage-toggle");
const historyBulkActions = document.getElementById("history-bulk-actions");
const historyDeleteSelectedBtn = document.getElementById("history-delete-selected");
const historyDeleteAllBtn = document.getElementById("history-delete-all");
const historyManageCancelBtn = document.getElementById("history-manage-cancel");
const recordsBulkActions = document.getElementById("records-bulk-actions");
const recordsDeleteSelectedBtn = document.getElementById("records-delete-selected");
const recordsDeleteAllBtn = document.getElementById("records-delete-all");
const recordsManageCancelBtn = document.getElementById("records-manage-cancel");

const motionApi = window.Motion;
const motionAnimate = typeof motionApi?.animate === "function" ? motionApi.animate : null;
const motionStagger = typeof motionApi?.stagger === "function" ? motionApi.stagger : null;

let stableViewportHeight = 0;
let wellbeingNoteSaving = false;
let lastWorkoutStep = "";
let bodyScrollTop = 0;

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
  const next = Math.round(window.visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
  if (!next) {
    return;
  }
  const active = document.activeElement;
  const keyboardLikelyOpen =
    !!active &&
    (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

  // Keep viewport height stable while keyboard is open, but allow corrections after Telegram recalculates viewport.
  if (!force && stableViewportHeight) {
    const delta = Math.abs(next - stableViewportHeight);
    if (keyboardLikelyOpen) {
      return;
    }
    if (delta < 32) {
      return;
    }
  }
  stableViewportHeight = next;
  document.documentElement.style.setProperty("--app-vh", `${stableViewportHeight}px`);
}

function setBodyScrollLock(locked) {
  if (locked) {
    bodyScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    document.body.classList.add("modal-open");
    document.body.style.top = `-${bodyScrollTop}px`;
    document.body.style.position = "fixed";
    document.body.style.width = "100%";
    return;
  }
  document.body.classList.remove("modal-open");
  document.body.style.top = "";
  document.body.style.position = "";
  document.body.style.width = "";
  window.scrollTo(0, bodyScrollTop);
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
  runMotion(
    overlay,
    { opacity: [0, 1] },
    { duration: 0.2, easing: "ease-out" }
  );
  runMotion(
    workoutModal,
    {
      opacity: [0.6, 1],
      transform: ["translateY(24px) scale(0.98)", "translateY(0px) scale(1)"],
    },
    { duration: 0.28, easing: [0.22, 1, 0.36, 1] }
  );
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
document.addEventListener(
  "pointerdown",
  (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const tappable = target.closest(
      "button, [role='button'], .nav-btn, .action-card, .draft-action-btn, .history-edit-btn, .chip"
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
bindClick("close-record-flow", closeRecordFlow);
bindClick("save-record-flow", submitRecordFlow);
bindClick("records-delete-selected", deleteSelectedRecords);
bindClick("records-delete-all", deleteAllRecords);
bindClick("records-manage-cancel", disableRecordsManageMode);

deleteWorkoutDayBtn?.addEventListener("click", handleDeleteWorkoutDay);
addRecordBtn?.addEventListener("click", openRecordFlow);
removeRecordBtn?.addEventListener("click", toggleRecordsManageMode);
preventTapFocusShift(document.getElementById("open-workout-flow"));

recordOverlay?.addEventListener("click", (event) => {
  if (event.target === recordOverlay) {
    closeRecordFlow();
  }
});

recordExerciseInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  recordWeightInput?.focus();
});

recordWeightInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  void submitRecordFlow();
});

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

wellbeingNoteInput?.addEventListener("keydown", (event) => {
  if (!state.workoutFlow.open || state.workoutFlow.step !== "comment") {
    return;
  }
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  if (event.repeat) {
    return;
  }
  handleSaveFlowButton();
});

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

  if (!payload.ready) {
    document.getElementById("profile-name").textContent = "Нет данных";
    document.getElementById("weight-value").textContent = "—";
    document.getElementById("height-value").textContent = "—";
    document.getElementById("experience-value").textContent = "—";
    document.getElementById("workouts-value").textContent = "0";
    document.getElementById("history-list").innerHTML = emptyCard(payload.message || "Сначала открой бота и заполни профиль.");
    document.getElementById("records-list").innerHTML = emptyCard("Рекорды появятся после первых тренировок.");
    switchTab("profile");
    return;
  }

  renderApp(payload);
}

function renderApp(payload) {
  renderProfile(payload.user);
  renderDailyFireState(payload.history || []);
  renderHistory(payload.history);
  renderRecords(payload.records);
  renderFaqTabs(payload.faq);
  renderFaq();
  state.workoutFlow.items = convertHistoryToDraft(payload.history[0]);
  renderWorkoutFlow();
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

function renderProfile(user) {
  document.getElementById("profile-name").textContent = user.name || "Пользователь";
  document.getElementById("weight-value").textContent = user.weight ? `${user.weight} кг` : "—";
  document.getElementById("height-value").textContent = user.height ? `${user.height} см` : "—";
  document.getElementById("experience-value").textContent = user.experience || "—";
  document.getElementById("workouts-value").textContent = String(user.workout_days ?? 0);
}

function renderDailyFireState(history) {
  const fireNode = document.querySelector(".fire");
  const streakNode = document.querySelector(".streak-badge");
  const streakValueNode = document.getElementById("streak-value");
  if (!fireNode || !streakNode) {
    return;
  }
  if (!streakValueNode) {
    return;
  }

  const { value, active } = computeFireStreakStableForDay(history);
  streakValueNode.textContent = String(value);
  fireNode.classList.toggle("fire-inactive", !active);
  streakNode.classList.toggle("streak-inactive", !active);
}

function computeFireStreakStableForDay(history) {
  const raw = computeFireStreak(history);
  const today = todayValue();
  const cacheKey = `fire_state:${state.userId || "unknown"}`;

  let cached = null;
  try {
    const rawCached = localStorage.getItem(cacheKey);
    if (rawCached) {
      cached = JSON.parse(rawCached);
    }
  } catch (error) {
    cached = null;
  }

  if (!cached || cached.day !== today) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ day: today, value: raw.value, active: raw.active }));
    } catch (error) {
      // ignore storage errors
    }
    return raw;
  }

  const cachedValue = Number(cached.value || 0);
  const cachedActive = Boolean(cached.active);

  // Do not decrease streak or switch to inactive within the same day
  // just because a workout entry was edited/deleted.
  if ((cachedActive && !raw.active) || raw.value < cachedValue) {
    return { value: cachedValue, active: cachedActive };
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify({ day: today, value: raw.value, active: raw.active }));
  } catch (error) {
    // ignore storage errors
  }
  return raw;
}

function computeFireStreak(history) {
  const dates = new Set();
  if (Array.isArray(history)) {
    history.forEach((day) => {
      if (day?.date && typeof day.date === "string") {
        dates.add(day.date);
      }
    });
  }

  if (!dates.size) {
    return { value: 0, active: false };
  }

  const today = todayValue();
  if (dates.has(today)) {
    return { value: countBackConsecutiveDays(dates, today), active: true };
  }

  const yesterday = shiftIsoDate(today, -1);
  if (dates.has(yesterday)) {
    return { value: countBackConsecutiveDays(dates, yesterday), active: false };
  }

  return { value: 0, active: false };
}

function countBackConsecutiveDays(dateSet, startIsoDate) {
  let count = 0;
  let current = startIsoDate;
  while (dateSet.has(current)) {
    count += 1;
    current = shiftIsoDate(current, -1);
  }
  return count;
}

function shiftIsoDate(isoDate, deltaDays) {
  const parts = String(isoDate).split("-");
  if (parts.length !== 3) {
    return isoDate;
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return isoDate;
  }

  const dateObj = new Date(year, month - 1, day);
  dateObj.setDate(dateObj.getDate() + deltaDays);

  const y = String(dateObj.getFullYear());
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function renderHistory(history) {
  const root = document.getElementById("history-list");
  root.innerHTML = "";
  updateHistoryManageControls();

  if (!history.length) {
    state.selectedWorkoutSessions.clear();
    disableHistoryManageMode(true);
    updateHistoryManageControls();
    root.innerHTML = emptyCard("Пока нет тренировок. Добавь первую через кнопку на главной.");
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
              <button class="history-edit-btn" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}" type="button"${state.historyEditMode ? " hidden" : ""}>Изменить</button>
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
  animateCollection(root, ".history-card");
  animateExerciseRows(root);
}

function toggleHistoryManageMode() {
  state.historyEditMode = !state.historyEditMode;
  if (!state.historyEditMode) {
    state.selectedWorkoutSessions.clear();
  }
  renderHistory(state.payload?.history || []);
}

function disableHistoryManageMode(silent = false) {
  state.historyEditMode = false;
  state.selectedWorkoutSessions.clear();
  if (!silent) {
    renderHistory(state.payload?.history || []);
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

  const cards = document.querySelectorAll(`.history-card[data-session-key="${sessionKey}"]`);
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
  historyManageToggle.textContent = state.historyEditMode ? "Готово" : "Изменить";
  historyBulkActions.hidden = !state.historyEditMode;

  if (historyDeleteSelectedBtn) {
    historyDeleteSelectedBtn.disabled = state.selectedWorkoutSessions.size === 0;
  }
}

async function deleteSelectedHistoryWorkouts() {
  if (!state.historyEditMode || state.selectedWorkoutSessions.size === 0) {
    return;
  }
  const confirmed = window.confirm(`Удалить выбранные тренировки: ${state.selectedWorkoutSessions.size} шт.?`);
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

function renderRecords(records) {
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
  animateCollection(root, ".record-card");
}

function toggleRecordsManageMode() {
  state.recordsEditMode = !state.recordsEditMode;
  if (!state.recordsEditMode) {
    state.selectedRecordExercises.clear();
  }
  renderRecords(state.payload?.records || []);
}

function disableRecordsManageMode() {
  state.recordsEditMode = false;
  state.selectedRecordExercises.clear();
  renderRecords(state.payload?.records || []);
}

function toggleRecordSelection(exercise) {
  if (!exercise) {
    return;
  }
  if (state.selectedRecordExercises.has(exercise)) {
    state.selectedRecordExercises.delete(exercise);
  } else {
    state.selectedRecordExercises.add(exercise);
  }
  renderRecords(state.payload?.records || []);
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
  if (state.activeTab === "profile" && tab !== "profile" && state.historyEditMode) {
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
    renderRecords(state.payload?.records || []);
  }
  animatePanelEnter(tab);
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
  if (tab === "profile") return "Профиль";
  if (tab === "records") return "Рекорды";
  if (tab === "faq") return "Вопросы";
  return "Главная";
}




function openWorkoutFlow() {
  state.workoutFlow.open = true;
  resetWorkoutFlowForNewEntry();
  setBodyScrollLock(true);
  overlay.hidden = false;
  animateModalOpen();
  renderWorkoutFlow();
}

async function closeWorkoutFlow() {
  if (!state.workoutFlow.open) {
    return;
  }
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
  if (overlayAnimation?.finished || modalAnimation?.finished) {
    await Promise.all([overlayAnimation?.finished, modalAnimation?.finished].filter(Boolean)).catch(() => null);
  }
  overlay.hidden = true;
  setBodyScrollLock(false);
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
  const day = findWorkoutEntry(sourceSessionKey, sourceDate);
  if (!day) {
    showToast("Не удалось открыть тренировку для редактирования");
    return;
  }

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
  if (wellbeingNoteInput) {
    wellbeingNoteInput.value = day.note || "";
  }
  workoutNameInput.value = day.workout_name || "";
  setBodyScrollLock(true);
  overlay.hidden = false;
  animateModalOpen();
  renderWorkoutFlow();
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
  const nameInput = document.getElementById("exercise-name-input");
  const weightInput = document.getElementById("exercise-weight-input");
  const name = nameInput.value.trim();
  const weight = Number(weightInput.value);

  if (!name) {
    showToast("Введи название упражнения");
    return;
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
}

function handleSaveFlowButton() {
  if (state.workoutFlow.step === "list") {
    if (!state.workoutFlow.items.length) {
      showToast("Сначала добавь хотя бы одно упражнение");
      return;
    }
    state.workoutFlow.step = "comment";
    renderWorkoutFlow();
    return;
  }

  if (state.workoutFlow.step === "comment") {
    state.workoutFlow.step = "date";
    renderWorkoutFlow();
    return;
  }

  if (state.workoutFlow.step === "date") {
    submitWorkoutFlow();
    return;
  }

  if (state.workoutFlow.step === "done") {
    closeWorkoutFlow();
  }
}

function renderWorkoutFlow() {
  if (!state.workoutFlow.open) {
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
  saveButton.hidden = step === "form";
  saveButton.innerHTML = saveButtonLabel(step, state.workoutFlow.saving);
  saveButton.disabled = state.workoutFlow.saving;
  deleteWorkoutDayBtn.hidden = !(state.workoutFlow.mode === "edit" && step === "list");
  deleteWorkoutDayBtn.disabled = state.workoutFlow.saving;
  if (step === "list") {
    renderDraftList();
  }
  if (step === "comment" && wellbeingNoteInput) {
    requestAnimationFrame(() => {
      wellbeingNoteInput.focus();
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
  if (step === "comment") return "Самочувствие";
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
    return;
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
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить тренировку");
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

function openRecordFlow() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }
  recordExerciseInput.value = "";
  recordWeightInput.value = "";
  setBodyScrollLock(true);
  recordOverlay.hidden = false;
  runMotion(recordOverlay, { opacity: [0, 1] }, { duration: 0.18, easing: "ease-out" });
  runMotion(
    recordModal,
    { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
  requestAnimationFrame(() => {
    recordExerciseInput?.focus();
  });
}

function closeRecordFlow() {
  if (!recordOverlay || recordOverlay.hidden) {
    return;
  }
  const overlayAnimation = runMotion(recordOverlay, { opacity: [1, 0] }, { duration: 0.14, easing: "ease-out" });
  const modalAnimation = runMotion(
    recordModal,
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
    recordOverlay.hidden = true;
    setBodyScrollLock(false);
  }, 170);
}

async function submitRecordFlow() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }
  const exercise = String(recordExerciseInput?.value || "").trim();
  if (!exercise) {
    showToast("Введите название упражнения");
    recordExerciseInput?.focus();
    return;
  }
  const bestWeight = Number(String(recordWeightInput?.value || "").replace(",", "."));
  if (!Number.isFinite(bestWeight) || bestWeight <= 0) {
    showToast("Введите корректный вес");
    recordWeightInput?.focus();
    return;
  }

  try {
    const response = await fetch("/api/records", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        exercise,
        best_weight: bestWeight,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to save record");
    }
    closeRecordFlow();
    showToast("Рекорд добавлен");
    await refreshAppDataStable();
  } catch (error) {
    console.error(error);
    showToast("Не удалось добавить рекорд");
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
  const confirmed = window.confirm(`Удалить выбранные рекорды: ${state.selectedRecordExercises.size} шт.?`);
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

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyCard(text) {
  return `<div class="history-card"><div class="history-main">${escapeHtml(text)}</div></div>`;
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
