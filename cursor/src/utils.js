const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// تگ‌های تزریق اختصاصی برای نرم‌افزار Cursor
const TAG_START = '<!-- cursor-persian-chat-start -->';
const TAG_END = '<!-- cursor-persian-chat-end -->';

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
 * تولید تگ‌های تزریق HTML برای Cursor
 */
function generateInjectionTags(cssRelPath, jsRelPath) {
  return `\n${TAG_START}\n<link rel="stylesheet" href="${cssRelPath}">\n<script src="${jsRelPath}"></script>\n${TAG_END}`;
}

/**
 * تزریق اسکریپت و استایل به فایل workbench.html
 */
function injectHtml(htmlContent, cssRelPath, jsRelPath) {
  if (htmlContent.includes(TAG_START)) {
    return htmlContent;
  }
  const tags = generateInjectionTags(cssRelPath, jsRelPath);
  if (htmlContent.includes('</html>')) {
    return htmlContent.replace('</html>', `${tags}\n</html>`);
  }
  return htmlContent + '\n' + tags;
}

/**
 * حذف تگ‌های تزریق شده از HTML
 */
function removeHtml(htmlContent) {
  const regex = new RegExp(`\\s*${escapeRegex(TAG_START)}[\\s\\S]*?${escapeRegex(TAG_END)}`, 'g');
  return htmlContent.replace(regex, '');
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * محاسبه چک‌سام فایل به سبک هسته VS Code و Cursor (SHA256 Base64 بدون پدینگ)
 */
function computeChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('base64').replace(/=+$/, '');
}

/**
 * به‌روزرسانی چک‌سام در product.json برای جلوگیری از پیام Your installation is corrupt
 */
function updateChecksumInProduct(productPath, fileMap) {
  if (!fs.existsSync(productPath)) return;

  const backupPath = productPath + '.bak';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(productPath, backupPath);
  }

  let content = fs.readFileSync(productPath, 'utf8');

  for (const [key, filePath] of Object.entries(fileMap)) {
    if (fs.existsSync(filePath)) {
      const hash = computeChecksum(filePath);
      const escapedKey = escapeRegex(key);
      const regex = new RegExp(`("${escapedKey}"\\s*:\\s*")[^"]+(")`);
      content = content.replace(regex, `$1${hash}$2`);
    }
  }

  fs.writeFileSync(productPath, content, 'utf8');
}

/**
 * بازگردانی product.json از نسخه پشتیبان
 */
function restoreProductJson(productPath) {
  const backupPath = productPath + '.bak';
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, productPath);
  }
}

/**
 * یافتن مسیر نصب Cursor به صورت چندسکویی
 */
function findCursorAppPath(customPath) {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  const platform = process.platform;
  const home = os.homedir();

  const candidates = [];

  if (platform === 'linux') {
    candidates.push(
      '/usr/share/cursor/resources/app',
      '/opt/Cursor/resources/app',
      '/opt/cursor/resources/app',
      path.join(home, '.local/share/cursor/resources/app'),
      '/var/lib/flatpak/app/com.cursor.Cursor/current/active/files/share/cursor/resources/app'
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Cursor.app/Contents/Resources/app',
      path.join(home, 'Applications/Cursor.app/Contents/Resources/app')
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    candidates.push(
      path.join(localAppData, 'Programs', 'cursor', 'resources', 'app'),
      path.join(programFiles, 'Cursor', 'resources', 'app')
    );
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return candidates[0] || '/usr/share/cursor/resources/app';
}

/**
 * استخراج مسیر فایل‌های هدف بر اساس ساختار Cursor
 */
function getTargetFiles(appPath) {
  // ساختار استاندارد Cursor: out/vs/code/electron-sandbox/workbench/workbench.html
  const workbenchDir = path.join(appPath, 'out', 'vs', 'code', 'electron-sandbox', 'workbench');
  return {
    appPath,
    workbenchDir,
    workbenchHtml: path.join(workbenchDir, 'workbench.html'),
    productJson: path.join(appPath, 'product.json'),
    cssDest: path.join(workbenchDir, 'cursor-persian.css'),
    jsDest: path.join(workbenchDir, 'cursor-persian.js'),
  };
}

module.exports = {
  TAG_START,
  TAG_END,
  detectDirection,
  generateInjectionTags,
  injectHtml,
  removeHtml,
  computeChecksum,
  updateChecksumInProduct,
  restoreProductJson,
  findCursorAppPath,
  getTargetFiles,
};
