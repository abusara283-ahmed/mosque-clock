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
    curLayout = l; sizesFor = null;
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
    document.body.dataset.ampm = pos === "right" || pos === "below" ? pos : "left";
  }
  var SIZE_KEYS = { clock: "--clock-scale", analog: "--analog-scale", name: "--name-scale", date: "--date-scale", hero: "--hero-scale", prayers: "--prayers-scale", ticker: "--ticker-scale" };
  function clampSize(v, lo, hi) { v = +v; return isFinite(v) && v > 0 ? Math.max(lo, Math.min(hi, v)) : 1; }
  var sizesFor = null, fitReport = null;
  function requestedSizes() {
    var orient = document.body.classList.contains("portrait") ? "portrait" : "landscape";
    var z = (S.sizes && S.sizes[orient]) || {}, req = {};
    Object.keys(SIZE_KEYS).forEach(function (k) {
      var v = clampSize(z[k] == null ? 1 : z[k], .3, 3);
      if (k === "clock") v = clampSize(v * clampSize(S.clockScale || 1, .5, 2), .3, 3); // clockScale من القوالب القديمة يبقى مضاعفاً
      req[k] = Math.round(v * 1000) / 1000;
    });
    return { orient: orient, req: req };
  }
  function setSizeVars(eff) {
    var b = document.body.style;
    Object.keys(SIZE_KEYS).forEach(function (k) { b.setProperty(SIZE_KEYS[k], String(eff[k])); });
  }
  // الإصدار ١١: قياس العناصر الظاهرة لكشف التداخل
  function rectOf(el) {
    if (!el || el.hidden || !el.getClientRects().length) return null;
    var cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") return null;
    var r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
  }
  // المستطيل مع ما يفيض من أبنائه (بطاقات الصلوات قد تفيض عن صندوقها)
  function unionOf(el) {
    // صندوق مضغوط إلى ارتفاع صفر وأبناؤه يفيضون: نبدأ من موضعه الخام ولا نتجاهله
    if (!el || el.hidden || !el.getClientRects().length || getComputedStyle(el).display === "none") return null;
    var b = el.getBoundingClientRect(), u = { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    [].forEach.call(el.children, function (c) {
      var r = rectOf(c); if (!r) return;
      u.left = Math.min(u.left, r.left); u.top = Math.min(u.top, r.top); u.right = Math.max(u.right, r.right); u.bottom = Math.max(u.bottom, r.bottom);
    });
    return u;
  }
  function measureLayout() {
    var box = $("clockBox"), style = box.dataset.style, q = function (s) { return document.querySelector(s); };
    var rects = {
      clock: rectOf(box.querySelector(".digital")),
      analog: style === "analog" ? rectOf($("analog")) : style === "ring" ? rectOf($("ring")) : null,
      name: rectOf(q(".top .mosque")), date: rectOf(q(".top .dates")), chips: rectOf(q(".top .chips")), event: rectOf($("eventCard")),
      ticker: rectOf($("ticker")), hero: unionOf($("hero")), prayers: unionOf($("prayers")), dayline: rectOf($("dayline")), slide: rectOf($("slide"))
    };
    var vw = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    var inArch = box.parentNode === $("archBox"), portrait = document.body.classList.contains("portrait");
    // العمودي: لوحة الأرقام تمتد خارج العقد بعرض النافذة، فحدّها النافذة كلها
    var cb = inArch ? rectOf(portrait && style !== "analog" && style !== "ring" ? $("archBox").parentNode : $("archBox")) : vw;
    var bounds = {};
    Object.keys(rects).forEach(function (k) { bounds[k] = vw; });
    bounds.clock = bounds.analog = cb || vw;
    // الأرقام في لوحة العقد الأفقية تبقى داخل لوحتها (لا تعبر إطار المحراب الذهبي)
    if (inArch && !portrait && style !== "analog" && style !== "ring") bounds.clock = rectOf(box) || bounds.clock;
    var minH = {}, m = Math.min(innerWidth, innerHeight) * 0.06;
    if (style === "analog" || style === "ring") minH.analog = m * 2; else minH.clock = m; // الساعة لا تختفي
    if (style === "analog") delete rects.clock;
    // أسطر مقصوصة داخل بطاقاتها (overflow مخفي): نقيس الأسطر نفسها لأن ارتفاع الخط العربي يضخّم scrollHeight
    var clip = [];
    // يشمل البطاقة المضغوطة (حتى ارتفاع صفر) التي يفيض نصها فوق ما تحتها وإن لم يكن مخفياً
    function cut(e) {
      if (!e || !e.offsetParent) return false;
      var pr = e.getBoundingClientRect(), hid = getComputedStyle(e).overflow !== "visible";
      return [].some.call(e.children, function (c) {
        var r = c.getBoundingClientRect(); if (!r.height || getComputedStyle(c).position === "absolute") return false;
        var tol = hid ? Math.max(3, r.height * 0.08) : Math.max(6, r.height * 0.25); // هامش لارتفاع سطر الخط العربي
        return r.bottom > pr.bottom + tol || r.top < pr.top - tol;
      });
    }
    if ([].some.call(document.querySelectorAll("#prayers .p"), cut)) clip.push("prayers");
    if (cut($("hero"))) clip.push("hero");
    var active = ["name", "date", "hero", "prayers", "ticker"];
    if (style !== "analog") active.push("clock");
    if (style === "analog" || style === "ring") active.push("analog");
    return { rects: rects, bounds: bounds, minH: minH, clip: clip, active: active };
  }
  // force = "check": فحص دوري خفيف (قياس واحد من النتيجة الحالية؛ يُكمل التصغير فقط إن ظهر تداخل)
  // force = true: حل كامل من الأحجام المطلوبة (يسترد ما اتسع له المكان)
  var fullFitAt = 0;
  function applySizes(force) {
    if (!S) return;
    var r = requestedSizes(), key = r.orient + JSON.stringify(r.req) + curLayout + $("clockBox").dataset.style + S.showSeconds + S.ampmPos + innerWidth + "x" + innerHeight + S.clockFont + S.clockWeight;
    if (key === sizesFor && !force) return;
    var warm = key === sizesFor && force === "check" && fitReport && Date.now() - fullFitAt < 5 * 60000;
    sizesFor = key;
    if (!window.ClockFit || S.smartFit === false) { setSizeVars(r.req); fitReport = null; return; }
    var prev = fitReport;
    fitReport = ClockFit.solve(r.req, setSizeVars, measureLayout, 120, warm ? { start: prev.effective } : null);
    if (!warm) fullFitAt = Date.now();
    fitReport.orient = r.orient;
    window.__fitReport = fitReport;
    if (PREVIEW && parent !== window) parent.postMessage({ type: "fit", report: { requested: fitReport.requested, effective: fitReport.effective, reduced: fitReport.reduced, issues: fitReport.issues.length, orient: r.orient } }, "*");
  }

  // ——— الخلفيات ———
  var bgUpdated = 0, bgWanted = null;
  function bgContext(c) {
    var hj = window.ClockSeasons && ClockSeasons.hijri(c.d, c.S.hijriOffset);
    return { hijri: hj, friday: c.friday, min: Math.floor(c.ns / 60), t: c.t, period: ClockSchedule.period(Math.floor(c.ns / 60), c.t) };
  }
  // ——— الإصدار ١١: زخرفة هندسية متحركة ببطء حسب المناسبة (رمضان/الجمعة/العيد) ———
  // طبقة خفيفة جداً خلف المحتوى؛ تتوقف في وضع الأداء الخفيف وأثناء الصلاة (الخشوع)
  var patternFor = null;
  function patternSeason(c) {
    var h = window.ClockSeasons && ClockSeasons.hijri(c.d, S.hijriOffset);
    if (h && ((h.m === 10 && h.d <= 3) || (h.m === 12 && h.d >= 10 && h.d <= 13))) return "eid";
    if (h && h.m === 9) return "ramadan";
    if (c.friday) return "friday";
    return "";
  }
  function starTile(id, col) {
    // نجمة ثمانية (خاتم سليمان) متداخلة بمربعين، تتكرر في شبكة
    var st = "";
    for (var i = 0; i < 16; i++) { var q = i * Math.PI / 8, rr = i % 2 ? 17 : 30; st += (i ? "L" : "M") + (40 + rr * Math.sin(q)).toFixed(1) + " " + (40 - rr * Math.cos(q)).toFixed(1); }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><defs><pattern id="' + id + '" width="80" height="80" patternUnits="userSpaceOnUse">' +
      '<path d="' + st + 'Z" fill="none" stroke="' + col + '" stroke-width="1.2"/><rect x="22" y="22" width="36" height="36" fill="none" stroke="' + col + '" stroke-width=".8"/>' +
      '<rect x="22" y="22" width="36" height="36" fill="none" stroke="' + col + '" stroke-width=".8" transform="rotate(45 40 40)"/>' +
      '<path d="M0 0L12 12M80 0L68 12M0 80L12 68M80 80L68 68" stroke="' + col + '" stroke-width=".8"/></pattern></defs><rect width="100%" height="100%" fill="url(#' + id + ')"/></svg>';
  }
  function renderPattern(c) {
    var mode = S.patterns || "season", el = $("pattern");
    var season = mode === "off" ? "" : patternSeason(c) || (mode === "always" ? "plain" : "");
    if (season === patternFor) return;
    patternFor = season;
    el.hidden = !season;
    el.className = "spattern" + (season ? " pt-" + season : "");
    el.innerHTML = season ? '<div class="pt-a">' + starTile("ptA", "#e3bd6b") + '</div><div class="pt-b">' + starTile("ptB", season === "friday" ? "#7fd1a8" : season === "ramadan" ? "#c7a6ff" : "#ffffff") + "</div>" : "";
  }

  function renderBg(c) {
    var id = S.background === "auto" ? ClockBackgrounds.auto(bgContext(c)) : S.background;
    if (id !== bgWanted || ClockBackgrounds.current() !== id) {
      var shown = ClockBackgrounds.show(bgEl, id);
      if (shown.id !== bgWanted) bgUpdated = 0;
      bgWanted = id;
    }
    if (Date.now() - bgUpdated > 10000 && !c.quiet) {
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
    s += '<path class="a-arc" id="aArc" d=""/>'; // الإصدار ١١: قوس متوهج من الآن حتى الصلاة القادمة
    s += '<g class="a-nx" id="aNx"><path d="M0 -101L6 -112L-6 -112Z"/></g>';
    s += '<g id="aH"><path class="a-hand h" d="M-4.5 10L-3 -50L0 -56L3 -50L4.5 10Z"/></g>';
    s += '<g id="aM"><path class="a-hand m" d="M-3 12L-2 -78L0 -84L2 -78L3 12Z"/></g>';
    s += '<g id="aS"><line class="a-hand s" x1="0" y1="18" x2="0" y2="-88"/><circle class="a-hand s" cy="-70" r="3.2"/></g><circle class="a-cap" r="5"/>';
    $("analog").innerHTML = s;
  }
  var lastFit = 0;
  function renderClock(c) {
    var force = !c.quiet && Date.now() - lastFit > 20000 ? "check" : false; // المحتوى يتغير (بطاقة مناسبة، شريط يظهر): فحص دوري خفيف
    if (force) lastFit = Date.now();
    applySizes(force);
    var style = $("clockBox").dataset.style;
    if (style === "analog") {
      buildAnalog(c);
      var d = c.d, sec = d.getSeconds(), m = d.getMinutes() + sec / 60, h = (d.getHours() % 12) + m / 60;
      $("aH").setAttribute("transform", "rotate(" + (h * 30).toFixed(2) + ")");
      $("aM").setAttribute("transform", "rotate(" + (m * 6).toFixed(2) + ")");
      $("aS").setAttribute("transform", "rotate(" + (sec * 6) + ")");
      var at = c.nx.next.at / 60; // دقائق
      $("aNx").setAttribute("transform", "rotate(" + (((at / 60) % 12) * 30).toFixed(2) + ")");
      // القوس: يبدأ من موضع عقرب الساعات الآن ويمتد بقدر الوقت المتبقي (١٢ ساعة = دورة كاملة)
      var a0 = h * 30, span = Math.min(359.5, Math.max(0, c.nx.left / 43200 * 360)), a1 = a0 + span, R = 100;
      var pt = function (a) { var r = a * Math.PI / 180; return (R * Math.sin(r)).toFixed(2) + " " + (-R * Math.cos(r)).toFixed(2); };
      $("aArc").setAttribute("d", span < 0.3 ? "" : "M" + pt(a0) + " A" + R + " " + R + " 0 " + (span > 180 ? 1 : 0) + " 1 " + pt(a1));
      $("analog").classList.toggle("soon", c.nx.left <= 600);
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
    renderPattern(c);
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
    else if (a === "fps") { if (window.ClockPerf) toast(ClockPerf.meter() ? "مقياس السلاسة: ظاهر أعلى الشاشة" : "أُخفي مقياس السلاسة"); }
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
      // الإصدار ١١: طلب حجم من لوحة الإمام يُطبَّق مرة واحدة على اتجاه هذه الشاشة الحالي (والملاءمة الذكية تحدّه)
      var rl = j.settings.remoteLook, seen = +(S && S.remoteLookAt) || 0;
      if (rl && +rl.at > seen && +rl.clock > 0) {
        var o = document.body.classList.contains("portrait") ? "portrait" : "landscape", v = Math.max(0.4, Math.min(2.5, +rl.clock));
        n.sizes = JSON.parse(JSON.stringify(n.sizes || {})); n.sizes[o] = n.sizes[o] || {};
        n.sizes[o].clock = v; n.sizes[o].analog = Math.min(1.8, v);
        n.remoteLookAt = +rl.at;
      } else n.remoteLookAt = seen;
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
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { sizesFor = null; applySizes(true); });
    addEventListener("resize", function () { sizesFor = null; });
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

  window.ClockLook = { fit: function () { sizesFor = null; applySizes(true); return fitReport; }, init: init, apply: apply, tick: tick, LAYOUTS: LAYOUTS, STYLES: STYLES };
})();
