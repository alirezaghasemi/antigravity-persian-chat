#!/usr/bin/env bash
# ==============================================================================
# اسکریپت فعال‌سازی راست‌چین خودکار و فونت وزیرمتن برای Cursor
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# جستجوی خودکار مسیر نصب نرم‌افزار Cursor
POSSIBLE_PATHS=(
    "/usr/share/cursor/resources/app"
    "/opt/Cursor/resources/app"
    "/opt/cursor/resources/app"
    "$HOME/.local/share/cursor/resources/app"
    "/var/lib/flatpak/app/com.cursor.Cursor/current/active/files/share/cursor/resources/app"
)

APP_PATH=""
for p in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$p" ]; then
        APP_PATH="$p"
        break
    fi
done

if [ -z "$APP_PATH" ]; then
    echo -e "\033[0;31mخطا: مسیر نصب نرم‌افزار Cursor یافت نشد.\033[0m"
    echo "پوشه‌های بررسی شده:"
    for p in "${POSSIBLE_PATHS[@]}"; do
        echo " - $p"
    done
    exit 1
fi

WORKBENCH_DIR="$APP_PATH/out/vs/code/electron-sandbox/workbench"
WB_HTML="$WORKBENCH_DIR/workbench.html"
PRODUCT_JSON="$APP_PATH/product.json"

CSS_SRC="$SCRIPT_DIR/styles.css"
JS_SRC="$SCRIPT_DIR/src/cursor-chat.js"

CSS_DEST="$WORKBENCH_DIR/cursor-persian.css"
JS_DEST="$WORKBENCH_DIR/cursor-persian.js"

TAG_START="<!-- cursor-persian-chat-start -->"
TAG_END="<!-- cursor-persian-chat-end -->"

INJECTION="\n${TAG_START}\n<link rel=\"stylesheet\" href=\"./cursor-persian.css\">\n<script src=\"./cursor-persian.js\"></script>\n${TAG_END}\n"

# رنگ‌ها برای خروجی زیبا
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}       فعال‌سازی راست‌چین و فونت وزیرمتن در Cursor      ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo -e "مسیر شناسایی‌شده Cursor: ${YELLOW}$APP_PATH${NC}"

# بررسی پارامتر بازگردانی (Restore / Uninstall)
if [ "$1" == "--restore" ] || [ "$1" == "-r" ] || [ "$1" == "uninstall" ]; then
    echo -e "${YELLOW}در حال بازگردانی فایل‌های اصلی Cursor...${NC}"

    if [ ! -w "$WORKBENCH_DIR" ] || ([ -f "$PRODUCT_JSON" ] && [ ! -w "$PRODUCT_JSON" ]); then
        echo -e "${YELLOW}نیاز به دسترسی جهت بازگردانی فایل‌ها:${NC}"
        sudo sed -i "/$TAG_START/,/$TAG_END/d" "$WB_HTML"
        sudo rm -f "$CSS_DEST" "$JS_DEST"
        sudo rm -rf "$WORKBENCH_DIR/fonts"
        if [ -f "$PRODUCT_JSON.bak" ]; then
            sudo cp -f "$PRODUCT_JSON.bak" "$PRODUCT_JSON"
        fi
    else
        sed -i "/$TAG_START/,/$TAG_END/d" "$WB_HTML"
        rm -f "$CSS_DEST" "$JS_DEST"
        rm -rf "$WORKBENCH_DIR/fonts"
        if [ -f "$PRODUCT_JSON.bak" ]; then
            cp -f "$PRODUCT_JSON.bak" "$PRODUCT_JSON"
        fi
    fi

    # بررسی و تعمیر دسترسی‌های chrome-sandbox در صورت نیاز
    CHROME_SANDBOX="$(dirname "$(dirname "$APP_PATH")")/chrome-sandbox"
    if [ -f "$CHROME_SANDBOX" ] && [ "$(stat -c '%U:%a' "$CHROME_SANDBOX" 2>/dev/null)" != "root:4755" ]; then
        echo -e "${YELLOW}در حال تنظیم دسترسی‌های استاندارد chrome-sandbox (root:4755)...${NC}"
        sudo chown root:root "$CHROME_SANDBOX"
        sudo chmod 4755 "$CHROME_SANDBOX"
    fi

    echo -e "${GREEN}✓ پچ Cursor با موفقیت حذف شد و فایل‌های اصلی بازگردانی شدند.${NC}"
    echo -e "جهت اعمال، محیط Cursor را یک بار ببندید و دوباره باز کنید."
    exit 0
fi

# بررسی وجود مسیر Cursor IDE
if [ ! -d "$WORKBENCH_DIR" ]; then
    echo -e "${RED}خطا: ساختار دایرکتوری Cursor مطابقت ندارد: $WORKBENCH_DIR${NC}"
    exit 1
fi

