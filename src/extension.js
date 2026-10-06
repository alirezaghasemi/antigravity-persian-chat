const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const INJECTION_START = '<!-- antigravity-persian-chat-start -->';
const INJECTION_END = '<!-- antigravity-persian-chat-end -->';

const INJECTION_TAGS = `
${INJECTION_START}
<link rel="stylesheet" href="./persian-chat.css">
<script src="./persian-chat.js" type="module"></script>
${INJECTION_END}
`;

/**
 * یافتن مسیر نصب نرم‌افزار Antigravity IDE
 */
function findAntigravityAppPath() {
  const customPath = vscode.workspace.getConfiguration('antigravityPersian').get('customAppPath');
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }

  // تلاش برای یافتن از طریق مسیر پروسه اجرایی
  const execDir = path.dirname(process.execPath);
  const possiblePaths = [
    path.join(execDir, 'resources', 'app'),
    '/opt/antigravity-ide/resources/app',
    '/usr/share/antigravity-ide/resources/app',
    '/opt/Antigravity IDE/resources/app',
    path.join(process.env.HOME || '', '.local/share/antigravity-ide/resources/app'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(path.join(p, 'out', 'vs', 'code', 'electron-browser', 'workbench', 'workbench.html'))) {
      return p;
    }
  }

  return '/opt/antigravity-ide/resources/app';
}

/**
 * دریافت لیست فایل‌های هدف برای پچ کردن
 */
function getTargetFiles(appPath) {
  const workbenchDir = path.join(appPath, 'out', 'vs', 'code', 'electron-browser', 'workbench');
  return {
    workbenchDir,
    workbenchHtml: path.join(workbenchDir, 'workbench.html'),
    jetskiHtml: path.join(workbenchDir, 'workbench-jetski-agent.html'),
    cssDest: path.join(workbenchDir, 'persian-chat.css'),
    jsDest: path.join(workbenchDir, 'persian-chat.js'),
    productJson: path.join(appPath, 'product.json'),
  };
}

/**
 * بررسی اینکه آیا پچ راست‌چین اعمال شده است یا خیر
 */
function isPatched(targets) {
  try {
    if (!fs.existsSync(targets.workbenchHtml) || !fs.existsSync(targets.jetskiHtml)) {
      return false;
    }
    const content = fs.readFileSync(targets.workbenchHtml, 'utf8');
    return content.includes(INJECTION_START);
  } catch (e) {
    return false;
  }
}

/**
 * بررسی دسترسی نوشتن به پوشه و فایل‌ها
 */
function hasWriteAccess(targets) {
  try {
    fs.accessSync(targets.workbenchDir, fs.constants.W_OK);
    fs.accessSync(targets.workbenchHtml, fs.constants.W_OK);
    fs.accessSync(targets.jetskiHtml, fs.constants.W_OK);
    if (fs.existsSync(targets.productJson)) {
      fs.accessSync(targets.productJson, fs.constants.W_OK);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * محاسبه چک‌سام فایل به سبک هسته VS Code (SHA256 Base64 بدون پدینگ)
 */
function computeChecksum(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('base64').replace(/=+$/, '');
}

/**
 * به‌روزرسانی چک‌سام‌ها در product.json برای رفع پیام Corrupt/Unsupported
 */
function updateProductChecksums(targets) {
  const productPath = targets.productJson;
  if (!fs.existsSync(productPath)) return;

  try {
    const backupPath = productPath + '.bak';
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(productPath, backupPath);
    }

    let content = fs.readFileSync(productPath, 'utf8');
    const updates = [
      { key: 'vs/code/electron-browser/workbench/workbench.html', file: targets.workbenchHtml },
      { key: 'vs/code/electron-browser/workbench/workbench-jetski-agent.html', file: targets.jetskiHtml },
    ];

    for (const { key, file } of updates) {
      if (fs.existsSync(file)) {
        const hash = computeChecksum(file);
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`("${escapedKey}"\\s*:\\s*")[^"]+(")`);
        content = content.replace(regex, `$1${hash}$2`);
      }
    }

    fs.writeFileSync(productPath, content, 'utf8');
  } catch (err) {
    console.error('Failed to update product.json checksums:', err);
  }
}

/**
 * بازگردانی product.json به حالت اولیه
 */
function restoreProductChecksums(targets) {
  const productPath = targets.productJson;
  const backupPath = productPath + '.bak';
  try {
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, productPath);
    }
  } catch (err) {
    console.error('Failed to restore product.json checksums:', err);
  }
}

/**
 * اعمال پچ راست‌چین و فونت وزیرمتن
 */
