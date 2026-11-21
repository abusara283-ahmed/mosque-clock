/*
 * مصادر الإعلانات بالترتيب:
 *  ١. الخادم المحلي server.js  ← api/announcements (يُحدَّث من الجوال مباشرة)
 *  ٢. ملف data/announcements.json عند الاستضافة على الإنترنت
 *  ٣. ما حُفظ في هذا الجهاز من صفحة الإعلانات
 *  ٤. ملف data/announcements.js (يعمل حتى عند فتح الساعة كملف محلي)
 * الإعلان: { id, title, text, from: "2026-11-01", to: "2026-11-30", enabled: true, urgent: false }
 */
(function () {
  var KEY = "mosqueClock.ann.v1";
  var list = [], listeners = [];

  function local() {
    try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; }
  }
  function set(arr) {
    list = Array.isArray(arr) ? arr : [];
    listeners.forEach(function (f) { f(list); });
  }
  function fallback() {
    var l = local();
    set(l && l.length ? l : (window.CLOCK_ANNOUNCEMENTS || []));
  }
  function getJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { if (!Array.isArray(j)) throw 0; return j; });
  }
  // الإصدار ١٠: داخل تطبيق أندرويد (شاشة المسجد) يستقبل التطبيق الإعلانات من الجوال عبر خادمه الصغير
  function fromApp() {
    var A = window.AndroidClock;
    if (!window.MC_EMBEDDED || !A || typeof A.remoteAnnouncements !== "function") return null;
    try { var j = JSON.parse(A.remoteAnnouncements() || "null"); return Array.isArray(j) ? j : null; } catch (e) { return null; }
  }
  function refresh() {
    var app = fromApp();
    if (app) { if (JSON.stringify(app) !== JSON.stringify(list)) { try { localStorage.setItem(KEY, JSON.stringify(app)); } catch (e) {} set(app); } return; }
    if (window.MC_EMBEDDED || !/^https?:$/.test(location.protocol) || !window.fetch) return fallback();
    getJSON("api/announcements").catch(function () { return getJSON("data/announcements.json"); })
      .then(set).catch(fallback);
  }

  function dayStr(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function active(date) {
    if (window.ClockTicker) return list.filter(function (a) { return ClockTicker.isActive(a, date); }); // الإصدار ٨٫١: الأيام وساعات العرض
    var today = dayStr(date);
    return list.filter(function (a) {
      return a && a.enabled !== false && (a.text || a.title) &&
        (!a.from || a.from <= today) && (!a.to || a.to >= today);
    });
  }

  window.ClockAnnouncements = {
    KEY: KEY,
    refresh: refresh,
    active: active,
    all: function () { return list; },
    onChange: function (f) { listeners.push(f); },
    saveLocal: function (arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); return true; } catch (e) { return false; } },
    local: local
  };
  fallback();
  refresh();
  setInterval(refresh, window.MC_EMBEDDED ? 10 * 1000 : 60 * 1000);
  addEventListener("storage", function (e) { if (e.key === KEY) refresh(); });
})();
