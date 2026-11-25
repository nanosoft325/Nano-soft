document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('js-enabled');
  const pageLoadTimestamp = Date.now();

  // 1. Samsara-style Tabs Switcher + поддержка открытия таба по хэшу (#tab-wms и т.д.)
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function activateTab(targetId) {
    const targetBtn = document.querySelector(`.tab-btn[data-tab="${targetId}"]`);
    const targetPane = document.getElementById(targetId);
    if (!targetBtn || !targetPane) return false;

    tabButtons.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    tabPanes.forEach(p => p.classList.remove('active'));

    targetBtn.classList.add('active');
    targetBtn.setAttribute('aria-selected', 'true');
    targetPane.classList.add('active');
    return true;
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      activateTab(targetId);
    });
  });

  // Автооткрытие нужного таба или спойлера кейсов по хэшу в URL
  function handleHashNavigation() {
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;

    if (hash.startsWith('tab-')) {
      if (activateTab(hash)) {
        const solutionsSection = document.getElementById('solutions');
        if (solutionsSection) solutionsSection.scrollIntoView({ behavior: 'smooth' });
      }
    } else if (hash === 'cases') {
      const casesDetails = document.querySelector('.cases-details');
      if (casesDetails && !casesDetails.open) {
        casesDetails.open = true;
      }
    }
  }
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);

  // Тоггл текста кнопки «Смотреть кейсы / Свернуть кейсы»
  const casesDetails = document.querySelector('.cases-details');
  if (casesDetails) {
    const actionLabel = casesDetails.querySelector('.cases-summary-action');
    const updateCasesSummaryText = () => {
      if (!actionLabel) return;
      actionLabel.innerHTML = casesDetails.open
        ? 'Свернуть кейсы <svg aria-hidden="true"><use href="#icon-arrow"/></svg>'
        : 'Смотреть кейсы <svg aria-hidden="true"><use href="#icon-arrow"/></svg>';
    };
    casesDetails.addEventListener('toggle', updateCasesSummaryText);
    updateCasesSummaryText();
  }

  // Также раскрываем кейсы при клике на любую якорную ссылку #cases на текущей странице
  document.querySelectorAll('a[href="#cases"], a[href="index.html#cases"]').forEach(link => {
    link.addEventListener('click', () => {
      if (casesDetails) casesDetails.open = true;
    });
  });

  // 2. Sticky header shadow trigger
  const header = document.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // 3. Плавные анимации при скролле через IntersectionObserver
  const revealElements = document.querySelectorAll('.reveal-block');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.1
    });

    revealElements.forEach(el => observer.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add('is-revealed'));
  }

  // 4. Закрытие мобильного меню по клику на ссылку
  const mobileNav = document.querySelector('.mobile-menu');
  if (mobileNav) {
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.removeAttribute('open');
      });
    });
  }

  // 5. Фильтрация расширений файлов (accept) + обратная связь при прикреплении файла ТЗ
  const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'zip'];
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 МБ

  const fileInput = document.getElementById('task-file-input');
  const uploadLabel = fileInput?.closest('.file-upload-label');
  const textWrap = uploadLabel?.querySelector('.file-upload-text');
  const defaultStrong = textWrap?.querySelector('strong')?.textContent || 'Прикрепить ТЗ или файл задачи';
  const defaultSpan = textWrap?.querySelector('span')?.textContent || 'PDF, DOCX или ZIP до 10 МБ';

  function resetFileUploadUI() {
    if (textWrap) {
      textWrap.querySelector('strong').textContent = defaultStrong;
      textWrap.querySelector('span').textContent = defaultSpan;
    }
    if (uploadLabel) uploadLabel.style.borderColor = '';
  }

  if (fileInput) {
    // Автоматически задаем безопасный список форматов без необходимости править все HTML-файлы
    fileInput.setAttribute('accept', '.pdf,.docx,.zip');

    fileInput.addEventListener('change', () => {
      if (!textWrap) return;
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        resetFileUploadUI();
        return;
      }

      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        fileInput.value = '';
        textWrap.querySelector('strong').textContent = 'Недопустимый формат файла';
        textWrap.querySelector('span').textContent = 'Разрешены только: PDF, DOCX и ZIP';
        if (uploadLabel) uploadLabel.style.borderColor = '#b91c1c';
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        fileInput.value = '';
        textWrap.querySelector('strong').textContent = 'Файл превышает 10 МБ';
        textWrap.querySelector('span').textContent = 'Выберите файл размером не более 10 МБ';
        if (uploadLabel) uploadLabel.style.borderColor = '#b91c1c';
        return;
      }

      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      textWrap.querySelector('strong').textContent = `Файл прикреплен: ${file.name}`;
      textWrap.querySelector('span').textContent = `Размер: ${sizeMB} МБ (будет отправлен вместе с заявкой)`;
      if (uploadLabel) uploadLabel.style.borderColor = 'var(--accent)';
    });
  }

  // 6. Отправка формы заявки через fetch('send.php') в Telegram + Honeypot-защита от спам-ботов
  const form = document.getElementById('consultation-form');
  const formMsg = document.getElementById('form-message');
  const submitBtn = document.getElementById('submit-btn');

  if (form) {
    const getCsrfToken = async () => {
      const response = await fetch('send.php?csrf=1', {
        method: 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.csrf_token) throw new Error('Security token unavailable');
      return result.csrf_token;
    };
    // Динамически внедряем невидимое поле-ловушку (honeypot) для спам-ботов
    if (!form.querySelector('input[name="website_hp"]')) {
      const hpWrap = document.createElement('div');
      hpWrap.setAttribute('aria-hidden', 'true');
      hpWrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;';
      hpWrap.innerHTML = '<input type="text" name="website_hp" tabindex="-1" autocomplete="off">';
      form.appendChild(hpWrap);
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Проверка антиспам-ловушки и минимального времени заполнения (1.5 сек)
      const hpValue = form.querySelector('input[name="website_hp"]')?.value || '';
      const elapsedMs = Date.now() - pageLoadTimestamp;
      if (hpValue !== '' || elapsedMs < 1500) {
        if (formMsg) {
          formMsg.className = 'form-status-msg success';
          formMsg.textContent = '✓ Заявка отправлена!';
        }
        form.reset();
        resetFileUploadUI();
        return;
      }

      const formData = new FormData(form);
      const activeChannelPill = form.querySelector('.channel-pill.active');
      const preferredChannel = activeChannelPill ? activeChannelPill.getAttribute('data-channel') : 'Telegram';
      formData.append('channel', preferredChannel);
      formData.append('page_url', window.location.href);
      formData.append('form_elapsed_ms', String(elapsedMs));

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';
      }
      if (formMsg) {
        formMsg.className = 'form-status-msg';
        formMsg.textContent = 'Отправка запроса и файлов...';
      }

      // Если сайт открыт локально с диска (file://), показываем успешную демонстрацию без ошибки сети
      if (window.location.protocol === 'file:') {
        setTimeout(() => {
          if (formMsg) {
            formMsg.className = 'form-status-msg success';
            formMsg.textContent = '✓ Локальный тест: заявка и файл проверены и готовы к отправке через send.php на хостинге!';
          }
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
          }
          form.reset();
          resetFileUploadUI();
        }, 500);
        return;
      }

      try {
        const csrfToken = await getCsrfToken();
        formData.append('csrf_token', csrfToken);
        const response = await fetch('send.php', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          body: formData
        });
        const result = await response.json();

        if (response.ok && result.ok) {
          if (formMsg) {
            formMsg.className = 'form-status-msg success';
            formMsg.textContent = '✓ Заявка отправлена! Архитектор Нано Софт свяжется с вами выбранным способом.';
          }
          form.reset();
          resetFileUploadUI();
        } else {
          throw new Error(result.error || 'Ошибка отправки');
        }
      } catch (err) {
        if (formMsg) {
          formMsg.className = 'form-status-msg error';
          formMsg.textContent = 'Не удалось отправить автоматически. Напишите нам в Telegram: @nanosoft_team';
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
      }
    });
  }
});

