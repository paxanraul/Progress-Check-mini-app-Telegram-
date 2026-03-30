/*
 * Базовая механика открытия и закрытия модальных окон.
 * Вместо того чтобы дублировать одинаковый код в каждой модалке,
 * этот модуль берёт на себя показ оверлея, анимацию, блокировку прокрутки,
 * фокусировку поля и корректное снятие lock после закрытия.
 */
import { runMotion } from "./animation.js";

const DEFAULT_OPEN_OVERLAY_OPTIONS = { duration: 0.18, easing: "ease-out" };
const DEFAULT_OPEN_MODAL_KEYFRAMES = {
  opacity: [0.6, 1],
  transform: ["translateY(18px) scale(0.985)", "translateY(0px) scale(1)"],
};
const DEFAULT_OPEN_MODAL_OPTIONS = { duration: 0.24, easing: [0.22, 1, 0.36, 1] };

const DEFAULT_CLOSE_OVERLAY_OPTIONS = { duration: 0.14, easing: "ease-out" };
const DEFAULT_CLOSE_MODAL_KEYFRAMES = {
  opacity: [1, 0.75],
  transform: ["translateY(0px) scale(1)", "translateY(12px) scale(0.99)"],
};
const DEFAULT_CLOSE_MODAL_OPTIONS = { duration: 0.16, easing: "ease-in" };

function isOverlayTransitioning(overlay) {
  return overlay?.dataset.transitioning === "true";
}

function setOverlayTransitioning(overlay, active) {
  if (!overlay) {
    return;
  }
  overlay.dataset.transitioning = active ? "true" : "false";
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

export function hasVisibleBlockingOverlay(overlays) {
  return overlays.some((node) => node && !node.hidden);
}

export function updateBodyScrollLockFromVisibleOverlays(overlays, setBodyScrollLock) {
  setBodyScrollLock(hasVisibleBlockingOverlay(overlays));
}

// Унифицированное открытие любого overlay + modal-пары.
export function openOverlay({
  overlay,
  modal,
  freezeViewportFor,
  setBodyScrollLock,
  focusTarget,
  overlayKeyframes = { opacity: [0, 1] },
  overlayOptions = DEFAULT_OPEN_OVERLAY_OPTIONS,
  modalKeyframes = DEFAULT_OPEN_MODAL_KEYFRAMES,
  modalOptions = DEFAULT_OPEN_MODAL_OPTIONS,
}) {
  if (!overlay || !modal || !overlay.hidden || isOverlayTransitioning(overlay)) {
    return false;
  }

  setOverlayTransitioning(overlay, true);
  freezeViewportFor?.(280);
  setBodyScrollLock?.(true);
  resetMotionState(overlay, modal);
  resetScrollableOverlayState(overlay, modal);
  overlay.hidden = false;
  const overlayAnimation = runMotion(overlay, overlayKeyframes, overlayOptions);
  const modalAnimation = runMotion(modal, modalKeyframes, modalOptions);

  if (focusTarget) {
    requestAnimationFrame(() => {
      if (overlay.hidden) {
        return;
      }
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    });
  }

  waitForMotionFinish(overlayAnimation, modalAnimation).finally(() => {
    resetMotionState(overlay, modal);
    resetScrollableOverlayState(overlay, modal);
    setOverlayTransitioning(overlay, false);
  });
  return true;
}

// Унифицированное закрытие модалки с ожиданием завершения анимации.
export async function closeOverlay({
  overlay,
  modal,
  blurActiveFieldInside,
  freezeViewportFor,
  restoreViewportAfterClose,
  setBodyScrollLock,
  getBlockingOverlays = () => [overlay],
  overlayKeyframes = { opacity: [1, 0] },
  overlayOptions = DEFAULT_CLOSE_OVERLAY_OPTIONS,
  modalKeyframes = DEFAULT_CLOSE_MODAL_KEYFRAMES,
  modalOptions = DEFAULT_CLOSE_MODAL_OPTIONS,
  delayMs = 170,
}) {
  if (!overlay || !modal || overlay.hidden || isOverlayTransitioning(overlay)) {
    return false;
  }

  setOverlayTransitioning(overlay, true);
  blurActiveFieldInside?.(overlay);
  freezeViewportFor?.(320);

  const overlayAnimation = runMotion(overlay, overlayKeyframes, overlayOptions);
  const modalAnimation = runMotion(modal, modalKeyframes, modalOptions);
  await Promise.race([
    waitForMotionFinish(overlayAnimation, modalAnimation),
    new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    }),
  ]);

  overlay.hidden = true;
  resetMotionState(overlay, modal);
  resetScrollableOverlayState(overlay, modal);
  updateBodyScrollLockFromVisibleOverlays(getBlockingOverlays(), setBodyScrollLock);
  setOverlayTransitioning(overlay, false);
  restoreViewportAfterClose?.();
  return true;
}
