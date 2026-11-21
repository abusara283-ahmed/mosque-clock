/*
 * الإصدار ٨٫١: منطق شريط الإعلانات المتحرك (دوال صافية تعمل في المتصفح وفي Node للاختبار).
 * الإعلان: { id, title, text, kind, priority, from, to, timeFrom, timeTo, days, show, enabled, urgent }
 *   kind: info إعلان | alert تنبيه | dua دعاء | lesson درس | condolence تعزية | urgent عاجل
 *   priority: 1 عادي | 2 مهم (يتكرر مرتين في الدورة) | 3 مهم جداً (ثلاث مرات ويتقدّم الشريط)
 *   timeFrom/timeTo: ساعات العرض في اليوم مثل 16:00 – 21:00 (تقبل العبور بعد منتصف الليل)
 *   days: أيام الأسبوع [0..6] (الأحد = 0) ، فارغ = كل الأيام
 *   show: auto (حسب الإعداد العام) | ticker (الشريط فقط) | screen (الشاشة الكاملة فقط) | both
 */
(function (root) {
  var KINDS = {
    info: { name: "إعلان" }, alert: { name: "تنبيه" }, dua: { name: "دعاء" },
    lesson: { name: "درس" }, condolence: { name: "تعزية" }, urgent: { name: "عاجل" }
  };
  function pad(n) { return String(n).padStart(2, "0"); }
  function dayStr(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function hm(s) { var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(s || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  function kindOf(a) { return a.urgent ? "urgent" : (KINDS[a.kind] ? a.kind : "info"); }

  // هل يُعرض الإعلان في هذه اللحظة؟
  function isActive(a, date) {
    if (!a || a.enabled === false || !(a.text || a.title)) return false;
    var today = dayStr(date);
    if (a.from && a.from > today) return false;
    if (a.to && a.to < today) return false;
    if (Array.isArray(a.days) && a.days.length && a.days.map(Number).indexOf(date.getDay()) < 0) return false;
    var f = hm(a.timeFrom), t = hm(a.timeTo), m = date.getHours() * 60 + date.getMinutes();
    if (f != null || t != null) {
      f = f == null ? 0 : f; t = t == null ? 1440 : t;
      if (f <= t ? !(m >= f && m < t) : !(m >= f || m < t)) return false; // t < f: يعبر منتصف الليل
    }
    return true;
  }

  // أين يظهر الإعلان؟ العاجل دائماً في الشريط
  function inTicker(a, S) {
    var show = a.show || "auto", mode = (S && S.annMode) || "screen";
    if (kindOf(a) === "urgent") return true;
    if (show === "ticker" || show === "both") return true;
    if (show === "screen") return false;
    return mode !== "screen";
  }
  function onScreen(a, S) {
    var show = a.show || "auto", mode = (S && S.annMode) || "screen";
    if (show === "screen" || show === "both") return true;
    if (show === "ticker") return false;
    return kindOf(a) !== "urgent" && mode !== "ticker";
  }

  // عناصر الشريط مرتبة: العاجل ثم الأولوية الأعلى، والمهم يتكرر في الدورة الواحدة
  function items(list, S, date) {
    if (S && S.tickerEnabled === false) return [];
    var act = (list || []).filter(function (a) { return isActive(a, date) && inTicker(a, S); });
    act.sort(function (x, y) {
      var ux = kindOf(x) === "urgent" ? 1 : 0, uy = kindOf(y) === "urgent" ? 1 : 0;
      return (uy - ux) || ((+y.priority || 1) - (+x.priority || 1));
    });
    var base = act.map(function (a) {
      return { id: a.id, kind: kindOf(a), label: KINDS[kindOf(a)].name, text: (a.title ? a.title + ": " : "") + (a.text || ""), priority: Math.max(1, Math.min(3, +a.priority || 1)) };
    });
    // التكرار موزّع: المهم يظهر بين غيره لا متتالياً
    var out = base.slice(), extra = [];
    base.forEach(function (it) { for (var i = 1; i < it.priority; i++) extra.push(it); });
    extra.forEach(function (it, i) { out.splice(Math.min(out.length, Math.round((i + 1) * (out.length + 1) / (extra.length + 1))), 0, it); });
    for (var i = 1; i < out.length; i++) if (out[i].id === out[i - 1].id && out.length > 2) { var mv = out.splice(i, 1)[0]; out.push(mv); }
    return out;
  }

  // مدة دورة الحركة بالثواني: عرض النص ÷ السرعة (نسبة من عرض الشاشة في الثانية)
  var SPEEDS = { slow: 4, normal: 6, fast: 9 };
  function duration(textWidth, screenWidth, speed) {
    var v = typeof speed === "number" ? speed : (SPEEDS[speed] || SPEEDS.normal);
    return Math.max(8, Math.round(textWidth / Math.max(40, screenWidth * v / 100)));
  }

  // نبرة الشريط: عاجل، أو تعزية (رمادي هادئ) إن كان كل ما فيه تعزية
  function tone(list) {
    if (!list.length) return "";
    if (list.some(function (x) { return x.kind === "urgent"; })) return "urgent";
    if (list.every(function (x) { return x.kind === "condolence"; })) return "mourn";
    return "";
  }

  var api = { KINDS: KINDS, isActive: isActive, inTicker: inTicker, onScreen: onScreen, items: items, duration: duration, tone: tone, kindOf: kindOf, SPEEDS: SPEEDS };
  root.ClockTicker = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