# ۱. نصب فونت وزیرمتن در سیستم کاربر (Local Font Installation)
FONT_DIR="$HOME/.local/share/fonts"
mkdir -p "$FONT_DIR"
if [ -d "$SCRIPT_DIR/fonts" ]; then
    echo -e "${BLUE}در حال ثبت فونت‌های وزیرمتن در سیستم‌عامل...${NC}"
    cp -u "$SCRIPT_DIR/fonts"/* "$FONT_DIR/" 2>/dev/null || true
    fc-cache -f "$FONT_DIR" 2>/dev/null || true
    echo -e "${GREEN}✓ فونت وزیرمتن با موفقیت در سیستم ثبت شد.${NC}"
fi

# ۲. اطمینان از دسترسی نوشتن به پوشه فایل‌های رابط کاربری
CURRENT_USER="${SUDO_USER:-$USER}"

if [ ! -w "$WORKBENCH_DIR" ] || [ ! -w "$WB_HTML" ] || ([ -f "$PRODUCT_JSON" ] && [ ! -w "$PRODUCT_JSON" ]); then
    echo -e "${YELLOW}نیاز به دسترسی نوشتن به فایل‌های رابط کاربری Cursor...${NC}"
    echo -e "لطفاً در صورت درخواست، رمز عبور سیستم (sudo) را وارد کنید:"
    sudo chown -R "$CURRENT_USER:$CURRENT_USER" "$APP_PATH"
fi

# بررسی و اطمینان از سلامت دسترسی‌های امنیتی chrome-sandbox
CHROME_SANDBOX="$(dirname "$(dirname "$APP_PATH")")/chrome-sandbox"
if [ -f "$CHROME_SANDBOX" ] && [ "$(stat -c '%U:%a' "$CHROME_SANDBOX" 2>/dev/null)" != "root:4755" ]; then
    echo -e "${YELLOW}در حال تنظیم دسترسی‌های استاندارد chrome-sandbox (root:4755)...${NC}"
    sudo chown root:root "$CHROME_SANDBOX"
    sudo chmod 4755 "$CHROME_SANDBOX"
fi

# ۳. تهیه نسخه پشتیبان
if [ ! -f "$WB_HTML.bak" ]; then
    cp "$WB_HTML" "$WB_HTML.bak"
fi
if [ -f "$PRODUCT_JSON" ] && [ ! -f "$PRODUCT_JSON.bak" ]; then
    cp "$PRODUCT_JSON" "$PRODUCT_JSON.bak"
fi

# ۴. کپی فایل‌های فونت، CSS و JS
FONTS_DEST="$WORKBENCH_DIR/fonts"
mkdir -p "$FONTS_DEST"
if [ -d "$SCRIPT_DIR/fonts" ]; then
    cp -u "$SCRIPT_DIR/fonts"/* "$FONTS_DEST/" 2>/dev/null || true
fi

cp -f "$CSS_SRC" "$CSS_DEST"
cp -f "$JS_SRC" "$JS_DEST"

# ۵. پچ کردن workbench.html
if ! grep -q "$TAG_START" "$WB_HTML"; then
    echo -e "${BLUE}در حال تزریق استایل‌ها و اسکریپت به Cursor workbench.html...${NC}"
    sed -i "s|</html>|${INJECTION}</html>|" "$WB_HTML"
else
    echo -e "${YELLOW}پچ از قبل در workbench.html وجود دارد. در حال به‌روزرسانی فایل‌های تزریق...${NC}"
fi

# ۶. به‌روزرسانی چک‌سام در product.json برای رفع پیام Your installation is corrupt
if [ -f "$PRODUCT_JSON" ]; then
    echo -e "${BLUE}در حال به‌روزرسانی چک‌سام در product.json...${NC}"
    NEW_HASH=$(sha256sum "$WB_HTML" | awk '{print $1}' | xxd -r -p | base64 | tr -d '=')
    node -e "
    const fs = require('fs');
    try {
        const prod = JSON.parse(fs.readFileSync('$PRODUCT_JSON', 'utf8'));
        if (prod.checksums && prod.checksums['vs/code/electron-sandbox/workbench/workbench.html']) {
            prod.checksums['vs/code/electron-sandbox/workbench/workbench.html'] = '$NEW_HASH';
            fs.writeFileSync('$PRODUCT_JSON', JSON.stringify(prod, null, 2), 'utf8');
            console.log('چک‌سام workbench.html در Cursor با موفقیت به‌روز شد.');
        }
    } catch (e) {
        console.error('خطا در به‌روزرسانی چک‌سام:', e.message);
    }
    " 2>/dev/null || true
fi

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}✓ عملیات با موفقیت انجام شد!${NC}"
echo -e "${GREEN}  راست‌چین خودکار و فونت وزیرمتن در چت و Composer فعال شد.${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "جهت مشاهده تغییرات، نرم‌افزار Cursor را یک بار ببندید و مجدداً باز کنید."
