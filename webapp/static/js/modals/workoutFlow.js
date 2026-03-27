import { DEFAULT_WORKOUT_DRAFT } from "../core/constants.js";
import { escapeHtml, formatDate, todayValue } from "../shared/utils.js";
import { animateDraftItems, animateWorkoutStep } from "../ui/animation.js";
import { closeOverlay, openOverlay } from "../ui/modalBase.js";

function cloneDefaultDraft() {
  return { ...DEFAULT_WORKOUT_DRAFT };
}

function previousWorkoutStep(step) {
  if (step === "form") {
    return "list";
  }
  if (step === "comment") {
    return "list";
  }
  if (step === "date") {
    return "comment";
  }
  return "";
}

export function createWorkoutFlowModal({
  state,
  dom,
  api,
  interaction,
  showToast,
  refreshAppData,
  refreshAppDataStable,
  syncBottomButtons,
  getBlockingOverlays,
}) {
  let lastWorkoutStep = "";

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

  function seedDraftFromHistory(day) {
    state.workoutFlow.items = convertHistoryToDraft(day);
  }

  function resetWorkoutFlowForNewEntry() {
    state.workoutFlow.mode = "create";
    state.workoutFlow.sourceDate = "";
    state.workoutFlow.sourceSessionKey = "";
    state.workoutFlow.editingIndex = null;
    state.workoutFlow.items = [];
    state.workoutFlow.draft = cloneDefaultDraft();
    state.workoutFlow.step = "list";
    state.workoutFlow.date = todayValue();
    state.workoutFlow.saving = false;
    lastWorkoutStep = "";

    if (dom.modals.workout.exerciseNameInput) {
      dom.modals.workout.exerciseNameInput.value = "";
    }
    if (dom.modals.workout.exerciseWeightInput) {
      dom.modals.workout.exerciseWeightInput.value = "";
    }
    if (dom.modals.workout.wellbeingNoteInput) {
      dom.modals.workout.wellbeingNoteInput.value = "";
    }
    if (dom.modals.workout.workoutNameInput) {
      dom.modals.workout.workoutNameInput.value = "";
    }
  }

  function workoutTitle(step) {
    if (step === "form") {
      return state.workoutFlow.editingIndex === null ? "Параметры упражнения" : "Изменить упражнение";
    }
    if (step === "comment") {
      return "";
    }
    if (step === "date") {
      return "Дата";
    }
    if (step === "done") {
      return "Сохранено";
    }
    if (state.workoutFlow.mode === "edit") {
      return "Изменить тренировку";
    }
    return "Добавить упражнения";
  }

  function saveButtonLabel() {
    return "<i class='bx bxs-right-arrow'></i>";
  }

  function renderDraftCounters() {
    if (dom.modals.workout.setsValue) {
      dom.modals.workout.setsValue.textContent = String(state.workoutFlow.draft.sets);
    }
    if (dom.modals.workout.repsValue) {
      dom.modals.workout.repsValue.textContent = String(state.workoutFlow.draft.reps);
    }
  }

  function openDraftFormForCreate() {
    state.workoutFlow.editingIndex = null;
    state.workoutFlow.draft = cloneDefaultDraft();
    if (dom.modals.workout.exerciseNameInput) {
      dom.modals.workout.exerciseNameInput.value = "";
    }
    if (dom.modals.workout.exerciseWeightInput) {
      dom.modals.workout.exerciseWeightInput.value = "";
    }
    setStep("form");
  }

  function openDraftFormForEdit(index) {
    const item = state.workoutFlow.items[index];
    if (!item) {
      return;
    }

    state.workoutFlow.editingIndex = index;
    state.workoutFlow.draft = {
      sets: Number(item.sets) || 1,
      reps: Number(item.reps) || 1,
    };
    if (dom.modals.workout.exerciseNameInput) {
      dom.modals.workout.exerciseNameInput.value = item.exercise || "";
    }
    if (dom.modals.workout.exerciseWeightInput) {
      dom.modals.workout.exerciseWeightInput.value = item.weight || "";
    }
    setStep("form");
  }

  function renderDraftList() {
    if (!dom.modals.workout.draftList) {
      return;
    }

    dom.modals.workout.draftList.innerHTML = "";
    if (!state.workoutFlow.items.length) {
      return;
    }

    state.workoutFlow.items.forEach((item, index) => {
      dom.modals.workout.draftList.insertAdjacentHTML(
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

    dom.modals.workout.draftList.querySelectorAll(".draft-action-btn").forEach((actionButton) => {
      actionButton.addEventListener("click", (event) => {
        event.stopPropagation();
        const index = Number(actionButton.dataset.index);
        const action = actionButton.dataset.action;
        if (!Number.isInteger(index) || !state.workoutFlow.items[index] || !action) {
          return;
        }

        if (action === "delete") {
          removeDraftItem(index);
          return;
        }

        openDraftFormForEdit(index);
      });
    });

    animateDraftItems([...dom.modals.workout.draftList.querySelectorAll(".draft-item")]);
  }

  function render() {
    if (!state.workoutFlow.open) {
      syncBottomButtons();
      return;
    }

    const step = state.workoutFlow.step;
    dom.modals.workout.steps.forEach((node) => {
      node.classList.toggle("active", node.dataset.step === step);
    });

    if (lastWorkoutStep !== step) {
      const activeStep = dom.modals.workout.steps.find((node) => node.dataset.step === step);
      animateWorkoutStep(activeStep);
      lastWorkoutStep = step;
    }

    if (dom.modals.workout.title) {
      dom.modals.workout.title.textContent = workoutTitle(step);
    }
    if (dom.modals.workout.saveButton) {
      dom.modals.workout.saveButton.hidden = true;
      dom.modals.workout.saveButton.innerHTML = saveButtonLabel();
      dom.modals.workout.saveButton.disabled = true;
    }
    if (dom.modals.workout.deleteWorkoutDayButton) {
      dom.modals.workout.deleteWorkoutDayButton.hidden = !(
        state.workoutFlow.mode === "edit" && step === "list"
      );
      dom.modals.workout.deleteWorkoutDayButton.disabled = state.workoutFlow.saving;
    }

    if (step === "list") {
      renderDraftList();
    }
    if (step === "comment" && dom.modals.workout.wellbeingNoteInput) {
      requestAnimationFrame(() => {
        interaction.focusWithoutScroll(dom.modals.workout.wellbeingNoteInput);
      });
    }

    renderDraftCounters();

    if (
      dom.modals.workout.dateInput &&
      dom.modals.workout.dateInput.value !== state.workoutFlow.date
    ) {
      dom.modals.workout.dateInput.value = state.workoutFlow.date;
    }
    if (dom.modals.workout.datePreview) {
      dom.modals.workout.datePreview.textContent = formatDate(state.workoutFlow.date).replaceAll(
        ".",
        " "
      );
    }
    if (dom.modals.workout.savedSummary) {
      dom.modals.workout.savedSummary.textContent =
        `Сохранено упражнений: ${state.workoutFlow.items.length}. Дата: ${formatDate(state.workoutFlow.date)}.`;
    }

    syncBottomButtons();
  }

  function setStep(step) {
    state.workoutFlow.step = step;
    render();
  }

  function removeDraftItem(index) {
    if (!state.workoutFlow.items[index]) {
      return;
    }

    state.workoutFlow.items.splice(index, 1);
    if (state.workoutFlow.editingIndex === index) {
      state.workoutFlow.editingIndex = null;
    } else if (
      state.workoutFlow.editingIndex !== null &&
      state.workoutFlow.editingIndex > index
    ) {
      state.workoutFlow.editingIndex -= 1;
    }

    render();
  }

  function saveDraftItem() {
    const name = dom.modals.workout.exerciseNameInput?.value.trim() || "";
    const weight = Number(dom.modals.workout.exerciseWeightInput?.value);

    if (!name) {
      showToast("Введи название упражнения");
      interaction.focusWithoutScroll(dom.modals.workout.exerciseNameInput);
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

    if (dom.modals.workout.exerciseNameInput) {
      dom.modals.workout.exerciseNameInput.value = "";
    }
    if (dom.modals.workout.exerciseWeightInput) {
      dom.modals.workout.exerciseWeightInput.value = "";
    }
    state.workoutFlow.editingIndex = null;
    state.workoutFlow.draft = cloneDefaultDraft();
    state.workoutFlow.step = "list";
    render();
    return true;
  }

  async function submitWorkoutFlow() {
    if (state.workoutFlow.saving) {
      return false;
    }

    state.workoutFlow.saving = true;
    render();

    try {
      const isEditMode =
        state.workoutFlow.mode === "edit" &&
        Boolean(state.workoutFlow.sourceSessionKey || state.workoutFlow.sourceDate);
      const wellbeingNote = String(dom.modals.workout.wellbeingNoteInput?.value || "").trim();
      const workoutName = String(dom.modals.workout.workoutNameInput?.value || "").trim();
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

      await api.saveWorkout(payload, { editMode: isEditMode });
      await refreshAppData();
      resetWorkoutFlowForNewEntry();
      showToast("Тренировка сохранена. Можно добавить новую");
      render();
      return true;
    } catch (error) {
      console.error(error);
      showToast("Не удалось сохранить тренировку");
      return false;
    } finally {
      state.workoutFlow.saving = false;
      render();
    }
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

    const confirmed = window.confirm(
      `Удалить тренировку за ${formatDate(state.workoutFlow.sourceDate)}?`
    );
    if (!confirmed) {
      return;
    }

    state.workoutFlow.saving = true;
    render();

    try {
      await api.deleteWorkout({
        user_id: Number(state.userId),
        workout_date: state.workoutFlow.sourceDate,
        session_key: state.workoutFlow.sourceSessionKey,
      });

      showToast("Тренировка удалена");
      await refreshAppDataStable();
      await close();
    } catch (error) {
      console.error(error);
      showToast("Не удалось удалить тренировку");
    } finally {
      state.workoutFlow.saving = false;
      render();
    }
  }

  async function handlePrimaryAction() {
    interaction.blurActiveField();

    if (state.workoutFlow.step === "list") {
      if (!state.workoutFlow.items.length) {
        showToast("Сначала добавь хотя бы одно упражнение");
        return false;
      }
      state.workoutFlow.step = "comment";
      render();
      return true;
    }

    if (state.workoutFlow.step === "comment") {
      state.workoutFlow.step = "date";
      render();
      return true;
    }

    if (state.workoutFlow.step === "date") {
      return submitWorkoutFlow();
    }

    if (state.workoutFlow.step === "done") {
      await close();
      return true;
    }

    return false;
  }

  function open() {
    state.workoutFlow.open = true;
    resetWorkoutFlowForNewEntry();

    openOverlay({
      overlay: dom.modals.workout.overlay,
      modal: dom.modals.workout.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      modalKeyframes: {
        opacity: [0.6, 1],
        transform: ["translateY(24px) scale(0.98)", "translateY(0px) scale(1)"],
      },
      modalOptions: { duration: 0.28, easing: [0.22, 1, 0.36, 1] },
    });

    render();
  }

  async function close() {
    if (!state.workoutFlow.open) {
      return false;
    }

    state.workoutFlow.open = false;
    lastWorkoutStep = "";

    const closed = await closeOverlay({
      overlay: dom.modals.workout.overlay,
      modal: dom.modals.workout.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      getBlockingOverlays,
      overlayOptions: { duration: 0.16, easing: "ease-out" },
      modalKeyframes: {
        opacity: [1, 0.6],
        transform: ["translateY(0px) scale(1)", "translateY(18px) scale(0.98)"],
      },
      modalOptions: { duration: 0.18, easing: "ease-in" },
      delayMs: 180,
    });

    syncBottomButtons();
    return closed;
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
    state.workoutFlow.draft = cloneDefaultDraft();
    state.workoutFlow.date = day.date || sourceDate;
    state.workoutFlow.saving = false;
    lastWorkoutStep = "";

    if (dom.modals.workout.wellbeingNoteInput) {
      dom.modals.workout.wellbeingNoteInput.value = day.note || "";
    }
    if (dom.modals.workout.workoutNameInput) {
      dom.modals.workout.workoutNameInput.value = day.workout_name || "";
    }

    openOverlay({
      overlay: dom.modals.workout.overlay,
      modal: dom.modals.workout.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      modalKeyframes: {
        opacity: [0.6, 1],
        transform: ["translateY(24px) scale(0.98)", "translateY(0px) scale(1)"],
      },
      modalOptions: { duration: 0.28, easing: [0.22, 1, 0.36, 1] },
    });

    render();
  }

  function bindEvents() {
    dom.modals.workout.closeButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.workout.addDraftItemButton?.addEventListener("click", openDraftFormForCreate);
    dom.modals.workout.confirmDraftItemButton?.addEventListener("click", saveDraftItem);
    dom.modals.workout.saveButton?.addEventListener("click", () => {
      void handlePrimaryAction();
    });
    dom.modals.workout.primaryActionButton?.addEventListener("click", () => {
      void handlePrimaryAction();
    });
    dom.modals.workout.secondaryActionButton?.addEventListener("click", () => {
      const previousStep = previousWorkoutStep(state.workoutFlow.step);
      if (previousStep) {
        setStep(previousStep);
        return;
      }
      void close();
    });
    dom.modals.workout.deleteWorkoutDayButton?.addEventListener("click", () => {
      void handleDeleteWorkoutDay();
    });
    dom.modals.workout.dateInput?.addEventListener("change", (event) => {
      if (!event.target.value) {
        return;
      }
      state.workoutFlow.date = event.target.value;
    });

    dom.modals.workout.counterButtons.forEach((button) => {
      interaction.preventTapFocusShift(button);
      button.addEventListener("click", () => {
        const counter = button.dataset.counter;
        const direction = Number(button.dataset.direction);
        const key = counter === "sets" ? "sets" : "reps";
        const nextValue = Math.max(
          1,
          Number(state.workoutFlow.draft[key] || 1) + direction
        );
        state.workoutFlow.draft[key] = nextValue;
        renderDraftCounters();
      });
    });
  }

  return {
    bindEvents,
    close,
    handlePrimaryAction,
    open,
    openDraftFormForCreate,
    openEditWorkoutFlow,
    render,
    saveDraftItem,
    seedDraftFromHistory,
  };
}
