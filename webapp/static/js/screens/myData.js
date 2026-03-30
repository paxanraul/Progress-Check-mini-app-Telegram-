/*
 * Avatar-overlay с блоком "Мои данные".
 * Модуль переиспользует прежние summary-поля и оставляет старый edit-profile overlay,
 * но открывает его уже не с отдельного экрана, а из всплывающего окна по тапу на аватар.
 */
import { renderTelegramAvatar } from "../ui/telegram.js";

function resetScrollableOverlayState(overlay, modal) {
  [overlay, modal].forEach((node) => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.scrollTop = 0;
    node.scrollLeft = 0;
  });
}

function resetMotionState(overlay, modal) {
  [overlay, modal].forEach((node) => {
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

async function waitForMotionFinish(...animations) {
  const pending = animations
    .filter((animation) => animation?.finished)
    .map((animation) => animation.finished.catch(() => undefined));
  if (!pending.length) {
    return;
  }
  await Promise.all(pending);
}

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
  let overlayTransitioning = false;
  let overlayTransitionRunId = 0;

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

  async function open() {
    if (
      !dom.modals.myData.overlay ||
      !dom.modals.myData.modal ||
      !dom.modals.myData.overlay.hidden ||
      overlayTransitioning
    ) {
      return false;
    }

    const runId = ++overlayTransitionRunId;
    overlayTransitioning = true;
    freezeViewportFor?.(280);
    state.myDataOverlayOpen = true;
    setBodyScrollLock?.(true);
    resetMotionState(dom.modals.myData.overlay, dom.modals.myData.modal);
    resetScrollableOverlayState(dom.modals.myData.overlay, dom.modals.myData.modal);
    dom.modals.myData.overlay.hidden = false;
    const overlayAnimation = runMotion?.(
      dom.modals.myData.overlay,
      { opacity: [0, 1] },
      { duration: 0.18, easing: "ease-out" }
    );
    const modalAnimation = runMotion?.(
      dom.modals.myData.modal,
      { opacity: [0.6, 1], transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"] },
      { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
    );
    await waitForMotionFinish(overlayAnimation, modalAnimation);
    if (overlayTransitionRunId !== runId) {
      return false;
    }
    resetMotionState(dom.modals.myData.overlay, dom.modals.myData.modal);
    resetScrollableOverlayState(dom.modals.myData.overlay, dom.modals.myData.modal);
    overlayTransitioning = false;
    return true;
  }

  async function close({ updateScrollLock = true } = {}) {
    if (!dom.modals.myData.overlay || !dom.modals.myData.modal || dom.modals.myData.overlay.hidden) {
      return false;
    }

    const runId = ++overlayTransitionRunId;
    overlayTransitioning = true;
    state.myDataOverlayOpen = false;
    freezeViewportFor?.(320);
    resetMotionState(dom.modals.myData.overlay, dom.modals.myData.modal);
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
    await waitForMotionFinish(overlayAnimation, modalAnimation);
    if (overlayTransitionRunId !== runId) {
      return false;
    }

    dom.modals.myData.overlay.hidden = true;
    resetMotionState(dom.modals.myData.overlay, dom.modals.myData.modal);
    resetScrollableOverlayState(dom.modals.myData.overlay, dom.modals.myData.modal);
    if (updateScrollLock) {
      updateBodyScrollLockFromVisibleOverlays?.();
    }
    overlayTransitioning = false;
    return true;
  }

  async function openProfileEditor() {
    if (!state.userId) {
      showToast?.("Сначала открой профиль в боте");
      return false;
    }
    if (dom.modals.myData.overlay && !dom.modals.myData.overlay.hidden) {
      await close({ updateScrollLock: false });
    }
    return openProfileOverlay?.();
  }

  function bindEvents() {
    dom.app.topbarUser?.addEventListener("click", () => {
      void open();
    });
    dom.modals.myData.closeButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.myData.openProfileOverlayButton?.addEventListener("click", () => {
      void openProfileEditor();
    });
    dom.modals.myData.overlay?.addEventListener("click", (event) => {
      if (event.target === dom.modals.myData.overlay) {
        void close();
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
