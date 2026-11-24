/*
 * الإصدار ٩: تكامل الصفحات مع تطبيق أندرويد (Capacitor). يُحمَّل أولاً في كل صفحة، ولا يفعل شيئاً خارج التطبيق.
 * - يضيف للصفحة الأصناف in-app و mode-screen|phone|tablet و tv.
 * - يلغي عامل الخدمة داخل التطبيق (الملفات محلية أصلاً، وتجنباً لنسخ قديمة بعد التحديث).
 * - الريموت (Android TV والصناديق): زر الموافقة يفتح القائمة، والأسهم تتنقل، وزر القائمة يفتح الإعدادات.
 * - بعد تعذّر خادم المسجد: يعيد المحاولة كل ١٠ دقائق.
 */
(function () {
  var A = window.AndroidClock;
  var inApp = !!(A && typeof A.status === "function");
  // «مضمّن»: الصفحات من داخل التطبيق نفسه، فلا خادم api/ خلفها
  window.MC_EMBEDDED = inApp && location.hostname === "localhost";
  if (!inApp) return;
  var S = {};
  try { S = JSON.parse(A.status()); } catch (e) {}
  window.MC_ANDROID = S;
  var root = document.documentElement;
  root.classList.add("in-app", "mode-" + (S.mode || "screen"));
  if (S.tv) root.classList.add("tv");
  if (S.mode === "tablet" || /[?&]tablet=1/.test(location.search)) root.classList.add("tablet");

  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () {});
  }

  if (/[?&]fallback=1/.test(location.search)) setTimeout(function () { location.replace("start.html"); }, 10 * 60 * 1000);

  // ——— الريموت ———
  function $(id) { return document.getElementById(id); }
  function visible(el) { return el && !el.hidden && el.offsetParent !== null; }
  function focusables(scope) {
    return [].slice.call((scope || document).querySelectorAll("a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])"))
      .filter(function (el) { return el.offsetParent !== null && !el.closest("[hidden]"); });
  }
  function moveIn(list, dir) {
    var i = list.indexOf(document.activeElement);
    var n = list[(i + dir + list.length) % list.length] || list[0];
    if (n) { n.focus(); if (n.scrollIntoView) n.scrollIntoView({ block: "nearest" }); }
  }
  var R = {
    /** زر القائمة في الريموت */
    menu: function () {
      // صفحات النماذج: زر القائمة يبدّل وضع الفأرة (الإصدار ١١٫١)
      if (!$("starBtn") && window.TvNav && document.documentElement.getAttribute("data-no-spatial") === null) { TvNav.cursor(); return true; }
      if ($("starBtn")) { $("starBtn").click(); var f = focusables($("starMenu"))[0]; if (f) f.focus(); return true; }
      if ($("openSettings")) { $("openSettings").click(); return true; }
      if (!/settings\.html/.test(location.pathname)) { location.href = "settings.html"; return true; }
      return false;
    },
    /** زر الرجوع: يغلق ما هو مفتوح داخل الصفحة أولاً. يُرجع true إن استُهلك. */
    back: function () {
      if (window.TvNav && TvNav.back()) return true;
      if (visible($("qrPanel"))) { $("qrClose").click(); return true; }
      if ($("starMenu") && !$("starMenu").hidden) { $("starBtn").click(); return true; }
      if ($("sheet") && !$("sheet").hidden) { $("sheetClose").click(); return true; }
      if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen(); return true; }
      return false;
    }
  };
  window.ClockRemote = R;

  addEventListener("keydown", function (e) {
    var k = e.key, menuEl = $("starMenu");
    // داخل قائمة النجمة: الأسهم تتنقل بين عناصرها
    if (menuEl && !menuEl.hidden && (k === "ArrowDown" || k === "ArrowUp")) {
      e.preventDefault(); e.stopImmediatePropagation(); moveIn(focusables(menuEl), k === "ArrowDown" ? 1 : -1); return;
    }
    // على شاشة الساعة بلا عنصر محدد: «موافق» يفتح القائمة
    if ((k === "Enter" || k === " ") && $("starBtn") && (document.activeElement === document.body || !document.activeElement)) {
      e.preventDefault(); R.menu(); return;
    }
    if (k === "ContextMenu") { e.preventDefault(); R.menu(); }
  }, true);

  document.addEventListener("DOMContentLoaded", function () {
    // إظهار التحديد بوضوح على التلفاز (يُرى من بعيد)
    var st = document.createElement("style");
    st.textContent = "html.tv :focus{outline:4px solid #d9b562 !important;outline-offset:3px;box-shadow:0 0 0 8px rgba(217,181,98,.28) !important}" +
      "html.tv .star-menu a,html.tv .star-menu button{font-size:max(1em,3vh)}";
    document.head.appendChild(st);
    // في صفحات النماذج على التلفاز: أول عنصر يأخذ التحديد ليعمل الريموت فوراً
    if (S.tv && !$("starBtn") && !document.querySelector(":focus")) { var f = focusables()[0]; if (f) f.focus(); }
  });
})();
