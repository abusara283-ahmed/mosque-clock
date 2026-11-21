#!/usr/bin/env bash
# ساعة المسجد — فتح الساعة بوضع العرض (kiosk) وإعادتها إن أُغلقت (الإصدار ٨)
# يُشغَّل تلقائياً عند دخول سطح المكتب (ثبّته بـ install.sh). للإيقاف: stop.sh
set -u
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/mosque-clock"
LOG="$DATA/kiosk.log"; STOP="$DATA/stop.flag"; PROFILE="$DATA/browser-profile"
PORT="${CLOCK_PORT:-8080}"
FRONT_IDLE="${CLOCK_FRONT_IDLE:-120}"   # ثوانٍ بلا لمس قبل إعادة الساعة للأمام (X11 مع xdotool)
mkdir -p "$DATA"

# نسخة واحدة فقط (قد يُستدعى من XDG وlabwc معاً)
exec 9>"$DATA/kiosk.lock"
if command -v flock >/dev/null 2>&1; then flock -n 9 || exit 0; fi
rm -f "$STOP"
log() { [ -f "$LOG" ] && [ "$(wc -c < "$LOG")" -gt 1048576 ] && mv -f "$LOG" "$LOG.old"; printf '%s  %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }
port_open() { (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; }

log "kiosk start (root: $ROOT)"
sleep "${CLOCK_START_DELAY:-5}"   # مهلة لاكتمال سطح المكتب والشبكة

# منع إطفاء الشاشة وإخفاء المؤشر (X11). في Wayland يتكفّل raspi-config والساعة نفسها بإخفاء المؤشر.
if [ -n "${DISPLAY:-}" ] && command -v xset >/dev/null 2>&1; then xset s off; xset -dpms; xset s noblank; fi 2>/dev/null
if [ -n "${DISPLAY:-}" ] && command -v unclutter >/dev/null 2>&1; then pgrep -x unclutter >/dev/null || unclutter -idle 3 -root >/dev/null 2>&1 & fi

# الخادم: خدمة systemd عادةً، وإلا نشغّله هنا
URL="file://$(printf '%s' "$ROOT/index.html" | sed 's/ /%20/g')?kiosk=1"
if command -v node >/dev/null 2>&1; then
  if ! port_open; then
    systemctl --user start mosque-clock-server >/dev/null 2>&1 || true
    sleep 2
    if ! port_open; then
      PIN=""; [ -f "$DATA/pin.txt" ] && PIN="$(tr -d '\r\n' < "$DATA/pin.txt")"
      ( cd "$ROOT" && PORT="$PORT" CLOCK_PIN="${PIN:-${CLOCK_PIN:-1234}}" exec nohup node "$ROOT/server.js" >> "$DATA/server.log" 2>&1 ) &
      log "started server.js"
    fi
  fi
  for _ in $(seq 1 40); do port_open && break; sleep 0.5; done
  port_open && URL="http://localhost:$PORT/index.html?kiosk=1"
fi

pick_browser() {
  for b in chromium-browser chromium google-chrome-stable google-chrome microsoft-edge firefox; do
    command -v "$b" >/dev/null 2>&1 && { printf '%s' "$b"; return 0; }
  done
  return 1
}
BROWSER="$(pick_browser)" || { log "no browser found"; exit 1; }
log "browser: $BROWSER  url: $URL"

# إعادة الساعة للأمام إن تُرك برنامج آخر فوقها (X11 فقط، يحتاج xdotool وxprintidle)
front_watch() {
  command -v xdotool >/dev/null 2>&1 && command -v xprintidle >/dev/null 2>&1 && [ -n "${DISPLAY:-}" ] || return 0
  while [ ! -f "$STOP" ]; do
    sleep 30
    idle=$(( $(xprintidle 2>/dev/null || echo 0) / 1000 ))
    if [ "$idle" -ge "$FRONT_IDLE" ]; then
      w=$(xdotool search --classname "${BROWSER##*/}" 2>/dev/null | tail -1)
      [ -n "$w" ] && [ "$(xdotool getactivewindow 2>/dev/null)" != "$w" ] && xdotool windowactivate "$w" 2>/dev/null && log "brought to front"
    fi
  done
}
front_watch &

fails=0
while [ ! -f "$STOP" ]; do
  # بعد انقطاع الكهرباء يظن المتصفح أنه انهار فيعرض «استعادة الصفحات»
  P="$PROFILE/Default/Preferences"
  [ -f "$P" ] && sed -i 's/"exited_cleanly":false/"exited_cleanly":true/; s/"exit_type":"Crashed"/"exit_type":"Normal"/' "$P" 2>/dev/null
  start=$(date +%s)
  case "$BROWSER" in
    firefox) mkdir -p "$PROFILE-ff"; firefox --kiosk --profile "$PROFILE-ff" "$URL" >/dev/null 2>&1 ;;
    *) "$BROWSER" --kiosk "$URL" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --noerrdialogs \
         --disable-session-crashed-bubble --disable-infobars --autoplay-policy=no-user-gesture-required \
         --disable-features=Translate,TranslateUI --overscroll-history-navigation=0 --disable-pinch \
         --check-for-update-interval=31536000 --password-store=basic --ozone-platform-hint=auto \
         --disable-background-timer-throttling --disable-renderer-backgrounding >/dev/null 2>&1 ;;
  esac
  [ -f "$STOP" ] && break
  if [ $(( $(date +%s) - start )) -lt 30 ]; then fails=$((fails + 1)); else fails=0; fi
  wait_s=$(( fails < 1 ? 5 : (fails * 5 > 60 ? 60 : fails * 5) ))
  log "browser closed: reopening in ${wait_s}s"
  sleep "$wait_s"
done
log "kiosk stopped"
