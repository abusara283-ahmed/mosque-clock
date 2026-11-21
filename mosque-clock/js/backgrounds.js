/*
 * الخلفيات: تسع خلفيات مدمجة مرسومة بالكود (بلا صور) + صور يرفعها المستخدم (تُحفظ في IndexedDB على الجهاز).
 * الخلفيات «الحية» تأخذ لون سمائها من ارتفاع الشمس الحقيقي الآن.
 */
(function (root) {
  function rng(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function stars(n, seed, maxY) {
    var r = rng(seed), out = "";
    for (var i = 0; i < n; i++) {
      var s = r();
      out += '<circle cx="' + (r() * 1600).toFixed(0) + '" cy="' + (Math.pow(r(), 1.3) * (maxY || 700)).toFixed(0) + '" r="' + (0.7 + s * 1.9).toFixed(1) + '"' + (s > .8 ? ' class="tw"' : "") + "/>";
    }
    return '<svg class="bg-stars live-stars" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' + out + "</svg>";
  }
  function star8(cx, cy, r) {
    var p = "", k;
    for (k = 0; k < 16; k++) { var a = k * Math.PI / 8, rr = k % 2 ? r * .55 : r; p += (k ? "L" : "M") + (cx + rr * Math.sin(a)).toFixed(1) + " " + (cy - rr * Math.cos(a)).toFixed(1); }
    return p + "Z";
  }
  // أفق عريض من القباب والمآذن (أصلي)
  function skyline() {
    var d = "M-400 400L-400 330L120 330L120 300Q170 236 220 300L220 330L300 330L300 290L340 290L340 250Q345 238 360 236Q380 150 450 136Q520 150 540 236Q555 238 560 250L560 290L600 290L600 330L700 330L700 280Q760 196 820 280L820 330L1060 330L1060 260L1090 260L1090 224Q1110 178 1150 170Q1190 178 1210 224L1210 260L1240 260L1240 330L1350 330L1350 300Q1395 245 1440 300L1440 330L2000 330L2000 400Z";
    var m = "";
    [[260, 330, 150], [640, 330, 120], [1000, 330, 160], [1300, 330, 110]].forEach(function (q) {
      var x = q[0], b = q[1], h = q[2];
      m += "M" + (x - 9) + " " + b + "L" + (x - 9) + " " + (b - h) + "L" + (x - 14) + " " + (b - h - 6) + "L" + (x - 8) + " " + (b - h - 8) + "L" + (x - 7) + " " + (b - h - 40) +
        "Q" + x + " " + (b - h - 64) + " " + (x + 7) + " " + (b - h - 40) + "L" + (x + 8) + " " + (b - h - 8) + "L" + (x + 14) + " " + (b - h - 6) + "L" + (x + 9) + " " + (b - h) + "L" + (x + 9) + " " + b + "Z";
    });
    var win = "";
    for (var i = 0; i < 9; i++) win += '<rect x="' + (395 + i * 12) + '" y="262" width="5" height="12" rx="2.5"/>';
    for (i = 0; i < 6; i++) win += '<rect x="' + (1112 + i * 14) + '" y="280" width="5" height="12" rx="2.5"/>';
    return '<svg class="bg-skyline" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice"><path d="' + d + m + '"/><g class="win">' + win + "</g></svg>";
  }
  function lantern(x, len, s, delay) {
    return '<g class="lan" style="animation-delay:' + delay + 's" transform="translate(' + x + ' 0)">' +
      '<line x1="0" y1="0" x2="0" y2="' + len + '"/>' +
      '<g transform="translate(0 ' + len + ') scale(' + s + ')">' +
      '<path class="lan-top" d="M-14 0L14 0L22 14L-22 14Z"/><circle class="lan-glow" cy="46" r="34"/>' +
      '<path class="lan-body" d="M-22 14L22 14L26 60L14 84L-14 84L-26 60Z"/>' +
      '<path class="lan-frame" d="M-22 14L-26 60L-14 84M22 14L26 60L14 84M0 14L0 84M-26 60L26 60"/>' +
      '<path class="lan-top" d="M-14 84L14 84L6 96L-6 96Z"/></g></g>';
  }

  var BUILTIN = [
    { id: "ink", name: "المحراب الليلي", html: function () { return '<div class="bg-ink"></div>'; } },
    { id: "sky", name: "السماء الحية", live: true, html: function () {
      return '<div class="live-sky"></div>' + stars(220, 11) + '<div class="bg-sun live-sun"></div><div class="bg-moon live-moon"></div>'; } },
    { id: "domes", name: "قباب ومآذن", live: true, html: function () {
      return '<div class="live-sky"></div>' + stars(160, 5, 520) + '<div class="bg-sun live-sun"></div><div class="bg-moon live-moon"></div>' + skyline(); } },
    { id: "geometry", name: "هندسة إسلامية", html: function () { return '<div class="bg-geometry"></div>'; } },
    { id: "dunes", name: "كثبان عُمان", live: true, html: function () {
      return '<div class="live-sky"></div>' + stars(120, 3, 380) + '<div class="bg-sun live-sun"></div><div class="bg-moon live-moon"></div>' +
        '<svg class="bg-dunes" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">' +
        '<path class="d1" d="M0 560Q260 470 520 540T1050 520T1600 500L1600 900L0 900Z"/>' +
        '<path class="d2" d="M0 640Q300 560 620 640Q900 700 1200 610Q1420 560 1600 600L1600 900L0 900Z"/>' +
        '<path class="d3" d="M0 730Q240 660 520 720Q860 800 1150 720Q1400 670 1600 720L1600 900L0 900Z"/>' +
        '<path class="d4" d="M0 820Q380 760 760 820Q1150 870 1600 800L1600 900L0 900Z"/></svg>'; } },
    { id: "mashrabiya", name: "مشربية", html: function () { return '<div class="bg-mashrabiya"></div>'; } },
    { id: "ramadan", name: "فوانيس رمضان", html: function () {
      return '<div class="bg-ramadan"></div>' + stars(180, 21) +
        '<svg class="bg-crescent" viewBox="0 0 100 100"><path d="M62 14A38 38 0 1 0 62 86A30 30 0 1 1 62 14Z"/></svg>' +
        '<svg class="bg-lanterns" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMin slice">' +
        lantern(180, 140, 1.4, 0) + lantern(330, 260, 1, -1.5) + lantern(1270, 220, 1.2, -.7) + lantern(1430, 120, .9, -2.2) + lantern(760, 70, .8, -3) + "</svg>"; } },
    { id: "eid", name: "بهجة العيد", html: function () {
      var r = rng(42), s = "";
      for (var i = 0; i < 60; i++) { var x = r() * 1600, y = r() * 900, z = 4 + r() * 18; s += '<path class="' + (r() > .6 ? "tw" : "") + '" style="animation-delay:-' + (r() * 4).toFixed(1) + 's" d="' + star8(x, y, z) + '"/>'; }
      return '<div class="bg-eid"></div><svg class="bg-eid-stars" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">' + s + "</svg>"; } },
    { id: "friday", name: "نور الجمعة", html: function () { return '<div class="bg-friday"></div><div class="bg-rays"></div>'; } }
  ];

  // ——— الصور المرفوعة (IndexedDB) ———
  var DB = "mosqueClock.bg", STORE = "images";
  function db() {
    return new Promise(function (ok, bad) {
      if (!root.indexedDB) return bad(new Error("no idb"));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true }); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { bad(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, bad) {
        var t = d.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
        t.oncomplete = function () { ok(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { bad(t.error); };
      });
    });
  }
  var custom = [], urls = {};
  function loadCustom() {
    return tx("readonly", function (st) { return st.getAll(); }).then(function (list) {
      custom = (list || []).map(function (x) {
        if (!urls[x.id]) urls[x.id] = URL.createObjectURL(x.blob);
        return { id: "custom:" + x.id, name: x.name || "صورة", url: urls[x.id], key: x.id };
      });
      return custom;
    }).catch(function () { custom = []; return custom; });
  }
  function addCustom(file) { return tx("readwrite", function (st) { return st.add({ name: file.name.replace(/\.[^.]+$/, ""), blob: file, added: Date.now() }); }).then(loadCustom); }
  function removeCustom(key) { return tx("readwrite", function (st) { return st.delete(key); }).then(function () { if (urls[key]) URL.revokeObjectURL(urls[key]); delete urls[key]; return loadCustom(); }); }

  function list() { return BUILTIN.concat(custom); }
  function find(id) { return list().filter(function (b) { return b.id === id; })[0] || null; }

  // اختيار تلقائي: العيد ← رمضان ← الجمعة ← حسب وقت اليوم
  function auto(ctx) {
    var h = ctx.hijri;
    if (h && ((h.m === 10 && h.d <= 3) || (h.m === 12 && h.d >= 10 && h.d <= 13))) return "eid";
    if (h && h.m === 9) return "ramadan";
    if (ctx.friday && ctx.min < ctx.t.asr) return "friday";
    var p = ctx.period;
    return { dawn: "dunes", day: "domes", golden: "dunes", dusk: "domes", night: "sky" }[p] || "ink";
  }

  // ——— الرسم مع تلاشٍ متقاطع ———
  var current = null, front = 0;
  function show(container, id) {
    var b = find(id) || BUILTIN[0];
    if (current === b.id) return b;
    current = b.id;
    var layers = container.querySelectorAll(".bg-layer");
    var next = layers[1 - front], prev = layers[front];
    next.className = "bg-layer bg-" + (b.url ? "custom" : b.id);
    next.innerHTML = b.url ? '<div class="bg-img" style="background-image:url(' + b.url + ')"></div>' : b.html();
    next.classList.add("on"); prev.classList.remove("on");
    front = 1 - front;
    setTimeout(function () { if (!prev.classList.contains("on")) prev.innerHTML = ""; }, 2200);
    return b;
  }
  // تحديث العناصر الحية من موضع الشمس
  function update(container, sun, hijriDay) {
    if (!sun || !root.ClockSky) return;
    var c = ClockSky.colors(sun.alt);
    container.querySelectorAll(".live-sky").forEach(function (e) {
      e.style.background = "linear-gradient(180deg," + ClockSky.css(c.top) + " 0%," + ClockSky.css(c.mid) + " 55%," + ClockSky.css(c.low) + " 85%)";
    });
    var st = ClockSky.stars(sun.alt).toFixed(2);
    container.querySelectorAll(".live-stars").forEach(function (e) { e.style.opacity = st; });
    var x = 50 + Math.max(-1.1, Math.min(1.1, sun.hourAngle / 95)) * 40, y = 78 - (sun.alt / 60) * 70;
    container.querySelectorAll(".live-sun").forEach(function (e) { e.style.left = x + "%"; e.style.top = y + "%"; e.style.opacity = sun.alt > -4 ? 1 : 0; });
    var hd = hijriDay || 15, ph = Math.abs(hd - 15) / 15;
    container.querySelectorAll(".live-moon").forEach(function (e) {
      e.style.opacity = sun.alt < -4 ? 1 : 0; e.style.left = (hd < 15 ? 22 : 74) + "%";
      e.style.setProperty("--cut", (((hd <= 15) ? -1 : 1) * (6 + 92 * (1 - ph))).toFixed(0) + "%");
    });
    var day = Math.max(0, Math.min(1, (sun.alt + 8) / 20));
    container.style.setProperty("--day", day.toFixed(2));
    container.classList.toggle("is-night", sun.alt < -6);
  }

  root.ClockBackgrounds = { BUILTIN: BUILTIN, list: list, find: find, auto: auto, show: show, update: update,
    loadCustom: loadCustom, addCustom: addCustom, removeCustom: removeCustom, current: function () { return current; } };
})(typeof window !== "undefined" ? window : globalThis);
