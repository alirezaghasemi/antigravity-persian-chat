/**
 * Cursor Persian Chat - Client Injection Script
 * راست‌چین‌سازی هوشمند و خودکار متن‌های چت و Composer در نرم‌افزار Cursor
 */
(function () {
  'use strict';

  const PERSIAN_CHARS_REGEX = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/;
  const PERSIAN_CHARS_GLOBAL = /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFC]/g;
  const LATIN_CHARS_GLOBAL = /[A-Za-z]/g;

  /**
   * تشخیص جهت متن بر اساس توزیع کاراکترهای فارسی و لاتین
   */
  function detectDirection(text) {
    if (!text) return null;

    const cleaned = text
      .replace(/https?:\/\/\S+/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/[0-9\s.,!?:;'"_`*~#\(\)\[\]{}<>\/\\|+=@$%^&\-—]/g, '');

    if (!cleaned) return null;

    const persianMatches = cleaned.match(PERSIAN_CHARS_GLOBAL);
    const persianCount = persianMatches ? persianMatches.length : 0;

    const latinMatches = cleaned.match(LATIN_CHARS_GLOBAL);
    const latinCount = latinMatches ? latinMatches.length : 0;

    if (persianCount > 0) {
      if (persianCount >= 3 || persianCount >= (latinCount * 0.25)) {
        return 'rtl';
      }
    }

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];
      if (PERSIAN_CHARS_REGEX.test(char)) return 'rtl';
      if (/[A-Za-z]/.test(char)) return 'ltr';
    }

    return latinCount > 0 ? 'ltr' : null;
  }

  /**
   * آیا این المان یک بلوک کد، مونو یا تگ معاف از تغییر جهت است؟
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
      el.closest('code') ||
      el.closest('.code-block') ||
      el.closest('.markdown-code-outer-container') ||
      el.closest('.monaco-editor:not(.interactive-input-editor)')
    ) {
      return true;
    }

    return false;
  }

  /**
   * اعمال استایل‌های راست‌چین مستقیم روی یک المان و بلوک والد آن
   */
  function applyRtlStyles(el) {
    el.setAttribute('data-cursor-dir', 'rtl');
    el.setAttribute('dir', 'rtl');
    el.classList.add('cursor-persian-rtl');
    el.classList.remove('cursor-persian-ltr');
    el.style.direction = 'rtl';
    el.style.textAlign = 'right';

    // تنظیم کانتینر بلوکی والد جهت کشش کامل به سمت راست
    const blockParent = el.closest('p, li, blockquote, .rendered-markdown, .composer-human-message-content, .composer-human-message-body, .composer-message-markdown');
    if (blockParent && blockParent !== el) {
      blockParent.setAttribute('data-cursor-dir', 'rtl');
      blockParent.setAttribute('dir', 'rtl');
      blockParent.classList.add('cursor-persian-rtl');
      blockParent.classList.remove('cursor-persian-ltr');
      blockParent.style.direction = 'rtl';
      blockParent.style.textAlign = 'right';
    }
  }

  /**
   * اعمال استایل چپ‌چین
   */
  function applyLtrStyles(el) {
    el.setAttribute('data-cursor-dir', 'ltr');
    el.setAttribute('dir', 'ltr');
    el.classList.add('cursor-persian-ltr');
    el.classList.remove('cursor-persian-rtl');
    el.style.direction = 'ltr';
    el.style.textAlign = 'left';
  }

  /**
   * پردازش یک المان متنی
   */
  function processElement(el) {
    if (!el || isCodeOrExcluded(el)) return;

    const text = el.textContent || '';
    if (!text.trim()) return;

    const dir = detectDirection(text);
    if (!dir) return;

    const currentDir = el.getAttribute('data-cursor-dir');
    if (currentDir === dir) return;

    if (dir === 'rtl') {
      applyRtlStyles(el);
    } else if (dir === 'ltr') {
      applyLtrStyles(el);
    }
  }

  // انتخابگرهای مربوط به متون چت، Composer و پیام‌ها در Cursor
  const TARGET_SELECTORS = [
    'p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'th', 'td',
    '.rendered-markdown',
    '.rendered-markdown p',
    '.rendered-markdown li',
    '.composer-human-message-content',
    '.composer-human-message-body',
    '.composer-message-markdown',
    '.composer-message-markdown p',
    '.agent-transcript-row-markdown',
    '.agent-transcript-row-markdown p',
    '.aislash-editor-input-readonly',
    '.aislash-editor-input-readonly p',
    '.composer-human-tiptap-readonly-editor p',
    '.markdown-lexical-editor-paragraph'
  ].join(', ');

  /**
   * پردازش المان‌های ورودی تایپ (TipTap, Lexical, textarea, contenteditable)
   */
  function processInput(inputEl) {
    if (!inputEl) return;
    const text = inputEl.innerText || inputEl.value || inputEl.textContent || '';
    const dir = detectDirection(text);

    if (dir === 'rtl') {
      inputEl.setAttribute('dir', 'rtl');
      inputEl.setAttribute('data-cursor-dir', 'rtl');
      inputEl.style.direction = 'rtl';
      inputEl.style.textAlign = 'right';

      const innerParas = inputEl.querySelectorAll('p, div');
      innerParas.forEach(p => {
        p.setAttribute('dir', 'rtl');
        p.style.direction = 'rtl';
        p.style.textAlign = 'right';
      });
    } else if (dir === 'ltr') {
      inputEl.setAttribute('dir', 'ltr');
      inputEl.setAttribute('data-cursor-dir', 'ltr');
      inputEl.style.direction = 'ltr';
      inputEl.style.textAlign = 'left';

      const innerParas = inputEl.querySelectorAll('p, div');
      innerParas.forEach(p => {
        p.setAttribute('dir', 'ltr');
        p.style.direction = 'ltr';
        p.style.textAlign = 'left';
      });
    }
  }

  /**
   * اسکن کامل یک کانتینر DOM
   */
  function scanContainer(root) {
    if (!root || !root.querySelectorAll) return;

    if (root.matches && root.matches(TARGET_SELECTORS)) {
      processElement(root);
    }

    const elements = root.querySelectorAll(TARGET_SELECTORS);
    for (let i = 0; i < elements.length; i++) {
      processElement(elements[i]);
    }

    const inputs = root.querySelectorAll('div[contenteditable="true"], .aislash-editor-input, .markdown-lexical-editor-content-editable, textarea');
    for (let i = 0; i < inputs.length; i++) {
      processInput(inputs[i]);
    }
  }

  // صف گره‌های در انتظار پردازش (Mutation Queue بدون از دست رفتن هیچ رویدادی)
  let animationFrameId = null;
  const pendingNodes = new Set();

  function flushPendingNodes() {
    animationFrameId = null;
    pendingNodes.forEach(node => {
      if (node && node.isConnected) {
        scanContainer(node);
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

  const observer = new MutationObserver((mutations) => {
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

  function init() {
    document.documentElement.setAttribute('data-cursor-persian', 'active');

    scanContainer(document.body);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // لیسنر Capture Phase برای رویدادهای تایپ و فوکوس
    const handleTypingEvent = (e) => {
      const target = e.target;
      if (!target) return;
      if (
        target.isContentEditable ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'INPUT' ||
        target.classList.contains('aislash-editor-input') ||
        target.classList.contains('markdown-lexical-editor-content-editable') ||
        target.closest('div[contenteditable="true"]')
      ) {
        const inputContainer = target.isContentEditable
          ? target
          : (target.closest('div[contenteditable="true"]') || target);
        processInput(inputContainer);
      }
    };

    document.addEventListener('input', handleTypingEvent, true);
    document.addEventListener('keyup', handleTypingEvent, true);
    document.addEventListener('compositionend', handleTypingEvent, true);
    document.addEventListener('focusin', handleTypingEvent, true);

    // اسکن دوره‌ای با فواصل مشخص برای تضمین ۱۰۰٪ تراز راست پیام‌ها در تمام شرایط
    setInterval(() => {
      scanContainer(document.body);
    }, 350);

    console.log('[Cursor Persian Chat] RTL engine active and listening.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
