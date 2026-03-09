const telegram = window.Telegram?.WebApp;
if (telegram) telegram.ready();

const state = {
  userId: "",
  payload: null,
  activeTab: "home",
  workoutFlow: {
    open: false,
    mode: "create",
    sourceDate: "",
    step: "list",
    items: [],
    editingIndex: null,
    draft: { sets: 1, reps: 8 },
    date: todayValue(),
    saving: false,
  },
};

const navButtons = [...document.querySelectorAll(".nav-btn")];
const panels = [...document.querySelectorAll(".panel")];
const overlay = document.getElementById("workout-overlay");
const modalSteps = [...document.querySelectorAll(".modal-step")];
const modalTitle = document.getElementById("modal-title");
const saveOverlay = document.getElementById("save-overlay");

const workoutNameInput = document.getElementById("workout-name-input");
const dateInput = document.getElementById("workout-date-input");
const wellbeingNoteInput = document.getElementById("wellbeing-note");

bindClick("open-workout-flow", openWorkoutFlow);
bindClick("close-workout-flow", closeWorkoutFlow);
bindClick("add-draft-item", openDraftFormForCreate);
bindClick("confirm-draft-item", saveDraftItem);
bindClick("save-workout-flow", handleSaveFlowButton);
bindClick("save-wellbeing-note", () => void saveHomeComment());

navButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab || "home"));
});

dateInput.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.value) state.workoutFlow.date = target.value;
});

document.querySelectorAll(".counter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.counter === "sets" ? "sets" : "reps";
    const direction = Number(button.dataset.direction || 0);
    state.workoutFlow.draft[key] = Math.max(1, Number(state.workoutFlow.draft[key]) + direction);
    renderDraftCounters();
  });
});

bootstrap().catch((error) => {
  console.error(error);
  showToast("Не удалось загрузить Mini App");
});

async function bootstrap() {
  const userId = resolveUserId();
  if (!userId) {
    showToast("Не удалось определить пользователя");
    return;
  }
  state.userId = userId;
  await refreshAppData();
}

async function refreshAppData() {
  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(state.userId)}`);
  const payload = await response.json();
  state.payload = payload;

  if (!payload.ready) {
    renderEmptyProfile(payload.message || "Пользователь не найден");
    switchTab("profile");
    return;
  }

  renderProfile(payload.user);
  renderHistory(payload.history || []);
  renderRecords(payload.records || []);
}

function renderEmptyProfile(message) {
  document.getElementById("profile-name").textContent = "Нет данных";
  document.getElementById("weight-value").textContent = "—";
  document.getElementById("height-value").textContent = "—";
  document.getElementById("experience-value").textContent = "—";
  document.getElementById("workouts-value").textContent = "0";
  document.getElementById("history-list").innerHTML = emptyCard(message);
  document.getElementById("records-list").innerHTML = emptyCard("Рекордов пока нет");
}

function renderProfile(user) {
  document.getElementById("profile-name").textContent = user.name || "Пользователь";
  document.getElementById("weight-value").textContent = user.weight ? `${user.weight} кг` : "—";
  document.getElementById("height-value").textContent = user.height ? `${user.height} см` : "—";
  document.getElementById("experience-value").textContent = user.experience || "—";
  document.getElementById("workouts-value").textContent = String(user.workout_days || 0);
  document.getElementById("streak-value").textContent = String(user.workout_days || 0);
}

function renderHistory(history) {
  const root = document.getElementById("history-list");
  root.innerHTML = "";

  if (!history.length) {
    root.innerHTML = emptyCard("Пока нет тренировок");
    return;
  }

  history.forEach((day, index) => {
    const rows = day.exercises
      .map(
        (item) => `
          <div class="exercise-row">
            <span>${escapeHtml(item.exercise)}</span>
            <span>${item.weight} кг · ${item.sets}×${item.reps}</span>
          </div>
        `
      )
      .join("");

    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="history-card" data-date="${escapeHtml(day.date)}">
          <div class="history-head">
            <div class="history-main" data-role="title">${escapeHtml(day.workout_name || trainingDayTitle(index))}</div>
            <div class="history-date">${formatDate(day.date)}</div>
          </div>
          <div class="exercise-list">${rows}</div>
          <div class="history-note" data-role="note">${escapeHtml(day.note || "Без комментария")}</div>
        </article>
      `
    );
  });

  root.querySelectorAll(".history-card").forEach((card) => {
    const date = card.dataset.date || "";
    card.addEventListener("click", () => openEditWorkoutFlow(date));

    const titleNode = card.querySelector('[data-role="title"]');
    const noteNode = card.querySelector('[data-role="note"]');

    if (titleNode) {
      setupLongPress(titleNode, 200, async () => {
        if (navigator.vibrate) navigator.vibrate(10);
        card.classList.add("focus-editing");
        const current = titleNode.textContent || "";
        const next = window.prompt("Новое название тренировки", current);
        card.classList.remove("focus-editing");
        if (next === null) return;
        const value = next.trim();
        if (!value) return;
        await updateWorkoutMeta(date, { workout_name: value });
      });
    }

    if (noteNode) {
      setupLongPress(noteNode, 100, async () => {
        const current = noteNode.textContent === "Без комментария" ? "" : noteNode.textContent || "";
        const next = window.prompt("Измени комментарий", current);
        if (next === null) return;
        await updateWorkoutMeta(date, { wellbeing_note: next.trim() });
      });
    }
  });
}