// 7. Spotlight Cursor Follower
const spotlightCards = document.querySelectorAll('.spotlight-card');
spotlightCards.forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  });
});

// 8. Раздельный телеметрический лог событий под каждую из 7 вкладок
const tabSpecificLogs = {
  'tab-erp': [
    { tag: '1С:ERP', msg: 'Расчет себестоимости выпуска: счета 20/25/26 закрыты без ошибок' },
    { tag: 'МИГРАЦИЯ', msg: 'Конвертация справочников УПП → КА 2.5: 100% сходимость сальдо' },
    { tag: 'НАЛОГИ', msg: 'Книга продаж и переходящие авансы НДС 22% / УСН сверены [ОК]' }
  ],
  'tab-wms': [
    { tag: 'WMS', msg: 'ТСД DataMobile: заказ #1049 собран в ячейке A-08 за 4 мин 12 сек' },
    { tag: 'ПРИЕМКА', msg: 'Поступление по штрихкодам проверено: пересорта 0, размещено в B-14' },
    { tag: 'ИНВЕНТ', msg: 'Пересчет зоны отбора C-02 завершен без остановки отгрузок' }
  ],
  'tab-mark': [
    { tag: 'ЛМ ЧЗ', msg: 'Разрешительный режим: проверка КМ на кассе выполнена за 0.03 сек' },
    { tag: 'СУЗ API', msg: 'Эмиссия 2 500 кодов DataMatrix и агрегация паллеты SSCC [ОК]' },
    { tag: 'МЕРКУРИЙ', msg: 'ВетИС API: партия сырья сверена, входящие эВСД погашены в 1С' }
  ],
  'tab-market': [
    { tag: 'WB / OZON', msg: 'Финотчет загружен: логистика и СПП распределены по 412 SKU' },
    { tag: 'FBS API', msg: 'Резерв остатков обновлен за 1.4 сек на 4 площадках, оверсейлов 0' },
    { tag: 'СБОРКА', msg: 'Стикеры Ozon и QR-коды поставки отправлены на термопринтер' }
  ],
  'tab-crm': [
    { tag: 'CRM ↔ 1С', msg: 'Счет #894 оплачен в 1С → стадия сделки в Битрикс24: «В отгрузку»' },
    { tag: 'РЕЗЕРВ', msg: 'Спецификация из сделки передана в 1С:УТ, товар зарезервирован' },
    { tag: 'КОНТРОЛЬ', msg: 'Проверка дебиторской задолженности контрагента по ИНН: лимит [ОК]' }
  ],
  'tab-ai': [
    { tag: 'AI OCR', msg: 'УПД №841 распознан за 1.2 сек: 14 из 14 позиций сопоставлены с НСИ' },
    { tag: 'RAG 1С', msg: 'Ответ по регламенту списания сырья сформирован с учетом прав RLS' },
    { tag: 'ML СПРОС', msg: 'Прогноз запасов: сформирован проект заказа поставщику на 420 шт.' }
  ],
  'tab-infra': [
    { tag: 'СУБД', msg: 'PostgreSQL 1C: индекс APDEX 0.96, ожидания блокировок 0 [ОК]' },
    { tag: 'БЭКАП', msg: 'Ежедневный архив базы 1С сохранен в изолированный ЦОД Tier III' },
    { tag: 'NVMe', msg: 'Закрытие месяца в базе 85 ГБ выполнено в 4.8 раза быстрее' }
  ]
};

