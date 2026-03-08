(function () {
  const data = window.MDJ_DATA || { projects: [], reviews: [], telegramUrl: "#", phone: "" };
  const TELEGRAM = data.telegramUrl;
  const PHONE = (data.phone || "").replace(/[^\d+]/g, "");
  const QUIZ_SUPPRESS_MS = 7 * 24 * 60 * 60 * 1000;

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function isMobile() {
    return window.matchMedia("(max-width: 1023px)").matches;
  }

  function trackEvent(name, params) {
    if (window.dataLayer && Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: name, ...params });
    }
    if (typeof window.ym === "function") {
      try {
        window.ym(window.MDJ_METRIKA_ID || 0, "reachGoal", name, params || {});
      } catch (error) {
        void error;
      }
    }
  }

  function bindHeaderHideOnScroll() {
    const header = qs(".site-header");
    if (!header) return;
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const curr = window.scrollY;
      if (curr > lastY && curr > 120) header.classList.add("hidden");
      else header.classList.remove("hidden");
      lastY = curr;
    });
  }

  function bindGlobalLinks() {
    qsa("[data-telegram]").forEach((el) => {
      el.href = TELEGRAM;
      el.addEventListener("click", () => trackEvent("telegram_click", { location: location.pathname }));
    });
    qsa("[data-phone]").forEach((el) => {
      el.href = `tel:${PHONE}`;
      el.addEventListener("click", () => trackEvent("phone_click", { location: location.pathname }));
    });
  }

  function bindCookies() {
    const banner = qs(".cookie-banner");
    if (!banner) return;
    if (localStorage.getItem("mdjCookiesChoice")) {
      banner.classList.add("hidden");
      return;
    }
    qsa("[data-cookie]", banner).forEach((btn) => {
      btn.addEventListener("click", () => {
        localStorage.setItem("mdjCookiesChoice", btn.dataset.cookie);
        banner.classList.add("hidden");
      });
    });
  }

  function toggleFloatingCtas(hidden) {
    qsa(".floating-cta").forEach((el) => {
      if (hidden) el.classList.add("hidden");
      else el.classList.remove("hidden");
    });
  }

  function validateContact(value) {
    const cleaned = value.replace(/\s+/g, "");
    const tg = /^@?[a-zA-Z0-9_]{5,32}$/;
    const phone = /^\+?\d{10,15}$/;
    return tg.test(cleaned) || phone.test(cleaned.replace(/[^\d+]/g, ""));
  }

  const quizState = {
    step: 0,
    answers: {}
  };

  const quizSteps = [
    {
      key: "type",
      title: "Шаг 1 из 5: Тип мебели",
      options: ["Кухня", "Шкаф / гардеробная", "Детская комната", "Прихожая / гостиная", "Мебель для бизнеса", "Другое"]
    },
    {
      key: "area",
      title: "Шаг 2 из 5: Площадь помещения",
      options: ["До 8 кв.м", "8-15 кв.м", "15-25 кв.м", "Более 25 кв.м", "Не знаю"]
    },
    {
      key: "material",
      title: "Шаг 3 из 5: Материал фасадов",
      options: ["Пленка ПВХ (эконом)", "МДФ эмаль (средний)", "Шпон / массив (премиум)", "Не знаю / помогите выбрать"]
    },
    {
      key: "urgency",
      title: "Шаг 4 из 5: Срочность",
      options: ["Нужно в течение месяца", "1-3 месяца", "Просто интересует цена", "Еще в процессе ремонта"]
    },
    {
      key: "contact",
      title: "Шаг 5 из 5: Контакт",
      form: true
    }
  ];

  function renderQuizResult(name) {
    const body = qs("#quizBody");
    const selected = (quizState.answers.type || "").toLowerCase();
    const matched = data.projects
      .filter((project) => (project.type || "").toLowerCase().includes(selected.split(" ")[0] || ""))
      .slice(0, 3);
    const cards = matched.length
      ? matched
          .map(
            (project) => `
        <article class="card">
          <strong>${project.title}</strong>
          <p class="muted">${project.district}, от ${project.budget}</p>
        </article>
      `
          )
          .join("")
      : `<p class="muted">Подборка появится после наполнения базы кейсов.</p>`;

    body.innerHTML = `
      <h3>${name}, спасибо!</h3>
      <p>Менеджер напишет вам в Telegram в течение 30 минут в рабочее время.</p>
      <div class="cards">${cards}</div>
      <div class="quiz-nav">
        <a class="btn btn-primary" href="resheniya.html">Посмотреть все проекты</a>
        <button class="btn btn-outline" id="quizDone">Закрыть</button>
      </div>
    `;
    qs("#quizDone", body)?.addEventListener("click", closeQuiz);
  }

  function openQuiz() {
    const backdrop = qs("#quizBackdrop");
    if (!backdrop) return;
    backdrop.classList.remove("hidden");
    toggleFloatingCtas(true);
    trackEvent("quiz_start", { source: location.pathname });
    renderQuiz();
  }

  function closeQuiz() {
    const backdrop = qs("#quizBackdrop");
    if (!backdrop) return;
    backdrop.classList.add("hidden");
    toggleFloatingCtas(false);
  }

  function renderQuiz() {
    const body = qs("#quizBody");
    const progress = qs("#quizProgress");
    if (!body || !progress) return;

    const step = quizSteps[quizState.step];
    progress.style.width = `${((quizState.step + 1) / quizSteps.length) * 100}%`;
    let html = `<h3>${step.title}</h3>`;

    if (step.form) {
      html += `
        <input id="quizName" class="input" placeholder="Ваше имя" />
        <input id="quizContact" class="input" placeholder="Telegram или телефон" />
        <button class="btn btn-primary" id="quizSubmit">Получить ориентир стоимости</button>
      `;
    } else {
      html += `<div class="option-list">`;
      step.options.forEach((opt) => {
        html += `<button class="option-btn" data-opt="${opt}">${opt}</button>`;
      });
      html += `</div>`;
    }

    html += `
      <div class="quiz-nav">
        <button class="btn btn-outline" id="quizBack"${quizState.step === 0 ? " disabled" : ""}>Назад</button>
        <button class="btn btn-outline" id="quizClose">Закрыть</button>
      </div>
    `;

    body.innerHTML = html;

    qsa("[data-opt]", body).forEach((btn) => {
      btn.addEventListener("click", () => {
        quizState.answers[step.key] = btn.dataset.opt;
        trackEvent(`quiz_step_${quizState.step + 1}`, { answer: btn.dataset.opt });
        quizState.step += 1;
        renderQuiz();
      });
    });

    qs("#quizBack", body)?.addEventListener("click", () => {
      if (quizState.step > 0) quizState.step -= 1;
      renderQuiz();
    });
    qs("#quizClose", body)?.addEventListener("click", closeQuiz);

    qs("#quizSubmit", body)?.addEventListener("click", () => {
      const name = (qs("#quizName", body)?.value || "").trim();
      const contact = (qs("#quizContact", body)?.value || "").trim();
      if (!name || !contact) {
        alert("Заполните имя и контакт.");
        return;
      }
      if (!validateContact(contact)) {
        alert("Проверьте формат Telegram или телефона.");
        return;
      }
      quizState.answers.name = name;
      quizState.answers.contact = contact;
      localStorage.setItem("mdjQuizLastComplete", String(Date.now()));
      localStorage.setItem("mdjQuizLastData", JSON.stringify(quizState.answers));
      trackEvent("quiz_complete", quizState.answers);
      renderQuizResult(name);
    });
  }

  function canAutoShowQuiz() {
    const path = location.pathname;
    if (path.includes("service") || path.includes("/care/") || path.includes("blog")) return false;
    const lastComplete = Number(localStorage.getItem("mdjQuizLastComplete") || "0");
    return Date.now() - lastComplete > QUIZ_SUPPRESS_MS;
  }

  function bindQuiz() {
    qsa("[data-open-quiz]").forEach((btn) => btn.addEventListener("click", openQuiz));
    qs("#quizCloseTop")?.addEventListener("click", closeQuiz);
    qs("#quizBackdrop")?.addEventListener("click", (event) => {
      if (event.target.id === "quizBackdrop") closeQuiz();
    });

    if (canAutoShowQuiz()) {
      window.setTimeout(openQuiz, 45000);
    }

    if (!isMobile() && canAutoShowQuiz()) {
      let once = false;
      document.addEventListener("mouseout", (event) => {
        if (!once && event.clientY < 10) {
          once = true;
          openQuiz();
        }
      });
    }
  }

  function renderFeaturedProjects() {
    const list = qs("[data-featured-projects]");
    if (!list) return;
    const featured = data.projects.filter((project) => project.featured && project.segment === "b2c").slice(0, 3);
    list.innerHTML = featured
      .map(
        (project) => `
      <article class="project-card">
        <div class="project-image"></div>
        <div class="project-content">
          <div class="tag-row">
            <span class="tag">${project.type}</span>
            <span class="tag">${project.district}</span>
          </div>
          <h3>${project.title}</h3>
          <p class="muted"><em>"${project.capsule}"</em></p>
          <a class="btn btn-outline" href="resheniya.html">Смотреть проект</a>
        </div>
      </article>
    `
      )
      .join("");
  }

  function renderReviews() {
    const root = qs("[data-reviews]");
    if (!root) return;
    root.innerHTML = data.reviews
      .map(
        (review) => `
      <article class="review-card">
        <strong>${review.name}</strong>
        <p>${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</p>
        <p class="muted">${review.text}</p>
        <a class="btn btn-outline" href="https://yandex.ru/maps/" target="_blank" rel="noreferrer">Читать полностью</a>
      </article>
    `
      )
      .join("");
  }

  function getQueryParams() {
    const params = new URLSearchParams(location.search);
    return {
      search: params.get("q") || "",
      type: params.get("type") || "",
      segment: params.get("segment") || ""
    };
  }

  function syncQueryParams(state) {
    const params = new URLSearchParams();
    if (state.search) params.set("q", state.search);
    if (state.type) params.set("type", state.type);
    if (state.segment) params.set("segment", state.segment);
    const newUrl = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    history.replaceState({}, "", newUrl);
  }

  function renderProjectsPage() {
    const root = qs("#projectsGrid");
    if (!root) return;
    const search = qs("#searchInput");
    const filters = qsa("[data-filter]");
    const prefilled = getQueryParams();

    if (search) search.value = prefilled.search;
    filters.forEach((btn) => {
      const group = btn.dataset.group;
      const value = btn.dataset.value;
      if ((group === "type" && value === prefilled.type) || (group === "segment" && value === prefilled.segment)) {
        btn.classList.add("active");
      }
    });

    function collectFilters() {
      const active = {};
      filters.forEach((btn) => {
        if (btn.classList.contains("active")) active[btn.dataset.group] = btn.dataset.value;
      });
      return active;
    }

    function apply() {
      const q = (search?.value || "").trim().toLowerCase();
      const active = collectFilters();
      const filtered = data.projects.filter((project) => {
        const text = `${project.title} ${project.capsule} ${project.district}`.toLowerCase();
        return (!q || text.includes(q)) && (!active.type || project.type === active.type) && (!active.segment || project.segment === active.segment);
      });

      const counter = qs("#resultsCount");
      if (counter) counter.textContent = `Показано ${filtered.length} из ${data.projects.length} проектов`;

      root.innerHTML = filtered
        .map(
          (project) => `
        <article class="project-card">
          <div class="project-image"></div>
          <div class="project-content">
            <div class="tag-row">
              <span class="tag">${project.type}</span>
              <span class="tag">${project.segment.toUpperCase()}</span>
              <span class="tag">${project.area} кв.м</span>
            </div>
            <h3>${project.title}</h3>
            <p class="muted">${project.district}, от ${project.budget}</p>
            <p><em>"${project.capsule}"</em></p>
            <button class="btn btn-primary" data-open-quiz>Хочу такой же проект</button>
          </div>
        </article>
      `
        )
        .join("");

      bindQuiz();
      syncQueryParams({ search: q, type: active.type || "", segment: active.segment || "" });
    }

    filters.forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.dataset.group;
        qsa(`[data-group="${group}"]`).forEach((item) => item.classList.remove("active"));
        btn.classList.add("active");
        apply();
      });
    });

    qs("#clearFilters")?.addEventListener("click", () => {
      filters.forEach((btn) => btn.classList.remove("active"));
      if (search) search.value = "";
      apply();
    });
    search?.addEventListener("input", apply);
    apply();
  }

  function bindReferralCode() {
    const button = qs("[data-generate-promo]");
    const output = qs("[data-promo-output]");
    if (!button || !output) return;
    button.addEventListener("click", () => {
      const code = `MDJ-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      output.textContent = `Ваш промокод: ${code}`;
      trackEvent("referral_promo_get", { code });
    });
  }

  function bindCareTracking() {
    if (location.pathname.includes("/care/")) {
      const order = new URLSearchParams(location.search).get("order") || "not_set";
      trackEvent("qr_scan", { order, page: location.pathname });
    }
  }

  function init() {
    bindHeaderHideOnScroll();
    bindGlobalLinks();
    bindCookies();
    bindQuiz();
    renderFeaturedProjects();
    renderReviews();
    renderProjectsPage();
    bindReferralCode();
    bindCareTracking();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