function renderRecords(records) {
  const root = document.getElementById("records-list");
  root.innerHTML = "";
  if (!records.length) {
    root.innerHTML = emptyCard("Рекордов пока нет");
    return;
  }

  records.forEach((record) => {
    root.insertAdjacentHTML(
      "beforeend",
      `<article class="record-card"><strong>${escapeHtml(record.exercise)}</strong><span>${record.best_weight} кг</span></article>`
    );
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  document.getElementById("screen-title").textContent = tab === "profile" ? "Профиль" : tab === "records" ? "Рекорды" : "Главная";
}

function openWorkoutFlow() {
  state.workoutFlow.open = true;
  state.workoutFlow.mode = "create";
  state.workoutFlow.sourceDate = "";
  state.workoutFlow.step = "list";
  state.workoutFlow.items = [];
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.date = todayValue();
  state.workoutFlow.saving = false;

  workoutNameInput.value = "";
  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
  overlay.hidden = false;
  renderWorkoutFlow();
}

function openEditWorkoutFlow(sourceDate) {
  const day = (state.payload?.history || []).find((entry) => entry.date === sourceDate);
  if (!day) return;

  state.workoutFlow.open = true;
  state.workoutFlow.mode = "edit";
  state.workoutFlow.sourceDate = sourceDate;
  state.workoutFlow.step = "list";
  state.workoutFlow.items = day.exercises.map((item) => ({
    id: item.id,
    exercise: item.exercise,
    weight: item.weight,
    sets: item.sets,
    reps: item.reps,
  }));
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.date = sourceDate;
  state.workoutFlow.saving = false;

  workoutNameInput.value = day.workout_name || "";
  overlay.hidden = false;
  renderWorkoutFlow();
}

function closeWorkoutFlow() {
  state.workoutFlow.open = false;
  overlay.hidden = true;
}

function openDraftFormForCreate() {
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
  state.workoutFlow.step = "form";
  renderWorkoutFlow();
}

function saveDraftItem() {
  const name = document.getElementById("exercise-name-input").value.trim();
  const weightValue = Number(document.getElementById("exercise-weight-input").value);
  const weight = Number.isFinite(weightValue) && weightValue > 0 ? weightValue.toFixed(1) : "0.0";

  if (!name) {
    showToast("Введи название упражнения");
    return;
  }

  const item = {
    exercise: name,
    weight,
    sets: state.workoutFlow.draft.sets,
    reps: state.workoutFlow.draft.reps,
  };

  if (state.workoutFlow.editingIndex === null) {
    state.workoutFlow.items.push(item);
  } else {
    state.workoutFlow.items[state.workoutFlow.editingIndex] = item;
  }

  state.workoutFlow.editingIndex = null;
  state.workoutFlow.step = "list";
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
  renderWorkoutFlow();
}

function handleSaveFlowButton() {
  if (state.workoutFlow.step === "list") {
    if (!state.workoutFlow.items.length) {
      showToast("Добавь минимум одно упражнение");
      return;
    }
    state.workoutFlow.step = "date";
    renderWorkoutFlow();
    return;
  }

  if (state.workoutFlow.step === "date") {
    void submitWorkoutFlow();
  }
}

function renderWorkoutFlow() {
  if (!state.workoutFlow.open) return;

  const step = state.workoutFlow.step;
  modalSteps.forEach((node) => node.classList.toggle("active", node.dataset.step === step));
  modalTitle.textContent = step === "form" ? "Упражнение" : step === "date" ? "Дата" : "Добавить упражнения";

  const saveBtn = document.getElementById("save-workout-flow");
  saveBtn.hidden = step === "form";
  saveBtn.textContent = step === "date" ? (state.workoutFlow.saving ? "..." : "Сохранить") : "Далее";
  saveBtn.disabled = state.workoutFlow.saving;

  if (dateInput.value !== state.workoutFlow.date) {
    dateInput.value = state.workoutFlow.date;
  }

  renderDraftList();
  renderDraftCounters();
}

function renderDraftCounters() {
  document.getElementById("sets-value").textContent = String(state.workoutFlow.draft.sets);
  document.getElementById("reps-value").textContent = String(state.workoutFlow.draft.reps);
}

function renderDraftList() {
  const root = document.getElementById("draft-list");
  root.innerHTML = "";

  if (!state.workoutFlow.items.length) {
    root.innerHTML = '<div class="draft-empty">Упражнений пока нет</div>';
    return;
  }

  state.workoutFlow.items.forEach((item, index) => {
    root.insertAdjacentHTML(
      "beforeend",
      `
      <div class="draft-item" data-index="${index}">
        <div class="draft-main">
          <div class="draft-title">${escapeHtml(item.exercise)}</div>
          <div class="draft-sub">${item.weight} кг · ${item.sets}×${item.reps}</div>
        </div>
        <div class="draft-actions">
          <button type="button" data-action="edit">Изм.</button>
          <button type="button" data-action="delete" class="danger">Удалить</button>
        </div>
      </div>
      `
    );
  });

  root.querySelectorAll(".draft-item").forEach((node) => {
    const index = Number(node.dataset.index);
    if (!Number.isInteger(index)) return;

    setupSwipeActions(node);

    node.querySelectorAll(".draft-actions button").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const action = button.dataset.action;
        if (action === "delete") {
          removeDraftItem(index);
          return;
        }

        const item = state.workoutFlow.items[index];
        if (!item) return;
        state.workoutFlow.editingIndex = index;
        state.workoutFlow.draft = { sets: item.sets, reps: item.reps };
        document.getElementById("exercise-name-input").value = item.exercise;
        document.getElementById("exercise-weight-input").value = item.weight;
        state.workoutFlow.step = "form";
        renderWorkoutFlow();
      });
    });
  });
}

