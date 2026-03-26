export function createBottomNavigation({
  state,
  dom,
  animatePanelEnter,
  onLeavingProfile,
  onLeavingRecords,
  onActivateHome,
  onActivateRecords,
  onTabChanged,
}) {
  function syncNavPillPosition(tab, immediate = false) {
    if (!dom.navigation.bottomNav || !dom.navigation.navPill) {
      return;
    }

    if (window.getComputedStyle(dom.navigation.navPill).display === "none") {
      return;
    }

    const activeButton = dom.navigation.buttons.find((button) => button.dataset.tab === tab);
    if (!activeButton) {
      return;
    }

    const navRect = dom.navigation.bottomNav.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();
    const x = buttonRect.left - navRect.left;

    dom.navigation.navPill.style.width = `${buttonRect.width}px`;
    if (immediate) {
      dom.navigation.navPill.style.transition = "none";
      dom.navigation.navPill.style.transform = `translateX(${x}px)`;
      void dom.navigation.navPill.offsetWidth;
      dom.navigation.navPill.style.transition = "";
      return;
    }

    dom.navigation.navPill.style.transform = `translateX(${x}px)`;
  }

  function titleForTab(tab) {
    if (tab === "profile") {
      return "Профиль";
    }
    if (tab === "records") {
      return "Рекорды";
    }
    if (tab === "faq") {
      return "Вопросы";
    }
    return "Главная";
  }

  function switchTab(tab) {
    if (!tab || state.activeTab === tab) {
      return;
    }

    if (state.activeTab === "profile" && tab !== "profile") {
      onLeavingProfile?.();
    }
    if (state.activeTab === "records" && tab !== "records") {
      onLeavingRecords?.();
    }

    state.activeTab = tab;

    dom.navigation.buttons.forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tab);
    });
    dom.navigation.panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tab);
    });

    syncNavPillPosition(tab, false);

    if (dom.app.screenTitle) {
      dom.app.screenTitle.textContent = titleForTab(tab);
    }

    if (tab === "records") {
      onActivateRecords?.();
    }
    if (tab === "home") {
      onActivateHome?.();
    }

    onTabChanged?.(tab);

    const panel = dom.navigation.panels.find((node) => node.dataset.panel === tab);
    animatePanelEnter(panel);
  }

  function bindEvents() {
    dom.navigation.buttons.forEach((button) => {
      button.addEventListener("click", () => {
        switchTab(button.dataset.tab);
      });
    });
  }

  return {
    bindEvents,
    switchTab,
    syncNavPillPosition,
  };
}
