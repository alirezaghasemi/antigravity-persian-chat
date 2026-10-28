/**
 * Antigravity Persian Chat - Client Injection Script
 * راست‌چین‌سازی هوشمند و خودکار متن‌های چت و پشتیبانی دو زبانه (فارسی و انگلیسی)
 * سازگار با Antigravity IDE نسخه ۲٫۶٫۰ و بالاتر
 */
(function () {
  'use strict';

  // محدوده حروف فارسی و عربی استاندارد و فرم‌های متصل
  const PERSIAN_CHARS_REGEX = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/;
  const PERSIAN_CHARS_GLOBAL = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/g;
  const LATIN_CHARS_GLOBAL = /[A-Za-z]/g;

  /**
   * تشخیص جهت متن بر اساس توزیع کاراکترهای فارسی و لاتین
   * @param {string} text 
   * @returns {'rtl' | 'ltr' | null}
   */
  function detectDirection(text) {
    if (!text) return null;

    // حذف لینک‌ها، نقل‌قول‌های کد، اعداد و علائم خاص
    const cleaned = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/[0-9\s.,!?:;'"_`*~#\(\)\[\]{}<>\/\\|+=@$%^&\-—]/g, '');

    if (!cleaned) return null;

    const persianMatches = cleaned.match(PERSIAN_CHARS_GLOBAL);
    const persianCount = persianMatches ? persianMatches.length : 0;

    const latinMatches = cleaned.match(LATIN_CHARS_GLOBAL);
    const latinCount = latinMatches ? latinMatches.length : 0;

    // اگر متن شامل حروف فارسی باشد:
    // ۱. اگر حداقل ۳ حرف فارسی داشته باشد، یا بیش از ۲۵٪ حروف آن فارسی باشد => RTL
    if (persianCount > 0) {
      if (persianCount >= 3 || persianCount >= (latinCount * 0.25)) {
        return 'rtl';
      }
    }

    // بررسی اولین کاراکتر دارای جهت قوی (First strong directional character)
    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (PERSIAN_CHARS_REGEX.test(char)) return 'rtl';
      if (/[A-Za-z]/.test(char)) return 'ltr';
    }

    return latinCount > 0 ? 'ltr' : null;
  }

  /**
   * بررسی اینکه آیا المان مربوط به کد، ترمینال یا معاف از تغییر چیدمان است
   * @param {HTMLElement} el 
   */
  function isCodeOrExcluded(el) {
    if (!el || !el.tagName) return true;
    const tag = el.tagName.toLowerCase();

    if (
      tag === 'pre' ||
      tag === 'code' ||
      tag === 'script' ||
      tag === 'style' ||
      tag === 'svg' ||
      tag === 'button'
    ) {
      return true;
    }

    if (
      el.closest('pre') ||
      el.closest('.monaco-editor') ||
      el.closest('.code-block') ||
      el.closest('.xterm')
    ) {
      return true;
    }

    return false;
  }

  /**
   * اعمال استایل‌های راست‌چین مستقیم روی یک المان و کانتینرهای مرتبط
   * @param {HTMLElement} el 
   */
  function applyRtlStyles(el) {
    el.setAttribute('data-ag-dir', 'rtl');
    el.setAttribute('dir', 'rtl');
    el.classList.add('ag-persian-rtl');
    el.classList.remove('ag-persian-ltr');
    el.style.direction = 'rtl';
    el.style.textAlign = 'right';

    // در صورتی که المان درون حباب کاربر در Antigravity 2.6.0 باشد
    const userBubble = el.closest('[data-testid="user-message-bubble"]');
    if (userBubble && userBubble !== el) {
      userBubble.setAttribute('data-ag-dir', 'rtl');
      userBubble.setAttribute('dir', 'rtl');
      userBubble.classList.add('ag-persian-rtl');
      userBubble.classList.remove('ag-persian-ltr');
      userBubble.style.direction = 'rtl';
      userBubble.style.textAlign = 'right';
    }

    const userStep = el.closest('[data-testid="user-input-step"]');
    if (userStep && userStep !== el) {
      userStep.setAttribute('data-ag-dir', 'rtl');
      userStep.setAttribute('dir', 'rtl');
      userStep.classList.add('ag-persian-rtl');
      userStep.classList.remove('ag-persian-ltr');
    }
  }

  /**
   * اعمال استایل‌های چپ‌چین
   * @param {HTMLElement} el 
   */
  function applyLtrStyles(el) {
    el.setAttribute('data-ag-dir', 'ltr');
    el.setAttribute('dir', 'ltr');
    el.classList.add('ag-persian-ltr');
    el.classList.remove('ag-persian-rtl');
    el.style.direction = 'ltr';
    el.style.textAlign = 'left';

    const userBubble = el.closest('[data-testid="user-message-bubble"]');
    if (userBubble && userBubble !== el) {
      userBubble.setAttribute('data-ag-dir', 'ltr');
      userBubble.setAttribute('dir', 'ltr');
      userBubble.classList.add('ag-persian-ltr');
      userBubble.classList.remove('ag-persian-rtl');
      userBubble.style.direction = 'ltr';
      userBubble.style.textAlign = 'left';
    }
  }

  /**
   * پردازش یک المان متنی منفرد
   * @param {HTMLElement} el 
   */
  function processElement(el) {
    if (!el || isCodeOrExcluded(el)) return;

    // استخراج متن هدف (در user-input-step مستقیماً از بخش متن استفاده می‌کنیم تا دکمه‌ها جهت را خراب نکنند)
    let text = '';
    if (el.matches && el.matches('[data-testid="user-input-step"]')) {
      const bubble = el.querySelector('[data-quotable="true"], [data-testid="user-message-bubble"]');
      text = bubble ? bubble.textContent || '' : el.textContent || '';
    } else {
      text = el.textContent || '';
    }

    if (!text.trim()) return;

    const dir = detectDirection(text);
    if (!dir) return;

    const currentDir = el.getAttribute('data-ag-dir');
    const hasDirClass = el.classList.contains(dir === 'rtl' ? 'ag-persian-rtl' : 'ag-persian-ltr');
    const hasDirAttr = el.getAttribute('dir') === dir;

    // اگر قبلاً اعمال شده و توسط ریکنسلیشن ری‌اکت بازنشانی نشده است، بازگشت
    if (currentDir === dir && hasDirClass && hasDirAttr) return;

    if (dir === 'rtl') {
      applyRtlStyles(el);
    } else if (dir === 'ltr') {
      applyLtrStyles(el);
    }
  }

  /**
   * پردازش المان‌های ورودی تایپ (Lexical Editor, textarea, contenteditable)
   * @param {HTMLElement} inputEl 
   */
  function processInput(inputEl) {
    if (!inputEl) return;
    const text = inputEl.innerText || inputEl.value || inputEl.textContent || '';
    const dir = detectDirection(text);

    const editable = inputEl.isContentEditable ? inputEl : inputEl.querySelector('[contenteditable="true"]') || inputEl;

    if (dir === 'rtl') {
      editable.setAttribute('dir', 'rtl');
      editable.setAttribute('data-ag-dir', 'rtl');
      editable.classList.add('ag-persian-rtl');
      editable.classList.remove('ag-persian-ltr');
      editable.style.direction = 'rtl';
      editable.style.textAlign = 'right';

      const innerParas = editable.querySelectorAll('p, div');
      for (let i = 0; i < innerParas.length; i++) {
        const p = innerParas[i];
        p.setAttribute('dir', 'rtl');
        p.style.direction = 'rtl';
        p.style.textAlign = 'right';
      }

      // تنظیم جهت متن پیش‌فرض (Placeholder) در پرامپت باکس
      const box = editable.closest('[data-testid="agent-input-box"]') || editable.parentElement;
      if (box) {
        const placeholder = box.querySelector('p.pointer-events-none, [class*="placeholder"]');
        if (placeholder) {
          placeholder.setAttribute('dir', 'rtl');
          placeholder.style.direction = 'rtl';
          placeholder.style.textAlign = 'right';
        }
      }
    } else if (dir === 'ltr') {
      editable.setAttribute('dir', 'ltr');
      editable.setAttribute('data-ag-dir', 'ltr');
      editable.classList.add('ag-persian-ltr');
      editable.classList.remove('ag-persian-rtl');
      editable.style.direction = 'ltr';
      editable.style.textAlign = 'left';

      const innerParas = editable.querySelectorAll('p, div');
      for (let i = 0; i < innerParas.length; i++) {
        const p = innerParas[i];
        p.setAttribute('dir', 'ltr');
        p.style.direction = 'ltr';
        p.style.textAlign = 'left';
      }

      const box = editable.closest('[data-testid="agent-input-box"]') || editable.parentElement;
      if (box) {
        const placeholder = box.querySelector('p.pointer-events-none, [class*="placeholder"]');
        if (placeholder) {
          placeholder.setAttribute('dir', 'ltr');
          placeholder.style.direction = 'ltr';
          placeholder.style.textAlign = 'left';
        }
      }
    }
  }

  // انتخابگرهای مربوط به محتوای متنی چت در Antigravity IDE (نسخه ۲٫۶٫۰ و نسخه‌های پیشین)
  const TARGET_SELECTORS = [
    'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'th', 'td',
    '[data-testid="user-input-step"]',
    '[data-testid="user-message-bubble"]',
    '[data-quotable="true"]',
    '[data-testid="ask-question-writein"]',
    '[data-testid="interaction-takeover-card"]',
    '.rendered-markdown',
    '.animate-markdown',
    '.whitespace-pre-wrap'
  ].join(', ');

  /**
   * اسکن و پردازش یک کانتینر یا گره DOM
   * @param {Node} root 
   */
  function processContainer(root) {
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return;

    if (root.matches && root.matches(TARGET_SELECTORS)) {
      processElement(root);
    }

    if (root.querySelectorAll) {
      const elements = root.querySelectorAll(TARGET_SELECTORS);
      for (let i = 0; i < elements.length; i++) {
        processElement(elements[i]);
      }

      const inputs = root.querySelectorAll('div[contenteditable="true"], [data-testid="agent-input-box"], textarea');
      for (let i = 0; i < inputs.length; i++) {
        processInput(inputs[i]);
      }
    }
  }

  /**
   * مانیتور کردن ورودی‌های متنی کاربر (Lexical Editor, Textarea و Input)
   */
  function setupInputObservers() {
    function handleInputEvent(e) {
      const target = e.target;
      if (!target) return;

      const inputContainer = target.closest(
        'div[contenteditable="true"], [role="textbox"], textarea, input, [data-testid="agent-input-box"], [data-testid="ask-question-writein"]'
      ) || (target.isContentEditable ? target : null);

      if (inputContainer) {
        processInput(inputContainer);
      }
    }

    document.addEventListener('input', handleInputEvent, true);
    document.addEventListener('keyup', handleInputEvent, true);
    document.addEventListener('compositionend', handleInputEvent, true);
  }

  // سیستم ناظر تغییرات DOM با Debounce جهت پردازش روان هنگام Streaming پاسخ هوش مصنوعی
  let animationFrameId = null;
  const pendingNodes = new Set();

  function flushPendingNodes() {
    animationFrameId = null;
    pendingNodes.forEach(node => {
      if (node && node.isConnected) {
        processContainer(node);
      }
    });
    pendingNodes.clear();
  }

  function queueNodeForProcessing(node) {
    if (!node) return;
    pendingNodes.add(node);
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(flushPendingNodes);
    }
  }

  const domObserver = new MutationObserver(mutations => {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (mutation.type === 'childList') {
        // علاوه بر گره‌های اضافه شده، کانتینر والد نیز صف‌بندی می‌شود (ضروری برای Streaming در ری‌اکت)
        if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
          queueNodeForProcessing(mutation.target);
        }
        for (let j = 0; j < mutation.addedNodes.length; j++) {
          const added = mutation.addedNodes[j];
          if (added.nodeType === Node.ELEMENT_NODE) {
            queueNodeForProcessing(added);
          }
        }
      } else if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent) {
          queueNodeForProcessing(parent);
          const block = parent.closest('p, li, blockquote, [data-quotable="true"], [data-testid="user-message-bubble"]');
          if (block) {
            queueNodeForProcessing(block);
          }
        }
      }
    }
  });

  /**
   * راه‌اندازی اولیه
   */
  function initialize() {
    domObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    setupInputObservers();
    processContainer(document.body);

    console.log('[Antigravity Persian Chat] Auto RTL and Vazirmatn font initialized.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