function setupSwipeActions(node) {
  let startX = 0;
  let dragging = false;

  node.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    dragging = true;
  });

  node.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const diff = event.clientX - startX;
    if (diff < -25) {
      node.classList.add("swiped");
    }
    if (diff > 10) {
      node.classList.remove("swiped");
    }
  });

  node.addEventListener("pointerup", () => {
    dragging = false;
  });

  node.addEventListener("pointercancel", () => {
    dragging = false;
  });
}

function removeDraftItem(index) {
  state.workoutFlow.items.splice(index, 1);
  state.workoutFlow.editingIndex = null;
  renderWorkoutFlow();
}

async function submitWorkoutFlow() {
  if (state.workoutFlow.saving) return;
  state.workoutFlow.saving = true;
  renderWorkoutFlow();

  try {
    const isEdit = state.workoutFlow.mode === "edit";
    const response = await fetch("/api/workouts", {
      method: isEdit ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: Number(state.userId),
        source_workout_date: state.workoutFlow.sourceDate || undefined,
        workout_date: state.workoutFlow.date,
        workout_name: workoutNameInput.value.trim(),
        wellbeing_note: "",
        exercises: state.workoutFlow.items.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: Number(item.sets),
          reps: Number(item.reps),
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "save failed");

    // Сброс блока добавления после сохранения.
    resetWorkoutFlowState();
    closeWorkoutFlow();
    showSavedOverlay();
    await refreshAppData();
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить тренировку");
  } finally {
    state.workoutFlow.saving = false;
    renderWorkoutFlow();
  }
}

function resetWorkoutFlowState() {
  state.workoutFlow.mode = "create";
  state.workoutFlow.sourceDate = "";
  state.workoutFlow.step = "list";
  state.workoutFlow.items = [];
  state.workoutFlow.editingIndex = null;
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.date = todayValue();
  workoutNameInput.value = "";
  document.getElementById("exercise-name-input").value = "";
  document.getElementById("exercise-weight-input").value = "";
}

async function saveHomeComment() {
  const note = wellbeingNoteInput.value.trim();
  if (!note) {
    showToast("Введи комментарий");
    return;
  }

  const date = todayValue();
  const day = (state.payload?.history || []).find((entry) => entry.date === date);
  if (!day) {
    showToast("На сегодня нет тренировки");
    return;
  }

  await updateWorkoutMeta(date, { wellbeing_note: note });
  wellbeingNoteInput.value = "";
}

async function updateWorkoutMeta(date, patch) {
  try {
    const response = await fetch("/api/workouts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: Number(state.userId),
        source_workout_date: date,
        workout_date: date,
        ...patch,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || "meta failed");
    await refreshAppData();
    showToast("Сохранено");
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить");
  }
}

function showSavedOverlay() {
  saveOverlay.hidden = false;
  setTimeout(() => {
    saveOverlay.hidden = true;
  }, 1500);
}

function setupLongPress(node, delayMs, handler) {
  let timer = null;
  let started = false;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    started = false;
  };

  node.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    started = true;
    timer = setTimeout(() => {
      if (!started) return;
      handler();
      cancel();
    }, delayMs);
  });

  ["pointerup", "pointerleave", "pointercancel"].forEach((type) => {
    node.addEventListener(type, cancel);
  });

  node.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

function bindClick(id, handler) {
  const node = document.getElementById(id);
  if (!node) return;
  node.addEventListener("click", handler);
}

function resolveUserId() {
  const params = new URLSearchParams(window.location.search);
  const queryUserId = params.get("user_id");
  if (queryUserId) return queryUserId;
  const tgUserId = telegram?.initDataUnsafe?.user?.id;
  return tgUserId ? String(tgUserId) : "";
}

function trainingDayTitle(index) {
  const names = ["День груди", "День спины", "День ног", "День плеч"];
  return names[index % names.length];
}

function formatDate(value) {
  if (!value) return "сегодня";
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyCard(text) {
  return `<article class="history-card"><div class="history-main">${escapeHtml(text)}</div></article>`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
