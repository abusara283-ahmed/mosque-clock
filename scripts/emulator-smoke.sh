#!/usr/bin/env bash
# فحص فعلي على محاكي أندرويد: تثبيت APK وفتحه، ثم التحقق من الصفحة المحمّلة داخل WebView.
# يكتب لقطات الشاشة والسجلات في emu/ ويفشل إن ظهرت صفحة الخطأ.
set -u
APK="$1"; OUT=emu; mkdir -p $OUT
PKG=om.mosque.clock
adb install -r -g "$APK" || exit 1
adb logcat -c
adb shell am start -W -n $PKG/.MainActivity
pages() {
  PID=$(adb shell pidof $PKG | tr -d '\r')
  adb forward --remove-all >/dev/null 2>&1
  adb forward tcp:9222 localabstract:webview_devtools_remote_$PID >/dev/null 2>&1
  curl -s --max-time 5 http://127.0.0.1:9222/json || echo "[]"
}
shot() { adb exec-out screencap -p > $OUT/$1.png; echo "== $1: $(pages | tr -d '\n' | grep -o '"url": *"[^"]*"' | head -3)"; }
sleep 8;  shot 1-start
sleep 25; shot 2-after-auto-mode
URL2=$(pages | grep -o '"url": *"[^"]*"' | head -1)
# وضع الشاشة: نختاره عبر الجسر بعد إعادة الفتح بـ ?choose=1 غير متاح من adb، فنمسح البيانات ونختار الشاشة بلمسة على الزر الأول
adb shell am force-stop $PKG; adb shell pm clear $PKG >/dev/null
adb shell am start -W -n $PKG/.MainActivity; sleep 6
adb shell input keyevent KEYCODE_DPAD_UP; adb shell input keyevent KEYCODE_DPAD_UP; adb shell input keyevent KEYCODE_DPAD_UP
shot 3-chooser-focus
adb shell input keyevent KEYCODE_ENTER; sleep 10; shot 4-after-enter
URL4=$(pages | grep -o '"url": *"[^"]*"' | head -1)
adb logcat -d > $OUT/logcat.txt
echo "----- logcat (app) -----"
grep -E "Capacitor|MosqueClock|chromium|Console|AndroidRuntime|FATAL" $OUT/logcat.txt | tail -150
echo "phone-auto: $URL2"; echo "after-enter: $URL4"
FAIL=0
echo "$URL2$URL4" | grep -q "error.html" && FAIL=1
[ -z "$URL2" ] && FAIL=1
grep -q "main-frame load failed" $OUT/logcat.txt && FAIL=1
grep -q "FATAL EXCEPTION" $OUT/logcat.txt && FAIL=1
echo "SMOKE_RESULT=$FAIL"
exit $FAIL