async function applyPatch(context, statusBarItem) {
  const appPath = findAntigravityAppPath();
  const targets = getTargetFiles(appPath);

  if (!fs.existsSync(targets.workbenchHtml)) {
    vscode.window.showErrorMessage(
      `مسیر Antigravity IDE یافت نشد: ${appPath}. لطفاً در تنظیمات افزونه مسیر صحیح را مشخص کنید.`
    );
    return;
  }

  // اگر دسترسی روت یا دسترسی نوشتن لازم است
  if (!hasWriteAccess(targets)) {
    const installScript = path.join(context.extensionPath, 'apply-persian-rtl.sh');
    const action = await vscode.window.showWarningMessage(
      'برای اعمال فونت وزیرمتن و راست‌چین، نیاز به دسترسی نوشتن به پوشه Antigravity IDE است.',
      'اجرا در ترمینال داخلی (پیشنهادی)',
      'کپی دستور دسترسی'
    );

    if (action === 'اجرا در ترمینال داخلی (پیشنهادی)') {
      const terminal = vscode.window.createTerminal('Antigravity Persian Patch');
      terminal.show();
      terminal.sendText(`bash "${installScript}"`);
    } else if (action === 'کپی دستور دسترسی') {
      const cmd = `sudo chown -R $USER /opt/antigravity-ide`;
      await vscode.env.clipboard.writeText(cmd);
      vscode.window.showInformationMessage(`دستور در کلیپ‌بورد کپی شد: ${cmd}`);
    }
    return;
  }

  try {
    // تهیه نسخه پشتیبان
    if (!fs.existsSync(targets.workbenchHtml + '.bak')) {
      fs.copyFileSync(targets.workbenchHtml, targets.workbenchHtml + '.bak');
    }
    if (!fs.existsSync(targets.jetskiHtml + '.bak')) {
      fs.copyFileSync(targets.jetskiHtml, targets.jetskiHtml + '.bak');
    }

    // کپی فایل‌های CSS و JS اختصاصی
    const srcCss = path.join(context.extensionPath, 'styles.css');
    const srcJs = path.join(context.extensionPath, 'src', 'persian-chat.js');

    fs.copyFileSync(srcCss, targets.cssDest);
    fs.copyFileSync(srcJs, targets.jsDest);

    // پچ کردن workbench.html
    let wbContent = fs.readFileSync(targets.workbenchHtml, 'utf8');
    if (!wbContent.includes(INJECTION_START)) {
      wbContent = wbContent.replace('</html>', `${INJECTION_TAGS}\n</html>`);
      fs.writeFileSync(targets.workbenchHtml, wbContent, 'utf8');
    }

    // پچ کردن workbench-jetski-agent.html
    let jkContent = fs.readFileSync(targets.jetskiHtml, 'utf8');
    if (!jkContent.includes(INJECTION_START)) {
      jkContent = jkContent.replace('</html>', `${INJECTION_TAGS}\n</html>`);
      fs.writeFileSync(targets.jetskiHtml, jkContent, 'utf8');
    }

    // به‌روزرسانی چک‌سام‌ها در product.json
    updateProductChecksums(targets);

    updateStatusBar(statusBarItem, true);

    const reload = await vscode.window.showInformationMessage(
      '✅ راست‌چین خودکار و فونت وزیرمتن با موفقیت فعال شد!',
      'بارگذاری مجدد پنجره (Reload)'
    );

    if (reload === 'بارگذاری مجدد پنجره (Reload)') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`خطا در اعمال پچ: ${err.message}`);
  }
}

/**
 * غیرفعال‌سازی و بازگردانی فایل‌های اصلی
 */
async function removePatch(context, statusBarItem) {
  const appPath = findAntigravityAppPath();
  const targets = getTargetFiles(appPath);

  if (!hasWriteAccess(targets)) {
    const installScript = path.join(context.extensionPath, 'apply-persian-rtl.sh');
    const action = await vscode.window.showWarningMessage(
      'برای بازگردانی، نیاز به دسترسی نوشتن به پوشه Antigravity IDE است.',
      'اجرا در ترمینال داخلی'
    );
    if (action === 'اجرا در ترمینال داخلی') {
      const terminal = vscode.window.createTerminal('Antigravity Persian Restore');
      terminal.show();
      terminal.sendText(`bash "${installScript}" --restore`);
    }
    return;
  }

  try {
    const regex = new RegExp(`${INJECTION_START}[\\s\\S]*?${INJECTION_END}\\n?`, 'g');

    if (fs.existsSync(targets.workbenchHtml)) {
      let wb = fs.readFileSync(targets.workbenchHtml, 'utf8');
      wb = wb.replace(regex, '');
      fs.writeFileSync(targets.workbenchHtml, wb, 'utf8');
    }

    if (fs.existsSync(targets.jetskiHtml)) {
      let jk = fs.readFileSync(targets.jetskiHtml, 'utf8');
      jk = jk.replace(regex, '');
      fs.writeFileSync(targets.jetskiHtml, jk, 'utf8');
    }

    // بازگردانی چک‌سام‌ها در product.json
    restoreProductChecksums(targets);

    updateStatusBar(statusBarItem, false);

    const reload = await vscode.window.showInformationMessage(
      'استایل فارسی غیرفعال شد و فایل‌های اصلی بازگردانی شدند.',
      'بارگذاری مجدد پنجره (Reload)'
    );

    if (reload === 'بارگذاری مجدد پنجره (Reload)') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`خطا در غیرفعال‌سازی: ${err.message}`);
  }
}

