/*
 * «مزولة اليوم»: حلقة ٢٤ ساعة يكون فيها الزوال في الأعلى، فيرتسم النهار قوساً علوياً والليل قوساً سفلياً،
 * وتتحرك الشمس (أو الهلال ليلاً) على الحلقة، ويُضاء القوس من الصلاة السابقة حتى الآن.
 * دوال الهندسة صافية لتسهيل اختبارها.
 */
(function (root) {
  var NS = "http://www.w3.org/2000/svg";
  var R = 100;
  var LABELS = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", jumuah: "الجمعة", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };

  // الزاوية بالدرجات (مع عقارب الساعة من الأعلى) لوقت بالدقائق، والزوال في الأعلى
  function angle(min, noon) { return (((min - noon) / 1440) * 360 % 360 + 360) % 360; }
  function point(deg, r) { var a = deg * Math.PI / 180; return { x: +(r * Math.sin(a)).toFixed(2), y: +(-r * Math.cos(a)).toFixed(2) }; }
  // قوس من وقت إلى وقت (مع عقارب الساعة)
  function arc(m1, m2, noon, r) {
    var a1 = angle(m1, noon), a2 = angle(m2, noon), sweep = (a2 - a1 + 360) % 360;
    if (sweep < 0.05) sweep = 0.05;
    var p1 = point(a1, r), p2 = point(a1 + sweep, r);
    return "M" + p1.x + " " + p1.y + "A" + r + " " + r + " 0 " + (sweep > 180 ? 1 : 0) + " 1 " + p2.x + " " + p2.y;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var built = null, dyn = {};
  function build(svg, t, friday) {
    var key = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha, friday].join(",");
    if (built === key) return;
    built = key;
    svg.innerHTML = "";
    var noon = t.dhuhr;
    var defs = el("defs", {}, svg);
    var g = el("radialGradient", { id: "sunGlow" }, defs);
    el("stop", { offset: "0", "stop-color": "#fff6d8" }, g);
    el("stop", { offset: ".45", "stop-color": "#ffd36b" }, g);
    el("stop", { offset: "1", "stop-color": "#ffb13b", "stop-opacity": "0" }, g);

    // خلفية الحلقة
    el("circle", { r: R, class: "d-track" }, svg);
    // ساعات اليوم
    for (var h = 0; h < 24; h++) {
      var a = angle(h * 60, noon), p1 = point(a, R - 12), p2 = point(a, R - (h % 6 ? 15 : 19));
      el("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "d-tick" + (h % 6 ? "" : " major") }, svg);
    }
    // فترات اليوم
    el("path", { d: arc(t.isha, t.fajr + 1440, noon, R), class: "d-seg night" }, svg);
    el("path", { d: arc(t.fajr, t.sunrise, noon, R), class: "d-seg dawn" }, svg);
    el("path", { d: arc(t.sunrise, t.maghrib, noon, R), class: "d-seg day" }, svg);
    el("path", { d: arc(t.maghrib, t.isha, noon, R), class: "d-seg dusk" }, svg);
    // خط الأفق (الشروق ← الغروب)
    var hr = point(angle(t.sunrise, noon), R - 8), hs = point(angle(t.maghrib, noon), R - 8);
    el("line", { x1: hr.x, y1: hr.y, x2: hs.x, y2: hs.y, class: "d-horizon" }, svg);
    // قوس التقدّم (يُحدَّث كل ثانية)
    dyn.progress = el("path", { class: "d-progress" }, svg);
    // علامات الأوقات
    dyn.marks = {};
    ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"].forEach(function (k) {
      var ang = angle(t[k], noon), p = point(ang, R), lp = point(ang, R + 12);
      var side = Math.abs(lp.x) < 14 ? "middle" : (lp.x > 0 ? "start" : "end");
      if (side === "middle") lp.y += lp.y < 0 ? -6 : 6;
      var grp = el("g", { class: "d-mark" + (k === "sunrise" ? " minor" : "") }, svg);
      el("circle", { cx: p.x, cy: p.y, r: k === "sunrise" ? 3.2 : 4.4 }, grp);
      var tx = el("text", { x: lp.x, y: lp.y, "text-anchor": side, "dominant-baseline": "central", direction: "ltr" }, grp);
      tx.textContent = (k === "dhuhr" && friday) ? LABELS.jumuah : LABELS[k];
      dyn.marks[k] = grp;
    });
    // الشمس / الهلال
    dyn.body = el("g", { class: "d-body" }, svg);
    dyn.glow = el("circle", { r: 15, fill: "url(#sunGlow)", class: "d-glow" }, dyn.body);
    dyn.sun = el("circle", { r: 6.2, class: "d-sun" }, dyn.body);
    dyn.moonMask = el("circle", { r: 5.4, cx: 2.8, cy: -2.2, class: "d-moon-cut" }, dyn.body);
  }

  function update(nowMin, t, prevMin, nextKey) {
    if (!dyn.body) return;
    var noon = t.dhuhr, a = angle(nowMin, noon), p = point(a, R);
    dyn.body.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
    var night = nowMin < t.sunrise || nowMin >= t.maghrib;
    dyn.body.setAttribute("class", "d-body" + (night ? " moon" : ""));
    dyn.progress.setAttribute("d", arc(prevMin, nowMin, noon, R));
    Object.keys(dyn.marks).forEach(function (k) {
      dyn.marks[k].setAttribute("class", "d-mark" + (k === "sunrise" ? " minor" : "") + (k === nextKey ? " next" : ""));
    });
  }

  root.ClockDial = { angle: angle, point: point, arc: arc, build: build, update: update, reset: function () { built = null; } };
})(typeof window !== "undefined" ? window : globalThis);
