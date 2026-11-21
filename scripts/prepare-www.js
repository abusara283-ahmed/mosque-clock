#!/usr/bin/env node
/*
 * ينسخ ملفات الساعة (mosque-clock/) إلى www/ التي يضمّها Capacitor داخل التطبيق.
 * يستثني ما لا يلزم على الجهاز: سكربتات التشغيل التلقائي للحاسوب، الاختبارات، الأدوات، الخادم، الملف الواحد للجوال.
 * الاستخدام: node scripts/prepare-www.js   (ثم: npx cap sync android)
 */
var fs = require("fs"), path = require("path");
var SRC = path.join(__dirname, "..", "mosque-clock"), OUT = path.join(__dirname, "..", "www");
var SKIP_DIRS = ["autostart", "tests", "tools", "android", ".github", "node_modules"];
var SKIP_FILES = [/\.md$/i, /\.zip$/i, /^server\.js$/, /^mawaqit-phone\.html$/, /^sw\.js$/, /(^|\/)data\/settings\.json$/, /(^|\/)data\/announcements\.json$/, /\.py$/];

function rm(p) { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); }
var count = 0, bytes = 0;
function copy(rel) {
  var s = path.join(SRC, rel), st = fs.statSync(s);
  if (st.isDirectory()) {
    if (SKIP_DIRS.indexOf(rel) >= 0) return;
    fs.mkdirSync(path.join(OUT, rel), { recursive: true });
    fs.readdirSync(s).forEach(function (f) { copy(rel ? rel + "/" + f : f); });
    return;
  }
  if (SKIP_FILES.some(function (re) { return re.test(rel) || re.test(path.basename(rel)); })) return;
  fs.copyFileSync(s, path.join(OUT, rel));
  count++; bytes += st.size;
}
rm(OUT);
fs.mkdirSync(OUT, { recursive: true });
copy("");
// عامل خدمة فارغ: داخل التطبيق لا حاجة له، والصفحات لا تسجّله أصلاً (حماية من نسخ قديمة)
fs.writeFileSync(path.join(OUT, "sw.js"), "self.addEventListener('install',function(){self.skipWaiting()});self.addEventListener('activate',function(e){e.waitUntil(self.registration.unregister())});\n");
["index.html", "m.html", "start.html", "error.html", "settings.html", "js/android-app.js", "fonts/kufi-arabic.woff2", "data/quran/quran.js"].forEach(function (f) {
  if (!fs.existsSync(path.join(OUT, f))) { console.error("ناقص: " + f); process.exit(1); }
});
console.log("www جاهز: " + count + " ملفاً، " + (bytes / 1048576).toFixed(1) + " م.ب");
