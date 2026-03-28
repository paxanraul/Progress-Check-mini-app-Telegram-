/*
 * Avatar-overlay с блоком "Мои данные".
 * Модуль переиспользует прежние summary-поля и оставляет старый edit-profile overlay,
 * но открывает его уже не с отдельного экрана, а из всплывающего окна по тапу на аватар.
 */
import { renderTelegramAvatar } from "../ui/telegram.js";

export function createMyDataOverlay({
  state,
  dom,
  showToast,
  openProfileOverlay,
  setBodyScrollLock,
  freezeViewportFor,
  runMotion,
  updateBodyScrollLockFromVisibleOverlays,
}) {
  function renderProfileSummary(user = {}) {
    renderTelegramAvatar(dom, user);

    if (dom.modals.myData.name) {
      dom.modals.myData.name.textContent = user.name || "Пользователь";
    }
    if (dom.modals.myData.weight) {
      dom.modals.myData.weight.textContent = user.weight ? `${user.weight} кг` : "—";
    }
    if (dom.modals.myData.height) {
      dom.modals.myData.height.textContent = user.height ? `${user.height} см` : "—";
    }
    if (dom.modals.myData.experience) {
      dom.modals.myData.experience.textContent = user.experience || "—";
    }
    if (dom.modals.myData.workouts) {
      dom.modals.myData.workouts.textContent = String(user.workout_days ?? 0);
    }
  }

  function open() {
    if (!dom.modals.myData.overlay || !dom.modals.myData.modal) {
      return;
    }
    freezeViewportFor?.(280);
    state.myDataOverlayOpen = true;
    setBodyScrollLock?.(true);
    dom.modals.myData.overlay.hidden = false;
    runMotion?.(dom.modals.myData.overlay, { opacity: [0, 1] }, { duration: 0.18, easing: "ease-out" });
    runMotion?.(
      dom.modals.myData.modal,
      { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
      { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
    );
  }

  function close() {
    if (!dom.modals.myData.overlay || dom.modals.myData.overlay.hidden) {
      return;
    }

    state.myDataOverlayOpen = false;
    freezeViewportFor?.(320);
    const overlayAnimation = runMotion?.(
      dom.modals.myData.overlay,
      { opacity: [1, 0] },
      { duration: 0.14, easing: "ease-out" }
    );
    const modalAnimation = runMotion?.(
      dom.modals.myData.modal,
      { opacity: [1, 0.75], transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"] },
      { duration: 0.16, easing: "ease-in" }
    );
    overlayAnimation?.finished?.catch(() => undefined);
    modalAnimation?.finished?.catch(() => undefined);

    setTimeout(() => {
      dom.modals.myData.overlay.hidden = true;
      updateBodyScrollLockFromVisibleOverlays?.();
    }, 170);
  }

  function openProfileEditor() {
    if (!state.userId) {
      showToast?.("Сначала открой профиль в боте");
      return;
    }
    if (dom.modals.myData.overlay && !dom.modals.myData.overlay.hidden) {
      state.myDataOverlayOpen = false;
      dom.modals.myData.overlay.hidden = true;
    }
    openProfileOverlay?.();
  }

  function bindEvents() {
    dom.app.topbarUser?.addEventListener("click", open);
    dom.modals.myData.closeButton?.addEventListener("click", close);
    dom.modals.myData.openProfileOverlayButton?.addEventListener("click", openProfileEditor);
    dom.modals.myData.overlay?.addEventListener("click", (event) => {
      if (event.target === dom.modals.myData.overlay) {
        close();
      }
    });
  }

  return {
    bindEvents,
    close,
    open,
    openProfileEditor,
    renderProfileSummary,
  };
}
