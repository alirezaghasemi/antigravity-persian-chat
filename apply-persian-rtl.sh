#!/usr/bin/env bash
# ==============================================================================
# اسکریپت فعال‌سازی راست‌چین خودکار و فونت وزیرمتن برای Antigravity IDE
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="/opt/antigravity-ide/resources/app"
WORKBENCH_DIR="$APP_PATH/out/vs/code/electron-browser/workbench"

WB_HTML="$WORKBENCH_DIR/workbench.html"
JK_HTML="$WORKBENCH_DIR/workbench-jetski-agent.html"
PRODUCT_JSON="$APP_PATH/product.json"

CSS_SRC="$SCRIPT_DIR/styles.css"
JS_SRC="$SCRIPT_DIR/src/persian-chat.js"

CSS_DEST="$WORKBENCH_DIR/persian-chat.css"
JS_DEST="$WORKBENCH_DIR/persian-chat.js"

TAG_START="<!-- antigravity-persian-chat-start -->"
TAG_END="<!-- antigravity-persian-chat-end -->"

INJECTION="\n${TAG_START}\n<link rel=\"stylesheet\" href=\"./persian-chat.css\">\n<script src=\"./persian-chat.js\" type=\"module\"></script>\n${TAG_END}\n"

# رنگ‌ها برای خروجی زیبا
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}    فعال‌سازی راست‌چین و فونت وزیرمتن در Antigravity IDE   ${NC}"
echo -e "${BLUE}====================================================${NC}"

# بررسی پارامتر بازگردانی (Restore / Uninstall)
if [ "$1" == "--restore" ] || [ "$1" == "-r" ] || [ "$1" == "uninstall" ]; then
    echo -e "${YELLOW}در حال بازگردانی فایل‌های اصلی...${NC}"

    if [ ! -w "$WORKBENCH_DIR" ] || ([ -f "$PRODUCT_JSON" ] && [ ! -w "$PRODUCT_JSON" ]); then
        echo -e "${YELLOW}نیاز به دسترسی روت جهت بازگردانی فایل‌ها:${NC}"
        sudo sed -i "/$TAG_START/,/$TAG_END/d" "$WB_HTML"
        sudo sed -i "/$TAG_START/,/$TAG_END/d" "$JK_HTML"
        sudo rm -f "$CSS_DEST" "$JS_DEST"
        if [ -f "$PRODUCT_JSON.bak" ]; then
            sudo cp -f "$PRODUCT_JSON.bak" "$PRODUCT_JSON"
        fi
    else
        sed -i "/$TAG_START/,/$TAG_END/d" "$WB_HTML"
        sed -i "/$TAG_START/,/$TAG_END/d" "$JK_HTML"
        rm -f "$CSS_DEST" "$JS_DEST"
        if [ -f "$PRODUCT_JSON.bak" ]; then
            cp -f "$PRODUCT_JSON.bak" "$PRODUCT_JSON"
        fi
    fi

    echo -e "${GREEN}✓ پچ با موفقیت حذف شد و فایل‌های اصلی بازگردانی شدند.${NC}"
    echo -e "جهت اعمال، محیط Antigravity IDE را یک بار ببندید و دوباره باز کنید."
    exit 0
fi

# بررسی وجود مسیر Antigravity IDE
if [ ! -d "$WORKBENCH_DIR" ]; then
    echo -e "${RED}خطا: مسیر Antigravity IDE یافت نشد: $WORKBENCH_DIR${NC}"
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

# ۲. اطمینان از دسترسی نوشتن
CURRENT_USER="${SUDO_USER:-$USER}"

if [ ! -w "$WORKBENCH_DIR" ] || [ ! -w "$WB_HTML" ] || ([ -f "$PRODUCT_JSON" ] && [ ! -w "$PRODUCT_JSON" ]); then
    echo -e "${YELLOW}نیاز به دسترسی نوشتن به پوشه Antigravity IDE...${NC}"
    echo -e "لطفاً در صورت درخواست، رمز عبور سیستم (sudo) را وارد کنید:"
    sudo chown -R "$CURRENT_USER:$CURRENT_USER" /opt/antigravity-ide
fi

# ۳. تهیه نسخه پشتیبان
if [ ! -f "$WB_HTML.bak" ]; then
    cp "$WB_HTML" "$WB_HTML.bak"
fi
if [ ! -f "$JK_HTML.bak" ]; then
    cp "$JK_HTML" "$JK_HTML.bak"
fi
if [ -f "$PRODUCT_JSON" ] && [ ! -f "$PRODUCT_JSON.bak" ]; then
    cp "$PRODUCT_JSON" "$PRODUCT_JSON.bak"
fi

# ۴. کپی فایل‌های CSS و JS
cp -f "$CSS_SRC" "$CSS_DEST"
cp -f "$JS_SRC" "$JS_DEST"

# ۵. پچ کردن workbench.html
if ! grep -q "$TAG_START" "$WB_HTML"; then
    # قرار دادن تگ‌ها قبل از </html>
    sed -i "s|</html>|${INJECTION}</html>|" "$WB_HTML"
fi

# ۶. پچ کردن workbench-jetski-agent.html
if ! grep -q "$TAG_START" "$JK_HTML"; then
    sed -i "s|</html>|${INJECTION}</html>|" "$JK_HTML"
fi

# ۷. به‌روزرسانی چک‌سام‌ها در product.json (جهت رفع خطای Corrupt / Unsupported)
if [ -f "$PRODUCT_JSON" ]; then
    echo -e "${BLUE}در حال به‌روزرسانی چک‌سام‌ها در product.json...${NC}"
    python3 - <<EOF
import hashlib, base64, re, sys

def calc_hash(filepath):
    with open(filepath, "rb") as f:
        return base64.b64encode(hashlib.sha256(f.read()).digest()).decode("utf-8").rstrip("=")

product_path = "$PRODUCT_JSON"
updates = {
    "vs/code/electron-browser/workbench/workbench.html": "$WB_HTML",
    "vs/code/electron-browser/workbench/workbench-jetski-agent.html": "$JK_HTML"
}

try:
    with open(product_path, "r", encoding="utf-8") as f:
        content = f.read()

    for key, file_path in updates.items():
        new_hash = calc_hash(file_path)
        pattern = r'("' + re.escape(key) + r'"\s*:\s*")[^"]+(")'
        content = re.sub(pattern, r'\g<1>' + new_hash + r'\2', content)

    with open(product_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("✓ چک‌سام‌های جدید با موفقیت در product.json ثبت شدند.")
except Exception as e:
    print(f"هشدار: خطای به‌روزرسانی چک‌سام در product.json: {e}", file=sys.stderr)
EOF
fi

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}✓ تنظیمات راست‌چین، فونت وزیرمتن و چک‌سام‌ها با موفقیت اعمال شد!${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "حالا برای مشاهده نتیجه، در Antigravity IDE کلید ${YELLOW}Ctrl+Shift+P${NC} را بزنید"
echo -e "و گزینه ${YELLOW}> Developer: Reload Window${NC} را انتخاب نمایید (یا IDE را ریستارت کنید)."
echo -e ""
echo -e "برای بازگردانی به حالت اولیه در هر زمان:"
echo -e "  bash $(basename "$0") --restore"

