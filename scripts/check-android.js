#!/usr/bin/env node
/*
 * فحوص تطبيق أندرويد (الإصدار ٩) بلا Android SDK: الأذونات، الأوضاع، التوقيع، الجسر بين الصفحات والكود الأصلي،
 * ومنطق تنبيهات الثلاثين يوماً. وإن وُجد android.jar تُترجم ملفات Java فعلياً بـ javac.
 * الاستخدام: node scripts/check-android.js     (ANDROID_JAR=/path/android.jar لتفعيل الترجمة)
 */
var fs = require("fs"), path = require("path"), cp = require("child_process"), vm = require("vm");
var R = path.join(__dirname, ".."), A = path.join(R, "android"), W = path.join(R, "mosque-clock");
var pass = 0, fail = 0, notes = [];
function ok(c, m) { if (c) pass++; else { fail++; console.log("  ✗ " + m); } }
function read(p) { return fs.readFileSync(path.join(R, p), "utf8"); }
function exists(p) { return fs.existsSync(path.join(R, p)); }

console.log("فحوص تطبيق أندرويد");
var man = read("android/app/src/main/AndroidManifest.xml");
["INTERNET", "RECEIVE_BOOT_COMPLETED", "SYSTEM_ALERT_WINDOW", "WAKE_LOCK", "POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM", "REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"].forEach(function (p) {
  ok(man.indexOf("android.permission." + p) >= 0, "إذن " + p);
});
ok(man.indexOf("USE_EXACT_ALARM") < 0, "لا يُستخدم USE_EXACT_ALARM (مقيّد في متجر Play للمنبّهات والتقويم فقط)");
ok(/android.software.leanback" android:required="false"/.test(man) && /android.hardware.touchscreen" android:required="false"/.test(man), "التلفاز: leanback وشاشة اللمس غير إلزاميين");
ok(/LEANBACK_LAUNCHER/.test(man) && /android:banner="@drawable\/banner"/.test(man) && exists("android/app/src/main/res/drawable/banner.png"), "التلفاز: يظهر في قائمة Android TV مع بطاقة");
ok(/HomeAlias"[\s\S]*?android:enabled="false"[\s\S]*?category.HOME/.test(man), "الشاشة الرئيسية اختيارية ومعطّلة افتراضياً");
ok(/BootReceiver[\s\S]*?BOOT_COMPLETED[\s\S]*?MY_PACKAGE_REPLACED[\s\S]*?TIME_SET[\s\S]*?TIMEZONE_CHANGED/.test(man), "الإقلاع والتحديث وتغيير الوقت والمنطقة");
ok(/AlarmReceiver[\s\S]*?SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED/.test(man), "إعادة الضبط عند منح إذن المنبّهات الدقيقة");
ok(/AdminReceiver[\s\S]*?BIND_DEVICE_ADMIN/.test(man) && exists("android/app/src/main/res/xml/device_admin.xml"), "وضع مالك الجهاز (kiosk كامل) اختياري");
ok(/lockTaskMode="if_whitelisted"/.test(man) && /launchMode="singleTask"/.test(man), "تثبيت الشاشة ونسخة واحدة من الشاشة");
ok(/android:name=".ClockApp"/.test(man), "تطبيق بمعالج أعطال (إعادة الفتح الذاتي)");
ok(/networkSecurityConfig/.test(man) && /cleartextTrafficPermitted="true"/.test(read("android/app/src/main/res/xml/network_security_config.xml")), "يسمح بخادم المسجد المحلي http");
var play = read("android/app/src/play/AndroidManifest.xml");
ok(/REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" tools:node="remove"/.test(play), "نسخة المتجر تحذف إذن استثناء البطارية");

var vars = read("android/variables.gradle"), bg = read("android/app/build.gradle");
ok(/minSdkVersion = 24/.test(vars), "أقل إصدار: أندرويد 7.0 (API 24)");
ok(/targetSdkVersion = 3[5-9]/.test(vars) && /compileSdkVersion = 3[5-9]/.test(vars), "الهدف API 35 فأحدث (شرط Google Play)");
ok(/productFlavors[\s\S]*direct[\s\S]*play/.test(bg), "نسختان: direct (APK للمساجد) و play (AAB للمتجر)");
ok(/MC_KEYSTORE_PATH/.test(bg) && /MC_KEYSTORE_PASSWORD/.test(bg) && /MC_KEY_ALIAS/.test(bg) && /MC_KEY_PASSWORD/.test(bg), "التوقيع من متغيرات البيئة");
ok(!/storePassword\s+["'][^"']+["']/.test(bg) && !/keyPassword\s+["'][^"']+["']/.test(bg), "لا كلمات مرور مكتوبة في الكود");
ok(/enableV1Signing true/.test(bg) && /enableV2Signing true/.test(bg), "توقيع v1 وv2 (أندرويد 7)");
ok(/buildConfig = true/.test(bg), "BuildConfig مفعّل (اسم النسخة)");
var gi = read(".gitignore") + read("android/.gitignore");
ok(/\*\.jks/.test(gi) && /keystore\.properties/.test(gi), "ملفات المفاتيح مستبعدة من المستودع");
function walk(d, out) { fs.readdirSync(d).forEach(function (f) { var p = path.join(d, f); if (f === "node_modules" || f === ".git" || f === "build") return; if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p); }); return out; }
ok(walk(R, []).filter(function (p) { return /\.(jks|keystore)$/.test(p); }).length === 0, "لا يوجد ملف مفتاح داخل المشروع");
var wf = read(".github/workflows/android.yml");
["MC_KEYSTORE_BASE64", "MC_KEYSTORE_PASSWORD", "MC_KEY_ALIAS", "MC_KEY_PASSWORD"].forEach(function (s) { ok(wf.indexOf("secrets." + s) >= 0, "سرّ GitHub: " + s); });
ok(/assembleDirectRelease/.test(wf) && /bundlePlayRelease/.test(wf) && /apksigner verify/.test(wf), "البناء الآلي: APK موقّع + AAB + التحقق من التوقيع");
ok(/java-version: 21/.test(wf) && /tests\/run\.js/.test(wf), "البناء الآلي: Java 21 ويشغّل الاختبارات أولاً");

var cap = JSON.parse(read("capacitor.config.json"));
ok(cap.appId === "om.mosque.clock" && cap.webDir === "www", "معرّف التطبيق ومجلد الصفحات");
ok(cap.server.appStartPath === "/start.html" /* Capacitor يلصق المسار بـ https://localhost مباشرة */ && cap.server.errorPath === "error.html" && exists("mosque-clock/start.html") && exists("mosque-clock/error.html"), "صفحة البداية (اختيار الوضع) وصفحة الخطأ");
ok(cap.android.minWebViewVersion >= 80, "تنبيه واضح إن كان محرّك WebView قديماً");

// ——— الجسر: كل ما تستدعيه الصفحات موجود في ClockBridge ومعلَّم @JavascriptInterface ———
var jdir = "android/app/src/main/java/om/mosque/clock/";
var bridge = read(jdir + "ClockBridge.java"), exposed = {};
var re = /@JavascriptInterface\s+public\s+[\w<>]+\s+(\w+)\s*\(/g, m;
while ((m = re.exec(bridge))) exposed[m[1]] = 1;
var callers = { "js/autostart-ui.js": /\bA\.(\w+)\s*\(/g, "js/mobile.js": /\bAN\.(\w+)\s*\(/g, "start.html": /\bA\.(\w+)\s*\(/g, "error.html": /\bA\.(\w+)\s*\(/g, "js/android-app.js": /\bA\.(\w+)\s*\(/g };
var used = {};
Object.keys(callers).forEach(function (f) {
  var src = fs.readFileSync(path.join(W, f), "utf8"), r = callers[f], x;
  while ((x = r.exec(src))) used[x[1]] = f;
});
Object.keys(used).forEach(function (fn) { ok(exposed[fn], "الجسر: " + fn + "() المستدعاة في " + used[fn] + " موجودة في ClockBridge"); });
ok(Object.keys(used).length >= 18, "الجسر مستعمل فعلاً (" + Object.keys(used).length + " دالة)");
var main = read(jdir + "MainActivity.java"), plug = read(jdir + "ClockPlugin.java"), alarms = read(jdir + "PrayerAlarms.java");
ok(/addJavascriptInterface\(new ClockBridge/.test(plug) && /registerPlugin\(ClockPlugin\.class\)/.test(main), "الجسر يُضاف قبل تحميل أول صفحة");
ok(/OnBackPressedCallback/.test(main), "زر الرجوع عبر OnBackPressedDispatcher (أندرويد ١٦ والرجوع التنبّئي)");
ok(/KEYCODE_MENU/.test(main) && /ClockRemote/.test(main), "زر القائمة في الريموت");
ok(/setExactAndAllowWhileIdle/.test(alarms) && /setAlarmClock/.test(alarms) && /canScheduleExactAlarms/.test(alarms) && /setAndAllowWhileIdle/.test(alarms), "منبّه دقيق مع بديل غير دقيق إن لم يُمنح الإذن");
ok(/createNotificationChannel/.test(alarms) && /POST_NOTIFICATIONS/.test(alarms), "قنوات الإشعارات وإذن أندرويد ١٣");
["notify_adhan", "notify_soon", "notify_iqama"].forEach(function (n) { ok(exists("android/app/src/main/res/raw/" + n + ".mp3"), "صوت " + n); });
ok(/Build\.VERSION\.SDK_INT >= 31/.test(alarms) || /SDK_INT < 31/.test(alarms), "فحص إصدار النظام قبل واجهات أندرويد ١٢");

// ——— منطق تنبيهات الثلاثين يوماً (نفس الكود الذي يسلّم المواعيد للتطبيق) ———
var ctx = { console: console, Intl: Intl, Date: Date, Math: Math, JSON: JSON };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
["js/settings-defaults.js", "js/config.js", "data/prayer-table.js", "js/prayertimes.js", "js/seasons.js", "js/schedule.js", "js/events.js", "js/quran.js", "js/mobile-core.js"].forEach(function (f) {
  try { vm.runInContext(fs.readFileSync(path.join(W, f), "utf8"), ctx, { filename: f }); } catch (e) { notes.push("تعذّر تحميل " + f + ": " + e.message); }
});
var C = ctx.MobileCore;
if (C && ctx.CLOCK_DEFAULTS) {
  var S = ctx.ClockConfig.merge(ctx.CLOCK_DEFAULTS, {}), M = ctx.ClockConfig.merge(C.DEFAULTS, { notify: true, notifyBefore: 10, notifyAdhan: true, notifyIqama: true });
  var from = new Date(2026, 10, 21, 0, 0), list = C.alerts(from, S, M, 30);
  var payload = list.map(function (a) { return { id: a.id, at: a.at.getTime(), kind: a.kind, title: a.title, body: a.body }; });
  ok(payload.length >= 30 * 5 * 2 && payload.length <= 30 * 5 * 3, "٣٠ يوماً من التنبيهات: " + payload.length);
  ok(payload.every(function (a, i) { return i === 0 || a.at >= payload[i - 1].at; }), "المواعيد مرتبة زمنياً");
  var ids = {}; payload.forEach(function (a) { ids[a.id] = 1; });
  ok(Object.keys(ids).length === payload.length, "معرّفات فريدة");
  ok(payload.every(function (a) { return /^(pre|adhan|iqama)$/.test(a.kind) && a.title && isFinite(a.at); }), "كل موعد له نوع وعنوان ووقت");
  ok(JSON.stringify(payload).length < 200000, "حجم القائمة مناسب للتخزين (" + Math.round(JSON.stringify(payload).length / 1024) + " ك.ب)");
  var fri = payload.filter(function (a) { return a.kind === "adhan" && new Date(a.at).getDay() === 5 && /الجمعة/.test(a.title); });
  ok(fri.length >= 4, "الجمعة تظهر باسمها في التنبيهات (" + fri.length + ")");
} else notes.push("لم تُحمَّل ملفات المواقيت لفحص التنبيهات");

// ——— ترجمة Java فعلياً ———
var jar = process.env.ANDROID_JAR || ["/root/asdk/platforms/android-36/android.jar", path.join(process.env.ANDROID_HOME || "/none", "platforms/android-36/android.jar")].filter(fs.existsSync)[0];
if (jar && fs.existsSync(jar)) {
  var out = path.join(require("os").tmpdir(), "mc9-javac");
  fs.rmSync(out, { recursive: true, force: true });
  var stubs = walk(path.join(R, "scripts/javac-stubs"), []).filter(function (f) { return /\.java$/.test(f); });
  var srcs = fs.readdirSync(path.join(R, jdir)).map(function (f) { return path.join(R, jdir, f); });
  var jc = cp.spawnSync("javac", ["-encoding", "UTF-8", "--release", "17", "-Xlint:-options", "-nowarn", "-cp", jar, "-d", out].concat(stubs, srcs), { encoding: "utf8" });
  ok(jc.status === 0, "ترجمة كود أندرويد مقابل " + path.basename(path.dirname(jar)) + (jc.status ? " " + jc.stderr.slice(-600) : ""));
} else notes.push("لم تُترجم ملفات Java (ضع ANDROID_JAR لمسار android.jar)");

if (notes.length) console.log(notes.join("\n"));
console.log("النتيجة: " + pass + " ناجح، " + fail + " فاشل");
process.exit(fail ? 1 : 0);
