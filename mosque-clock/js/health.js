/*
 * الإصدار ١٠: المراقبة الذاتية للشاشة.
 * - مراقب: إن توقفت الساعة عن التحديث دقيقة كاملة أو تكررت الأخطاء تظهر شارة «إعادة تشغيل تلقائية» ثم تُعاد الصفحة
 *   (حدّ أقصى ثلاث مرات في ربع ساعة حتى لا تدخل في حلقة). بعد العودة تظهر شارة صغيرة بوقت الإعادة وسببها لدقيقتين.
 * - الشبكة: إن انقطعت بعد أن كانت متصلة تظهر شارة «الشبكة منقطعة، الساعة تعمل دون إنترنت» حتى تعود.
 * - شارات أخرى تضيفها الصفحة عبر ClockHealth.set(id, نص, نوع) مثل فرق المواقيت عن الجدول الرسمي.
 */
(function () {
  var KEY = "mosqueClock.settings.v1", LOG = "mosqueClock.restarts", NOTE = "mosqueClock.restartNote";
  var errs = 0, born = Date.now(), box = null, items = {};
  function S() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  var preview = /preview=1/.test(location.search);
  function ensure() {
    if (box || !document.body) return box;
    box = document.createElement("div"); box.className = "health"; box.id = "health"; box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
    return box;
  }
  function set(id, text, kind) {
    if (preview) return;
    var b = ensure(); if (!b) return;
    var el = items[id];
    if (!text) { if (el) { el.remove(); delete items[id]; } return; }
    if (!el) { el = items[id] = document.createElement("div"); b.appendChild(el); }
    el.className = kind || "";
    if (el.textContent !== text) el.textContent = text;
  }
  function hhmm(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes(), ar = S().arabicDigits !== false;
    var s = (h % 12 || 12) + ":" + String(m).padStart(2, "0") + (h < 12 ? " ص" : " م");
    return ar ? s.replace(/[0-9]/g, function (x) { return "٠١٢٣٤٥٦٧٨٩"[x]; }) : s;
  }

  addEventListener("error", function () { errs++; });
  addEventListener("unhandledrejection", function () { errs++; });

  function restart(reason) {
    var log = []; try { log = JSON.parse(sessionStorage.getItem(LOG) || "[]"); } catch (e) {}
    log = log.filter(function (t) { return Date.now() - t < 15 * 60000; });
    if (log.length >= 3) { set("restart", "تعذّرت الاستعادة التلقائية: " + reason + ". أعد تشغيل الجهاز إن استمر", "bad"); return; }
    log.push(Date.now());
    try { sessionStorage.setItem(LOG, JSON.stringify(log)); localStorage.setItem(NOTE, JSON.stringify({ at: Date.now(), reason: reason })); } catch (e) {}
    set("restart", "⟳ إعادة تشغيل تلقائية: " + reason, "warn");
    setTimeout(function () { location.reload(); }, 2500);
  }

  setInterval(function () {
    if (S().watchdog === false || preview) return;
    var stalled = Date.now() - Math.max(window.__clockTick || 0, born) > 60000;
    if (stalled) restart("توقفت الساعة عن التحديث");
    else if (errs > 40) restart("أخطاء متكررة");
    errs = Math.max(0, errs - 10);
  }, 15000);

  // الشبكة
  var wasOnline = navigator.onLine !== false;
  function net() {
    if (navigator.onLine === false) { if (wasOnline) set("net", "الشبكة منقطعة • الساعة تعمل دون إنترنت", "warn"); }
    else { wasOnline = true; set("net", ""); }
  }
  addEventListener("offline", net); addEventListener("online", net);

  document.addEventListener("DOMContentLoaded", function () {
    var n = null; try { n = JSON.parse(localStorage.getItem(NOTE) || "null"); } catch (e) {}
    if (n && Date.now() - n.at < 5 * 60000) {
      set("restart", "أُعيد تشغيل الساعة تلقائياً " + hhmm(n.at) + " (" + n.reason + ")");
      setTimeout(function () { set("restart", ""); }, 120000);
    }
    try { localStorage.removeItem(NOTE); } catch (e) {}
  });

  window.ClockHealth = { set: set, restart: restart };
})();
