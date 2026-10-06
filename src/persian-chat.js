/**
 * Antigravity Persian Chat - Client Injection Script
 * راست‌چین‌سازی هوشمند و خودکار متن‌های چت و پشتیبانی دو زبانه (فارسی و انگلیسی)
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
   * پردازش یک المان متنی منفرد
   * @param {HTMLElement} el 
   */
  function processElement(el) {
    if (!el || !el.tagName) return;

    const tag = el.tagName.toLowerCase();

    // نادیده گرفتن بلوک‌های کد، ادیتور موناکو، تگ‌های اسکریپت و استایل
    if (
      tag === 'pre' ||
      tag === 'code' ||
      tag === 'script' ||
      tag === 'style' ||
      tag === 'svg' ||
      el.closest('pre') ||
      el.closest('.monaco-editor') ||
      el.closest('.code-block')
    ) {
      return;
    }

    const text = el.textContent || '';
    if (!text.trim()) return;

    const dir = detectDirection(text);
    if (!dir) return;

    const currentDir = el.getAttribute('data-ag-dir');
    if (currentDir === dir) return;

    if (dir === 'rtl') {
      el.setAttribute('data-ag-dir', 'rtl');
      el.setAttribute('dir', 'rtl');
      el.classList.add('ag-persian-rtl');
      el.classList.remove('ag-persian-ltr');
    } else if (dir === 'ltr') {
      el.setAttribute('data-ag-dir', 'ltr');
      el.setAttribute('dir', 'ltr');
      el.classList.add('ag-persian-ltr');
      el.classList.remove('ag-persian-rtl');
    }
  }

  // انتخابگرهای مربوط به محتوای متنی چت در Antigravity IDE
  const TARGET_SELECTORS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, th, td, [data-testid="user-input-step"]';

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
    }
  }

  /**
   * مانیتور کردن ورودی‌های متنی کاربر (Textarea و Input) برای راست‌چین خودکار هنگام تایپ فارسی
   */
  function setupInputObservers() {
    function handleInputEvent(e) {
      const target = e.target;
      if (!target) return;

      const tag = target.tagName ? target.tagName.toLowerCase() : '';
      if (tag === 'textarea' || tag === 'input' || target.isContentEditable) {
        const val = target.value || target.textContent || '';
        const dir = detectDirection(val);
        if (dir === 'rtl') {
          target.setAttribute('dir', 'rtl');
          target.style.textAlign = 'right';
          target.style.direction = 'rtl';
        } else if (dir === 'ltr') {
          target.setAttribute('dir', 'ltr');
          target.style.textAlign = 'left';
          target.style.direction = 'ltr';
        }
      }
    }

    document.addEventListener('input', handleInputEvent, true);
    document.addEventListener('keyup', handleInputEvent, true);
  }

  // سیستم ناظر تغییرات DOM با Debounce جهت پردازش روان هنگام Streaming پاسخ هوش مصنوعی
  let animationFrameId = null;
  const pendingNodes = new Set();

  function flushPendingNodes() {
    animationFrameId = null;
    pendingNodes.forEach(node => {
      if (node.isConnected) {
        processContainer(node);
      }
    });
    pendingNodes.clear();
  }

  function queueNodeForProcessing(node) {
    pendingNodes.add(node);
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(flushPendingNodes);
    }
  }

  const domObserver = new MutationObserver(mutations => {
    for (let i = 0; i < mutations.length; i++) {
      const mutation = mutations[i];
      if (mutation.type === 'childList') {
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
