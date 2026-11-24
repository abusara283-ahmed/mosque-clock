#!/usr/bin/env node
/*
 * الإصدار ١١٫١: اختبار آلي يحاكي أزرار الريموت (أعلى، أسفل، يمين، يسار، موافق، رجوع) على صفحة الإعدادات.
 * - لكل تبويب: يبني شبكة التنقل من كل عنصر في الاتجاهات الأربعة ويتأكد أن كل عنصر يمكن الوصول إليه من شريط التبويبات
 *   وأن من كل عنصر طريقاً للعودة إليه (لا شيء يحبس التحديد).
 * - سيناريو المشكلة المبلّغ عنها: منزلقة حجم الساعة لا تحبس الريموت.
 * - القائمة المنسدلة وحقل الرقم: أعلى/أسفل تنقل ولا تغيّر القيمة.
 * - وضع الفأرة: الحركة والتسارع والنقر والخروج بالرجوع.
 * الاستخدام: node tools/remote-check.js http://localhost:8080/ [مجلد-اللقطات]
 */
var path = require("path"), fs = require("fs");
var pw; try { pw = require("playwright-core"); } catch (e) { pw = require(process.env.PW || "/tmp/pw/node_modules/playwright-core"); }
var base = (process.argv[2] || "http://localhost:8080/").replace(/\/?$/, "/"), outDir = process.argv[3];
var CHROME = process.env.CHROME || ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(fs.existsSync)[0];
var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.log("  ✗ " + m); } }

