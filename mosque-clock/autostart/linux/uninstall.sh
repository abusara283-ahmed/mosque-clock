#!/usr/bin/env bash
# ساعة المسجد — إزالة التشغيل التلقائي (الإصدار ٨)
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF="${XDG_CONFIG_HOME:-$HOME/.config}"
QUIET=0; [ "${1:-}" = "--quiet" ] && QUIET=1
bash "$HERE/stop.sh" >/dev/null 2>&1
rm -f "$CONF/autostart/mosque-clock.desktop"
[ -f "$CONF/labwc/autostart" ] && sed -i "\#$HERE/kiosk.sh#d" "$CONF/labwc/autostart"
[ -f "$CONF/wayfire.ini" ] && sed -i '/^mosque_clock = /d' "$CONF/wayfire.ini"
systemctl --user disable --now mosque-clock-server >/dev/null 2>&1
rm -f "$CONF/systemd/user/mosque-clock-server.service"
if [ -f /etc/systemd/system/mosque-clock-server.service ]; then
  if [ "$(id -u)" = 0 ]; then S=""; elif sudo -n true 2>/dev/null || [ "$QUIET" = 0 ]; then S=sudo; else S=skip; fi
  if [ "$S" != skip ]; then $S systemctl disable --now mosque-clock-server >/dev/null 2>&1; $S rm -f /etc/systemd/system/mosque-clock-server.service; $S systemctl daemon-reload; fi
fi
[ "$QUIET" = 1 ] || echo "أُزيل التشغيل التلقائي لساعة المسجد."