let logStep = 0;
const allTabPanesWithLogs = document.querySelectorAll('.tab-pane');
if (allTabPanesWithLogs.length) {
  setInterval(() => {
    const now = new Date();
    const timeStr = `[${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}]`;
    logStep++;

    allTabPanesWithLogs.forEach(pane => {
      const feed = pane.querySelector('.live-log-feed');
      const pool = tabSpecificLogs[pane.id];
      if (!feed || !pool || !pool.length) return;

      const event = pool[logStep % pool.length];
      const row = document.createElement('div');
      row.className = 'log-row';

      const timeEl = document.createElement('span');
      timeEl.className = 'log-time';
      timeEl.textContent = timeStr;

      const tagEl = document.createElement('span');
      tagEl.className = 'log-tag';
      tagEl.textContent = event.tag;

      const msgEl = document.createElement('span');
      msgEl.className = 'log-msg';
      msgEl.textContent = event.msg;

      row.append(timeEl, ' ', tagEl, ' ', msgEl);
      feed.replaceChildren(row);
    });
  }, 3200);
}

// 9. Анимация числовых счетчиков (поддерживает префиксы вроде «до 3 раз», «от 7 дней» и «50+»)
const counters = document.querySelectorAll('.stat-pill strong, .metric strong, .about-numbers strong');
if ('IntersectionObserver' in window) {
  const counterObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const text = el.innerText.trim();
        const match = text.match(/^([^\d]*)(\d+)(.*)$/);
        if (match) {
          const prefix = match[1] || '';
          const targetNum = parseInt(match[2], 10);
          const suffix = match[3] || '';

          if (targetNum > 0) {
            const duration = 1800;
            const startTime = performance.now();

            function updateCounter(currentTime) {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const easeProgress = 1 - Math.pow(1 - progress, 3);
              const currentVal = Math.floor(easeProgress * targetNum);

              el.textContent = prefix + currentVal + suffix;

              if (progress < 1) {
                requestAnimationFrame(updateCounter);
              } else {
                el.textContent = prefix + targetNum + suffix;
              }
            }
            requestAnimationFrame(updateCounter);
          }
        }
        obs.unobserve(el);
      }
    });
  }, { threshold: 0.3 });
  counters.forEach(c => counterObserver.observe(c));
}

