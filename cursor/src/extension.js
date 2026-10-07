const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const {
  TAG_START,
  injectHtml,
  removeHtml,
  updateChecksumInProduct,
  restoreProductJson,
  findCursorAppPath,
  getTargetFiles,
} = require('./utils.js');

/**
 * بررسی دسترسی نوشتن به فایل‌های مورد نیاز
 */
function hasWriteAccess(targets) {
  try {
    fs.accessSync(targets.workbenchDir, fs.constants.W_OK);
    fs.accessSync(targets.workbenchHtml, fs.constants.W_OK);
    if (fs.existsSync(targets.productJson)) {
      fs.accessSync(targets.productJson, fs.constants.W_OK);
    }
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * به‌روزرسانی وضعیت استاتوس‌بار
 */
function updateStatusBar(statusBarItem, isPatched) {
  if (isPatched) {
    statusBarItem.text = '$(globe) Cursor RTL: فعال';
    statusBarItem.tooltip = 'راست‌چین خودکار و فونت وزیرمتن در Cursor فعال است (برای مدیریت کلیک کنید)';
  } else {
    statusBarItem.text = '$(globe) Cursor RTL: غیرفعال';
    statusBarItem.tooltip = 'راست‌چین خودکار غیرفعال است (برای فعال‌سازی کلیک کنید)';
  }
}

/**
 * اعمال پچ راست‌چین و فونت وزیرمتن در Cursor
 */
async function applyPatch(context, statusBarItem) {
  const config = vscode.workspace.getConfiguration('cursorPersian');
  const customPath = config.get('customAppPath', '');
  const appPath = findCursorAppPath(customPath);
  const targets = getTargetFiles(appPath);

  if (!fs.existsSync(targets.workbenchHtml)) {
    vscode.window.showErrorMessage(
      `مسیر Cursor IDE یافت نشد: ${appPath}. لطفاً در تنظیمات افزونه مسیر صحیح را مشخص کنید.`
    );
    return;
  }

  // اگر دسترسی روت یا دسترسی نوشتن لازم است
  if (!hasWriteAccess(targets)) {
    const installScript = path.join(context.extensionPath, 'apply-cursor-persian.sh');
    const action = await vscode.window.showWarningMessage(
      'برای اعمال فونت وزیرمتن و راست‌چین، نیاز به دسترسی نوشتن به پوشه فایل‌های رابط کاربری Cursor است.',
      'اجرا در ترمینال داخلی (پیشنهادی)',
      'کپی دستور دسترسی'
    );

    if (action === 'اجرا در ترمینال داخلی (پیشنهادی)') {
      const terminal = vscode.window.createTerminal('Cursor Persian Patch');
      terminal.show();
      terminal.sendText(`bash "${installScript}"`);
    } else if (action === 'کپی دستور دسترسی') {
      const baseDir = path.dirname(path.dirname(appPath));
      const sandboxPath = path.join(baseDir, 'chrome-sandbox');
      const cmd = `sudo chown -R $USER "${appPath}" && if [ -f "${sandboxPath}" ]; then sudo chown root:root "${sandboxPath}" && sudo chmod 4755 "${sandboxPath}"; fi`;
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

    // کپی فایل‌های CSS و JS اختصاصی
    const srcCss = path.join(context.extensionPath, 'styles.css');
    const srcJs = path.join(context.extensionPath, 'src', 'cursor-chat.js');

    // کپی فونت‌های محلی وزیرمتن جهت بارگذاری آفلاین و سازگار با CSP
    const srcFonts = path.join(context.extensionPath, 'fonts');
    const destFonts = path.join(targets.workbenchDir, 'fonts');
    if (fs.existsSync(srcFonts)) {
      if (!fs.existsSync(destFonts)) {
        fs.mkdirSync(destFonts, { recursive: true });
      }
      for (const f of fs.readdirSync(srcFonts)) {
        fs.copyFileSync(path.join(srcFonts, f), path.join(destFonts, f));
      }
    }

    fs.copyFileSync(srcCss, targets.cssDest);
    fs.copyFileSync(srcJs, targets.jsDest);

    // پچ کردن workbench.html
    const wbContent = fs.readFileSync(targets.workbenchHtml, 'utf8');
    const injected = injectHtml(wbContent, './cursor-persian.css', './cursor-persian.js');
    fs.writeFileSync(targets.workbenchHtml, injected, 'utf8');

    // به‌روزرسانی چک‌سام‌ها در product.json
    updateChecksumInProduct(targets.productJson, {
      'vs/code/electron-sandbox/workbench/workbench.html': targets.workbenchHtml,
    });

    updateStatusBar(statusBarItem, true);

    const reload = await vscode.window.showInformationMessage(
      '✅ راست‌چین خودکار و فونت وزیرمتن با موفقیت برای Cursor فعال شد!',
      'بارگذاری مجدد پنجره (Reload)'
    );

    if (reload === 'بارگذاری مجدد پنجره (Reload)') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`خطا در اعمال پچ Cursor: ${err.message}`);
  }
}

/**
 * غیرفعال‌سازی و بازگردانی فایل‌های اصلی Cursor
 */
async function removePatch(context, statusBarItem) {
  const config = vscode.workspace.getConfiguration('cursorPersian');
  const customPath = config.get('customAppPath', '');
  const appPath = findCursorAppPath(customPath);
  const targets = getTargetFiles(appPath);

  if (!fs.existsSync(targets.workbenchHtml)) {
    vscode.window.showErrorMessage(`مسیر Cursor IDE یافت نشد: ${appPath}`);
    return;
  }

  try {
    // بازگردانی workbench.html
    if (fs.existsSync(targets.workbenchHtml + '.bak')) {
      fs.copyFileSync(targets.workbenchHtml + '.bak', targets.workbenchHtml);
    } else {
      const wbContent = fs.readFileSync(targets.workbenchHtml, 'utf8');
      fs.writeFileSync(targets.workbenchHtml, removeHtml(wbContent), 'utf8');
    }

    // حذف فایل‌های تزریق شده
    if (fs.existsSync(targets.cssDest)) fs.unlinkSync(targets.cssDest);
    if (fs.existsSync(targets.jsDest)) fs.unlinkSync(targets.jsDest);

    // بازگردانی product.json
    restoreProductJson(targets.productJson);

    updateStatusBar(statusBarItem, false);

    const reload = await vscode.window.showInformationMessage(
      '🔄 پچ Cursor با موفقیت حذف شد و فایل‌های اصلی بازگردانی شدند.',
      'بارگذاری مجدد پنجره (Reload)'
    );

    if (reload === 'بارگذاری مجدد پنجره (Reload)') {
      vscode.commands.executeCommand('workbench.action.reloadWindow');
    }
  } catch (err) {
    vscode.window.showErrorMessage(`خطا در بازگردانی فایل‌های Cursor: ${err.message}`);
  }
}

/**
 * منوی سریع مدیریت وضعیت
 */
async function showMenu(context, statusBarItem) {
  const appPath = findCursorAppPath();
  const targets = getTargetFiles(appPath);
  const isPatched = fs.existsSync(targets.workbenchHtml) &&
    fs.readFileSync(targets.workbenchHtml, 'utf8').includes(TAG_START);

  const items = [
    {
      label: isPatched ? '$(check) راست‌چین و فونت وزیرمتن: فعال است' : '$(circle-slash) راست‌چین و فونت وزیرمتن: غیرفعال است',
      description: 'وضعیت فعلی',
      action: 'none',
    },
    {
      label: '$(sync) اعمال مجدد / فعال‌سازی (Enable)',
      description: 'نصب و فعال‌سازی فونت وزیرمتن و RTL در چت و Composer',
      action: 'enable',
    },
    {
      label: '$(trash) غیرفعال‌سازی و بازگردانی (Disable)',
      description: 'بازگردانی فایل‌های اصلی Cursor',
      action: 'disable',
    },
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'مدیریت راست‌چین و فونت وزیرمتن برای Cursor',
  });

  if (!selected) return;

  if (selected.action === 'enable') {
    await applyPatch(context, statusBarItem);
  } else if (selected.action === 'disable') {
    await removePatch(context, statusBarItem);
  }
}

function activate(context) {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
  statusBarItem.command = 'cursorPersian.menu';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  const appPath = findCursorAppPath();
  const targets = getTargetFiles(appPath);
  const isPatched = fs.existsSync(targets.workbenchHtml) &&
    fs.readFileSync(targets.workbenchHtml, 'utf8').includes(TAG_START);
  updateStatusBar(statusBarItem, isPatched);

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorPersian.applyRtl', () => applyPatch(context, statusBarItem)),
    vscode.commands.registerCommand('cursorPersian.disable', () => removePatch(context, statusBarItem)),
    vscode.commands.registerCommand('cursorPersian.menu', () => showMenu(context, statusBarItem)),
    vscode.commands.registerCommand('cursorPersian.status', () => {
      vscode.window.showInformationMessage(
        isPatched
          ? 'وضعیت: راست‌چین و فونت وزیرمتن برای Cursor فعال است.'
          : 'وضعیت: افزونه در Cursor غیرفعال است.'
      );
    })
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
