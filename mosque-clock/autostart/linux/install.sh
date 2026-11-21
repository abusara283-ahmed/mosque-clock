#!/usr/bin/env bash
# ساعة المسجد — التشغيل التلقائي على Raspberry Pi ولينكس (الإصدار ٨)
# Mosque Clock — Linux / Raspberry Pi autostart installer (v8)
#
#   bash autostart/linux/install.sh            تثبيت + تشغيل الآن
#   bash autostart/linux/install.sh --deps     يثبّت أيضاً Chromium وNode.js وunclutter عبر apt إن نقصت
#   bash autostart/linux/install.sh --status   حالة التثبيت بصيغة JSON (لصفحة الإعدادات)
#   خيارات أخرى: --quiet  --no-start  --no-sudo
#
# ما يفعله:
#   ١. خدمة systemd تشغّل server.js دائماً وتعيده إن توقف (إن وُجد Node.js).
#   ٢. تشغيل الساعة عند دخول سطح المكتب: ملف XDG autostart، ومعه labwc وwayfire (Raspberry Pi OS).
#   ٣. على Raspberry Pi: الدخول التلقائي لسطح المكتب وإيقاف إطفاء الشاشة (raspi-config).
#   ٤. kiosk.sh يفتح Chromium بوضع العرض، ويعيده إن أُغلق، ويخفي المؤشر، ويمنع إطفاء الشاشة.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/mosque-clock"
CONF="${XDG_CONFIG_HOME:-$HOME/.config}"
DESKTOP_FILE="$CONF/autostart/mosque-clock.desktop"
KIOSK="$HERE/kiosk.sh"
SERVICE=mosque-clock-server
QUIET=0; NOSTART=0; NOSUDO=0; DEPS=0; STATUS=0
for a in "$@"; do
  case "$a" in
    --quiet) QUIET=1 ;; --no-start) NOSTART=1 ;; --no-sudo) NOSUDO=1 ;; --deps) DEPS=1 ;; --status) STATUS=1 ;;
    -h|--help) sed -n '2,16p' "$0"; exit 0 ;;
  esac
done
say() { [ "$QUIET" = 1 ] || printf '%s\n' "$*"; }

find_browser() {
  for b in chromium-browser chromium google-chrome-stable google-chrome microsoft-edge firefox; do
    if command -v "$b" >/dev/null 2>&1; then command -v "$b"; return 0; fi
  done
  return 1
}

if [ "$STATUS" = 1 ]; then
  inst=false; [ -f "$DESKTOP_FILE" ] && inst=true
  run=false; pgrep -f "$DATA/browser-profile" >/dev/null 2>&1 && run=true
  srv=none
  if systemctl is-enabled "$SERVICE" >/dev/null 2>&1; then srv=system
  elif systemctl --user is-enabled "$SERVICE" >/dev/null 2>&1; then srv=user; fi
  br="$(find_browser || true)"
  printf '{"platform":"linux","installed":%s,"running":%s,"server":"%s","browser":"%s"}\n' "$inst" "$run" "$srv" "$(basename "${br:-}")"
  exit 0
fi

# تشغيل أمر بصلاحية المدير إن أمكن (بلا سؤال في الوضع الصامت)
as_root() {
  if [ "$(id -u)" = 0 ]; then "$@"; return $?; fi
  [ "$NOSUDO" = 1 ] && return 1
  command -v sudo >/dev/null 2>&1 || return 1
  if sudo -n true 2>/dev/null; then sudo "$@"; return $?; fi
  [ "$QUIET" = 1 ] && return 1
  sudo "$@"
}

