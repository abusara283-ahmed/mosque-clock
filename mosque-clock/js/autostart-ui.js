/*
 * الإصدار ٨: قسم «التشغيل التلقائي عند تشغيل الجهاز» في صفحة الإعدادات.
 * - داخل تطبيق أندرويد: أزرار أصلية عبر الجسر window.AndroidClock.
 * - من server.js على جهاز الشاشة (ويندوز أو لينكس): تفعيل وإيقاف بلمسة عبر /api/autostart.
 * - غير ذلك: يُبرز طريقة جهازك ويشرح ملف التثبيت المناسب.
 */
(function () {
  function $(id) { return document.getElementById(id); }
  if (!$("autoSec")) return;
  var ua = navigator.userAgent || "";
  var plat = /Tizen|Web0S|webOS|SMART-TV|SmartTV|NetCast|HbbTV/i.test(ua) ? "tv" :
    /Android/i.test(ua) ? "android" : /Windows/i.test(ua) ? "windows" : /Linux|X11|CrOS/i.test(ua) ? "linux" : "";
  var NAMES = { windows: "ويندوز", linux: "لينكس / Raspberry Pi", android: "أندرويد", tv: "تلفاز ذكي" };

  function status(cls, text) {
    var el = $("autoStatus");
    el.className = "status" + (cls ? " " + cls : "");
    $("autoStatusTxt").textContent = text;
  }
  function mark(p) {
    document.querySelectorAll("#platCards > div").forEach(function (d) { d.classList.toggle("here", d.dataset.p === p); });
  }
  mark(plat);

  // ——— داخل تطبيق أندرويد ———
  var A = window.AndroidClock;
  if (A && typeof A.status === "function") {
    mark("android");
    var refresh = function () {
      var s = {};
      try { s = JSON.parse(A.status()); } catch (e) {}
      $("androidBtns").hidden = false;
      $("andBoot").checked = !!s.bootStart;
      $("andFront").checked = !!s.keepFront;
      $("andOverlay").textContent = (s.overlay ? "✓ " : "١. ") + "السماح بالظهور فوق التطبيقات";
      $("andBattery").textContent = (s.batteryIgnored ? "✓ " : "٢. ") + "استثناء من توفير البطارية";
      $("andHome").textContent = (s.isHome ? "✓ الشاشة الرئيسية" : "٣. جعلها الشاشة الرئيسية (اختياري)");
      $("andPin").textContent = s.pinned ? "✓ الشاشة مثبّتة على الساعة (اضغط للإلغاء)" : "تثبيت الشاشة على الساعة (kiosk)";
      $("andOwner").hidden = !s.deviceOwner;
      var MODES = { screen: "شاشة المسجد", phone: "جوال المصلي", tablet: "التابلت" };
      var info = $("andInfo"); info.hidden = false;
      info.textContent = "الوضع: " + (MODES[s.mode] || s.mode) + (s.modeSetting === "auto" ? " (تلقائي)" : "") + " • الجهاز: " + (s.model || "") +
        " • أندرويد " + (s.release || "") + " • WebView " + (s.webview || "?") + (s.webviewOk === false ? " (قديم: حدّثه من المتجر)" : "") +
        " • التطبيق " + (s.version || "") + (s.flavor === "play" ? " (المتجر)" : "") + (s.deviceOwner ? " • مالك الجهاز ✓" : "");
      if (s.mode !== "screen") {
        status("off", "هذا الجهاز على وضع «" + (MODES[s.mode] || s.mode) + "»: التشغيل التلقائي والعودة للأمام يعملان في وضع «شاشة المسجد» فقط. غيّر الوضع بالزر أدناه.");
        return;
      }
      var ok = s.bootStart && (s.overlay || s.isHome);
      status(ok ? "on" : "off", ok ? "تطبيق أندرويد: تشتغل الساعة عند الإقلاع وتظهر فوق التطبيقات" + (s.tv ? " (صندوق تلفاز)" : "") + "."
        : "تطبيق أندرويد: أكمل الخطوات أدناه ليعمل التشغيل التلقائي. " + (!s.overlay && !s.isHome ? "ينقص إذن «الظهور فوق التطبيقات» أو جعلها الشاشة الرئيسية." : ""));
    };
    $("andOverlay").onclick = function () { A.requestOverlay(); };
    $("andBattery").onclick = function () { A.requestIgnoreBattery(); };
    $("andHome").onclick = function () { A.makeHome(); };
    $("andUrl").onclick = function () {
      var cur = A.getStartUrl ? A.getStartUrl() : "";
      var u = prompt("رابط الساعة على خادم المسجد، مثل http://192.168.1.10:8080/\nاتركه فارغاً لاستخدام الساعة المضمّنة في التطبيق:", cur || "");
      if (u !== null) A.setStartUrl(u);
    };
    $("andVendor").onclick = function () { A.openVendorAutostart(); };
    $("andPin").onclick = function () {
      var s = {}; try { s = JSON.parse(A.status()); } catch (e) {}
      if (s.pinned) { A.setPinned(false); setTimeout(refresh, 800); return; }
      if (s.deviceOwner || confirm("تثبيت الشاشة يمنع الخروج من الساعة بأزرار النظام.\nسيطلب أندرويد تأكيداً. وللإلغاء: اضغط مطوّلاً على «رجوع» و«نظرة عامة» معاً، أو من هنا.\nللقفل الكامل بلا تأكيد انظر «وضع مالك الجهاز» في دليل التطبيق.")) { A.setPinned(true); setTimeout(refresh, 1200); }
    };
    $("andMode").onclick = function () { location.href = "start.html?choose=1"; };
    $("andOwner").onclick = function () { if (confirm("إلغاء وضع «مالك الجهاز»؟ يعود الجهاز عادياً ويمكن حذف التطبيق.")) { A.clearDeviceOwner(); setTimeout(refresh, 1000); } };
    addEventListener("androidstatus", refresh);
    $("andExit").onclick = function () { if (confirm("إغلاق ساعة المسجد؟ لن تعود للأمام حتى إعادة تشغيل الجهاز أو فتحها يدوياً.")) A.exitApp(); };
    $("andBoot").onchange = function () { A.setBootStart(this.checked); refresh(); };
    $("andFront").onchange = function () { A.setKeepFront(this.checked); refresh(); };
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refresh(); });
    refresh();
    return;
  }

  // ——— من server.js على جهاز الشاشة ———
  var pinEl = $("autoPin");
  try { pinEl.value = localStorage.getItem("mosqueClock.pin") || ""; } catch (e) {}
  function describe(s) {
    if (!s || s.supported === false) return null;
    var where = NAMES[s.platform] || s.platform;
    if (s.installed) {
      var how = s.method === "task" ? "مهمة مجدولة" : s.method === "startup" ? "مجلد بدء التشغيل" : s.server && s.server !== "none" ? "خدمة systemd وسطح المكتب" : "سطح المكتب";
      return { cls: "on", text: "مفعّل على جهاز الشاشة (" + where + "، " + how + ")" + (s.running ? " • الساعة تعمل الآن بوضع العرض" : "") + (s.browser ? " • المتصفح: " + s.browser : "") };
    }
    return { cls: "off", text: "غير مفعّل على جهاز الشاشة (" + where + "). اضغط «تفعيل» ليُثبَّت بلمسة واحدة." + (s.browser ? "" : " تنبيه: لم يُعثر على Chrome أو Edge أو Chromium.") };
  }
  function load() {
    return fetch("api/autostart", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      var d = describe(s);
      if (!d) throw new Error("unsupported");
      $("autoBtns").hidden = false;
      $("autoOn").hidden = !!s.installed;
      $("autoOff").hidden = !s.installed;
      mark(s.platform);
      status(d.cls, d.text);
    });
  }
  function act(action) {
    try { localStorage.setItem("mosqueClock.pin", pinEl.value); } catch (e) {}
    status("", action === "enable" ? "جارٍ التفعيل على جهاز الشاشة…" : "جارٍ الإيقاف…");
    fetch("api/autostart", { method: "POST", headers: { "Content-Type": "application/json", "X-Pin": pinEl.value }, body: JSON.stringify({ action: action }) })
      .then(function (r) { return r.json().then(function (j) { j.http = r.status; return j; }); })
      .then(function (j) {
        if (j.http === 403) return status("off", "الرمز السري غير صحيح. هو نفسه CLOCK_PIN الذي شُغّل به الخادم.");
        if (!j.ok) return status("off", "تعذّر التنفيذ على الجهاز. شغّل ملف التثبيت يدوياً (انظر أدناه). " + (j.log ? "التفاصيل: " + j.log.slice(-160) : ""));
        load();
      }).catch(function () { status("off", "تعذّر الاتصال بالخادم."); });
  }
  $("autoOn").onclick = function () { act("enable"); };
  $("autoOff").onclick = function () { if (confirm("إيقاف التشغيل التلقائي للساعة على جهاز الشاشة؟")) act("disable"); };

  var viaServer = /^https?:$/.test(location.protocol) && !!window.fetch;
  (viaServer ? load() : Promise.reject()).catch(function () {
    var tip = plat === "windows" ? "على هذا الحاسوب: انقر مرتين على autostart\\windows\\install-autostart.bat" :
      plat === "linux" ? "على هذا الجهاز: شغّل في الطرفية  bash autostart/linux/install.sh" :
      plat === "android" ? "على هذا الجهاز: ثبّت تطبيق ساعة المسجد (APK) من مجلد android" :
      plat === "tv" ? "التلفاز لا يسمح بالتشغيل التلقائي لصفحة ويب؛ استخدم صندوق أندرويد أو Raspberry Pi" : "اختر طريقة جهازك أدناه";
    status("", tip + ". (عند فتح الإعدادات من جهاز الشاشة عبر server.js يظهر هنا زر تفعيل بلمسة.)");
  });
})();
