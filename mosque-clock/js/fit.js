/*
 * الإصدار ١١: «الحد الأقصى الذكي» لأحجام العناصر (دوال صافية تعمل في المتصفح وفي Node للاختبار).
 * الصفحة تقيس مستطيلات العناصر الظاهرة، وهنا يُحكم: أيّها يتداخل أو يخرج عن حدوده، وأيّها يُصغَّر خطوة.
 * rects: { اسم: {left, top, right, bottom} }   bounds: { اسم: مستطيل الحدود الذي يجب أن يبقى داخله }
 * الأسماء: clock (الأرقام)، analog (العقارب/الحلقة)، name، date، chips، event، ticker، hero، prayers، dayline، slide
 */
(function (root) {
  // ما يُسمح بتداخله طبيعياً: أرقام الحلقة داخل دائرتها
  var ALLOWED = { "analog|clock": 1, "clock|analog": 1 };
  // العنصر ← مفتاح حجمه في الإعدادات (ما لا مفتاح له لا يُصغَّر)
  var KEY = { clock: "clock", analog: "analog", name: "name", date: "date", hero: "hero", prayers: "prayers", ticker: "ticker" };
  var STEP = 0.05, COARSE = 0.25, MIN = 0.4;

  function inter(a, b, tol) {
    var w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > tol && h > tol;
  }
  function outside(a, b, tol) { return a.left < b.left - tol || a.top < b.top - tol || a.right > b.right + tol || a.bottom > b.bottom + tol; }

  // قائمة المشكلات: { type: "overlap", a, b } أو { type: "out", a }
  // minH: أقل ارتفاع مقبول لكل عنصر (الساعة لا يصح أن تختفي)
  function issues(rects, bounds, tol, minH, clip) {
    tol = tol == null ? 3 : tol;
    var names = Object.keys(rects).filter(function (k) { var r = rects[k]; return r && r.right - r.left > 1 && r.bottom - r.top > 1; });
    var out = [];
    for (var i = 0; i < names.length; i++) {
      for (var j = i + 1; j < names.length; j++) {
        var a = names[i], b = names[j];
        if (ALLOWED[a + "|" + b]) continue;
        if (inter(rects[a], rects[b], tol)) out.push({ type: "overlap", a: a, b: b });
      }
      var bd = bounds && bounds[names[i]];
      if (bd && outside(rects[names[i]], bd, tol)) out.push({ type: "out", a: names[i] });
    }
    // نص مقصوص داخل منطقته (اسم المنطقة: prayers أو hero)
    (clip || []).forEach(function (k) { out.push({ type: "clip", a: k }); });
    Object.keys(minH || {}).forEach(function (k) {
      var r = rects[k];
      if (r !== undefined && (!r || r.bottom - r.top < minH[k])) out.push({ type: "small", a: k });
    });
    return out;
  }

  // أي عنصر نصغّر؟ من المشاركين في المشكلات: صاحب أكبر حجم فعلي فوق ١٠٠٪ (لا نصغّر ما هو على حجمه الافتراضي أو أقل)
  // active: المفاتيح الظاهرة فعلاً (حجم العقارب لا يعني شيئاً في الساعة الرقمية)
  function pick(list, eff, active) {
    var best = null;
    function ok(k) { return k && (!active || active.indexOf(k) >= 0) && eff[k] > 1 + 1e-9; }
    list.forEach(function (p) {
      if (p.type === "small") return; // الصغر يعالَج أدناه بتصغير غيره
      [p.a, p.b].forEach(function (n) {
        var k = n && KEY[n];
        if (ok(k) && (!best || eff[k] > eff[best])) best = k;
      });
    });
    if (best) return best;
    // لا مشارك مكبَّر: العناصر المكبَّرة الأخرى هي التي تدفعه (في العمود نفسه) أو تضغط الساعة حتى تختفي؛ نصغّر أكبرها
    if (list.length) Object.keys(eff).forEach(function (k) { if (ok(k) && (!best || eff[k] > eff[best])) best = k; });
    return best;
  }

  function r3(x) { return Math.round(x * 1000) / 1000; }
  // حلقة الملاءمة. apply(eff) تطبّق الأحجام، measure() تُرجع { rects, bounds, minH, clip, active }
  // سريعة على الأجهزة الضعيفة: تصغير بخطوات خشنة (٢٥٪) ثم استرداد بخطوات ٥٪ حتى أقصى حجم بلا تداخل.
  // opts.start: بداية دافئة من نتيجة سابقة (الفحص الدوري يقيس مرة واحدة فقط إن لم يتغير شيء)
  function solve(req, apply, measure, maxIter, opts) {
    opts = opts || {}; maxIter = maxIter || 120;
    var eff = {}, touched = {}, list = [], n = 0, active = null, start = opts.start || req;
    Object.keys(req).forEach(function (k) { eff[k] = Math.min(req[k], start[k] != null ? start[k] : req[k]); });
    function check() {
      apply(eff); var m = measure(); n++;
      if (m.active) active = m.active;
      list = issues(m.rects, m.bounds, 3, m.minH, m.clip);
      return list.length;
    }
    while (n < maxIter && check()) {
      var k = pick(list, eff, active);
      if (!k) break;
      eff[k] = r3(Math.max(1, eff[k] - COARSE)); touched[k] = 1;
    }
    if (!list.length) Object.keys(touched).sort(function (a, b) { return eff[b] - eff[a]; }).forEach(function (k) {
      while (n < maxIter && eff[k] + STEP <= req[k] + 1e-9) {
        var prev = eff[k]; eff[k] = r3(eff[k] + STEP);
        if (check()) { eff[k] = prev; apply(eff); list = []; break; }
      }
    });
    var reduced = Object.keys(req).filter(function (k) { return eff[k] < req[k] - 1e-9; });
    return { requested: req, effective: eff, reduced: reduced, issues: list, iterations: n };
  }

  var api = { issues: issues, pick: pick, solve: solve, KEY: KEY, STEP: STEP, COARSE: COARSE, MIN: MIN };
  root.ClockFit = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
