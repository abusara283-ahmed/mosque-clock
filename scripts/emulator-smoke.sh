#!/usr/bin/env bash
# فحص فعلي على محاكي أندرويد: تثبيت APK وفتحه، ثم التحقق من الصفحة المحمّلة داخل WebView.
# يكتب لقطات الشاشة والسجلات في emu/ ويفشل إن ظهرت صفحة الخطأ.
set -u
APK="$1"; OUT=emu; mkdir -p $OUT
PKG=om.mosque.clock
A() { timeout 30 adb "$@"; }
A install -r -g "$APK" || exit 1
A logcat -c
(timeout 300 adb logcat -v time > $OUT/logcat.txt 2>&1 &)
pages() {
  PID=$(A shell pidof $PKG | tr -d '\r')
  A forward --remove-all >/dev/null 2>&1
  A forward tcp:9222 localabstract:webview_devtools_remote_$PID >/dev/null 2>&1
  curl -s --max-time 5 http://127.0.0.1:9222/json | tr -d '\n' | grep -o '"url": *"[^"]*"' | head -1
}
shot() { A exec-out screencap -p > $OUT/$1.png; P=$(pages); echo "== $1: $P"; echo "$1 $P" >> $OUT/pages.txt; }

# 1) أول تشغيل: صفحة اختيار الوضع، ثم بعد ١٥ ثانية يفتح الوضع المقترح (جوال)
A shell am start -W -n $PKG/.MainActivity
sleep 8;  shot 1-start
sleep 25; shot 2-phone-auto
# 2) وضع الشاشة: من البداية، نختار الزر الأول (شاشة المسجد) بأسهم الريموت
A shell am force-stop $PKG; A shell pm clear $PKG >/dev/null
A shell am start -W -n $PKG/.MainActivity; sleep 6
for i in 1 2 3; do A shell input keyevent KEYCODE_DPAD_UP; done
shot 3-chooser
A shell input keyevent KEYCODE_ENTER; sleep 15; shot 4-screen-mode
sleep 20; shot 5-screen-mode-later
sleep 2
echo "----- logcat (app) -----"
grep -E "Capacitor|MosqueClock|chromium|Console|AndroidRuntime|FATAL|lowmemorykiller|ActivityManager: (Kill|Process)" $OUT/logcat.txt | grep -v "Registering plugin" | tail -120
FAIL=0
grep -q "1-start .*start.html" $OUT/pages.txt || FAIL=1
grep -q "2-phone-auto .*m.html" $OUT/pages.txt || FAIL=1
grep -q "error.html" $OUT/pages.txt && FAIL=1
grep -q "main-frame load failed" $OUT/logcat.txt && FAIL=1
grep -q "FATAL EXCEPTION" $OUT/logcat.txt && FAIL=1
grep -q "4-screen-mode .*index.html" $OUT/pages.txt || echo "::warning::screen mode page not confirmed (see emu/)"
cat $OUT/pages.txt
echo "SMOKE_RESULT=$FAIL"
exit $FAIL