// 10. Обработчик парящего мега-меню
const navHubButtons = document.querySelectorAll('[data-mega-target]');
const floatingPanels = document.querySelectorAll('.mega-dropdown-panel');
const megaBackdrop = document.querySelector('.mega-menu-overlay');

function syncBodyScrollLock() {
  const anyMegaOpen = [...floatingPanels].some(p => p.classList.contains('is-open'));
  const caseModalOpen = document.querySelector('.case-modal-backdrop.is-open');
  document.body.classList.toggle('modal-open', Boolean(anyMegaOpen || caseModalOpen));
}

function closeAllPanels() {
  navHubButtons.forEach(b => {
    b.classList.remove('is-active');
    b.setAttribute('aria-expanded', 'false');
  });
  floatingPanels.forEach(p => p.classList.remove('is-open'));
  if (megaBackdrop) megaBackdrop.classList.remove('is-active');
  syncBodyScrollLock();
}

navHubButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const targetId = btn.getAttribute('data-mega-target');
    const targetPanel = document.getElementById(targetId);
    const isAlreadyOpen = targetPanel && targetPanel.classList.contains('is-open');

    closeAllPanels();

    if (!isAlreadyOpen && targetPanel) {
      btn.classList.add('is-active');
      btn.setAttribute('aria-expanded', 'true');
      targetPanel.classList.add('is-open');
      if (megaBackdrop) megaBackdrop.classList.add('is-active');
      syncBodyScrollLock();
    }
  });
});

if (megaBackdrop) {
  megaBackdrop.addEventListener('click', closeAllPanels);
}

document.querySelectorAll('.floating-menu-card, .mega-dropdown-panel a').forEach(a => {
  a.addEventListener('click', closeAllPanels);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllPanels();
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.site-header') && !e.target.closest('.mega-dropdown-panel')) {
    closeAllPanels();
  }
});

// 11. ИНТЕРАКТИВНЫЙ КАЛЬКУЛЯТОР-КВИЗ ВНЕДРЕНИЯ
const calcOptions = document.querySelectorAll('.calc-option');
const resSystem = document.getElementById('calc-res-system');
const resDays = document.getElementById('calc-res-days');
const resBudget = document.getElementById('calc-res-budget');
const calcTaskInput = document.getElementById('calc-task-input');

const CALC = {
  rate: 3600,
  scale: {
    small: { k: 1, team: 1, host: 4900, hostName: 'Старт 1С' },
    mid:   { k: 1.8, team: 2, host: 12500, hostName: 'Бизнес ERP' },
    large: { k: 3.2, team: 3, host: 28000, hostName: 'Enterprise' }
  },
  base:  { erp: 90, wms: 70, mark: 50, market: 55, crm: 60, ai: 75 },
  extra: { integr: 40, migr: 30, train: 12, audit: 24, custom: 48 },
  reserve: 1.3,
  hoursPerDay: 6
};
const fmt = n => Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');