/**
 * به‌روزرسانی نوار وضعیت
 */
function updateStatusBar(item, active) {
  if (active) {
    item.text = '$(check) فارسی/RTL';
    item.tooltip = 'راست‌چین چت و فونت وزیرمتن: فعال (کلیک برای مدیریت)';
    item.backgroundColor = undefined;
  } else {
    item.text = '$(circle-slash) فارسی/RTL';
    item.tooltip = 'راست‌چین چت و فونت وزیرمتن: غیرفعال (کلیک برای فعال‌سازی)';
  }
  item.show();
}

function activate(context) {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.command = 'antigravityPersian.menu';
  context.subscriptions.push(statusBarItem);

  const appPath = findAntigravityAppPath();
  const targets = getTargetFiles(appPath);
  const active = isPatched(targets);
  updateStatusBar(statusBarItem, active);

  // دستور فعال‌سازی
  const enableCmd = vscode.commands.registerCommand('antigravityPersian.applyRtl', () => {
    applyPatch(context, statusBarItem);
  });

  const enableAliasCmd = vscode.commands.registerCommand('antigravityPersian.enable', () => {
    applyPatch(context, statusBarItem);
  });

  // دستور غیرفعال‌سازی
  const disableCmd = vscode.commands.registerCommand('antigravityPersian.disable', () => {
    removePatch(context, statusBarItem);
  });

  // دستور منوی سریع
  const menuCmd = vscode.commands.registerCommand('antigravityPersian.menu', async () => {
    const isNowPatched = isPatched(targets);
    const options = [
      {
        label: isNowPatched ? '$(check) فعال‌سازی مجدد / به‌روزرسانی استایل' : '$(play) فعال‌سازی راست‌چین و فونت وزیرمتن',
        description: 'اعمال فونت وزیرمتن و تنظیمات RTL روی چت Antigravity',
        action: 'enable',
      },
      {
        label: '$(trash) غیرفعال‌سازی و بازگردانی به حالت اولیه',
        description: 'حذف استایل‌های فارسی و برگرداندن فایل‌های پیش‌فرض',
        action: 'disable',
      },
      {
        label: '$(refresh) بارگذاری مجدد پنجره (Reload Window)',
        description: 'راه‌اندازی دوباره محیط بدون بستن کامل IDE',
        action: 'reload',
      },
    ];

    const selected = await vscode.window.showQuickPick(options, {
      placeHolder: 'مدیریت راست‌چین و فونت وزیرمتن چت Antigravity',
    });

    if (!selected) return;

    if (selected.action === 'enable') {
      applyPatch(context, statusBarItem);
    } else if (selected.action === 'disable') {
      removePatch(context, statusBarItem);
    } else if (selected.action === 'reload') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  });

  // دستور بررسی وضعیت
  const statusCmd = vscode.commands.registerCommand('antigravityPersian.status', () => {
    const isNowPatched = isPatched(targets);
    vscode.window.showInformationMessage(
      `وضعیت راست‌چین چت: ${isNowPatched ? 'فعال ✅' : 'غیرفعال ❌'}`
    );
  });

  context.subscriptions.push(enableCmd, enableAliasCmd, disableCmd, menuCmd, statusCmd);

  // یادآوری اولیه در صورت فعال نبودن
  const enabledInConfig = vscode.workspace.getConfiguration('antigravityPersian').get('enabled', true);
  if (enabledInConfig && !active) {
    vscode.window
      .showInformationMessage(
        'راست‌چین خودکار چت و فونت وزیرمتن هنوز فعال نشده است. آیا مایلید فعال شود؟',
        'فعال‌سازی (Enable)',
        'بعداً'
      )
      .then(choice => {
        if (choice === 'فعال‌سازی (Enable)') {
          applyPatch(context, statusBarItem);
        }
      });
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
