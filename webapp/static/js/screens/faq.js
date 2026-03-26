import { emptyCard, escapeHtml, faqTitle } from "../shared/utils.js";

export function createFaqScreen({ state, dom, animateCollection }) {
  function renderTabs(faqData = {}) {
    if (!dom.faq.tabs) {
      return;
    }

    dom.faq.tabs.innerHTML = "";
    Object.keys(faqData).forEach((key) => {
      const button = document.createElement("button");
      button.className = `chip${key === state.faqCategory ? " active" : ""}`;
      button.type = "button";
      button.textContent = faqTitle(key);
      button.addEventListener("click", () => {
        state.faqCategory = key;
        renderTabs(faqData);
        render();
      });
      dom.faq.tabs.appendChild(button);
    });
  }

  function render() {
    const faqData = state.payload?.faq || {};
    const items = faqData[state.faqCategory] || [];
    const filtered = items.filter((item) => {
      if (!state.faqQuery) {
        return true;
      }
      const fullText = `${item.question} ${item.answer}`.toLowerCase();
      return fullText.includes(state.faqQuery);
    });

    if (!dom.faq.list) {
      return;
    }

    dom.faq.list.innerHTML = "";
    if (!filtered.length) {
      dom.faq.list.innerHTML = emptyCard("Ничего не найдено.");
      return;
    }

    filtered.forEach((item, index) => {
      dom.faq.list.insertAdjacentHTML(
        "beforeend",
        `
          <details class="faq-card"${index === 0 ? " open" : ""}>
            <summary>${escapeHtml(item.question)}</summary>
            <p>${escapeHtml(item.answer)}</p>
          </details>
        `
      );
    });

    animateCollection(dom.faq.list, ".faq-card");
  }

  function bindEvents() {
    dom.faq.search?.addEventListener("input", (event) => {
      state.faqQuery = event.target.value.trim().toLowerCase();
      render();
    });
  }

  return {
    bindEvents,
    render,
    renderTabs,
  };
}
