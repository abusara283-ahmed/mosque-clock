#!/usr/bin/env bash
# ساعة المسجد — إيقاف الساعة الآن (تعود عند التشغيل القادم للجهاز). للتشغيل الآن: bash kiosk.sh &
DATA="${XDG_DATA_HOME:-$HOME/.local/share}/mosque-clock"
mkdir -p "$DATA"; date > "$DATA/stop.flag"
pkill -f "$DATA/browser-profile" 2>/dev/null
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pkill -f "node $ROOT/server.js" 2>/dev/null   # الخادم الذي شغّله kiosk.sh فقط (خدمة systemd تبقى)
echo "أُوقفت الساعة. ستعمل تلقائياً عند التشغيل القادم."
