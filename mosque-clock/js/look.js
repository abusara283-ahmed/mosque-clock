/*
 * المظهر (الإصدار ٥): الخلفيات وتبديلها باللمس، أشكال الساعة، توزيعات الشاشة، زر النجمة،
 * وضع الجمعة، التحكم من الجوال (QR + مزامنة مع server.js)، والمعاينة الحية من صفحة الإعدادات.
 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var LAYOUTS = ["side", "center", "bar", "cards"];
  var STYLES = ["digital", "analog", "ring"];
  var FONTS = { kufi: 'var(--font-head)', naskh: 'var(--font-text)', light: 'var(--font-head)', system: '"Segoe UI", Tahoma, Arial, sans-serif' };
  var params = new URLSearchParams(location.search);
  var PREVIEW = params.get("preview") === "1";
  var S = null, last = null, bgEl;

  function save() { if (!PREVIEW) ClockConfig.save(S); }
  function layoutOf(s) { return LAYOUTS.indexOf(s.layout) >= 0 ? s.layout : "side"; } // "mihrab" (الإصدار ٤) = الجانبي

  // ——— التطبيق الكامل للإعدادات ———
  var curLayout = null, rotOffset = 0, rotAt = Date.now();
  function setLayout(l) {
    if (curLayout === l) return;
    curLayout = l;
    document.body.dataset.layout = l;
    var box = $("clockBox"), target = l === "side" ? $("archBox") : $("board");
    if (box.parentNode !== target) target.appendChild(box);
  }
  function apply(s) {
    S = s;
    rotOffset = 0; rotAt = Date.now();
    setLayout(layoutOf(S));
    var b = document.body.style;
    b.setProperty("--clock-font", FONTS[S.clockFont] || FONTS.kufi);
    var w = String(S.clockWeight || "auto");
    b.setProperty("--clock-weight", /^[1-9]00$/.test(w) ? w : S.clockFont === "light" ? "300" : S.clockFont === "naskh" ? "700" : "800");
    if (S.clockColor) b.setProperty("--clock-color", S.clockColor); else b.removeProperty("--clock-color");
    $("clockBox").dataset.style = STYLES.indexOf(S.clockStyle) >= 0 ? S.clockStyle : "digital";
    $("clockBox").classList.toggle("no-sec", S.showSeconds === false);
    placeAmpm(S.ampmPos);
    sizesFor = null; applySizes();
    bgEl.style.setProperty("--bg-dim", String(Math.max(0, Math.min(.9, +S.bgDim || 0))));
    bgEl.style.setProperty("--bg-blur", Math.max(0, Math.min(30, +S.bgBlur || 0)) + "px");
    analogFor = null; bgUpdated = 0;
    if (last) tick(last);
  }

  // ——— الإصدار ١٠: موضع ص/م وأحجام العناصر لكل اتجاه شاشة ———
  function placeAmpm(pos) {
    var ap = $("ampm"), clk = $("clockBox").querySelector(".clock"); if (!ap || !clk) return;
    if (pos === "below") { if (ap.parentNode === clk) clk.parentNode.insertBefore(ap, clk.nextSibling); }
    else if (pos === "right") clk.appendChild(ap);
    else clk.insertBefore(ap, clk.firstChild);
    ap.classList.toggle("below", pos === "below");
  }
  var SIZE_KEYS = { clock: "--clock-scale", analog: "--analog-scale", name: "--name-scale", date: "--date-scale", hero: "--hero-scale", prayers: "--prayers-scale", ticker: "--ticker-scale" };
  function clampSize(v, lo, hi) { v = +v; return isFinite(v) && v > 0 ? Math.max(lo, Math.min(hi, v)) : 1; }
  var sizesFor = null;
  function applySizes() {
    if (!S) return;
    var orient = document.body.classList.contains("portrait") ? "portrait" : "landscape";
    var z = (S.sizes && S.sizes[orient]) || {}, key = orient + JSON.stringify(z) + S.clockScale;
    if (key === sizesFor) return;
    sizesFor = key;
    var b = document.body.style;
    Object.keys(SIZE_KEYS).forEach(function (k) {
      var v = clampSize(z[k] == null ? 1 : z[k], .3, 3);
      if (k === "clock") v = clampSize(v * clampSize(S.clockScale || 1, .5, 2), .3, 3); // clockScale من القوالب القديمة يبقى مضاعفاً
      b.setProperty(SIZE_KEYS[k], String(Math.round(v * 1000) / 1000));
    });
  }

  // ——— الخلفيات ———
  var bgUpdated = 0, bgWanted = null;
  function bgContext(c) {
    var hj = window.ClockSeasons && ClockSeasons.hijri(c.d, c.S.hijriOffset);
    return { hijri: hj, friday: c.friday, min: Math.floor(c.ns / 60), t: c.t, period: ClockSchedule.period(Math.floor(c.ns / 60), c.t) };
  }
  function renderBg(c) {
    var id = S.background === "auto" ? ClockBackgrounds.auto(bgContext(c)) : S.background;
    if (id !== bgWanted || ClockBackgrounds.current() !== id) {
      var shown = ClockBackgrounds.show(bgEl, id);
      if (shown.id !== bgWanted) bgUpdated = 0;
      bgWanted = id;
    }
    if (Date.now() - bgUpdated > 10000) {
      bgUpdated = Date.now();
      var hj = window.ClockSeasons && ClockSeasons.hijri(c.d, S.hijriOffset);
      ClockBackgrounds.update(bgEl, ClockSky.sun(c.d, S.latitude, S.longitude, S.timezone), hj && hj.d);
    }
  }
  function bgCycle(dir) {
    var ids = ["auto"].concat(ClockBackgrounds.list().map(function (b) { return b.id; }));
    var i = ids.indexOf(S.background); if (i < 0) i = 0;
    S.background = ids[(i + dir + ids.length) % ids.length];
    save(); bgWanted = null;
    var b = ClockBackgrounds.find(S.background);
    toast(S.background === "auto" ? "الخلفية: تلقائية حسب الوقت والمناسبة" : "الخلفية: " + (b ? b.name : ""));
    if (last) tick(last);
  }
  var toastTimer;
  function toast(msg) {
    var el = $("bgToast"); el.textContent = msg; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2400);
  }

  // ——— أشكال الساعة ———
  var NS = "http://www.w3.org/2000/svg", analogFor = null;
  function buildAnalog(c) {
    var key = (c.S.arabicDigits ? "a" : "l");
    if (analogFor === key) return;
    analogFor = key;
    var s = '<circle class="a-face" r="104"/><circle class="a-rim" r="104"/><circle class="a-rim2" r="96"/>';
    for (var i = 0; i < 60; i++) {
      var maj = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = maj ? 84 : 89, r2 = 93;
      s += '<line class="a-tick' + (maj ? " maj" : "") + '" x1="' + (r1 * Math.sin(a)).toFixed(2) + '" y1="' + (-r1 * Math.cos(a)).toFixed(2) + '" x2="' + (r2 * Math.sin(a)).toFixed(2) + '" y2="' + (-r2 * Math.cos(a)).toFixed(2) + '"/>';
    }
    for (i = 1; i <= 12; i++) {
      var b = i * 30 * Math.PI / 180;
      s += '<text class="a-num" x="' + (70 * Math.sin(b)).toFixed(1) + '" y="' + (-70 * Math.cos(b) + 7).toFixed(1) + '">' + c.digits(i) + "</text>";
    }
    // نجمة ثمانية في المركز وعلامة الصلاة القادمة على الإطار
    var st = "";
    for (i = 0; i < 16; i++) { var q = i * Math.PI / 8, rr = i % 2 ? 13 : 24; st += (i ? "L" : "M") + (rr * Math.sin(q)).toFixed(1) + " " + (-rr * Math.cos(q)).toFixed(1); }
    s += '<path class="a-star" d="' + st + 'Z"/>';
    s += '<g class="a-nx" id="aNx"><path d="M0 -101L6 -112L-6 -112Z"/></g>';
    s += '<g id="aH"><path class="a-hand h" d="M-4.5 10L-3 -50L0 -56L3 -50L4.5 10Z"/></g>';
    s += '<g id="aM"><path class="a-hand m" d="M-3 12L-2 -78L0 -84L2 -78L3 12Z"/></g>';
    s += '<g id="aS"><line class="a-hand s" x1="0" y1="18" x2="0" y2="-88"/><circle class="a-hand s" cy="-70" r="3.2"/></g><circle class="a-cap" r="5"/>';
    $("analog").innerHTML = s;
  }
  function renderClock(c) {
    applySizes();
    var style = $("clockBox").dataset.style;
    if (style === "analog") {
      buildAnalog(c);
      var d = c.d, sec = d.getSeconds(), m = d.getMinutes() + sec / 60, h = (d.getHours() % 12) + m / 60;
      $("aH").setAttribute("transform", "rotate(" + (h * 30).toFixed(2) + ")");
      $("aM").setAttribute("transform", "rotate(" + (m * 6).toFixed(2) + ")");
      $("aS").setAttribute("transform", "rotate(" + (sec * 6) + ")");
      var at = c.nx.next.at / 60; // دقائق
      $("aNx").setAttribute("transform", "rotate(" + (((at / 60) % 12) * 30).toFixed(2) + ")");
    } else if (style === "ring") {
      $("ringFg").style.strokeDashoffset = (628.3 * (1 - c.nx.progress)).toFixed(1);
      var lb = $("ringLabel");
      var k = c.nx.next.key === "dhuhr" && c.friday ? "jumuah" : c.nx.next.key;
      var txt = c.NAMES[k] + " بعد " + c.fmtDur(c.nx.left);
      if (lb.textContent !== txt) lb.textContent = txt;
    }
  }

  // ——— وضع الجمعة: إبراز موعد الخطبة قبلها بمدة ———
  function renderFriday(c) {
    var lead = (+c.S.fridayLeadMinutes || 0) * 60, at = c.t.dhuhr * 60;
    var on = c.friday && lead > 0 && c.ns < at && c.ns >= at - lead;
    document.body.classList.toggle("friday-mode", on);
    var fb = $("fridayBanner");
    if (!on) { fb.hidden = true; return; }
    fb.hidden = false;
    var txt = "يوم الجمعة • أذان الخطبة " + c.fmtMinText(c.t.dhuhr) + " • بعد " + c.fmtDur(at - c.ns);
    // الإصدار ٧: موضوع الخطبة واسم الخطيب بالتناوب مع الموعد
    var topic = String(c.S.khutbaTopic || "").trim(), khatib = String(c.S.khatib || "").trim();
    if ((topic || khatib) && Math.floor(Date.now() / 8000) % 2) txt = (topic ? "خطبة اليوم: " + topic : "") + (topic && khatib ? " • " : "") + (khatib ? "الخطيب: " + khatib : "");
    if (fb.textContent !== txt) fb.textContent = txt;
    $("heroLabel").textContent = "خطبة الجمعة" + (c.t.jumuahFixed ? " (موعد ثابت)" : "");
  }

  // ——— شاشة الإعلانات: ساعة مصغّرة وشريط تقدّم ———
  function renderAnn(c) {
    if (!c.st || c.st.name !== "ann") return;
    $("ovMiniTime").textContent = $("hm").textContent + ($("ampm").textContent ? " " + $("ampm").textContent : "");
    var k = c.nx.next.key === "dhuhr" && c.friday ? "jumuah" : c.nx.next.key;
    $("ovMiniNext").textContent = c.NAMES[k] + " بعد " + c.fmtDur(c.nx.left);
    $("ovProg").style.width = (c.annLeft * 100).toFixed(1) + "%";
  }

  // ——— تدوير التوزيعات ———
  function rotate(c) {
    var every = +S.layoutRotateMinutes || 0;
    if (!every || c.st) return;
    if (Date.now() - rotAt >= every * 60000) {
      rotAt = Date.now(); rotOffset++;
      var base = LAYOUTS.indexOf(layoutOf(S));
      setLayout(LAYOUTS[(base + rotOffset) % LAYOUTS.length]);
    }
  }

  function tick(c) {
    last = c;
    if (!S) return;
    renderBg(c);
    renderClock(c);
    renderFriday(c);
    renderAnn(c);
    rotate(c);
  }

  // ——— زر النجمة: يتوهّج ثم يخفت، ويعود عند أي لمسة أو حركة ———
  var awakeTimer, menuTimer;
  function wake() {
    document.body.classList.add("awake");
    clearTimeout(awakeTimer);
    awakeTimer = setTimeout(function () { if ($("starMenu").hidden) document.body.classList.remove("awake"); }, 7000);
  }
  function menu(open) {
    var m = $("starMenu");
    m.hidden = !open;
    $("starBtn").classList.toggle("open", open);
    clearTimeout(menuTimer);
    if (open) menuTimer = setTimeout(function () { menu(false); }, 20000);
  }
  function act(a) {
    if (a === "bg") bgCycle(1);
    else if (a === "clock") {
      S.clockStyle = STYLES[(STYLES.indexOf($("clockBox").dataset.style) + 1) % STYLES.length]; save(); apply(S);
      toast({ digital: "الساعة: رقمية", analog: "الساعة: بعقارب", ring: "الساعة: حلقة الوقت المتبقي" }[S.clockStyle]);
    } else if (a === "layout") {
      S.layout = LAYOUTS[(LAYOUTS.indexOf(layoutOf(S)) + 1) % LAYOUTS.length]; save(); apply(S);
      toast({ side: "التوزيع: نافذة المحراب", center: "التوزيع: الساعة في المنتصف", bar: "التوزيع: شريط سفلي", cards: "التوزيع: بطاقات" }[S.layout]);
    } else if (a === "qr") showQR();
    else if (a === "qrapp") showQR("m.html");
    else if (a === "fs") { var de = document.documentElement; if (de.requestFullscreen) de.requestFullscreen().catch(function () {}); }
  }

  // ——— التحكم من الجوال ———
  function httpServed() { return /^https?:$/.test(location.protocol) && !window.MC_EMBEDDED; } // الإصدار ٩: داخل تطبيق أندرويد لا خادم خلف الصفحة
  // page: settings.html (التحكم) أو m.html (تطبيق المصلين للجوال)
  function showQR(page) {
    menu(false);
    var app = page === "m.html";
    page = app ? page : "settings.html";
    var p = $("qrPanel"); p.hidden = false;
    $("qrCode").innerHTML = ""; $("qrUrl").textContent = "";
    if ($("qrTitle")) $("qrTitle").textContent = app ? "تطبيق المصلين للجوال" : "التحكم من الجوال";
    var RA = appRemote(), info = null;
    if (RA && !app && typeof RA.remoteInfo === "function") { try { info = JSON.parse(RA.remoteInfo()); } catch (e) {} }
    if (info && info.enabled && info.urls && info.urls.length) { // الإصدار ١٠: لوحة التحكم من الجوال مدمجة في التطبيق
      var url = info.urls[0].replace(/\/$/, "") + "/remote.html";
      $("qrUrl").textContent = url;
      if (window.qrcode) { var q0 = qrcode(0, "M"); q0.addData(url); q0.make(); $("qrCode").innerHTML = q0.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); }
      $("qrHint").innerHTML = "امسح الرمز بجوال الإمام وهو على شبكة الواي فاي نفسها.<br>الرمز السري: <b dir=\"ltr\" style=\"font-size:1.6em;letter-spacing:.15em\">" + String(info.pin).replace(/[^0-9]/g, "") + "</b><br>يعدّل منه الإعلانات ومواعيد الإقامة وموضوع الخطبة، وتصل للشاشة خلال ١٠ ثوانٍ.";
      return;
    }
    if (RA && !app && info && !info.enabled) {
      $("qrHint").innerHTML = "التحكم من الجوال متوقف. فعّله من: الإعدادات ← «التحكم من الجوال».";
      return;
    }
    if (window.MC_EMBEDDED) { // الإصدار ٩: داخل تطبيق أندرويد
      $("qrHint").innerHTML = app ? "على جوال المصلي: ثبّت تطبيق «ساعة المسجد» نفسه واختر «جوال المصلي»؛ يعرض المواقيت ويُنبّه للأذان والتطبيق مغلق."
        : "عدّل الإعدادات من هنا بالريموت أو اللمس: القائمة ← الإعدادات.<br>وللتحكم من جوال آخر عبر الواي فاي: شغّل <b dir=\"ltr\">node server.js</b> على حاسوب في المسجد، ثم ضع عنوانه في «رابط خادم المسجد» بإعدادات التطبيق.";
      return;
    }
    if (!httpServed()) {
      $("qrHint").innerHTML = "الساعة مفتوحة من ملف مباشرة. للتحكم من الجوال شغّل على جهاز الشاشة:<br><b dir=\"ltr\">node server.js</b><br>ثم افتح الساعة من العنوان الذي يظهر.";
      return;
    }
    $("qrHint").textContent = app ? "امسح الرمز ثم ثبّت التطبيق على الشاشة الرئيسية: مواقيت المسجد وإقامته، الأذكار، المصحف والتفسير، والقبلة."
      : "امسح الرمز بكاميرا الجوال وهو على نفس شبكة الواي فاي، وستحتاج الرمز السري عند الحفظ.";
    fetch("api/info").then(function (r) { return r.json(); }).catch(function () { return {}; }).then(function (j) {
      var base = (j.urls && j.urls[0]) || location.href.replace(/[?#].*$/, "").replace(/[^/]*$/, "");
      var url = base.replace(/\/$/, "") + "/" + page;
      $("qrUrl").textContent = url;
      if (window.qrcode) {
        var q = qrcode(0, "M"); q.addData(url); q.make();
        $("qrCode").innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
      }
    });
  }
  // مزامنة: الجوال يحفظ في الخادم، والشاشة تسحب التغييرات كل ٢٠ ثانية
  // الإصدار ١٠: داخل تطبيق أندرويد الخادم جزء من التطبيق نفسه، والصفحة تقرأ منه عبر الجسر AndroidClock
  var REV = "mosqueClock.remoteRev";
  function appRemote() { var A = window.AndroidClock; return window.MC_EMBEDDED && A && typeof A.remoteSettings === "function" ? A : null; }
  function getSettings() {
    var A = appRemote();
    if (A) { try { return Promise.resolve(JSON.parse(A.remoteSettings() || "null") || { rev: 0, settings: null }); } catch (e) { return Promise.resolve(null); } }
    return fetch("api/settings", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; });
  }
  function pull() {
    getSettings().then(function (j) {
      if (!j) return;
      if (!j.rev || !j.settings) { seed(); return; }
      var mine = null; try { mine = localStorage.getItem(REV); } catch (e) {}
      if (String(j.rev) === mine) return;
      try { localStorage.setItem(REV, String(j.rev)); } catch (e) {}
      var n = ClockConfig.merge(window.CLOCK_DEFAULTS, j.settings);
      if (S && S.sizes) n.sizes = S.sizes; // الإصدار ١٠: الأحجام خاصة بكل شاشة
      ClockConfig.save(n);
      bgWanted = null;
      if (window.ClockApp) ClockApp.setSettings(n);
      toast("وصلت إعدادات جديدة من الجوال");
    }).catch(function () {});
  }

  var seeded = false;
  function seed() {
    if (seeded) return; seeded = true;
    var A = appRemote();
    if (A) { try { var rv = A.remoteSeed(JSON.stringify(S)); if (rv) localStorage.setItem(REV, String(rv)); } catch (e) {} return; }
    fetch("api/settings", { method: "POST", headers: { "Content-Type": "application/json", "X-Seed": "1" }, body: JSON.stringify(S) })
      .then(function (r) { return r.json(); }).then(function (j) { if (j && j.rev) try { localStorage.setItem(REV, String(j.rev)); } catch (e) {} })
      .catch(function () {});
  }

  function init(s) {
    bgEl = $("bg");
    // عنصر نص الحلقة
    var dg = $("clockBox").querySelector(".digital");
    if (!$("ringLabel")) { var rl = document.createElement("div"); rl.id = "ringLabel"; rl.className = "ring-label"; dg.appendChild(rl); }
    apply(s);
    ClockBackgrounds.loadCustom().then(function () { bgWanted = null; if (last) tick(last); });

    $("tzNext").addEventListener("click", function (e) { e.stopPropagation(); bgCycle(1); });
    $("tzPrev").addEventListener("click", function (e) { e.stopPropagation(); bgCycle(-1); });
    $("starBtn").addEventListener("click", function (e) { e.stopPropagation(); wake(); menu($("starMenu").hidden); });
    $("starMenu").addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      e.stopPropagation(); act(b.dataset.act);
    });
    $("qrClose").addEventListener("click", function () { $("qrPanel").hidden = true; });
    document.addEventListener("click", function () { if (!$("starMenu").hidden) menu(false); });
    ["mousemove", "touchstart", "pointerdown", "keydown"].forEach(function (ev) { addEventListener(ev, wake, { passive: true }); });
    addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") bgCycle(1);
      if (e.key === "ArrowRight") bgCycle(-1);
      if (e.key === "c" || e.key === "ؤ") act("clock");
      if (e.key === "l" || e.key === "م") act("layout");
    });
    wake();

    if (PREVIEW) {
      document.body.classList.add("preview");
      addEventListener("message", function (e) {
        if (e.source !== parent || !e.data || e.data.type !== "settings") return;
        bgWanted = null;
        ClockApp.setSettings(ClockConfig.merge(window.CLOCK_DEFAULTS, e.data.S));
      });
      if (parent !== window) parent.postMessage({ type: "preview-ready" }, "*");
    } else if (appRemote() && !params.get("sim")) {
      pull(); setInterval(pull, 10000);
    } else if (httpServed() && window.fetch && !params.get("sim")) { // لا مزامنة أثناء المحاكاة
      pull(); setInterval(pull, 20000);
    }
  }

  window.ClockLook = { init: init, apply: apply, tick: tick, LAYOUTS: LAYOUTS, STYLES: STYLES };
})();
