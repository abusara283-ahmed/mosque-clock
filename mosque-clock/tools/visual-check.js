#!/usr/bin/env node
/*
 * الإصدار ١١: فحص لقطات آلي لكشف التداخل قبل أي إصدار.
 * يفتح الساعة في Chrome بلا واجهة على مصفوفة: التوزيعات × الاتجاه (أفقي/عمودي) × شكل الساعة (رقمية/عقارب/حلقة)
 * × بالثواني وبدونها × الأحجام (افتراضي، كبير، أقصى)، ثم يقيس العناصر ويتحقق أن لا شيء يتداخل أو يخرج من الشاشة.
 * الاستخدام:
 *   node tools/visual-check.js http://localhost:8080/ [مجلد-اللقطات] [--quick]
 * يحتاج: npm i playwright-core  وChrome مثبتاً (أو CHROME=/path/to/chrome).
 */
var path = require("path"), fs = require("fs");
var pw; try { pw = require("playwright-core"); } catch (e) { try { pw = require(process.env.PW || "/tmp/pw/node_modules/playwright-core"); } catch (e2) { console.error("ثبّت playwright-core أولاً: npm i playwright-core"); process.exit(2); } }
var base = (process.argv[2] || "http://localhost:8080/").replace(/\/?$/, "/");
var outDir = process.argv[3] && !/^--/.test(process.argv[3]) ? process.argv[3] : null;
var quick = process.argv.indexOf("--quick") > 0;
var CHROME = process.env.CHROME || ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(fs.existsSync)[0];

var LAYOUTS = ["side", "center", "bar", "cards"], ORIENTS = [["landscape", 1920, 1080], ["portrait", 1080, 1920]];
var STYLES = ["digital", "analog", "ring"], SECS = quick ? [true] : [true, false];
var SIZES = { "افتراضي": 1, "كبير": 1.6, "أقصى": 2.5 };
var TIMES = quick ? ["2026-11-21T19:40:00"] : ["2026-11-21T19:40:00", "2026-11-21T10:15:00"];

(async function () {
  var b = await pw.chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  var total = 0, bad = [], errors = [];
  var cases = [];
  for (var o0 of ORIENTS) for (var l0 of LAYOUTS) for (var s0 of STYLES) for (var c0 of SECS) for (var z0 of Object.keys(SIZES)) for (var t0 of TIMES) cases.push([o0, l0, s0, c0, z0, t0]);
  // عدة صفحات بالتوازي لتسريع الفحص الكامل
  async function one(cs) {
    var o = cs[0], lay = cs[1], st = cs[2], sec = cs[3], sz = cs[4], tm = cs[5];
    var big = SIZES[sz], sizes = { clock: big, analog: Math.min(big, 1.8), name: 1, date: 1, hero: 1, prayers: 1, ticker: 1 };
    if (sz === "أقصى") Object.keys(sizes).forEach(function (k) { sizes[k] = k === "clock" ? 2.5 : 1.8; });
    var S = { layout: lay, clockStyle: st, showSeconds: sec, annMode: "ticker", autoBright: false, nightRest: false, dayRest: false, pixelShift: false, sizes: {} };
    S.sizes[o[0]] = sizes;
    var p = await b.newPage({ viewport: { width: o[1], height: o[2] } });
    p.on("pageerror", function (e) { errors.push(e.message); });
    await p.addInitScript(function (s) {
      localStorage.setItem("mosqueClock.settings.v1", JSON.stringify(s));
      localStorage.setItem("mosqueClock.ann.v1", JSON.stringify([{ id: "a", text: "نرجو المحافظة على نظافة المسجد وهدوئه وإغلاق الهواتف قبل الدخول إلى المصلى", enabled: true }]));
    }, S);
    await p.goto(base + "index.html?rest=0&sim=" + tm);
    await p.waitForTimeout(1800);
    var r = await p.evaluate(function () {
      var f = window.ClockLook && ClockLook.fit(); if (!f) return null;
      var issues = f.issues.slice(); // يشمل القص داخل البطاقات (clip) من محرك الملاءمة نفسه
      return { issues: issues, reduced: f.reduced, eff: f.effective };
    });
    total++;
    var tag = [o[0], lay, st, sec ? "ثواني" : "بلا-ثوانٍ", sz, tm.slice(11, 16)].join(" | ");
    if (!r || r.issues.length) bad.push(tag + " ⟵ " + (r ? r.issues.map(function (i) { return i.type === "out" ? i.a + " خارج حدوده" : i.type === "small" ? i.a + " صغير جداً" : i.type === "clip" ? i.a + " نص مقصوص" : i.a + "×" + i.b; }).join("، ") : "لا تقرير"));
    if (outDir && (sz !== "افتراضي" || !sec) && tm === TIMES[0]) {
      fs.mkdirSync(outDir, { recursive: true });
      await p.screenshot({ path: path.join(outDir, [o[0], lay, st, sec ? "s" : "nos", sz === "افتراضي" ? "1" : sz === "كبير" ? "160" : "max"].join("-") + ".png") });
    }
    await p.close();
  }
  var next = 0, N = +process.env.JOBS || 4;
  await Promise.all(Array.from({ length: N }, async function () { while (next < cases.length) await one(cases[next++]); }));
  await b.close();
  console.log("حالات: " + total + " • بلا تداخل: " + (total - bad.length) + " • فيها تداخل: " + bad.length);
  bad.slice(0, 40).forEach(function (x) { console.log("  ✗ " + x); });
  if (errors.length) console.log("أخطاء الصفحة: " + Array.from(new Set(errors)).slice(0, 5).join(" / "));
  process.exit(bad.length || errors.length ? 1 : 0);
})();
