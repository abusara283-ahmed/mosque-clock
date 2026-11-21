#!/usr/bin/env node
/*
 * الإصدار ٨: مقارنة جدول وزارة الأوقاف بحساب الساعة من سطر الأوامر.
 *   node tools/compare-official.js جدول-مسقط-2026.csv --city=مسقط
 *   node tools/compare-official.js table.csv --lat=23.58 --lon=58.38 --report=تقرير.csv
 * يقبل ما تقبله صفحة الإعدادات: CSV أو نص منسوخ من Excel أو ملف «توقيت» (wtimes-*.js).
 * يخرج بالرمز 1 إن كان أي وقت خارج حد السماح (--tol=2 افتراضياً) ليُستعمل في الفحص الآلي.
 */
var fs = require("fs"), path = require("path"), vm = require("vm");
var ROOT = path.join(__dirname, "..");
var args = {}, files = [];
process.argv.slice(2).forEach(function (a) { var m = /^--([^=]+)=?(.*)$/.exec(a); if (m) args[m[1]] = m[2] || true; else files.push(a); });
if (!files.length) {
  console.log("الاستخدام: node tools/compare-official.js <ملف الجدول> [--city=مسقط] [--lat=.. --lon=..] [--tol=2] [--report=out.csv]");
  process.exit(2);
}
var store = {}, ctx = { console: console, localStorage: { getItem: function (k) { return store[k] || null; }, setItem: function (k, v) { store[k] = String(v); }, removeItem: function (k) { delete store[k]; } } };
ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
["js/settings-defaults.js", "js/config.js", "data/oman-cities.js", "js/prayertimes.js", "js/verify.js"].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
});
var S = ctx.ClockConfig.merge(ctx.CLOCK_DEFAULTS, {});
var city = args.city && findCity(String(args.city));
if (args.city && !city) { console.error("لم أجد الولاية: " + args.city); process.exit(2); }
if (city) { S.latitude = city.lat; S.longitude = city.lon; S.cityName = city.name; }
if (args.lat) S.latitude = +args.lat;
if (args.lon) S.longitude = +args.lon;
var tol = args.tol ? +args.tol : 2, worstExit = 0;
files.forEach(function (f) {
  var r = ctx.PrayerTimes.parseCSV(fs.readFileSync(f, "utf8"));
  console.log("\n" + path.basename(f) + ": " + r.count + " يوماً" + (r.errors.length ? " • أسطر لم تُقرأ: " + r.errors.slice(0, 12).join("، ") : "") + " • الموقع " + S.cityName + " (" + S.latitude + ", " + S.longitude + ")");
  if (!r.count) { worstExit = 2; return; }
  var res = ctx.ClockVerify.compare(r.table, S, { tolerance: tol });
  res.perKey.forEach(function (p) {
    console.log("  " + p.name.padEnd(7) + " مطابق " + ctx.ClockVerify.pct(p.exact).padStart(6) + " • ضمن دقيقة " + ctx.ClockVerify.pct(p.within1).padStart(6) +
      " • أكبر فرق " + p.maxAbs + " د • الوسيط " + p.median + (p.worst[0] ? " • أسوأ يوم " + p.worst[0].date + " (رسمي " + p.worst[0].official + "، محسوب " + p.worst[0].calc + ")" : ""));
  });
  var o = res.overall;
  console.log("  الإجمالي: " + o.n + " وقتاً، مطابق " + ctx.ClockVerify.pct(o.exact) + "، ضمن دقيقة " + ctx.ClockVerify.pct(o.within1) + "، خارج ±" + tol + " د: " + o.outside);
  console.log("  الحكم: " + res.verdict);
  var sg = Object.keys(res.suggest).filter(function (k) { return res.suggest[k]; });
  if (sg.length) console.log("  تعديل مقترح (دقائق): " + sg.map(function (k) { return ctx.ClockVerify.NAMES[k] + " " + (res.suggest[k] > 0 ? "+" : "") + res.suggest[k]; }).join("، "));
  if (args.report) { var out = files.length > 1 ? String(args.report).replace(/(\.csv)?$/, "-" + path.basename(f)) : String(args.report); fs.writeFileSync(out, ctx.ClockVerify.reportCSV(res)); console.log("  التقرير: " + out); }
  if (o.outside) worstExit = 1;
});
process.exit(worstExit);

function findCity(q) {
  var hit = (ctx.OMAN_CITIES || []).filter(function (c) { return c[0] === q; })[0];
  return hit ? { name: hit[0], lat: hit[1], lon: hit[2] } : null;
}
