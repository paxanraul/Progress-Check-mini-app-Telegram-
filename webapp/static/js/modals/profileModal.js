import { closeOverlay, openOverlay } from "../ui/modalBase.js";

export function createProfileModal({
  state,
  dom,
  api,
  interaction,
  showToast,
  triggerHaptic,
  refreshAppDataStable,
  getBlockingOverlays,
}) {
  let profileSaving = false;

  function fillProfileOverlayForm() {
    const user = state.payload?.user || {};
    if (dom.modals.profile.nameInput) {
      dom.modals.profile.nameInput.value = user.name || "";
    }
    if (dom.modals.profile.weightInput) {
      dom.modals.profile.weightInput.value = user.weight
        ? String(user.weight).replace(",", ".")
        : "";
    }
    if (dom.modals.profile.heightInput) {
      dom.modals.profile.heightInput.value = user.height
        ? String(user.height).replace(",", ".")
        : "";
    }
    if (dom.modals.profile.experienceInput) {
      dom.modals.profile.experienceInput.value =
        user.experience && user.experience !== "Не заполнено"
          ? String(user.experience)
          : "";
    }
  }

  function open() {
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
      return;
    }

    state.profileOverlayOpen = true;
    fillProfileOverlayForm();

    openOverlay({
      overlay: dom.modals.profile.overlay,
      modal: dom.modals.profile.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      focusTarget: dom.modals.profile.nameInput,
    });
  }

  function close() {
    if (!dom.modals.profile.overlay || dom.modals.profile.overlay.hidden) {
      return Promise.resolve(false);
    }

    state.profileOverlayOpen = false;
    return closeOverlay({
      overlay: dom.modals.profile.overlay,
      modal: dom.modals.profile.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      getBlockingOverlays,
    });
  }

  async function save() {
    interaction.blurActiveField();
    if (profileSaving || !state.userId) {
      return false;
    }

    const name = String(dom.modals.profile.nameInput?.value || "").trim();
    const weight = Number(String(dom.modals.profile.weightInput?.value || "").replace(",", "."));
    const height = Number(String(dom.modals.profile.heightInput?.value || "").replace(",", "."));
    const experience = String(dom.modals.profile.experienceInput?.value || "").trim();

    if (!name) {
      showToast("Введите имя");
      interaction.focusWithoutScroll(dom.modals.profile.nameInput);
      return false;
    }
    if (!Number.isFinite(weight) || weight <= 0) {
      showToast("Введите корректный вес");
      interaction.focusWithoutScroll(dom.modals.profile.weightInput);
      return false;
    }
    if (!Number.isFinite(height) || height <= 0) {
      showToast("Введите корректный рост");
      interaction.focusWithoutScroll(dom.modals.profile.heightInput);
      return false;
    }

    try {
      profileSaving = true;
      await api.updateProfile({
        user_id: Number(state.userId),
        name,
        weight,
        height,
        experience,
      });

      triggerHaptic("success");
      await close();
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

  async function clearAllData() {
    if (profileSaving || !state.userId) {
      return false;
    }

    const confirmed = window.confirm("Очистить профиль, историю тренировок и рекорды?");
    if (!confirmed) {
      return false;
    }

    try {
      profileSaving = true;
      await api.clearProfile(state.userId);
      triggerHaptic("warning");
      await close();
      showToast("Все данные очищены");
      await refreshAppDataStable();
      return true;
    } catch (error) {
      console.error(error);
      showToast("Не удалось очистить данные");
      return false;
    } finally {
      profileSaving = false;
    }
  }

  function bindEvents() {
    dom.modals.profile.closeButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.profile.cancelButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.profile.saveButton?.addEventListener("click", () => {
      void save();
    });
    dom.modals.profile.clearButton?.addEventListener("click", () => {
      void clearAllData();
    });
    dom.modals.profile.overlay?.addEventListener("click", (event) => {
      if (event.target === dom.modals.profile.overlay) {
        void close();
      }
    });
  }

  return {
    bindEvents,
    close,
    open,
    save,
  };
}
