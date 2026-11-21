#!/usr/bin/env node
/*
 * يبني نسخة الجوال في ملف واحد:  node tools/build-single.js  ←  mawaqit-phone.html
 * كل شيء مضمّن (الخطوط، الأنماط، الشيفرة، المصحف، التفسير الميسر)، فيعمل الملف عند فتحه مباشرة
 * من ذاكرة الهاتف أو إرساله بالواتساب أو رفعه كما هو على أي استضافة.
 */
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..");
function read(f) { return fs.readFileSync(path.join(ROOT, f), "utf8"); }
function safe(js) { return js.replace(/<\/script/gi, "<\\/script"); }
var html = read("m.html");
// الأنماط مع الخطوط بصيغة data:
var css = read("css/mobile.css").replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, function (m, f) {
  return 'url("data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, "fonts", f)).toString("base64") + '")';
});
html = html.replace('<link rel="stylesheet" href="css/mobile.css">', function () { return "<style>\n" + css + "\n</style>"; });
// الإصدار ٩: تخطيط التابلت
html = html.replace('<link rel="stylesheet" href="css/tablet.css">', function () { return "<style>\n" + read("css/tablet.css") + "\n</style>"; });
html = html.replace(/\s*<link rel="manifest"[^>]*>/, "");
html = html.replace(/<link rel="(icon|apple-touch-icon)" href="([^"]+)"[^>]*>/g, function (m, rel, f) {
  var ext = path.extname(f).slice(1), type = ext === "svg" ? "image/svg+xml" : "image/png";
  return '<link rel="' + rel + '" href="data:' + type + ";base64," + fs.readFileSync(path.join(ROOT, f)).toString("base64") + '">';
});
// الشيفرة: المصحف والتفسير الميسر قبل quran.js
var extra = ["data/quran/quran.js", "data/tafsir/muyassar.js"];
html = html.replace(/<script src="([^"]+)"><\/script>/g, function (m, f) {
  var pre = f === "js/quran.js" ? extra.map(function (x) { return "<script>\n" + safe(read(x)) + "\n</script>\n  "; }).join("") : "";
  return pre + "<script>\n" + safe(read(f)) + "\n</script>";
});
html = html.replace(/<script>\s*if \("serviceWorker"[\s\S]*?<\/script>/, "<script>window.MOBILE_SINGLE_FILE = true;</script>");
html = html.replace("<head>", "<head>\n  <!-- نسخة الملف الواحد من «مواقيت المسجد» — مولّدة بـ tools/build-single.js، لا تُعدَّل يدوياً -->");
// العلم قبل تشغيل mobile.js
html = html.replace("<script>\n(function () {\n  var C = window.MobileCore", "<script>window.MOBILE_SINGLE_FILE = true;</script>\n<script>\n(function () {\n  var C = window.MobileCore");
fs.writeFileSync(path.join(ROOT, "mawaqit-phone.html"), html);
console.log("mawaqit-phone.html", (html.length / 1048576).toFixed(2) + " MB");