function recalculateQuiz() {
  if (!calcOptions.length) return;
  const scale = document.querySelector('input[name="calc_scale"]:checked')?.value || 'mid';
  const contour = document.querySelector('input[name="calc_contour"]:checked')?.value || 'erp';
  const hosting = document.querySelector('input[name="calc_hosting"]:checked')?.value || 'cloud';
  const extras = [...document.querySelectorAll('input[name="calc_extra"]:checked')].map(i => i.value);
  const sc = CALC.scale[scale];

  let hours = CALC.base[contour] * sc.k;
  extras.forEach(e => {
    hours += (e === 'integr' || e === 'custom' || e === 'audit') ? CALC.extra[e] : CALC.extra[e] * sc.k;
  });
  if (hosting === 'onpremise') hours += 24;
  if (hosting === 'hybrid') hours += 16;

  const budgetMin = Math.round(hours * CALC.rate / 10000) * 10000;
  const budgetMax = Math.round(hours * CALC.rate * CALC.reserve / 10000) * 10000;

  const daysMin = Math.ceil(hours / (sc.team * CALC.hoursPerDay)) + 5;
  const daysMax = Math.round(daysMin * 1.4);
  const term = daysMax > 45
    ? `${Math.round(daysMin / 7)}–${Math.round(daysMax / 7)} нед.`
    : `${daysMin}–${daysMax} дней`;

  let recSystem;
  if (contour === 'erp') recSystem = scale === 'large' ? '1С:ERP Управление предприятием 2.5' : (scale === 'mid' ? '1С:КА 2.5 + Производство' : '1С:Комплексная автоматизация 2.5');
  else if (contour === 'wms') recSystem = '1С:УТ 11.5 + DataMobile (ТСД)';
  else if (contour === 'mark') recSystem = '1С + Честный Знак / СУЗ / ТС ПИоТ';
  else if (contour === 'market') recSystem = '1С:УТ + API Ozon / WB / Яндекс Маркет';
  else if (contour === 'crm') recSystem = 'Битрикс24 + двусторонний обмен с 1С';
  else recSystem = 'On-Premise ИИ-модуль / OCR / RAG в 1С';

  if (hosting === 'cloud') recSystem += ' [Облако Tier III]';
  else if (hosting === 'hybrid') recSystem += ' [Гибрид]';
  else recSystem += ' [Свой сервер]';

  const budgetText = `${fmt(budgetMin)} – ${fmt(budgetMax)} ₽`;
  const hostText = hosting === 'onpremise' ? 'на вашем оборудовании' : `от ${fmt(sc.host)} ₽ / мес`;

  if (resSystem) resSystem.textContent = recSystem;
  if (resDays) resDays.textContent = term;
  if (resBudget) resBudget.textContent = budgetText;
  const resHosting = document.getElementById('calc-res-hosting');
  if (resHosting) resHosting.textContent = hostText;

  if (calcTaskInput) {
    const extraNames = { integr: 'интеграции', migr: 'перенос данных', train: 'обучение', audit: 'обследование и моделирование', custom: 'доработки и API' };
    calcTaskInput.value = `Расчет из калькулятора: контур — ${contour}, масштаб — ${scale}, размещение — ${hosting}` +
      (extras.length ? `, дополнительно: ${extras.map(e => extraNames[e]).join(', ')}` : '') +
      `. Рекомендовано: ${recSystem}; ориентир по срокам: ${term}; ориентир бюджета: ${budgetText}.`;
  }
}

calcOptions.forEach(opt => {
  opt.addEventListener('click', (e) => {
    const input = opt.querySelector('input');
    if (!input) return;
    e.preventDefault();
    if (opt.classList.contains('calc-option-multi')) {
      input.checked = !input.checked;
      opt.classList.toggle('selected', input.checked);
    } else {
      input.checked = true;
      const groupName = input.getAttribute('name');
      document.querySelectorAll(`input[name="${groupName}"]`).forEach(inp => {
        inp.closest('.calc-option').classList.remove('selected');
      });
      opt.classList.add('selected');
    }
    recalculateQuiz();
  });
});
recalculateQuiz();

// 12. Бегущие строки компетенций: бесшовный цикл
(function () {
  const SPEED = 9;
  function build() {
    document.querySelectorAll('.ticker-track').forEach(track => {
      if (!track.children.length) return;
      if (!track.dataset.unit) track.dataset.unit = track.children[0].outerHTML;
      const tmp = document.createElement('div');
      tmp.innerHTML = track.dataset.unit;
      const probe = tmp.firstElementChild;
      track.innerHTML = '';
      track.appendChild(probe);
      const unitW = probe.getBoundingClientRect().width;
      if (!unitW) return;
      const n = Math.ceil(window.innerWidth / unitW) + 1;
      track.innerHTML = '';
      for (let i = 0; i < n * 2; i++) {
        const el = probe.cloneNode(true);
        if (i >= n) el.setAttribute('aria-hidden', 'true');
        track.appendChild(el);
      }
      const shift = unitW * n;
      track.style.setProperty('--ticker-shift', shift + 'px');
      track.style.setProperty('--ticker-time', (shift / SPEED) + 's');
    });
  }
  window.addEventListener('load', build);
  let t;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(build, 200); });
})();

// 13. Прогресс-бар чтения в шапке
(function() {
  const header = document.querySelector('.site-header');
  if (header && !header.querySelector('.scroll-progress-bar')) {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress-bar';
    header.appendChild(bar);
    window.addEventListener('scroll', () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const pct = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
      bar.style.width = pct + '%';
    }, { passive: true });
  }
})();

