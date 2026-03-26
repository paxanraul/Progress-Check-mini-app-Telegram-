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

export function hasVisibleBlockingOverlay(overlays) {
  return overlays.some((node) => node && !node.hidden);
}

export function updateBodyScrollLockFromVisibleOverlays(overlays, setBodyScrollLock) {
  setBodyScrollLock(hasVisibleBlockingOverlay(overlays));
}

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
  if (!overlay) {
    return;
  }

  freezeViewportFor?.(280);
  setBodyScrollLock?.(true);
  overlay.hidden = false;
  runMotion(overlay, overlayKeyframes, overlayOptions);
  runMotion(modal, modalKeyframes, modalOptions);

  if (focusTarget) {
    requestAnimationFrame(() => {
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    });
  }
}

export async function closeOverlay({
  overlay,
  modal,
  freezeViewportFor,
  setBodyScrollLock,
  getBlockingOverlays = () => [overlay],
  overlayKeyframes = { opacity: [1, 0] },
  overlayOptions = DEFAULT_CLOSE_OVERLAY_OPTIONS,
  modalKeyframes = DEFAULT_CLOSE_MODAL_KEYFRAMES,
  modalOptions = DEFAULT_CLOSE_MODAL_OPTIONS,
  delayMs = 170,
}) {
  if (!overlay || overlay.hidden) {
    return false;
  }

  freezeViewportFor?.(320);

  const overlayAnimation = runMotion(overlay, overlayKeyframes, overlayOptions);
  const modalAnimation = runMotion(modal, modalKeyframes, modalOptions);

  if (overlayAnimation?.finished) {
    overlayAnimation.finished.catch(() => undefined);
  }
  if (modalAnimation?.finished) {
    modalAnimation.finished.catch(() => undefined);
  }

  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });

  overlay.hidden = true;
  updateBodyScrollLockFromVisibleOverlays(getBlockingOverlays(), setBodyScrollLock);
  return true;
}