mkdir -p "$DATA" "$CONF/autostart"
chmod +x "$KIOSK" "$HERE"/*.sh 2>/dev/null || true

# ——— ٠. المتطلبات ———
if [ "$DEPS" = 1 ] && command -v apt-get >/dev/null 2>&1; then
  need=""
  find_browser >/dev/null || need="$need chromium"
  command -v node >/dev/null 2>&1 || need="$need nodejs"
  command -v unclutter >/dev/null 2>&1 || need="$need unclutter"
  if [ -n "$need" ]; then
    say "تثبيت:$need"
    as_root apt-get update -y >/dev/null 2>&1
    # اسم الحزمة chromium-browser في إصدارات Raspberry Pi OS القديمة
    as_root apt-get install -y $need || as_root apt-get install -y ${need/chromium/chromium-browser} || true
  fi
fi
BROWSER="$(find_browser || true)"
if [ -z "$BROWSER" ]; then
  say "لم أجد متصفحاً (Chromium أو Chrome أو Firefox). ثبّته ثم أعد التشغيل:"
  say "  sudo apt install chromium      أو شغّل هذا السكربت مع --deps"
  exit 1
fi

# ——— ١. خدمة الخادم ———
NODE="$(command -v node || true)"
SRV="none"
if [ -n "$NODE" ] && command -v systemctl >/dev/null 2>&1; then
  PIN_LINE=""
  [ -f "$DATA/pin.txt" ] && PIN_LINE="Environment=CLOCK_PIN=$(tr -d '\r\n' < "$DATA/pin.txt")"
  UNIT="[Unit]
Description=Mosque Clock server (server.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=$ROOT
ExecStart=$NODE $ROOT/server.js
$PIN_LINE
Restart=always
RestartSec=3"
  if printf '%s\n%s\n\n[Install]\nWantedBy=multi-user.target\n' "$UNIT" "User=$(id -un)" | as_root tee "/etc/systemd/system/$SERVICE.service" >/dev/null 2>&1 \
     && as_root systemctl daemon-reload && as_root systemctl enable --now "$SERVICE" >/dev/null 2>&1; then
    SRV="system"
  else
    mkdir -p "$CONF/systemd/user"
    printf '%s\n\n[Install]\nWantedBy=default.target\n' "$UNIT" > "$CONF/systemd/user/$SERVICE.service"
    if systemctl --user daemon-reload 2>/dev/null && systemctl --user enable --now "$SERVICE" >/dev/null 2>&1; then
      SRV="user"
      as_root loginctl enable-linger "$(id -un)" >/dev/null 2>&1 || true
    fi
  fi
fi

# ——— ٢. التشغيل عند دخول سطح المكتب ———
cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Type=Application
Name=Mosque Clock
Name[ar]=ساعة المسجد
Comment=Mosque prayer clock in kiosk mode
Exec=bash "$KIOSK"
X-GNOME-Autostart-enabled=true
X-GNOME-Autostart-Delay=3
NoDisplay=false
Terminal=false
EOF
LINE="bash \"$KIOSK\" &"
# labwc (Raspberry Pi OS منذ ٢٠٢٤)
if command -v labwc >/dev/null 2>&1 || [ -d "$CONF/labwc" ]; then
  mkdir -p "$CONF/labwc"
  [ -f "$CONF/labwc/autostart" ] || { [ -f /etc/xdg/labwc/autostart ] && cp /etc/xdg/labwc/autostart "$CONF/labwc/autostart"; }
  touch "$CONF/labwc/autostart"
  grep -qF "$KIOSK" "$CONF/labwc/autostart" || printf '%s\n' "$LINE" >> "$CONF/labwc/autostart"
fi
# wayfire (Raspberry Pi OS Bookworm ٢٠٢٣)
if [ -f "$CONF/wayfire.ini" ]; then
  if ! grep -qF "$KIOSK" "$CONF/wayfire.ini"; then
    if grep -q '^\[autostart\]' "$CONF/wayfire.ini"; then
      sed -i "/^\[autostart\]/a mosque_clock = bash \"$KIOSK\"" "$CONF/wayfire.ini"
    else
      printf '\n[autostart]\nmosque_clock = bash "%s"\n' "$KIOSK" >> "$CONF/wayfire.ini"
    fi
  fi
fi

# ——— ٣. الدخول التلقائي وإيقاف إطفاء الشاشة ———
PI=""
if command -v raspi-config >/dev/null 2>&1; then
  PI="yes"
  as_root raspi-config nonint do_boot_behaviour B4 >/dev/null 2>&1 && say "✓ الدخول التلقائي لسطح المكتب (Raspberry Pi)"
  as_root raspi-config nonint do_blanking 1 >/dev/null 2>&1 && say "✓ إيقاف إطفاء الشاشة (Raspberry Pi)"
fi
if command -v gsettings >/dev/null 2>&1; then
  gsettings set org.gnome.desktop.session idle-delay 0 2>/dev/null || true
  gsettings set org.gnome.desktop.screensaver lock-enabled false 2>/dev/null || true
  gsettings set org.gnome.settings-daemon.plugins.power sleep-inactive-ac-type 'nothing' 2>/dev/null || true
fi

say ""
say "✓ تم تفعيل التشغيل التلقائي لساعة المسجد"
say "  المتصفح: $(basename "$BROWSER")   الخادم: $([ "$SRV" = none ] && echo 'بدون (تُفتح الساعة كملف أو يشغّله kiosk.sh)' || echo "خدمة systemd ($SRV)")"
say "  للإيقاف المؤقت: bash autostart/linux/stop.sh    للإزالة: bash autostart/linux/uninstall.sh"
[ -z "$PI" ] && say "  تأكد من تفعيل الدخول التلقائي لسطح المكتب من إعدادات النظام (Automatic login)."
say "  مهم: جهاز بلا إنترنت ولا وحدة ساعة RTC يبدأ بوقت خاطئ بعد انقطاع الكهرباء؛ أضف وحدة RTC (مثل DS3231)."

if [ "$NOSTART" = 0 ] && { [ -n "${DISPLAY:-}" ] || [ -n "${WAYLAND_DISPLAY:-}" ]; }; then
  nohup bash "$KIOSK" >/dev/null 2>&1 &
  say "  تُفتح الساعة الآن…"
fi
exit 0
