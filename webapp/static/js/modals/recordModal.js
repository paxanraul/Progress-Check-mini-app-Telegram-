/*
 * Модалка добавления нового личного рекорда.
 * Модуль управляет локальным состоянием сохранения, валидацией полей,
 * синхронизацией превью веса/даты и отправкой записи на backend.
 */
import { closeOverlay, openOverlay } from "../ui/modalBase.js";
import { formatDate, todayValue } from "../shared/utils.js";

export function createRecordModal({
  state,
  dom,
  api,
  interaction,
  showToast,
  refreshAppDataStable,
  syncBottomButtons,
  getBlockingOverlays,
}) {
  let recordFlowSaving = false;
  let transitionInFlight = false;

  function isSaving() {
    return recordFlowSaving;
  }

  // Отдельно поддерживаем визуальные превью в модалке, чтобы пользователь
  // сразу видел, как введённые значения будут выглядеть в карточке рекорда.
  function syncWeightDisplay() {
    if (!dom.modals.record.weightDisplay) {
      return;
    }

    const value = String(dom.modals.record.weightInput?.value || "").trim();
    dom.modals.record.weightDisplay.textContent = value || "100";
    dom.modals.record.weightDisplay.classList.toggle("is-placeholder", !value);
  }

  function syncDateDisplay() {
    if (!dom.modals.record.dateDisplay) {
      return;
    }

    const value = String(dom.modals.record.dateInput?.value || "").trim();
    dom.modals.record.dateDisplay.textContent = value ? formatDate(value) : "сегодня";
  }

  function open() {
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
      return;
    }
    if (
      transitionInFlight ||
      !dom.modals.record.overlay ||
      !dom.modals.record.modal ||
      !dom.modals.record.overlay.hidden
    ) {
      return false;
    }
    transitionInFlight = true;

    recordFlowSaving = false;
    if (dom.modals.record.exerciseInput) {
      dom.modals.record.exerciseInput.value = "";
    }
    if (dom.modals.record.weightInput) {
      dom.modals.record.weightInput.value = "";
    }
    if (dom.modals.record.dateInput) {
      dom.modals.record.dateInput.value = todayValue();
    }

    syncWeightDisplay();
    syncDateDisplay();

    const opened = openOverlay({
      overlay: dom.modals.record.overlay,
      modal: dom.modals.record.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      focusTarget: dom.modals.record.exerciseInput,
    });
    if (!opened) {
      transitionInFlight = false;
      return false;
    }

    syncBottomButtons();
    requestAnimationFrame(() => {
      transitionInFlight = false;
    });
    return true;
  }

  function close() {
    if (!dom.modals.record.overlay || dom.modals.record.overlay.hidden || transitionInFlight) {
      return Promise.resolve(false);
    }

    transitionInFlight = true;
    recordFlowSaving = false;
    return closeOverlay({
      overlay: dom.modals.record.overlay,
      modal: dom.modals.record.modal,
      blurActiveFieldInside: interaction.blurActiveFieldInside,
      freezeViewportFor: interaction.freezeViewportFor,
      restoreViewportAfterClose: interaction.restoreViewportAfterOverlayTransition,
      setBodyScrollLock: interaction.setBodyScrollLock,
      getBlockingOverlays,
    }).then((closed) => {
      syncBottomButtons();
      transitionInFlight = false;
      return closed;
    });
  }

  async function submit() {
    interaction.blurActiveField();

    if (recordFlowSaving) {
      return false;
    }
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
      return false;
    }

    const exercise = String(dom.modals.record.exerciseInput?.value || "").trim();
    if (!exercise) {
      showToast("Введите название упражнения");
      interaction.focusWithoutScroll(dom.modals.record.exerciseInput);
      return false;
    }

    const bestWeight = Number(
      String(dom.modals.record.weightInput?.value || "").replace(",", ".")
    );
    if (!Number.isFinite(bestWeight) || bestWeight <= 0) {
      showToast("Введите корректный вес");
      interaction.focusWithoutScroll(dom.modals.record.weightInput);
      return false;
    }

    const workoutDate = String(dom.modals.record.dateInput?.value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workoutDate)) {
      showToast("Выберите корректную дату");
      interaction.focusWithoutScroll(dom.modals.record.dateInput);
      return false;
    }

    try {
      recordFlowSaving = true;
      syncBottomButtons();

      await api.createRecord({
        user_id: Number(state.userId),
        exercise,
        best_weight: bestWeight,
        workout_date: workoutDate,
      });

      await close();
      showToast("Рекорд добавлен");
      await refreshAppDataStable();
      return true;
    } catch (error) {
      console.error(error);
      showToast("Не удалось добавить рекорд");
      return false;
    } finally {
      recordFlowSaving = false;
      syncBottomButtons();
    }
  }

  // Привязываем и кнопки модалки, и live-обновление отображаемых значений.
  function bindEvents() {
    dom.modals.record.saveButton?.addEventListener("click", () => {
      void submit();
    });
    dom.modals.record.primaryActionButton?.addEventListener("click", () => {
      void submit();
    });
    dom.modals.record.secondaryActionButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.record.overlay?.addEventListener("click", (event) => {
      if (event.target === dom.modals.record.overlay) {
        void close();
      }
    });
    dom.modals.record.weightInput?.addEventListener("change", syncWeightDisplay);
    dom.modals.record.weightInput?.addEventListener("input", syncWeightDisplay);
    dom.modals.record.dateInput?.addEventListener("change", syncDateDisplay);
    dom.modals.record.dateInput?.addEventListener("input", syncDateDisplay);

    syncWeightDisplay();
    syncDateDisplay();
  }

  return {
    bindEvents,
    close,
    isSaving,
    open,
    submit,
  };
}
