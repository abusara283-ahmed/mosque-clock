/*
 * «نافذة المحراب»: محراب مدبب بتاج من المقرنصات، تُرى من خلاله سماء المسجد كما هي الآن:
 * لون السماء من ارتفاع الشمس الحقيقي، والشمس في موضعها، والنجوم ليلاً، والقمر بطوره من اليوم الهجري،
 * فوق أفق من قباب ومآذن. ومعه «نجمة الإقامة» الاثنا عشرية التي تكتمل أضلاعها مع اقتراب الإقامة.
 * التصميم والرسم أصليان بالكامل (SVG يُبنى بالكود، بلا صور).
 */
(function (root) {
  var NS = "http://www.w3.org/2000/svg";
  var W = 1000, H = 1300, SPRING = 640, X0 = 60, X1 = 940, R = 616, HORIZON = 940;
  var CL = X0 + R, CR = X1 - R; // مركزا قوسي العقد
  var APEX_Y = SPRING - Math.sqrt(R * R - Math.pow((X1 - X0) / 2 - (X1 - X0 - R) + 0, 2));
  APEX_Y = SPRING - Math.sqrt(R * R - Math.pow(CL - 500, 2));

  function archPath(inset) {
    var r = R - inset, x0 = X0 + inset, x1 = X1 - inset;
    var ay = SPRING - Math.sqrt(r * r - Math.pow(CL - 500, 2));
    return "M" + x0 + " " + H + "L" + x0 + " " + SPRING + "A" + r + " " + r + " 0 0 1 500 " + ay.toFixed(1) +
      "A" + r + " " + r + " 0 0 1 " + x1 + " " + SPRING + "L" + x1 + " " + H + "Z";
  }
  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  // مولّد عشوائي ثابت (لتبقى النجوم في أماكنها)
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

  // خلية مقرنص: عقد صغير مدبب قاعدته على y=0 ورأسه للأعلى
  function cell(w, h) {
    var hw = w / 2;
    return "M" + (-hw) + " 0L" + (-hw) + " " + (-h * .45) + "Q" + (-hw) + " " + (-h * .85) + " 0 " + (-h) +
      "Q" + hw + " " + (-h * .85) + " " + hw + " " + (-h * .45) + "L" + hw + " 0Z";
  }

  function muqarnas(g) {
    var apexL = Math.atan2(APEX_Y - SPRING, 500 - CL) * 180 / Math.PI; // ≈ 253° لقوس اليسار
    var apexR = Math.atan2(APEX_Y - SPRING, 500 - CR) * 180 / Math.PI; // ≈ -73° لقوس اليمين
    var tiers = [{ off: 16, w: 46, h: 58, span: 66 }, { off: 80, w: 40, h: 50, span: 54 }, { off: 134, w: 34, h: 42, span: 42 }];
    tiers.forEach(function (t, ti) {
      var r = R - t.off - t.h * 0; // نصف قطر قاعدة الخلايا (الخلايا تتجه للخارج)
      var r2 = R - t.off - t.h;
      var n = Math.max(3, Math.round(t.span / (t.w / r2 * 180 / Math.PI) * .95));
      for (var side = 0; side < 2; side++) {
        for (var i = 0; i < n; i++) {
          var f = (i + (ti % 2 ? .5 : .15)) / n;
          var phi = side === 0 ? apexL - f * t.span : apexR + f * t.span; // يسار ثم يمين
          var cx = side === 0 ? CL : CR;
          var a = phi * Math.PI / 180, px = cx + r2 * Math.cos(a), py = SPRING + r2 * Math.sin(a);
          if (side === 0 && px > 500 - t.w * .45) continue;
          if (side === 1 && px < 500 + t.w * .45) continue;
          var rot = phi + 90;
          var grp = el("g", { transform: "translate(" + px.toFixed(1) + " " + py.toFixed(1) + ") rotate(" + rot.toFixed(1) + ")" }, g);
          el("path", { d: cell(t.w, t.h), class: "mq-cell t" + ti }, grp);
          el("path", { d: cell(t.w * .5, t.h * .55), class: "mq-in" }, grp);
        }
      }
      // خلية الذروة
      var top = el("g", { transform: "translate(500 " + (APEX_Y + t.off + t.h * 1.05).toFixed(1) + ")" }, g);
      el("path", { d: cell(t.w * 1.05, t.h), class: "mq-cell t" + ti }, top);
      el("path", { d: cell(t.w * .5, t.h * .55), class: "mq-in" }, top);
    });
  }

  // أفق المسجد: قبة كبرى على رقبة، مئذنتان، قبتان صغيرتان
  function skyline(g) {
    var d = "M60 " + H + "L60 1040 L170 1040 L170 1000 ";
    d += "Q235 905 300 1000 L300 1040 L330 1040 L330 980 ";
    d += "L380 980 L380 920 Q380 905 395 900 Q420 790 500 770 Q580 790 605 900 Q620 905 620 920 L620 980 ";
    d += "L670 980 L670 1040 L700 1040 L700 1000 Q765 905 830 1000 L830 1040 L940 1040 L940 " + H + "Z";
    el("path", { d: d, class: "sk-body" }, g);
    [240, 760].forEach(function (x) {
      var m = "M" + (x - 17) + " 1040L" + (x - 17) + " 760L" + (x - 26) + " 750L" + (x - 26) + " 736L" + (x - 15) + " 736L" + (x - 15) + " 640L" + (x - 22) + " 630L" + (x - 22) + " 618L" + (x - 12) + " 618L" + (x - 12) + " 600Q" + x + " 560 " + (x + 12) + " 600L" + (x + 12) + " 618L" + (x + 22) + " 618L" + (x + 22) + " 630L" + (x + 15) + " 640L" + (x + 15) + " 736L" + (x + 26) + " 736L" + (x + 26) + " 750L" + (x + 17) + " 760L" + (x + 17) + " 1040Z";
      el("path", { d: m, class: "sk-body" }, g);
      el("line", { x1: x, y1: 572, x2: x, y2: 548, class: "sk-finial" }, g);
    });
    el("line", { x1: 500, y1: 772, x2: 500, y2: 735, class: "sk-finial" }, g);
    el("path", { d: "M492 722 A11 11 0 1 0 508 734 A8 8 0 1 1 492 722Z", class: "sk-crescent" }, g);
    // نوافذ مضاءة ليلاً
    var wins = el("g", { class: "sk-windows" }, g);
    [[420, 940], [460, 940], [500, 940], [540, 940], [580, 940], [205, 1010], [235, 1010], [265, 1010], [735, 1010], [765, 1010], [795, 1010]].forEach(function (p) {
      el("path", { d: "M" + (p[0] - 7) + " " + (p[1] + 22) + "L" + (p[0] - 7) + " " + (p[1] + 6) + "Q" + p[0] + " " + (p[1] - 4) + " " + (p[0] + 7) + " " + (p[1] + 6) + "L" + (p[0] + 7) + " " + (p[1] + 22) + "Z" }, wins);
    });
  }

  var dyn = {};
  function build(svg) {
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = "";
    var defs = el("defs", {}, svg);
    var sg = el("linearGradient", { id: "skyGrad", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    dyn.s0 = el("stop", { offset: "0" }, sg); dyn.s1 = el("stop", { offset: ".55" }, sg); dyn.s2 = el("stop", { offset: ".78" }, sg);
    var sunG = el("radialGradient", { id: "sunGrad" }, defs);
    el("stop", { offset: "0", "stop-color": "#fffbe8" }, sunG); el("stop", { offset: ".22", "stop-color": "#ffe9a8" }, sunG);
    dyn.halo = el("stop", { offset: ".5", "stop-color": "#ffc861", "stop-opacity": ".35" }, sunG);
    el("stop", { offset: "1", "stop-color": "#ffb347", "stop-opacity": "0" }, sunG);
    var mq = el("linearGradient", { id: "mqGrad", x1: 0, y1: 1, x2: 0, y2: 0 }, defs);
    el("stop", { offset: "0", "stop-color": "var(--mq-a)" }, mq); el("stop", { offset: "1", "stop-color": "var(--mq-b)" }, mq);
    var pat = el("pattern", { id: "girih", width: 80, height: 80, patternUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M40 4 L50 30 L76 40 L50 50 L40 76 L30 50 L4 40 L30 30Z M40 22 L58 40 L40 58 L22 40Z", class: "gi" }, pat);
    var clip = el("clipPath", { id: "archClip" }, defs);
    el("path", { d: archPath(0) }, clip);

    // الإطار المستطيل (ألفية) والكوشات بنقش هندسي
    el("rect", { x: 6, y: 6, width: W - 12, height: H - 12, class: "alfiz" }, svg);
    el("rect", { x: 6, y: 6, width: W - 12, height: H - 12, fill: "url(#girih)", class: "spandrel" }, svg);
    // السماء داخل العقد
    var win = el("g", { "clip-path": "url(#archClip)" }, svg);
    el("rect", { x: 0, y: 0, width: W, height: H, fill: "url(#skyGrad)" }, win);
    dyn.stars = el("g", { class: "stars" }, win);
    var r = rng(7);
    for (var i = 0; i < 140; i++) {
      var x = 70 + r() * 860, y = 40 + Math.pow(r(), 1.4) * 900, s = r();
      el("circle", { cx: x.toFixed(0), cy: y.toFixed(0), r: (0.8 + s * 2.2).toFixed(1), class: s > .82 ? "tw" : "" }, dyn.stars);
    }
    dyn.moon = el("g", { class: "moon" }, win);
    el("circle", { r: 34, class: "moon-lit" }, dyn.moon);
    dyn.moonCut = el("circle", { r: 35, class: "moon-cut" }, dyn.moon);
    dyn.sun = el("g", { class: "sun" }, win);
    el("circle", { r: 150, fill: "url(#sunGrad)" }, dyn.sun);
    el("circle", { r: 30, class: "sun-disc" }, dyn.sun);
    dyn.glow = el("ellipse", { cx: 500, cy: HORIZON + 10, rx: 520, ry: 120, class: "horizon-glow" }, win);
    skyline(el("g", { class: "skyline", transform: "translate(0 -70)" }, win));
    el("rect", { x: 0, y: 1200, width: W, height: 100, class: "sk-body" }, win);
    el("line", { x1: 60, y1: 970, x2: 940, y2: 970, class: "ground-line" }, win);
    // التاج: مقرنصات
    muqarnas(el("g", { class: "muqarnas" }, svg));
    // إطار العقد المزدوج
    el("path", { d: archPath(0), class: "arch-frame a" }, svg);
    el("path", { d: archPath(0), class: "arch-frame b" }, svg);
    el("path", { d: archPath(-14), class: "arch-frame c" }, svg);
    el("path", { d: archPath(12), class: "arch-frame c" }, svg);
  }

  var lastKey = "";
  // تحديث السماء: الشمس والقمر والنجوم والألوان، ويُصدّر لون الأفق لبقية الصفحة (--sun)
  function update(svg, date, S, hijriDay) {
    if (!svg) return;
    if (!dyn.sun || !svg.firstChild) build(svg);
    var key = date.getHours() + ":" + date.getMinutes() + ":" + Math.floor(date.getSeconds() / 10);
    if (key === lastKey) return;
    lastKey = key;
    var s = ClockSky.sun(date, S.latitude, S.longitude, S.timezone);
    var c = ClockSky.colors(s.alt);
    dyn.s0.setAttribute("stop-color", ClockSky.css(c.top));
    dyn.s1.setAttribute("stop-color", ClockSky.css(c.mid));
    dyn.s2.setAttribute("stop-color", ClockSky.css(c.low));
    dyn.stars.setAttribute("opacity", ClockSky.stars(s.alt).toFixed(2));
    // موضع الشمس: أفقياً من زاوية الساعة، وعمودياً من الارتفاع
    var noonAlt = 90 - Math.abs(S.latitude - s.decl);
    var x = 500 + Math.max(-1.15, Math.min(1.15, s.hourAngle / 95)) * 390;
    var y = HORIZON - (s.alt / Math.max(35, noonAlt)) * 700;
    dyn.sun.setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ")");
    dyn.sun.style.opacity = s.alt > -4 ? 1 : 0;
    // القمر بطوره التقريبي من اليوم الهجري، يظهر ليلاً
    var hd = hijriDay || 15, ph = Math.abs(hd - 15) / 15; // ٠ بدر، ١ محاق
    dyn.moon.style.opacity = s.alt < -4 ? 1 : 0;
    dyn.moon.setAttribute("transform", "translate(" + (hd < 15 ? 280 : 720) + " 400)");
    dyn.moonCut.setAttribute("cx", ((hd < 15 ? -1 : 1) * 70 * (1 - ph) + (hd < 15 ? -1 : 1) * 4).toFixed(1));
    dyn.moonCut.setAttribute("cx", (((hd <= 15) ? -1 : 1) * (8 + 64 * (1 - ph))).toFixed(1));
    dyn.glow.style.fill = ClockSky.css(c.low);
    dyn.glow.style.opacity = Math.max(0, Math.min(.85, 1 - Math.abs(s.alt) / 14)).toFixed(2);
    var docEl = document.documentElement;
    docEl.style.setProperty("--sun", ClockSky.css(c.low));
    docEl.style.setProperty("--sky", ClockSky.css(c.top));
    document.body.classList.toggle("is-night", s.alt < -6);
    return s;
  }

  // ——— نجمة الإقامة: ١٢ ضلعاً تضيء تباعاً ———
  function rosette(svg) {
    svg.setAttribute("viewBox", "-520 -520 1040 1040");
    svg.innerHTML = "";
    var outer = 500, inner = 372, segs = [];
    var ring = el("g", { class: "ros-ring" }, svg);
    for (var k = 0; k < 48; k++) {
      var a = k * 7.5 * Math.PI / 180;
      el("circle", { cx: (512 * Math.sin(a)).toFixed(1), cy: (-512 * Math.cos(a)).toFixed(1), r: k % 4 ? 2.5 : 5 }, ring);
    }
    function P(r, deg) { var a = deg * Math.PI / 180; return (r * Math.sin(a)).toFixed(1) + " " + (-r * Math.cos(a)).toFixed(1); }
    for (var i = 0; i < 12; i++) {
      var d = "M0 0L" + P(inner, i * 30 - 15) + "L" + P(outer, i * 30) + "L" + P(inner, i * 30 + 15) + "Z";
      segs.push(el("path", { d: d, class: "ros-seg" }, svg));
    }
    // نجمة داخلية متداخلة
    var star = "";
    for (var j = 0; j < 24; j++) star += (j ? "L" : "M") + P(j % 2 ? 250 : 312, j * 15);
    el("path", { d: star + "Z", class: "ros-star" }, svg);
    el("circle", { r: 268, class: "ros-core" }, svg);
    svg._segs = segs;
  }
  function rosetteProgress(svg, p) {
    if (!svg) return;
    if (!svg._segs) rosette(svg);
    var lit = Math.floor(p * 12 + 1e-6);
    svg._segs.forEach(function (s, i) { s.setAttribute("class", "ros-seg" + (i < lit ? " on" : i === lit ? " cur" : "")); });
  }

  root.ClockMihrab = { build: build, update: update, rosette: rosette, rosetteProgress: rosetteProgress, archPath: archPath, APEX_Y: APEX_Y };
})(typeof window !== "undefined" ? window : globalThis);
