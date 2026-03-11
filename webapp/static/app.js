const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready();
}

const state = {
  activeTab: "home",
  faqCategory: "technique",
  faqQuery: "",
  recordsDeleteMode: false,
  payload: null,
  userId: "",
  workoutFlow: {
    open: false,
    mode: "create",
    sourceDate: "",
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
const modalSteps = [...document.querySelectorAll(".modal-step")];
const modalTitle = document.getElementById("modal-title");
const dateInput = document.getElementById("workout-date-input");
const workoutNameInput = document.getElementById("workout-name-input");
const workoutNoteInput = document.getElementById("workout-note-input");
const wellbeingNoteInput = document.getElementById("wellbeing-note");
const deleteWorkoutDayBtn = document.getElementById("delete-workout-day");
const removeRecordBtn = document.getElementById("delete-btn");
const addRecordBtn = document.getElementById("move-btn");
const workoutModal = document.querySelector(".workout-modal");

const motionApi = window.Motion;
const motionAnimate = typeof motionApi?.animate === "function" ? motionApi.animate : null;
const motionStagger = typeof motionApi?.stagger === "function" ? motionApi.stagger : null;

let stableViewportHeight = 0;
let wellbeingNoteSaving = false;
let lastWorkoutStep = "";
let bodyScrollTop = 0;

function syncViewportHeight(force = false) {
  const next = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  if (!next) {
    return;
  }
  // Keep viewport height stable to prevent jumps in Telegram WebView when keyboard appears.
  if (!force && stableViewportHeight) {
    return;
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
  syncNavPillPosition(state.activeTab, true);
}, { passive: true });

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

deleteWorkoutDayBtn?.addEventListener("click", handleDeleteWorkoutDay);
addRecordBtn?.addEventListener("click", promptAddRecord);
removeRecordBtn?.addEventListener("click", toggleRecordsDeleteMode);
preventTapFocusShift(document.getElementById("open-workout-flow"));

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
  if (event.key !== "Enter" || event.shiftKey || event.isComposing) {
    return;
  }
  event.preventDefault();
  if (state.workoutFlow.open) {
    if (!state.workoutFlow.items.length) {
      showToast("Сначала добавь хотя бы одно упражнение");
      return;
    }
    void submitWorkoutFlow();
    return;
  }
  void submitWellbeingNoteFromHome();
});

bootstrap().catch((error) => {
  console.error(error);
  showToast("Не удалось загрузить Mini App");
});

async function bootstrap() {
  requestAnimationFrame(() => {
    syncNavPillPosition(state.activeTab, true);
  });

  const userId = resolveUserId();
  if (!userId) {
    showToast("Не удалось определить пользователя");
    return;
  }
  state.userId = userId;

  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(userId)}`);
  const payload = await response.json();
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
  document.getElementById("streak-value").textContent = String(user.workout_days ?? 0);
}

function renderHistory(history) {
  const root = document.getElementById("history-list");
  root.innerHTML = "";

  if (!history.length) {
    root.innerHTML = emptyCard("Пока нет тренировок. Добавь первую через кнопку на главной.");
    return;
  }

  history.forEach((day, index) => {
    const title = day.workout_name || trainingDayTitle(index);
    const noteBlock = day.note
      ? `<div class="history-note" data-date="${escapeHtml(day.date)}">${escapeHtml(day.note)}</div>`
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
        <article class="history-card" data-date="${escapeHtml(day.date)}">
          <div class="history-head">
            <div class="history-main" data-date="${escapeHtml(day.date)}">${escapeHtml(title)}</div>
            <div class="history-head-right">
              <div class="history-date">${formatDate(day.date)}</div>
              <button class="history-edit-btn" data-date="${escapeHtml(day.date)}" type="button">Изменить</button>
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
      openEditWorkoutFlow(button.dataset.date || "");
    });
  });
  root.querySelectorAll(".history-note[data-date]").forEach((noteNode) => {
    attachLongPress(noteNode, 100, () => {
      void promptEditWorkoutComment(noteNode.dataset.date || "");
    });
  });
  root.querySelectorAll(".history-main[data-date]").forEach((titleNode) => {
    const card = titleNode.closest(".history-card");
    attachLongPress(titleNode, 200, () => {
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
      if (card) {
        card.classList.add("focus-edit");
      }
      promptEditWorkoutTitle(titleNode.dataset.date || "").finally(() => {
        if (card) {
          card.classList.remove("focus-edit");
        }
      });
    });
  });
  animateCollection(root, ".history-card");
  animateExerciseRows(root);
}

function renderRecords(records) {
  const root = document.getElementById("records-list");
  removeRecordBtn?.classList.toggle("active-tool", state.recordsDeleteMode);
  root.innerHTML = "";

  if (!records.length) {
    state.recordsDeleteMode = false;
    removeRecordBtn?.classList.remove("active-tool");
    root.innerHTML = emptyCard("Рекордов пока нет.");
    return;
  }

  records.forEach((record, index) => {
    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="record-card${index === 0 ? " highlight" : ""}${state.recordsDeleteMode ? " delete-mode" : ""}" data-exercise="${escapeHtml(record.exercise)}">
          <div class="record-main">
            <div>
              <div class="record-title">${escapeHtml(record.exercise)}</div>
              <div class="record-date">${record.date ? formatDate(record.date) : "последний лучший результат"}</div>
            </div>
            <div class="record-weight">${record.best_weight} кг${state.recordsDeleteMode ? " <i class='bx bx-trash'></i>" : ""}</div>
          </div>
        </article>
      `
    );
  });

  root.querySelectorAll(".record-card").forEach((card) => {
    card.addEventListener("click", () => {
      if (!state.recordsDeleteMode) {
        return;
      }
      const exercise = decodeHtml(card.dataset.exercise || "");
      if (!exercise) {
        return;
      }
      void deleteRecord(exercise);
    });
  });
  animateCollection(root, ".record-card");
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
  state.activeTab = tab;
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  syncNavPillPosition(tab, false);
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  document.getElementById("screen-title").textContent = titleForTab(tab);
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