(async function () {
  var b = await pw.chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
  var p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  var errors = []; p.on("pageerror", function (e) { errors.push(e.message); });
  await p.addInitScript(function () { try { localStorage.removeItem("mosqueClock.cursor"); sessionStorage.removeItem("mosqueClock.settingsTab"); } catch (e) {} });
  await p.goto(base + "settings.html");
  await p.waitForTimeout(1500);
  var key = async function (k, n) { for (var i = 0; i < (n || 1); i++) { await p.keyboard.press(k); await p.waitForTimeout(40); } };
  var active = function () { return p.evaluate(function () { var a = document.activeElement; return a ? (a.dataset.k || a.dataset.t || a.id || a.tagName + ":" + (a.textContent || "").trim().slice(0, 20)) : null; }); };

  // ١) شبكة التنقل لكل تبويب
  var tabs = await p.evaluate(function () { return [].map.call(document.querySelectorAll("#tabs button"), function (b) { return b.dataset.t; }); });
  ok(tabs.length === 5, "خمسة تبويبات");
  for (var t of tabs) {
    var r = await p.evaluate(function (t) {
      SettingsTabs.show(t);
      var list = TvNav.focusables().filter(function (el) { return el.closest("main, #tabs"); });
      var tab = document.querySelector('#tabs [data-t="' + t + '"]');
      var idx = new Map(list.map(function (el, i) { return [el, i]; }));
      var adj = list.map(function (el) { return ["up", "down", "left", "right"].map(function (d) { return TvNav.next(el, d, list); }).filter(function (n) { return n && idx.has(n); }).map(function (n) { return idx.get(n); }); });
      function reach(from, edges) { var seen = new Set([from]), q = [from]; while (q.length) { var x = q.shift(); edges[x].forEach(function (y) { if (!seen.has(y)) { seen.add(y); q.push(y); } }); } return seen; }
      var rev = list.map(function () { return []; }); adj.forEach(function (ns, i) { ns.forEach(function (j) { rev[j].push(i); }); });
      var s = idx.get(tab), fwd = reach(s, adj), back = reach(s, rev);
      var name = function (el) { return el.dataset.k || el.id || el.tagName + ":" + (el.textContent || el.closest("label") && el.closest("label").textContent || "").trim().slice(0, 30); };
      var main = list.filter(function (el) { return el.closest("main"); });
      return {
        total: main.length,
        unreachable: list.filter(function (el, i) { return !fwd.has(i); }).map(name),
        trapped: list.filter(function (el, i) { return !back.has(i); }).map(name)
      };
    }, t);
    ok(r.total > 3, "تبويب " + t + ": فيه عناصر (" + r.total + ")");
    ok(!r.unreachable.length, "تبويب " + t + ": كل العناصر يصلها الريموت" + (r.unreachable.length ? " — لا يصل إلى: " + r.unreachable.slice(0, 6).join("، ") : ""));
    ok(!r.trapped.length, "تبويب " + t + ": لا عنصر يحبس التحديد" + (r.trapped.length ? " — يحبس: " + r.trapped.slice(0, 6).join("، ") : ""));
    console.log("  تبويب " + t + ": " + r.total + " عنصراً");
  }

  // ٢) التنقل بين التبويبات بالأسهم
  await p.evaluate(function () { SettingsTabs.show("look", true); });
  await key("ArrowLeft");
  ok(await p.evaluate(function () { return document.activeElement.dataset.t === "prayer" && document.querySelector('section[data-tab="prayer"]:not(.tab-off)') && document.querySelector('#lookSec').classList.contains("tab-off"); }), "يسار من «الساعة والمظهر» يفتح «أوقات الصلاة»");
  await key("ArrowRight");
  ok(await active() === "look", "يمين يعود للتبويب السابق");
  await key("ArrowDown");
  ok(await p.evaluate(function () { return !!document.activeElement.closest("main"); }), "أسفل من التبويب يدخل محتواه");

  // ٣) المشكلة المبلّغ عنها: منزلقة حجم الساعة
  await p.evaluate(function () { SettingsTabs.show("look"); TvNav.go(document.querySelector('[data-size="clock"]')); });
  var v0 = await p.evaluate(function () { return document.querySelector('[data-size="clock"]').value; });
  await key("ArrowRight");
  var st = await p.evaluate(function () { var r = document.querySelector('[data-size="clock"]'); return { v: r.value, onIt: document.activeElement === r }; });
  ok(st.v === v0, "يمين على المنزلقة خارج وضع التعديل لا يغيّر الحجم");
  await p.evaluate(function () { TvNav.go(document.querySelector('[data-size="clock"]')); });
  await key("ArrowDown");
  st = await p.evaluate(function () { var r = document.querySelector('[data-size="clock"]'); return { v: r.value, onIt: document.activeElement === r }; });
  ok(!st.onIt && st.v === v0, "أسفل من المنزلقة ينقل التحديد ولا يغيّر الحجم");
  await key("ArrowUp");
  ok(await active() === "sizes.landscape.clock" || await p.evaluate(function () { return document.activeElement.dataset.size === "clock"; }), "أعلى يعود إلى المنزلقة");
  await key("Enter");
  ok(await p.evaluate(function () { return TvNav.editing() === document.querySelector('[data-size="clock"]'); }), "موافق يدخل وضع التعديل");
  if (outDir) { fs.mkdirSync(outDir, { recursive: true }); await p.screenshot({ path: path.join(outDir, "remote-slider-edit.png") }); }
  await key("ArrowRight", 3); await key("ArrowLeft", 1);
  var v1 = await p.evaluate(function () { return document.querySelector('[data-size="clock"]').value; });
  ok(v1 !== v0, "في وضع التعديل يمين/يسار يغيّران الحجم (" + v0 + " ← " + v1 + ")");
  ok(await p.evaluate(function () { return /١٠٠|[0-9٠-٩]+٪/.test(document.querySelector('[data-size="clock"]').nextElementSibling.textContent); }), "قيمة الحجم المعروضة تتحدّث");
  await key("ArrowDown");
  ok(await p.evaluate(function () { return !TvNav.editing() && document.activeElement.dataset.size !== "clock"; }), "أسفل في وضع التعديل يخرج منه وينتقل");
  await p.evaluate(function () { TvNav.go(document.querySelector('[data-size="clock"]')); });
  await key("Enter"); await key("Escape");
  ok(await p.evaluate(function () { return !TvNav.editing() && document.activeElement.dataset.size === "clock"; }), "الرجوع يخرج من وضع التعديل ويبقى على المنزلقة");
  await key("Enter"); await key("Enter");
  ok(await p.evaluate(function () { return !TvNav.editing(); }), "موافق مرة ثانية يُنهي التعديل");

  // ٤) القائمة المنسدلة وحقل الرقم ومربع الاختيار
  await p.evaluate(function () { SettingsTabs.show("look"); TvNav.go(document.querySelector('select[data-k="ampmPos"]')); });
  var sv = await p.evaluate(function () { return document.querySelector('select[data-k="ampmPos"]').value; });
  await key("ArrowDown");
  ok(await p.evaluate(function (sv) { var s = document.querySelector('select[data-k="ampmPos"]'); return s.value === sv && document.activeElement !== s; }, sv), "أسفل على القائمة المنسدلة ينقل ولا يغيّر الاختيار");
  await p.evaluate(function () { SettingsTabs.show("look"); TvNav.go(document.querySelector('input[type=number][data-k="hijriOffset"]')); });
  var nv = await p.evaluate(function () { return document.querySelector('[data-k="hijriOffset"]').value; });
  await key("ArrowUp");
  ok(await p.evaluate(function (nv) { var s = document.querySelector('[data-k="hijriOffset"]'); return s.value === nv && document.activeElement !== s; }, nv), "أعلى على حقل الرقم ينقل ولا يغيّر الرقم");
  await p.evaluate(function () { TvNav.go(document.querySelector('[data-k="showSeconds"]')); });
  var cb = await p.evaluate(function () { return document.querySelector('[data-k="showSeconds"]').checked; });
  await key("Enter");
  ok(await p.evaluate(function (cb) { return document.querySelector('[data-k="showSeconds"]').checked !== cb; }, cb), "موافق يبدّل مربع الاختيار");
  await key("Enter");

  // ٥) وضع الفأرة
  await p.evaluate(function () { SettingsTabs.show("look"); window.scrollTo(0, 0); TvNav.go(document.querySelector("#tabs button")); });
  await p.keyboard.down("Enter"); await p.waitForTimeout(1100); await p.keyboard.up("Enter");
  ok(await p.evaluate(function () { return TvNav.isCursor(); }), "ضغط مطوّل على «موافق» يفعّل وضع الفأرة");
  var c0 = await p.evaluate(function () { return TvNav.cursorPos(); });
  await p.keyboard.down("ArrowDown"); await p.waitForTimeout(250); var c1 = await p.evaluate(function () { return TvNav.cursorPos(); });
  await p.waitForTimeout(500); var c2 = await p.evaluate(function () { return TvNav.cursorPos(); }); await p.keyboard.up("ArrowDown");
  ok(c1.y > c0.y && (c2.y - c1.y) / 500 > (c1.y - c0.y) / 250, "المؤشر يتحرك ويتسارع مع طول الضغط (" + Math.round(c1.y - c0.y) + " ثم " + Math.round(c2.y - c1.y) + " بكسل)");
  // نقرة على مربع «الثواني»
  var target = await p.evaluate(function () { var el = document.querySelector('[data-k="showSeconds"]'); el.scrollIntoView({ block: "center" }); var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, v: el.checked }; });
  // نحرّك المؤشر إلى الهدف بالأسهم
  for (var i = 0; i < 200; i++) {
    var c = await p.evaluate(function () { return TvNav.cursorPos(); });
    var dx = target.x - c.x, dy = target.y - c.y;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) break;
    var k = Math.abs(dy) >= 8 ? (dy > 0 ? "ArrowDown" : "ArrowUp") : (dx > 0 ? "ArrowRight" : "ArrowLeft");
    await p.keyboard.press(k);
  }
  if (outDir) await p.screenshot({ path: path.join(outDir, "remote-mouse-mode.png") });
  await key("Enter");
  ok(await p.evaluate(function (v) { return document.querySelector('[data-k="showSeconds"]').checked !== v; }, target.v), "«موافق» في وضع الفأرة ينقر العنصر تحت المؤشر");
  await key("Escape");
  ok(await p.evaluate(function () { return !TvNav.isCursor(); }), "الرجوع يخرج من وضع الفأرة");
  await p.click("#tvCursorBtn");
  ok(await p.evaluate(function () { return TvNav.isCursor() && localStorage.getItem("mosqueClock.cursor") === "1"; }), "زر 🖱 يفعّل وضع الفأرة ويُحفظ");
  await p.click("#tvCursorBtn");

  if (outDir) {
    await p.evaluate(function () { SettingsTabs.show("prayer", true); document.documentElement.classList.add("kbnav"); });
    await key("ArrowDown", 2);
    await p.screenshot({ path: path.join(outDir, "remote-tabs.png") });
  }
  ok(!errors.length, "بلا أخطاء في الصفحة" + (errors.length ? ": " + errors.slice(0, 3).join(" / ") : ""));
  await b.close();
  console.log("\nالنتيجة: " + pass + " ناجح، " + fail + " فاشل");
  process.exit(fail ? 1 : 0);
})();
