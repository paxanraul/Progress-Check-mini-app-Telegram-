/*
 * Минимальный сервис для коротких toast-уведомлений.
 * Нужен для пользовательской обратной связи в сценариях, где полноценная модалка
 * была бы слишком тяжёлой: сохранение, ошибка валидации, удаление и т.д.
 */
import { runMotion } from "./animation.js";

export function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  runMotion(
    toast,
    {
      opacity: [0, 1],
      transform: ["translate(-50%, -8px)", "translate(-50%, 0px)"],
    },
    { duration: 0.2, easing: "ease-out" }
  );

  setTimeout(() => {
    toast.remove();
  }, 2200);
}
