/*
 * الإصدار ١١٫٢: وضع الأداء وعدّاد السلاسة.
 * S.perfMode: "auto" (افتراضي) | "high" (كل المؤثرات) | "saver" (توفير: بلا تمويه زجاجي ولا حركات زخرفية دائمة)
 * (وضع «خفيف جداً» القديم liteMode يبقى كما هو ويوقف كل الحركات.)
 * التلقائي: يبدأ بالتوفير على شاشات 4K في الأجهزة محدودة الذاكرة أو الأنوية، ثم يقيس معدل الإطارات فعلياً
 * بعد التشغيل وكل ساعة؛ إن هبط عن ٤٥ إطاراً أو كثرت الإطارات الطويلة يفعّل التوفير ويحفظ القرار أسبوعاً.
 * العدّاد: من قائمة النجمة «مقياس السلاسة» أو ?fps=1 — معدل الإطارات وأطول إطار في آخر ١٠ ثوانٍ والوضع الحالي.
 */
(function () {
  var KEY = "mosqueClock.perfAuto", WEEK = 7 * 864e5;
  var frames = [], sampling = false, meterOn = /[?&]fps=1/.test(location.search), meterEl = null, raf = 0, lastT = 0;
  function S() { return (window.ClockApp && ClockApp.S) || {}; }
  function saved() { try { var o = JSON.parse(localStorage.getItem(KEY) || "null"); return o && Date.now() - o.at < WEEK ? o : null; } catch (e) { return null; } }
  function save(mode, why) { try { localStorage.setItem(KEY, JSON.stringify({ mode: mode, at: Date.now(), why: why })); } catch (e) {} }

  function bigWeak() {
    var px = Math.max(screen.width, screen.height) * (window.devicePixelRatio || 1);
    var weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
    return px >= 3000 && weak;
  }
  function effective() {
    var m = S().perfMode || "auto";
    if (m !== "auto") return m;
    var sv = saved();
    if (sv) return sv.mode;
    return bigWeak() ? "saver" : "high";
  }
  function apply() {
    var m = effective();
    document.body.classList.toggle("perf-saver", m === "saver");
    return m;
  }

  function loop(t) {
    if (lastT) { frames.push([t, t - lastT]); }
    lastT = t;
    var cut = t - 10000; while (frames.length && frames[0][0] < cut) frames.shift();
    if (meterOn) drawMeter();
    if (sampling || meterOn) raf = requestAnimationFrame(loop); else { raf = 0; lastT = 0; }
  }
  function startLoop() { if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); } }
  function stats() {
    if (frames.length < 5) return null;
    var d = frames.map(function (f) { return f[1]; }), sum = d.reduce(function (a, b) { return a + b; }, 0);
    var sorted = d.slice().sort(function (a, b) { return a - b; });
    return { fps: Math.round(d.length / (sum / 1000)), worst: Math.round(sorted[sorted.length - 1]), p95: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
      long: d.filter(function (x) { return x > 50; }).length, mode: effective() };
  }
  function drawMeter() {
    if (!meterEl) { meterEl = document.createElement("div"); meterEl.className = "perf-meter"; document.body.appendChild(meterEl); }
    meterEl.hidden = false;
    var s = stats(); if (!s) return;
    var txt = "السلاسة: " + s.fps + " إطاراً/ث\nأطول إطار: " + s.worst + " م.ث\nإطارات بطيئة (١٠ث): " + s.long + "\nالوضع: " + ({ high: "عالٍ", saver: "توفير", lite: "خفيف" }[S().liteMode ? "lite" : s.mode] || s.mode) + ((S().perfMode || "auto") === "auto" ? " (تلقائي)" : "");
    if (meterEl.textContent !== txt) meterEl.textContent = txt;
  }

  // عيّنة قياس: ٨ ثوانٍ؛ القرار التلقائي بعدها
  function sample(cb) {
    frames = []; sampling = true; startLoop();
    setTimeout(function () { var s = stats(); sampling = false; cb && cb(s); }, 8000);
  }
  function autoCheck() {
    if ((S().perfMode || "auto") !== "auto" || S().liteMode || document.hidden) return;
    sample(function (s) {
      if (!s) return;
      var slow = s.fps < 45 || s.long > 8;
      if (slow && effective() !== "saver") { save("saver", "fps " + s.fps + ", long " + s.long); apply(); }
      else if (!slow && !saved()) save(effective(), "fps " + s.fps); // قرار مُقاس يُعتمد أسبوعاً
    });
  }

  function init() {
    apply();
    if (meterOn) startLoop();
    setTimeout(autoCheck, 20000);
    setInterval(autoCheck, 3600 * 1000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.ClockPerf = {
    apply: apply, stats: stats, effective: effective,
    meter: function (on) { meterOn = on === undefined ? !meterOn : !!on; if (meterOn) startLoop(); else if (meterEl) meterEl.hidden = true; return meterOn; },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} return apply(); }
  };
})();
