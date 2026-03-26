export const telegram = window.Telegram?.WebApp || null;
export const telegramMainButton = telegram?.MainButton || null;
export const telegramSecondaryButton = telegram?.SecondaryButton || null;

if (telegram) {
  telegram.ready();
  try {
    telegram.expand();
  } catch (error) {
    console.warn("telegram expand failed", error);
  }
}

let lastHapticAt = 0;

export function triggerHaptic(type = "selection") {
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
      if (type === "warning" && typeof haptic.notificationOccurred === "function") {
        haptic.notificationOccurred("warning");
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

export function triggerLightTapHaptic() {
  const now = Date.now();
  if (now - lastHapticAt < 45) {
    return;
  }
  lastHapticAt = now;
  triggerHaptic("selection");
}

export function bindGlobalTapHaptics() {
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
}
