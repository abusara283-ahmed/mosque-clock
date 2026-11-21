/* منطق شاشة الساعة */
(function () {
  var S = ClockConfig.load();
  var C = window.CLOCK_CONTENT;
  var SCH = window.ClockSchedule;
  var $ = function (id) { return document.getElementById(id); };

  var NAMES = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", jumuah: "الجمعة", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
  var NAMES_EN = { fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", jumuah: "Jumu\u2019ah", asr: "Asr", maghrib: "Maghrib", isha: "Isha" };
  function en(key) { return S.englishNames ? (NAMES_EN[key] || "") : ""; }

  // ——— الوقت: ساعة الجهاز مصحّحة، أو محاكاة للاختبار: ?sim=2026-11-06T11:45:00&speed=10 ———
  var params = new URLSearchParams(location.search);
  var simStart = params.get("sim") ? new Date(params.get("sim")).getTime() : NaN;
  var speed = +params.get("speed") || 1;
  var realStart = Date.now();
  var simulating = !isNaN(simStart);
  var simRestOff = params.get("rest") === "0"; // لتجربة الشاشة الرئيسية ليلاً في المحاكاة
  function now() {
    if (simulating) return new Date(simStart + (Date.now() - realStart) * speed);
    return new Date(ClockSync.now());
  }

  // ——— التنسيق ———
  var AR = "٠١٢٣٤٥٦٧٨٩";
  function digits(str) {
    str = String(str);
    return S.arabicDigits ? str.replace(/[0-9]/g, function (d) { return AR[d]; }) : str;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function fmtMin(m, withPeriod) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    if (S.use24h) return '<span class="num">' + digits(pad(h) + ":" + pad(mm)) + "</span>";
    var p = h < 12 ? "ص" : "م"; h = h % 12 || 12;
    return '<span class="num">' + digits(h + ":" + pad(mm)) + "</span>" + (withPeriod ? "<small>" + p + "</small>" : "");
  }
  function fmtMinText(m) {
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    if (S.use24h) return digits(pad(h) + ":" + pad(mm));
    return digits((h % 12 || 12) + ":" + pad(mm)) + (h < 12 ? " ص" : " م");
  }
  function fmtDur(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return digits((h ? h + ":" + pad(m) : m) + ":" + pad(s));
  }

  // ——— التهيئة ———
  function applyOrientation() {
    var portrait = S.orientation === "portrait" || (S.orientation === "auto" && innerHeight > innerWidth);
    document.body.classList.toggle("portrait", portrait);
  }
  applyOrientation(); addEventListener("resize", applyOrientation);
  function applyStatic() {
    $("mosqueName").textContent = S.mosqueName;
    $("cityName").textContent = S.cityName;
    $("slide").style.display = S.showSlides ? "" : "none";
    document.body.classList.toggle("bilingual", !!S.englishNames);
    if ($("dayline")) $("dayline").style.display = S.dayline ? "" : "none";
    // الإصدار ٧: هوية المسجد (الشعار واللون)، هامش التلفاز، الوضع الخفيف
    var lg = $("mosqueLogo");
    if (lg) { lg.hidden = !S.logo; if (S.logo && lg.getAttribute("src") !== S.logo) lg.src = S.logo; }
    var b = document.body.style;
    if (/^#[0-9a-f]{6}$/i.test(S.accentColor || "")) {
      b.setProperty("--gold", S.accentColor);
      var rgb = [1, 3, 5].map(function (k) { return parseInt(S.accentColor.substr(k, 2), 16); }); // بلا color-mix لأجهزة التلفاز القديمة
      b.setProperty("--gold2", "rgb(" + rgb.map(function (v) { return Math.round(v * .55 + 255 * .45); }).join(",") + ")");
      b.setProperty("--hl", S.accentColor);
      b.setProperty("--line", "rgba(" + rgb.join(",") + ",.3)");
    } else ["--gold", "--gold2", "--hl", "--line"].forEach(function (k) { b.removeProperty(k); });
    var m = Math.max(0, Math.min(8, +S.safeMargin || 0));
    b.transform = m ? "scale(" + (1 - m / 50).toFixed(3) + ")" : "";
    document.body.classList.toggle("lite", !!S.liteMode);
  }
  applyStatic();

  var mouseTimer;
  addEventListener("mousemove", function () {
    document.body.classList.add("mouse");
    clearTimeout(mouseTimer);
    var hideAfter = S.hideCursorSeconds == null ? 3 : +S.hideCursorSeconds; // الإصدار ٨: ٠ = لا يظهر المؤشر أبداً (شاشات المسجد)
    if (hideAfter <= 0) { document.body.classList.remove("mouse"); return; }
    mouseTimer = setTimeout(function () { document.body.classList.remove("mouse"); }, hideAfter * 1000);
  });
  addEventListener("keydown", function (e) {
    if (e.key === "s" || e.key === "س") location.href = "settings.html";
    if (e.key === "a" || e.key === "ش") location.href = "announcements.html";
    if (e.key === "f" || e.key === "ب") document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
  });

  // إبقاء الشاشة مضاءة
  var wakeLock = null;
  function keepAwake() {
    if (!navigator.wakeLock || document.hidden) return;
    navigator.wakeLock.request("screen").then(function (l) { wakeLock = l; }).catch(function () {});
  }
  keepAwake();
  document.addEventListener("visibilitychange", keepAwake);
  addEventListener("click", function () { if (!wakeLock) keepAwake(); });
  // ملء الشاشة تلقائياً: المتصفح يشترط لمسة أو ضغطة أولى، فنطلبه عندها (أو شغّل Chrome بالخيار --kiosk)
  function autoFs() {
    if (!S.autoFullscreen || params.get("preview") === "1" || document.fullscreenElement) return;
    var de = document.documentElement;
    if (de.requestFullscreen) de.requestFullscreen().catch(function () {});
  }
  ["pointerdown", "keydown"].forEach(function (ev) { addEventListener(ev, autoFs); });

  // ——— الأوقات ———
  var dayCache = {};
  function dayKey(d) { return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function timesFor(d) {
    var k = dayKey(d);
    if (!dayCache[k]) dayCache[k] = SCH.applyJumuah(PrayerTimes.forDate(d, S), isFriday(d), S);
    return dayCache[k];
  }
  function tomorrow(d) { var t = new Date(d); t.setDate(t.getDate() + 1); return t; }
  // الإصدار ٨: جدول اليوم بالإقامة الذكية (الأسبوعية تحتاج أوقات الأسبوع كله)
  var weekCache = {};
  function schFor(d) {
    var wk = null;
    if (SCH.needsWeek(S)) {
      var k = dayKey(d);
      wk = weekCache[k] || (weekCache[k] = SCH.weekMax(d, function (x) { return PrayerTimes.forDate(x, S); }));
    }
    return SCH.build(timesFor(d), isFriday(d), S, wk);
  }
  function isFriday(d) { return d.getDay() === 5; }

  // ——— بطاقات الصلوات ———
  var builtFor = null;
  function renderCards(d, nx, ns) {
    var k = dayKey(d) + nx.key + (nx.tomorrow ? "t" : "") + Math.floor(ns / 60);
    if (builtFor === k) return;
    builtFor = k;
    var t = timesFor(d), sch = schFor(d), fri = isFriday(d);
    var tt = nx.tomorrow ? timesFor(tomorrow(d)) : null, schT = nx.tomorrow ? schFor(tomorrow(d)) : null;
    $("prayers").innerHTML = SCH.ORDER.map(function (key) {
      var name = (key === "dhuhr" && fri) ? NAMES.jumuah : NAMES[key];
      var row = sch.filter(function (x) { return x.base === key; })[0];
      var showTomorrow = tt && key === "fajr";
      var adhan = showTomorrow ? tt.fajr : t[key];
      var iq;
      if (key === "sunrise") iq = '<div class="iq">&nbsp;</div>';
      else if (row.key === "jumuah" && !S.iqama.jumuah) iq = '<div class="iq">الخطبة</div>';
      else iq = '<div class="iq">الإقامة <b>' + fmtMin(showTomorrow ? schT[0].iqamaMin : row.iqamaMin) + "</b></div>"; // الإصدار ٨: يحترم الموعد الثابت والإقامة الذكية
      var cls = "p" + (key === "sunrise" ? " minor" : "") + (key === nx.key ? " is-next" : "") +
        (!nx.tomorrow && key !== nx.key && t[key] * 60 <= ns ? " done" : "") + (nx.tomorrow && key !== "fajr" ? " done" : "");
      var tagTxt = showTomorrow ? "غداً" : "";
      if (key === "fajr" && S.imsakMinutes > 0 && inRamadan(showTomorrow ? tomorrow(d) : d))
        tagTxt = (tagTxt ? tagTxt + " • " : "") + "الإمساك " + fmtMinText(adhan - S.imsakMinutes);
      return '<div class="' + cls + '">' + (tagTxt ? '<span class="tag">' + tagTxt + "</span>" : "") +
        '<div class="name">' + name + (S.englishNames ? '<span class="en">' + NAMES_EN[row && row.key === "jumuah" ? "jumuah" : key] + "</span>" : "") + "</div>" +
        '<div class="adhan">' + fmtMin(adhan, true) + "</div>" + iq + "</div>";
    }).join("");
  }

  function inRamadan(d) {
    var h = window.ClockSeasons && ClockSeasons.hijri(d, S.hijriOffset);
    return !!(h && h.m === 9);
  }

  // ——— تذكيرات المواسم ———
  var seasonFor = null, seasonList = [];
  function renderSeason(d) {
    var el = $("season");
    if (!S.showSeasons || !window.ClockSeasons) { el.hidden = true; return; }
    if (seasonFor !== dayKey(d)) { seasonFor = dayKey(d); seasonList = ClockSeasons.messages(d, { hijriOffset: S.hijriOffset }); }
    if (!seasonList.length) { el.hidden = true; return; }
    var txt = digits(seasonList[Math.floor(Date.now() / 12000) % seasonList.length]);
    el.hidden = false;
    if (el.textContent !== txt) el.textContent = txt;
  }

  // ——— التاريخ ———
  var dateFor = null;
  function renderDates(d) {
    if (dateFor === dayKey(d)) return;
    dateFor = dayKey(d);
    var wd = new Intl.DateTimeFormat("ar-u-nu-latn", { weekday: "long" }).format(d);
    var g = new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d);
    var h = "";
    try {
      h = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(d.getTime() + S.hijriOffset * 86400000));
    } catch (e) {}
    $("weekday").textContent = wd;
    $("hijri").textContent = h ? digits(h.replace(/\s*هـ?$/, "")) + " هـ" : "";
    $("greg").textContent = digits(g) + " م";
  }

  // ——— الألوان حسب وقت اليوم ———
  function applyPalette(nowMin, t) {
    var p = S.theme === "auto" ? SCH.period(nowMin, t) : S.theme;
    if (document.body.dataset.palette !== p) document.body.dataset.palette = p;
  }

  // ——— الشرائح ———
  var slideIdx = 0, lastSlide = 0;
  function buildSlides(nowMin, t) {
    var list = [];
    var A = window.CLOCK_ADHKAR, QRx = window.ClockQuran;
    function adk(kind, listS, def) {
      var src = listS && listS.length ? listS : null;
      if (src || (A && QRx)) {
        QRx.parseAdhkar(src || A[def]).forEach(function (x) { var tx = QRx.dhikrText(x); if (tx && !tx.quran && tx.text.length < 260) list.push({ kind: kind, text: tx.text + (x.n > 1 ? " (" + digits(x.n) + ")" : ""), ref: x.src }); });
      } else C[def].forEach(function (x) { list.push({ kind: kind, text: x }); });
    }
    if (S.morningMode !== "off" && nowMin >= t.fajr && nowMin < t.dhuhr) adk("أذكار الصباح", S.adhkarMorningList, "morning");
    if (S.eveningMode !== "off" && nowMin >= t.asr && nowMin < t.maghrib) adk("أذكار المساء", S.adhkarEveningList, "evening");
    C.ayat.forEach(function (x) { list.push({ kind: "آية", text: x.text, ref: x.ref }); });
    C.ahadith.forEach(function (x) { list.push({ kind: "حديث شريف", text: "«" + x.text + "»", ref: x.ref }); });
    (S.customMessages || []).forEach(function (x) { if (x) list.push({ kind: "تنبيه", text: x }); });
    return list;
  }
  function showSlide(item) {
    var el = $("slide");
    el.classList.add("fade");
    setTimeout(function () {
      $("slideKind").textContent = item.kind;
      $("slideText").textContent = item.text;
      $("slideText").classList.toggle("long", item.text.length > 120);
      $("slideRef").textContent = item.ref || "";
      el.classList.remove("fade");
    }, 600);
  }

  // ——— الإعلانات ———
  var annShowUntil = 0, annLastCycle = Date.now(), annIdx = 0, annCurrent = null;
  // الإصدار ٧: شريط متحرك. العاجل دائماً فيه، وبقية الإعلانات حسب «طريقة عرض الإعلانات»
  var tickerTxt = "";
  // الإصدار ٨٫١: شريط متحرك بأنواع ملوّنة وأولوية وسرعة واتجاه قابلين للضبط
  var tickerSig = "";
  function renderTicker(d) {
    var tk = $("ticker");
    var list = window.ClockTicker ? ClockTicker.items(ClockAnnouncements.all(), S, d) : [];
    if (!list.length) { tk.hidden = true; tickerTxt = ""; tickerSig = ""; return; }
    tk.hidden = false;
    var tone = ClockTicker.tone(list);
    tk.dataset.tone = tone;
    tk.querySelector(".tag").textContent = tone === "urgent" ? "عاجل" : tone === "mourn" ? "تعزية" : "إعلانات";
    var sig = JSON.stringify(list) + "|" + S.tickerSpeed + "|" + S.tickerDir + "|" + innerWidth;
    if (sig === tickerSig) return;
    tickerSig = sig;
    var msg = $("tickerMsg");
    msg.innerHTML = "";
    msg.classList.remove("scroll", "ltr");
    function makeRun(sep) {
      var run = document.createElement("span"); run.className = "run";
      list.forEach(function (it, i) {
        var el = document.createElement("span"); el.className = "tk-item k-" + it.kind;
        var dup = it.kind === "urgent" && tone === "urgent" || it.text.indexOf(it.label) === 0;
        if (!dup && (list.length > 1 || it.kind !== "info")) { var b = document.createElement("i"); b.textContent = it.label; el.appendChild(b); }
        el.appendChild(document.createTextNode(it.text));
        run.appendChild(el);
        if (sep || i < list.length - 1) { var s = document.createElement("span"); s.className = "tk-sep"; s.textContent = "✦"; run.appendChild(s); }
      });
      return run;
    }
    var run = makeRun(false);
    msg.appendChild(run);
    requestAnimationFrame(function () {
      if (run.getBoundingClientRect().width <= msg.getBoundingClientRect().width + 4) return; // يتسع النص: ثابت بلا حركة
      msg.innerHTML = "";
      var a = makeRun(true), b = makeRun(true);
      msg.appendChild(a); msg.appendChild(b);
      msg.style.setProperty("--tk-dur", ClockTicker.duration(a.getBoundingClientRect().width, innerWidth, S.tickerSpeed) + "s");
      msg.classList.add("scroll");
      if (S.tickerDir === "ltr") msg.classList.add("ltr");
    });
  }

  function announcementState(d) {
    var list = ClockAnnouncements.active(d).filter(function (a) { return window.ClockTicker ? ClockTicker.onScreen(a, S) : !a.urgent && S.annMode !== "ticker"; });
    if (!list.length || S.annEveryMinutes <= 0) { annCurrent = null; return null; }
    var nowMs = Date.now();
    if (annCurrent && nowMs < annShowUntil) return annCurrent;
    if (annCurrent) { // انتهى إعلان: التالي أو نهاية الدورة
      annIdx++;
      if (annIdx < list.length) { annShowUntil = nowMs + S.annSeconds * 1000; annCurrent = { a: list[annIdx], i: annIdx, n: list.length }; return annCurrent; }
      annCurrent = null; annLastCycle = nowMs; return null;
    }
    if (nowMs - annLastCycle >= S.annEveryMinutes * 60000) {
      annIdx = 0; annShowUntil = nowMs + S.annSeconds * 1000;
      annCurrent = { a: list[0], i: 0, n: list.length }; return annCurrent;
    }
    return null;
  }

  // ——— الشاشات الكاملة ———
  var ovShown = false, lastOvKey = "";
  function overlay(st) {
    var ov = $("overlay");
    if (!st) { if (ovShown) { ov.hidden = true; ovShown = false; lastOvKey = ""; } return; }
    ov.hidden = false; ovShown = true;
    ov.className = "overlay ov-" + st.name + (st.name === "prayer" && S.dimDuringPrayer ? " dim" : "") + (st.name === "prayer" && khMode() === "black" ? " black" : "") + (st.name === "prayer" && khMode() === "calm" ? " calm" : "") + (st.name === "iqama" && st.left <= 60 ? " pulse" : "");
    var ring = st.name === "iqama", total = ring ? Math.max(1, st.p.I - (st.p.A + S.adhanScreenMinutes * 60)) : 1;
    var ros = $("rosette");
    if (ros) { ros.style.display = ring ? "" : "none"; if (ring && window.ClockMihrab) ClockMihrab.rosetteProgress(ros, 1 - st.left / total); }
    else if ($("ovRing")) {
      $("ovRing").style.display = ring ? "" : "none";
      if (ring) $("ovRingFg").style.strokeDashoffset = (628.3 * (1 - st.left / total)).toFixed(1);
    }
    // دخول سينمائي عند تغيّر نوع الشاشة
    var stKey = st.name + (st.p ? st.p.key : "");
    if (stKey !== lastOvKey) { lastOvKey = stKey; ov.classList.remove("enter"); void ov.offsetWidth; ov.classList.add("enter"); }
    else ov.classList.add("enter");
    $("ovIcon").hidden = !(st.name === "iqama" && st.left <= Math.max(1, khMode() === "off" ? 3 : +S.khushooBefore || 3) * 60);
    var big = $("ovBig"), title = "", text = "", sub = "", cls = "ov-big", dots = "";
    var name = st.p ? NAMES[st.p.key] : "";
    if (st.name === "adhan") {
      title = "حان الآن موعد أذان"; cls += " text"; text = "صلاة " + name;
      sub = "اللهم ربَّ هذه الدعوةِ التامة، والصلاةِ القائمة، آتِ محمداً الوسيلةَ والفضيلة";
    } else if (st.name === "iqama") {
      title = "الإقامة لصلاة " + name + " بعد"; text = fmtDur(st.left);
      var msgs = S.customMessages && S.customMessages.length ? S.customMessages : [""];
      sub = msgs[Math.floor(st.left / 20) % msgs.length];
      if (S.rowsReminder && st.left <= 60) sub = "استووا واعتدلوا، وسُدّوا الفُرَج • أغلقوا الهواتف";
      else if (st.p.key === "jumuah" && khutbaLine()) sub = khutbaLine();
    } else if (st.name === "prayer") {
      cls += " text"; text = st.p.key === "jumuah" && !S.iqama.jumuah ? "الخطبة والصلاة" : "الصلاة قائمة";
      if (st.p.key === "jumuah" && khutbaLine()) sub = khutbaLine();
    } else if (st.name === "adhkar") {
      title = "أذكار بعد الصلاة"; cls += " adhkar";
      var per = Math.max(20, S.afterPrayerAdhkarMinutes * 60 / C.afterPrayer.length);
      text = C.afterPrayer[Math.floor(st.since / per) % C.afterPrayer.length];
    } else if (st.name === "rest") {
      cls += " rest-clock num"; text = $("hm").textContent + ($("ampm").textContent ? " " + $("ampm").textContent : "");
      sub = st.nextText;
      var k = Math.floor(Date.now() / 60000) % 9; // تتنقل الساعة كل دقيقة لحماية الشاشة
      ov.style.setProperty("--rx", ((k % 3) - 1) * 22 + "vw");
      ov.style.setProperty("--ry", (Math.floor(k / 3) - 1) * 22 + "vh");
    } else if (st.name === "ann") {
      title = st.a.title || "إعلان"; cls += " ann"; text = st.a.text || "";
      if (st.n > 1) for (var i = 0; i < st.n; i++) dots += '<i class="' + (i === st.i ? "on" : "") + '"></i>';
    }
    // الإصدار ٦: سطر إنجليزي ومناسبة تُقام بعد هذه الصلاة
    var enTxt = "";
    if (S.englishNames && st.p) enTxt = { adhan: "Adhan \u2022 ", iqama: "Iqamah \u2022 ", prayer: "", adhkar: "" }[st.name] + (st.name === "adhan" || st.name === "iqama" ? NAMES_EN[st.p.key] : "");
    if ($("ovEn")) $("ovEn").textContent = enTxt;
    var evEl = $("ovEvent"), evTxt = "";
    if (evEl && st.p && (st.name === "iqama" || st.name === "adhkar" || st.name === "adhan")) {
      var ev = window.ClockEvents && ClockEvents.afterPrayer(eventsToday, st.p.base);
      if (ev) evTxt = (st.name === "adhkar" && st.since < 600 ? "الآن: " : "بعد الصلاة: ") + ev.title + (ev.person ? " على " + ev.person : "");
    }
    if (evEl && st.name === "rest") {
      var up = window.ClockEvents && ClockEvents.featured(eventsToday, curNs);
      if (up && up.at > curNs) evTxt = up.title + " " + fmtMinText(Math.round(up.at / 60));
    }
    if (evEl) { evEl.hidden = !evTxt; evEl.textContent = evTxt; evEl.dataset.tone = evTxt && /الجنازة/.test(evTxt) ? "mourn" : ""; }
    big.className = cls;
    if (big.textContent !== text) big.textContent = text;
    $("ovTitle").textContent = title;
    $("ovSub").textContent = sub;
    $("ovDots").innerHTML = dots;
  }

  // ——— الإصدار ٨: وضع الخشوع ———
  function khMode() { var m = S.khushoo || "calm"; if (S.prayerBlack && m !== "off") m = "black"; return m; }
  var khLast = "";
  function applyKhushoo(st) {
    var m = khMode(), phase = "";
    if (m !== "off" && st) {
      if (st.name === "prayer") phase = "prayer";
      else if (st.name === "iqama" && st.left <= Math.max(0, +S.khushooBefore || 0) * 60) phase = "before";
    }
    var k = m + phase;
    if (k === khLast) return;
    khLast = k;
    var b = document.body.classList;
    b.toggle("kh-before", phase === "before"); b.toggle("kh-prayer", phase === "prayer");
    b.toggle("kh-calm", m === "calm"); b.toggle("kh-black", m === "black");
    document.documentElement.style.setProperty("--kh-dim", String(Math.max(0.03, Math.min(0.6, +S.khushooDim || 0.12))));
  }
  // ——— الإصدار ٨: ساعة الجهاز غير مضبوطة (بعد انقطاع الكهرباء في جهاز بلا بطارية ساعة ولا إنترنت) ———
  function clockSane(d) {
    var bad = S.clockCheck !== false && !simulating && d.getFullYear() < 2025;
    var el = $("clockWarn");
    if (!el && bad) {
      el = document.createElement("div"); el.id = "clockWarn"; el.className = "clock-warn";
      el.innerHTML = "<b>ساعة الجهاز غير مضبوطة</b><span>المواقيت المعروضة قد تكون خاطئة. صِل الجهاز بالإنترنت أو اضبط التاريخ والوقت من إعدادات النظام.</span>";
      document.body.appendChild(el);
    }
    if (el) el.hidden = !bad;
  }

  function khutbaLine() {
    var t = String(S.khutbaTopic || "").trim(), k = String(S.khatib || "").trim();
    return t || k ? (t ? "موضوع الخطبة: " + t : "") + (t && k ? " • " : "") + (k ? "الخطيب: " + k : "") : "";
  }

  // ——— حلقة الذكر (الإصدار ٧): الأذكار والآية والتفسير والفتاوى مع شريط الوقت ———
  var PREVIEW_MODE = params.get("preview") === "1";
  function preloadContent() { // المصحف دائماً (آيات الأذكار منه)، والتفاسير المختارة فقط
    if (!window.ClockQuran) return;
    ClockQuran.ensureQuran().then(function () { return S.ayahEnabled ? ClockQuran.ensureTafsirs(S.tafsirs) : null; }).catch(function () {});
  }
  function dockData(d, ns, nowMin, t, nx, sch) {
    var fri = isFriday(d), nk = nx.next.tomorrow ? "fajr" : nx.next.key;
    var L = window.ClockEvents ? ClockEvents.dayline(nowMin + d.getSeconds() / 60, t) : { now: 0, night: false };
    return {
      hm: $("hm").textContent, sec: $("sec").textContent, ap: $("ampm").textContent,
      date: $("weekday").textContent + " • " + $("hijri").textContent,
      nextLabel: nx.next.key === "sunrise" ? "الشروق بعد" : "القادمة",
      nextName: nx.next.key === "sunrise" ? "" : NAMES[nx.next.key === "dhuhr" && fri ? "jumuah" : nx.next.key],
      nextLeft: fmtDur(nx.left), day: L.now, night: L.night,
      prayers: SCH.ORDER.map(function (k) {
        var row = sch.filter(function (x) { return x.base === k; })[0];
        var past = !nx.next.tomorrow ? t[k] * 60 <= ns : k !== "fajr";
        return { name: k === "dhuhr" && fri ? NAMES.jumuah : NAMES[k], adhan: fmtMinText(t[k]), iq: row && row.I > row.A ? fmtMinText(row.iqamaMin) : "",
          cls: (k === nk ? "next" : past ? "done" : "") + (k === "sunrise" ? " minor" : "") };
      })
    };
  }
  // الفتاوى الدورية (مثل الإعلانات، في الأوقات العادية فقط)
  var fatwaLast = Date.now(), fatwaUntil = 0, fatwaCur = null;
  function fatwaState() {
    if (!window.ClockFatwa || !window.ClockReader || !S.fatwaEnabled || !(S.fatwaEveryMinutes > 0)) { fatwaCur = null; return null; }
    var nowMs = Date.now();
    if (fatwaCur && nowMs < fatwaUntil) return fatwaCur;
    if (fatwaCur) { fatwaCur = null; fatwaLast = nowMs; return null; }
    if (nowMs - fatwaLast < S.fatwaEveryMinutes * 60000) return null;
    var nf = ClockFatwa.next(S);
    if (!nf) { fatwaLast = nowMs; return null; }
    var dur = Math.min(240, ClockReader.fatwaDuration(nf.f));
    fatwaUntil = nowMs + dur * 1000;
    fatwaCur = { kind: "fatwa", key: "fatwa" + nowMs, fatwa: nf.f, start: nowMs, sub: nf.n > 1 ? QRnum(nf.i + 1) + " من " + QRnum(nf.n) : "" };
    return fatwaCur;
  }
  function QRnum(n) { return digits(n); }

  // ——— المناسبات الخاصة (الإصدار ٦) ———
  var eventsToday = [], eventsKey = "", curNs = 0;
  function computeEvents(d, sch) {
    if (!window.ClockEvents) return;
    var k = dayKey(d) + "|" + JSON.stringify(S.events || []) + S.taraweeh + S.qiyamTime + S.eidPrayerTime + S.hijriOffset;
    if (k === eventsKey) return;
    eventsKey = k;
    var hj = window.ClockSeasons && ClockSeasons.hijri(d, S.hijriOffset);
    eventsToday = ClockEvents.forDay(d, { sch: sch, hijri: hj, S: S });
  }
  function renderEvent(ns) {
    var el = $("eventCard"); if (!el) return;
    var ev = window.ClockEvents && ClockEvents.featured(eventsToday, ns);
    if (!ev) { if (!el.hidden) { el.hidden = true; document.body.classList.remove("has-event"); } return; }
    el.hidden = false; document.body.classList.add("has-event");
    el.dataset.tone = ev.tone;
    var title = ev.title + (ev.person ? " على " + ev.person : "");
    var sub = ev.type === "funeral" ? "إنّا لله وإنّا إليه راجعون" + (ev.note ? " • " + ev.note : "") : (ev.note || (S.englishNames ? ev.en : ""));
    var time = (ev.when ? ev.when + " • " : "") + fmtMinText(Math.round(ev.at / 60));
    var left = ns >= ev.at ? "الآن" : (ev.at - ns <= 3 * 3600 ? "بعد " + fmtDur(ev.at - ns) : "");
    if ($("evTitle").textContent !== title) $("evTitle").textContent = title;
    if ($("evSub").textContent !== digits(sub)) $("evSub").textContent = digits(sub);
    if ($("evTime").textContent !== time) $("evTime").textContent = time;
    $("evLeft").textContent = left;
    el.classList.toggle("now", ns >= ev.at);
  }

  // ——— شريط اليوم ———
  var dlBuilt = "";
  function renderDayline(d, nowMin, t, nxKey) {
    var box = $("dayline"); if (!box || !S.dayline || !window.ClockEvents) return;
    var L = ClockEvents.dayline(nowMin + d.getSeconds() / 60, t);
    var k = dayKey(d) + nxKey + S.englishNames + S.use24h + S.arabicDigits;
    if (dlBuilt !== k) {
      dlBuilt = k;
      var fri = isFriday(d);
      $("dlMarks").innerHTML = L.marks.map(function (m) {
        var nk = m.key === "dhuhr" && fri ? "jumuah" : m.key;
        return '<span class="dl-m' + (m.key === "sunrise" ? " minor" : "") + (m.key === nxKey ? " next" : "") + '" style="right:' + (m.x * 100).toFixed(2) + '%"><i></i><b>' + NAMES[nk] + "</b><em>" + fmtMinText(t[m.key]) + "</em></span>";
      }).join("");
    }
    $("dlFill").style.width = (L.now * 100).toFixed(2) + "%";
    var orb = $("dlOrb");
    orb.style.right = (L.now * 100).toFixed(2) + "%";
    orb.classList.toggle("moon", L.night);
  }

  // ——— الطقس (open-meteo بدون مفتاح) ———
  var WX = { 0: "صحو", 1: "صحو غالباً", 2: "غائم جزئياً", 3: "غائم", 45: "ضباب", 48: "ضباب", 51: "رذاذ", 53: "رذاذ", 55: "رذاذ", 61: "مطر خفيف", 63: "مطر", 65: "مطر غزير", 80: "زخات", 81: "زخات", 82: "زخات قوية", 95: "عاصفة رعدية", 96: "عاصفة رعدية", 99: "عاصفة رعدية" };
  function loadWeather() {
    if (!S.showWeather || !window.fetch) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=" + S.latitude + "&longitude=" + S.longitude + "&current=temperature_2m,weather_code&timezone=auto")
      .then(function (r) { return r.json(); }).then(function (j) {
        var c = j.current; if (!c) return;
        $("wx").textContent = "• " + digits(Math.round(c.temperature_2m)) + "° " + (WX[c.weather_code] || "");
      }).catch(function () {});
  }
  loadWeather(); setInterval(loadWeather, 30 * 60 * 1000);

  // ——— إعادة التحميل اليومية بعد أذكار الفجر ———
  var loadedAt = Date.now();
  function maybeReload(d, ns, sch) {
    if (!S.dailyReload || simulating) return;
    var fajr = sch[0];
    if (ns >= fajr.Z + 60 && ns < fajr.Z + 600 && Date.now() - loadedAt > 3600 * 1000) {
      if (navigator.onLine === false && !navigator.serviceWorker) return; // لا تُخاطر بصفحة فارغة بدون إنترنت أو نسخة محفوظة
      location.reload();
    }
  }

  // ——— الحلقة الرئيسية ———
  function tick() {
    var d = now();
    var ns = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    var nowMin = Math.floor(ns / 60);
    var t = timesFor(d);
    var sch = schFor(d);

    // الساعة
    var h = d.getHours(), ap = "";
    if (!S.use24h) { ap = h < 12 ? "ص" : "م"; h = h % 12 || 12; }
    var hm = digits((S.use24h ? pad(h) : h) + ":" + pad(d.getMinutes()));
    if ($("hm").textContent !== hm) {
      var hmEl = $("hm"); hmEl.textContent = hm;
      hmEl.classList.remove("flip"); void hmEl.offsetWidth; hmEl.classList.add("flip");
    }
    $("sec").textContent = digits(pad(d.getSeconds()));
    $("ampm").textContent = ap;
    $("ovClock").textContent = hm + (ap ? " " + ap : "");
    renderDates(d);
    applyPalette(nowMin, t);

    // الحالة: أحداث الصلاة أولاً، ثم الإعلانات في الأوقات العادية
    curNs = ns;
    computeEvents(d, sch);
    var st = SCH.state(ns, sch, S);
    playSounds(st);
    applyKhushoo(st);
    clockSane(d);
    var nx = SCH.next(ns, t, timesFor(tomorrow(d)).fajr);
    preAlert(ns, nx);
    if (!st && !simRestOff) {
      var r = SCH.rest(ns, sch, t, S, isFriday(d));
      if (r) {
        var nk = nx.next.key === "dhuhr" && isFriday(d) ? "jumuah" : nx.next.key;
        st = { name: "rest", nextText: (nx.next.key === "sunrise" ? "الشروق " : NAMES[nk] + " ") + fmtMinText(Math.round(nx.next.at / 60)) };
      }
    }
    // الإصدار ٧: ما بعد الصلاة وأذكار الصباح والمساء والفتاوى تُعرض في «حلقة الذكر» والساعة ظاهرة
    var view = null, dk = dayKey(d);
    if (st && (st.name === "adhkar" || st.name === "ayah")) {
      view = { kind: st.name, key: st.name + dk + st.p.key, since: st.since, p: st.p, seed: dk + st.p.key, sub: "بعد صلاة " + NAMES[st.p.key] };
    } else if (!st) {
      var ses = SCH.session(ns, sch, S);
      if (ses) view = { kind: ses.name, key: ses.name + dk, since: ses.since, sub: "" };
    }
    if (!st && !view) {
      var ann = announcementState(d);
      if (ann) st = { name: "ann", a: ann.a, i: ann.i, n: ann.n };
    }
    if (!st && !view) {
      var fw = fatwaState();
      if (fw) { view = fw; view.since = (Date.now() - fw.start) / 1000; }
    }
    if (view && window.ClockReader) {
      ClockReader.show(view, dockData(d, ns, nowMin, t, nx, sch));
      overlay(null);
      if (!st) st = { name: "reading", kind: view.kind };
    } else {
      if (window.ClockReader) ClockReader.hide();
      overlay(st && st.name !== "adhkar" && st.name !== "ayah" ? st : null);
    }
    renderTicker(d);

    renderSeason(d);

    // الصلاة القادمة
    var key = nx.next.key === "dhuhr" && isFriday(d) ? "jumuah" : nx.next.key;
    $("heroLabel").textContent = nx.next.key === "sunrise" ? "القادم" : (nx.next.tomorrow ? "الصلاة القادمة (غداً)" : "الصلاة القادمة");
    $("heroName").textContent = NAMES[key];
    $("heroCount").textContent = fmtDur(nx.left);
    var atMin = Math.round(nx.next.at / 60);
    $("heroAt").textContent = (nx.next.key === "sunrise" ? "" : "الأذان ") + fmtMinText(atMin);
    var nrow = nx.next.key === "sunrise" ? null : (nx.next.tomorrow ? schFor(tomorrow(d))[0] : sch.filter(function (x) { return x.base === nx.next.key; })[0]);
    $("heroIq").textContent = nrow && nrow.iqamaMin > nrow.adhan ? "الإقامة " + fmtMinText(nrow.iqamaMin) : "";
    if ($("dial") && window.ClockDial) {
      ClockDial.build($("dial"), t, isFriday(d));
      ClockDial.update(ns / 60, t, nx.prev.at / 60, nx.next.tomorrow ? "fajr" : nx.next.key);
    }
    if ($("arch") && window.ClockMihrab) {
      var hj = window.ClockSeasons && ClockSeasons.hijri(d, S.hijriOffset);
      ClockMihrab.update($("arch"), d, S, hj && hj.d);
    }
    // رمضان: الإفطار والإمساك
    var rh = S.ramadanHero && window.ClockEvents && ClockEvents.ramadanHero(ns, nx, t, S.imsakMinutes, inRamadan(d), inRamadan(tomorrow(d)));
    $("hero").classList.toggle("ramadan", !!rh);
    if (rh) {
      $("heroLabel").textContent = rh.label;
      $("heroName").textContent = rh.name;
      $("heroCount").textContent = fmtDur(rh.left);
      $("heroAt").textContent = rh.iftar ? "أذان المغرب " + fmtMinText(atMin) : "الإمساك " + fmtMinText(Math.round(rh.at / 60));
      $("heroIq").textContent = rh.imsak ? "الفجر " + fmtMinText(atMin) : $("heroIq").textContent;
    }
    if ($("heroEn")) $("heroEn").textContent = S.englishNames ? (rh ? (rh.iftar ? "Iftar" : "Imsak") : (nx.next.key === "sunrise" ? "Sunrise" : "Next prayer \u2022 " + NAMES_EN[key])) : "";
    renderEvent(ns);
    renderDayline(d, nowMin, t, nx.next.tomorrow ? "fajr" : nx.next.key);
    var dot = $("hero").querySelector(".dot");
    if (dot) dot.style.display = $("heroIq").textContent ? "" : "none";
    $("hero").classList.toggle("soon", nx.left <= 600 && nx.next.key !== "sunrise");
    renderCards(d, nx.next, ns);

    // الشرائح
    if (S.showSlides && !st && (!lastSlide || Date.now() - lastSlide >= S.slideSeconds * 1000)) {
      var list = buildSlides(nowMin, t);
      if (list.length) showSlide(list[slideIdx++ % list.length]);
      lastSlide = Date.now();
    }

    maybeReload(d, ns, sch);
    shiftPixels(d);
    window.__clockTick = Date.now(); // نبض للمراقب الذاتي (index.html)
    if (window.ClockLook) ClockLook.tick({ d: d, ns: ns, t: t, nx: nx, sch: sch, st: st, friday: isFriday(d), S: S, fmtMinText: fmtMinText, fmtDur: fmtDur, digits: digits, NAMES: NAMES, annLeft: st && st.name === "ann" ? Math.max(0, annShowUntil - Date.now()) / (S.annSeconds * 1000) : 0 });
  }

  // ——— الأصوات عند تغيّر الحالة ———
  var lastSound = null;
  function playSounds(st) {
    var k = st && (st.name === "adhan" || st.name === "prayer") ? st.name + st.p.key : null;
    if (k === lastSound) return;
    var first = lastSound === null && !soundsArmed;
    lastSound = k; soundsArmed = true;
    if (!k || first || !S.soundAlerts || !window.ClockSound) return; // لا صوت عند فتح الصفحة في منتصف حدث
    // الإصدار ٨: صوت لكل حدث من الأصوات المضمّنة أو ملف مرفوع، والفجر يمكن أن يختلف
    if (st.name === "adhan") {
      var snd = st.p.base === "fajr" && S.fajrSound && S.fajrSound !== "same" ? S.fajrSound : (S.adhanSound || (S.adhanAudio ? "file" : "chime"));
      ClockSound.play(snd, S, st.p.base === "fajr" ? "fajr" : "adhan");
    } else ClockSound.play(S.iqamaSound || "iqama", S, "iqama");
  }
  // تنبيه خفيف قبل الأذان بعدد من الدقائق
  var lastPre = "";
  function preAlert(ns, nx) {
    var m = +S.preAlertMinutes || 0;
    if (!m || !S.soundAlerts || !window.ClockSound || nx.next.key === "sunrise" || simulating && speed > 1) return;
    var left = nx.left, tag = nx.next.key + Math.round(nx.next.at / 60);
    if (left <= m * 60 && left > m * 60 - 5 && lastPre !== tag) { lastPre = tag; ClockSound.play("soon", S, "soon"); }
  }
  var soundsArmed = false;

  // ——— حماية الشاشة: إزاحة بسيطة كل دقيقة ———
  var lastShift = -1;
  function shiftPixels(d) {
    if (!S.pixelShift) return;
    var m = d.getMinutes();
    if (m === lastShift) return;
    lastShift = m;
    var dx = [0, 2, 3, 2, 0, -2, -3, -2][m % 8], dy = [0, -2, 0, 2, 3, 2, 0, -2][m % 8];
    $("board").style.transform = "translate(" + dx + "px," + dy + "px)";
  }

  ClockAnnouncements.onChange(function () { builtFor = null; });
  // واجهة لبقية الوحدات: تغيير الإعدادات حيّاً (المعاينة، المزامنة من الجوال، النقر لتبديل الخلفية)
  window.ClockApp = {
    get S() { return S; },
    setSettings: function (n) {
      S = n; dayCache = {}; weekCache = {}; builtFor = null; dateFor = null; seasonFor = null; slideIdx = 0; lastSlide = 0;
      applyStatic(); applyOrientation();
      if (window.ClockReader) ClockReader.setSettings(S, { preview: PREVIEW_MODE });
      preloadContent();
      if (window.ClockLook) ClockLook.apply(S);
      tick();
    },
    tick: function () { tick(); }
  };
  if (window.ClockReader) ClockReader.setSettings(S, { preview: PREVIEW_MODE });
  preloadContent();
  if (window.ClockLook) ClockLook.init(S);
  tick();
  setInterval(tick, 250);
})();