function openEditWorkoutFlow(sourceDate) {
  const history = state.payload?.history || [];
  const day = history.find((entry) => entry.date === sourceDate);
  if (!day) {
    showToast("Не удалось открыть тренировку для редактирования");
    return;
  }

  state.workoutFlow.open = true;
  state.workoutFlow.mode = "edit";
  state.workoutFlow.sourceDate = sourceDate;
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.step = "list";
  state.workoutFlow.items = convertHistoryToDraft(day);
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.date = sourceDate;
  state.workoutFlow.saving = false;
  document.getElementById("wellbeing-note").value = day.note || "";
  if (workoutNoteInput) {
    workoutNoteInput.value = day.note || "";
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
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.items = [];
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.step = "list";
  state.workoutFlow.date = todayValue();
  state.workoutFlow.saving = false;
  lastWorkoutStep = "";

  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
  document.getElementById("wellbeing-note").value = "";
  if (workoutNoteInput) {
    workoutNoteInput.value = "";
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

function saveButtonLabel(step, saving) {
  if (saving) {
    return "<i class='bx bxs-right-arrow'></i>";
  }
  if (step === "list") {
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
    const isEditMode = state.workoutFlow.mode === "edit" && Boolean(state.workoutFlow.sourceDate);
    const wellbeingNote = (workoutNoteInput?.value || document.getElementById("wellbeing-note").value).trim();
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

async function submitWellbeingNoteFromHome() {
  if (wellbeingNoteSaving) {
    return;
  }
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }

  const wellbeingNote = (wellbeingNoteInput?.value || "").trim();
  if (!wellbeingNote) {
    showToast("Введи комментарий");
    return;
  }

  const commentDate = todayValue();
  const workoutForCommentDate = (state.payload?.history || []).find((day) => day.date === commentDate);
  if (!workoutForCommentDate || !Array.isArray(workoutForCommentDate.exercises) || !workoutForCommentDate.exercises.length) {
    showToast("Нет тренировки на эту дату");
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
        source_workout_date: workoutForCommentDate.date,
        workout_date: workoutForCommentDate.date,
        workout_name: workoutForCommentDate.workout_name || "",
        wellbeing_note: wellbeingNote,
        exercises: workoutForCommentDate.exercises.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: item.sets,
          reps: item.reps,
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to save wellbeing note");
    }

    showToast("Комментарий сохранен");
    await refreshAppDataStable();
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить комментарий");
  } finally {
    wellbeingNoteSaving = false;
  }
}

async function promptEditWorkoutComment(sourceDate) {
  if (wellbeingNoteSaving) {
    return;
  }
  if (!state.userId || !sourceDate) {
    return;
  }

  const workoutDay = (state.payload?.history || []).find((day) => day.date === sourceDate);
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
        source_workout_date: workoutDay.date,
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

async function promptEditWorkoutTitle(sourceDate) {
  if (wellbeingNoteSaving) {
    return;
  }
  if (!state.userId || !sourceDate) {
    return;
  }

  const workoutDay = (state.payload?.history || []).find((day) => day.date === sourceDate);
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
        source_workout_date: workoutDay.date,
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
  if (state.workoutFlow.mode !== "edit" || !state.workoutFlow.sourceDate) {
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

async function promptAddRecord() {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }

  const exerciseRaw = window.prompt("Название упражнения для рекорда:");
  if (exerciseRaw === null) {
    return;
  }
  const exercise = exerciseRaw.trim();
  if (!exercise) {
    showToast("Введите название упражнения");
    return;
  }

  const weightRaw = window.prompt("Вес рекорда (кг):");
  if (weightRaw === null) {
    return;
  }
  const bestWeight = Number(String(weightRaw).replace(",", "."));
  if (!Number.isFinite(bestWeight) || bestWeight <= 0) {
    showToast("Введите корректный вес");
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
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to save record");
    }
    showToast("Рекорд добавлен");
    await refreshAppDataStable();
  } catch (error) {
    console.error(error);
    showToast("Не удалось добавить рекорд");
  }
}

function toggleRecordsDeleteMode() {
  state.recordsDeleteMode = !state.recordsDeleteMode;
  renderRecords(state.payload?.records || []);
}

async function deleteRecord(exercise) {
  if (!state.userId) {
    showToast("Сначала открой профиль в боте");
    return;
  }

  try {
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
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "failed to delete record");
    }
    showToast(`Рекорд "${exercise}" удален`);
    await refreshAppDataStable();
    if (!(state.payload?.records || []).length) {
      state.recordsDeleteMode = false;
    }
  } catch (error) {
    console.error(error);
    showToast("Не удалось удалить рекорд");
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