// 14. Фильтрация кейсов + Модальное окно архитектуры кейса (безопасный рендер без XSS через innerHTML)
(function() {
  const filterBtns = document.querySelectorAll('.case-filter-btn');
  const caseCards = document.querySelectorAll('.case-card');

  if (filterBtns.length && caseCards.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-filter');
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        caseCards.forEach(card => {
          const cat = card.getAttribute('data-category');
          if (filter === 'all' || cat === filter) {
            card.classList.remove('is-hidden');
            card.classList.remove('is-filtering');
            void card.offsetWidth;
            card.classList.add('is-filtering');
          } else {
            card.classList.add('is-hidden');
          }
        });
      });
    });

    const caseDetailsDB = {
      'ООО НПО «СПЕЦНЕФТЕМАШ»': {
        task: 'Перенос регламентированного учета и рабочих данных, внедрение производственного контура, календаря цехов, бюджетирования и расчета заработной платы.',
        arch: 'Единая система 1С:Комплексная автоматизация 2.5 + производственный контур и календарь цехов + блок бюджетирования и ЗП + специализированная управленческая отчетность.',
        result: 'Все бизнес-процессы объединены в единой базе 1С:КА. Срок подготовки отчетной документации сокращен в 10 раз, трудозатраты на ведение производственного учета снижены на 30%, обеспечен прозрачный расчет себестоимости.'
      },
      'ООО «ФОКСИ ЭКСПЕРТ»': {
        task: 'Автоматизировать производственные процессы на базе 1С:ERP, обеспечить работу с госсистемой маркировки, интегрировать оборудование и склад с ERP и оптимизировать ЭДО.',
        arch: '1С:ERP Управление предприятием + прямая интеграция с «Честным Знаком» и СУЗ + производственное оборудование и ТСД DataMobile + сервер печати этикеток + ЭДО.',
        result: 'Полная автоматизация учета, потоковой маркировки и выпуска парфюмерно-косметической продукции, 0 ошибок при передаче маркированных УПД через ЭДО.'
      },
      'ООО «СОДА СТРИМ СЕРВИС»': {
        task: 'Перевести компанию со старой платформы 1С 7.7 на 1С:УТ 11.5, интегрировать с госсистемами маркировки и автоматизировать склад и выездных торговых представителей.',
        arch: 'Переход с «1С:Торговля и Склад 7.7» на «1С:УТ 11.5» с переносом на новый сервер + интеграция ВетИС «Меркурий» и «Честный Знак» + мобильное приложение «Мобиком» и ТСД.',
        result: 'Масштабный переход без остановки оптовых отгрузок, автоматическое гашение эВСД, полная синхронизация полевых агентов и подготовленные ролевые инструкции.'
      },
      'ООО ТК «ГРАНД»': {
        task: 'Перевести компанию на 1С:УТ 11.5, объединить каналы продаж смазочных материалов в единой системе, адаптировать доработки и автоматизировать маркетплейсы.',
        arch: 'Миграция данных в «1С:Управление торговлей 11.5» + адаптация кастомных доработок через расширения (.cfe) + интеграция с сайтами + двусторонний обмен с Ozon и Wildberries.',
        result: 'Все каналы оптовых и e-commerce продаж объединены в единой базе 1С:УТ 11.5, организовано непрерывное сопровождение по SLA.'
      },
      'ООО «СТОМДЕВАЙС»': {
        task: 'Модернизировать систему управления торговлей, обеспечить бесшовную интеграцию сайта, Битрикс24 и 1С, сохранить доработки при переходе на 1С:УТ 11.5 и повысить стабильность.',
        arch: 'Комплексный аудит учета + перенос ИТ-инфраструктуры на выделенный сервер + переход на «1С:УТ 11.5» с адаптацией доработок + интеграция Сайт ↔ Битрикс24 ↔ 1С и торгового оборудования.',
        result: 'Высокая скорость и отказоустойчивость базы (99,98%) на новом сервере, сквозная синхронизация заказов между интернет-магазином, CRM и учетной системой.'
      },
      '«МОТАХ»': {
        task: 'Автоматизировать торговые и складские процессы оптово-розничной сети мототехники, связать сайт, Битрикс24 и 1С:УТ 11.5 и ускорить обработку заказов.',
        arch: 'Трехсторонняя интеграция Битрикс24 ↔ Сайт ↔ 1С:УТ 11.5 + внедрение терминалов сбора данных (ТСД) на складе + индивидуальные аналитические BI-отчеты.',
        result: 'Прозрачное управление товарными запасами, ускорение складской комплектации по штрихкодам в 2,5 раза и готовая платформа для масштабирования бизнеса.'
      },
      'ООО «МЕТАЛЛОБАЗА ВОЛХОНКА»': {
        task: 'Внедрить 1С:УТ 11.5 для управленческого учета продажи металлопроката, настроить синхронизацию с 1С:Бухгалтерией 3.0 и двусторонний обмен с CRM Битрикс24.',
        arch: 'Перенос данных и запуск «1С:УТ 11.5» + аудит и автоматизация ключевых операций + доработка синхронизации с «1С:Бухгалтерией 3.0» + двусторонняя интеграция с Битрикс24.',
        result: 'Прозрачная финансовая аналитика и управленческий контроль, единый контур работы менеджеров в CRM и бухгалтерии без двойного ввода документов.'
      },
      'ООО «ВЭЙФС» (WAFE STORE)': {
        task: 'Перевести управленческий учет импорта и продажи бытовой техники из 1С:Бухгалтерии 3.0 в 1С:УТ 11.5, оптимизировать контроль клиентских заказов и товарных резервов.',
        arch: 'Переход на оперативный учет в «1С:УТ 11.5» + автоматический контроль заказов и резервов + доработка обменов с «1С:БП 3.0» и Битрикс24 + вынос доработок в расширения (.cfe).',
        result: 'Высокая скорость работы базы, исключение сбоев при резервировании товара и сохранение всех доработок с возвратом на типовую поддержку.'
      },
      'ООО «ТИГЕО»': {
        task: 'Внедрить 1С:УТ 11.5 для управленческого учета, автоматизировать как оптовую продажу, так и аренду геодезического оборудования, перенести остатки и обучить штат.',
        arch: 'Внедрение «1С:УТ 11.5» и перенос данных + доработка блока продаж под биллинг аренды приборов + поштучный серийный учет (S/N) движения оборудования + подготовка НСИ к обмену с сайтом.',
        result: 'Полная прослеживаемость каждого геодезического прибора по серийным номерам в продаже и прокате, обученная команда пользователей.'
      },
      'ИП ПЕСТРЯКОВ А. В.': {
        task: 'Оптимизировать закупочные и складские процессы магазина электротехники и инструмента, внедрить систему лояльности и ускорить работу кассовой зоны.',
        arch: 'Аудит процессов и доработок в «1С:УТ для Казахстана, ред. 3» + автоматизация закупок и склада + внедрение бонусной системы лояльности + оптимизация рабочего места кассира (РМК).',
        result: 'Исправлены исторические ошибки учета, обслуживание покупателей и оформление возвратов на кассах ускорено на 40%, выросли повторные продажи за счет бонусной программы.'
      }
    };

    const backdrop = document.createElement('div');
    backdrop.className = 'case-modal-backdrop';
    backdrop.innerHTML = `
      <div class="case-modal-drawer" role="dialog" aria-modal="true" aria-label="Детали проекта">
        <div>
          <button type="button" class="case-modal-close" aria-label="Закрыть">×</button>
          <p class="eyebrow eyebrow-light" id="cm-industry" style="margin-bottom:10px;"></p>
          <h3 id="cm-title" style="font-size:24px;line-height:1.25;margin-bottom:8px;color:#fff;"></h3>
          <p id="cm-client" style="color:var(--accent-light);font-weight:700;font-size:13px;margin-bottom:20px;"></p>
          <div class="case-card-stats" id="cm-stats" style="margin-bottom:16px;"></div>
          <div class="case-modal-section">
            <h4>Исходная задача</h4>
            <p id="cm-task"></p>
          </div>
          <div class="case-modal-section">
            <h4>Архитектура решения Нано Софт</h4>
            <p id="cm-arch"></p>
          </div>
          <div class="case-modal-section">
            <h4>Бизнес-эффект</h4>
            <p id="cm-res"></p>
          </div>
        </div>
        <div style="padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);">
          <a href="#contacts" class="button button-bright" id="cm-cta" style="width:100%;">Запросить похожую архитектуру</a>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const closeModal = () => {
      backdrop.classList.remove('is-open');
      syncBodyScrollLock();
    };
    backdrop.querySelector('.case-modal-close').addEventListener('click', closeModal);
    backdrop.querySelector('#cm-cta').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && backdrop.classList.contains('is-open')) closeModal(); });

    caseCards.forEach(card => {
      const contentBox = card.querySelector('.case-card-content');
      if (contentBox && !contentBox.querySelector('.case-card-footer-hint')) {
        const hint = document.createElement('div');
        hint.className = 'case-card-footer-hint';
        hint.textContent = 'Архитектура проекта →';
        contentBox.appendChild(hint);
      }
      card.addEventListener('click', () => {
        const client = card.querySelector('.client-name')?.textContent.trim() || '';
        const ind = card.querySelector('.industry-tag')?.textContent.trim() || '';
        const title = card.querySelector('h3')?.textContent.trim() || '';
        const info = caseDetailsDB[client] || {};

        backdrop.querySelector('#cm-industry').textContent = ind;
        backdrop.querySelector('#cm-title').textContent = title;
        backdrop.querySelector('#cm-client').textContent = client;

        // Безопасная сборка статистики через textContent вместо innerHTML (защита от XSS)
        const cmStatsContainer = backdrop.querySelector('#cm-stats');
        cmStatsContainer.replaceChildren();
        card.querySelectorAll('.case-card-stats .c-stat').forEach(statItem => {
          const statClone = document.createElement('div');
          statClone.className = 'c-stat';

          const numSpan = document.createElement('span');
          numSpan.className = 'c-stat-num';
          numSpan.textContent = statItem.querySelector('.c-stat-num')?.textContent.trim() || '';

          const lblSpan = document.createElement('span');
          lblSpan.className = 'c-stat-lbl';
          lblSpan.textContent = statItem.querySelector('.c-stat-lbl')?.textContent.trim() || '';

          statClone.append(numSpan, lblSpan);
          cmStatsContainer.appendChild(statClone);
        });

        backdrop.querySelector('#cm-task').textContent = info.task || card.querySelector('p')?.textContent || '';
        backdrop.querySelector('#cm-arch').textContent = info.arch || '1С + Расширения (.cfe) + REST API';
        backdrop.querySelector('#cm-res').textContent = info.result || 'Проект запущен в промышленную эксплуатацию по ГОСТ.';
        backdrop.classList.add('is-open');
        syncBodyScrollLock();
      });
    });
  }
})();

// 15. Быстрый выбор способа связи в форме
(function() {
  const contactInput = document.querySelector('input[name="contact"]');
  const form = document.getElementById('consultation-form');
  if (contactInput && form && !form.querySelector('.contact-channel-pills')) {
    const pillWrap = document.createElement('div');
    pillWrap.className = 'contact-channel-pills';
    pillWrap.innerHTML = `
      <button type="button" class="channel-pill active" data-channel="Telegram">Ответить в Telegram</button>
      <button type="button" class="channel-pill" data-channel="Звонок">Позвонить</button>
      <button type="button" class="channel-pill" data-channel="Email / Max">Написать на Email / Max</button>
    `;
    const firstGrid = form.querySelector('.form-grid');
    if (firstGrid) form.insertBefore(pillWrap, firstGrid);

    pillWrap.querySelectorAll('.channel-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pillWrap.querySelectorAll('.channel-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const ch = pill.getAttribute('data-channel');
        if (ch === 'Telegram') contactInput.placeholder = '+7 900 000-00-00 или @username в Telegram';
        else if (ch === 'Звонок') contactInput.placeholder = '+7 (900) 000-00-00';
        else contactInput.placeholder = 'Ваш корпоративный email или телефон';
      });
    });
  }
})();

// 16. Интерактивный симулятор ИИ-ассистента (на странице ai.html)
(function() {
  const promptBtns = document.querySelectorAll('.ai-prompt-btn');
  const chatOut = document.getElementById('ai-chat-output');
  if (promptBtns.length && chatOut) {
    const answers = {
      'cost': '<strong>Ответ RAG-ассистента 1С:ERP (за 0,8 сек):</strong> В подразделении «Цех металлообработки №2» за октябрь зафиксирован перерасход по ст. «Инструмент и оснастка» (+18,4% к нормативу спецификации №14-М). Основной документ отклонения: <em>Требование-накладная №000418 от 24.10</em>. Рекомендую проверить списание твердосплавных пластин по заказу #382.',
      'upd': '<strong>Статус OCR + LLM-валидации (точность 99,6%):</strong> Входящий скан УПД №841 от ООО «ПолимерСнаб» (14 позиций) распознан. 13 позиций сопоставлены со справочником номенклатуры 1С автоматически. Позиция <em>«Гранула ПП-010 (перв.)»</em> сопоставлена с карточкой <em>«Полипропилен 01030 первичный»</em> (уверенность 98%). Черновик «Поступление товаров» готов к проведению с учетом ставки НДС.',
      'stock': '<strong>Предиктивный прогноз запасов (ML-модуль):</strong> С учетом темпа отгрузок на кластеры Ozon (СПб / Тверь) и плеча поставки 9 дней, остаток по группе <em>«Масло моторное 5W-40 4 л»</em> достигнет страхового минимума через 6 дней. Сформирован проект заказа поставщику на 420 шт.'
    };
    promptBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        promptBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const key = btn.getAttribute('data-ai-key');
        chatOut.style.opacity = '0.3';
        setTimeout(() => {
          chatOut.innerHTML = answers[key] || '';
          chatOut.style.opacity = '1';
        }, 180);
      });
    });
  }
})();

// 17. Автопауза фонового видео (hero.mp4) вне зоны видимости экрана
(function() {
  const heroVideos = document.querySelectorAll('.hero-media video');
  if ('IntersectionObserver' in window && heroVideos.length) {
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.05 });

    heroVideos.forEach(v => videoObserver.observe(v));
  }
})();


