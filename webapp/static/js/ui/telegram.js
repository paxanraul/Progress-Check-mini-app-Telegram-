/*
 * Адаптер над Telegram Web App API.
 * Модуль инициализирует mini-app внутри клиента Telegram,
 * отдаёт ссылки на MainButton/SecondaryButton и инкапсулирует haptic feedback,
 * чтобы остальной код не зависел от низкоуровневых деталей платформы.
 */
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

// Отдаём Telegram-пользователя отдельной функцией, чтобы UI-модули не читали WebApp API напрямую.
export function getTelegramUser() {
  return telegram?.initDataUnsafe?.user || null;
}

// Буквенный fallback нужен, когда Telegram не прислал photo_url или картинка не загрузилась.
export function avatarFallbackLetter(profileUser = null) {
  const telegramUser = getTelegramUser();
  const candidate = String(
    telegramUser?.first_name ||
      telegramUser?.username ||
      profileUser?.name ||
      "U"
  ).trim();

  return (candidate[0] || "U").toUpperCase();
}

// Модульный аналог логики из app.js: рисуем Telegram avatar в topbar и откатываемся к букве при ошибке.
export function renderTelegramAvatar(dom, profileUser = null) {
  const avatarNode = dom?.app?.topbarAvatar;
  const fallbackNode = dom?.app?.topbarAvatarFallback;
  if (!avatarNode || !fallbackNode) {
    return;
  }

  const telegramUser = getTelegramUser();
  const photoUrl = String(profileUser?.avatar_url || telegramUser?.photo_url || "").trim();

  fallbackNode.textContent = avatarFallbackLetter(profileUser);
  fallbackNode.hidden = false;

  if (!photoUrl) {
    avatarNode.hidden = true;
    avatarNode.removeAttribute("src");
    avatarNode.onload = null;
    avatarNode.onerror = null;
    return;
  }

  avatarNode.onload = () => {
    fallbackNode.hidden = true;
  };
  avatarNode.onerror = () => {
    avatarNode.hidden = true;
    avatarNode.removeAttribute("src");
    fallbackNode.hidden = false;
  };
  avatarNode.src = photoUrl;
  avatarNode.hidden = false;
}

// Единая точка вызова тактильной отдачи с fallback на `navigator.vibrate`.
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

// Глобально вешаем лёгкий haptic на основные tappable-элементы интерфейса.
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
