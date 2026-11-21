/*
 * نسخة الجوال من ساعة المسجد (الإصدار ٧): المواقيت والإقامة، الأذكار بعدّاد، المصحف مع التفاسير، القبلة، التنبيهات.
 * الإعدادات تأتي من المسجد نفسه (server.js أو data/settings.json)، ويحتفظ الجوال بآخر نسخة ليعمل بلا إنترنت.
 */
(function () {
  var C = window.MobileCore, Q = window.ClockQuran, QB = window.ClockQibla;
  var $ = function (id) { return document.getElementById(id); };
  var http = /^https?:$/.test(location.protocol) && !window.MC_EMBEDDED;
  // الإصدار ٩: داخل تطبيق أندرويد — تنبيهات أصلية تعمل والتطبيق مغلق، وربط اختياري بخادم المسجد
  var AN = window.AndroidClock && typeof window.AndroidClock.scheduleAlarms === "function" ? window.AndroidClock : null;
  function nst() { try { return JSON.parse(AN.status()); } catch (e) { return {}; } }
  var params = new URLSearchParams(location.search);

  // ——— الوقت (مع محاكاة للتجربة: m.html?sim=2026-11-20T11:50:00&speed=20) ———
  var simStart = params.get("sim") ? Date.parse(params.get("sim")) : NaN, realStart = Date.now(), speed = +params.get("speed") || 1;
  function nowDate() { return isNaN(simStart) ? new Date(window.ClockSync ? ClockSync.now() : Date.now()) : new Date(simStart + (Date.now() - realStart) * speed); }

  // ——— التخزين ———
  function readJSON(k, def) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? def : v; } catch (e) { return def; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var M = ClockConfig.merge(C.DEFAULTS, readJSON(C.MKEY, {}));
  function saveM() { writeJSON(C.MKEY, M); }

  // إعدادات المسجد: آخر ما وصل من المسجد ← إعدادات هذا الجهاز (إن كان هو جهاز الشاشة) ← الافتراضي
  var mosqueCache = readJSON(C.CACHE, null);
  function mosqueSettings() {
    if (mosqueCache && mosqueCache.settings) return ClockConfig.merge(window.CLOCK_DEFAULTS, mosqueCache.settings);
    return ClockConfig.load();
  }
  var S = null;
  function recompute() {
    S = C.effective(mosqueSettings(), M, window.OMAN_CITIES);
    applyLook(); renderStatic(); lastMinute = null; alertList = null; syncNativeSoon();
    if (curView === "qibla") renderQibla();
  }
  function mosqueBase() {
    var u = String(M.mosqueUrl || "").trim();
    if (u) return u.replace(/[?#].*$/, "").replace(/[^/]*\.html$/, "").replace(/\/?$/, "/");
    return http ? "" : null;
  }
  function refreshMosque() {
    var base = mosqueBase();
    if (base === null || !window.fetch) return Promise.resolve(false);
    function get(u) { return fetch(base + u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw 0; return r.json(); }); }
    return get("api/settings").then(function (j) { if (!j || !j.settings) throw 0; return j; })
      .catch(function () { return get("data/settings.json"); }).then(function (j) {
      // يقبل ملف server.js {rev, settings} أو ملف «تصدير الإعدادات» من لوحة التحكم كما هو
      if (j && !j.settings && typeof j === "object" && (j.iqama || j.mosqueName)) j = { rev: "f" + JSON.stringify(j).length + ":" + (j.mosqueName || ""), settings: j };
      if (!j || !j.settings || typeof j.settings !== "object") return false;
      var changed = !mosqueCache || String(mosqueCache.rev) !== String(j.rev);
      mosqueCache = { rev: j.rev, settings: j.settings, at: Date.now() };
      writeJSON(C.CACHE, mosqueCache);
      if (changed) recompute();
      return true;
    }).catch(function () { return false; });
  }

  // ——— المظهر ———
  var darkMQ = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function isDark() { return M.theme === "dark" || (M.theme === "auto" && (!darkMQ || darkMQ.matches)); }
  function applyLook() {
    var root = document.documentElement;
    root.dataset.theme = M.theme;
    root.style.setProperty("--fs", M.fontScale);
    root.style.setProperty("--qs", M.quranScale);
    // لون هوية المسجد يحل محل الذهبي في الوضع الداكن
    if (S.accentColor && isDark()) { root.style.setProperty("--accent", S.accentColor); }
    else root.style.removeProperty("--accent");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark() ? "#071712" : "#f6f1e6");
  }
  if (darkMQ && darkMQ.addEventListener) darkMQ.addEventListener("change", function () { applyLook(); });

  var toastT;
  function toast(msg, ms) {
    var t = $("toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove("on"); }, ms || 2600);
  }
  function vib(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function D(s) { return C.digits(s, S); }

  // ——— التواريخ ———
  function weekday(d) { return new Intl.DateTimeFormat("ar-u-nu-latn", { weekday: "long" }).format(d); }
  function greg(d) { return D(new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d)); }
  function hijri(d) {
    try {
      var h = new Intl.DateTimeFormat("ar-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "long", year: "numeric" })
        .format(new Date(d.getTime() + (S.hijriOffset || 0) * 86400000));
      return D(h.replace(/\s*هـ?$/, "")) + "\u00a0هـ";
    } catch (e) { return ""; }
  }

  // ——— الرأس ———
  function renderStatic() {
    $("mosqueName").textContent = S.mosqueName || "مواقيت المسجد";
    document.title = S.mosqueName ? S.mosqueName + " • المواقيت" : "مواقيت المسجد";
    var hasLogo = !!S.logo;
    $("logo").hidden = !hasLogo; $("star").style.display = hasLogo ? "none" : "";
    if (hasLogo) $("logo").src = S.logo;
  }
  addEventListener("scroll", function () { $("head").classList.toggle("scrolled", scrollY > 4); }, { passive: true });

  // ——— التبويب ———
  var curView = "times";
  function show(v) {
    curView = v;
    document.querySelectorAll(".view").forEach(function (el) { el.classList.toggle("on", el.id === "v-" + v); });
    document.querySelectorAll("#tabbar button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === v); });
    scrollTo(0, 0);
    if (v === "adhkar") openAdhkar();
    if (v === "quran") openQuranIndex();
    if (v === "qibla") renderQibla();
    try { history.replaceState(null, "", "#" + v + (location.search ? "" : "")); } catch (e) {}
  }
  $("tabbar").addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) show(b.dataset.v); });

  // ——— المواقيت ———
  var dayOffset = 0, lastMinute = null;
  function renderHero(d) {
    var n = C.now(d, S), hero = $("hero");
    $("heroLabel").textContent = n.label + (n.tomorrow ? " (غداً)" : "");
    $("heroName").textContent = n.name;
    $("heroCount").textContent = C.dur(n.left, S);
    $("ringFg").setAttribute("stroke-dashoffset", (339.3 * (1 - Math.max(0, Math.min(1, n.progress)))).toFixed(1));
    hero.classList.toggle("live", n.mode === "iqama" || n.mode === "prayer");
    hero.classList.toggle("soon", n.mode === "next" && n.left <= 600 && n.key !== "sunrise");
    var at = [];
    if (n.mode === "ramadan") {
      at.push(n.iftar ? "أذان المغرب <b>" + C.fmt(n.adhan, S) + "</b>" : "الإمساك <b>" + C.fmt(n.at, S) + "</b>");
      if (n.imsak) at.push("الفجر <b>" + C.fmt(n.adhan, S) + "</b>");
    } else if (n.key === "sunrise") {
      at.push("الشروق <b>" + C.fmt(n.adhan, S) + "</b>");
    } else {
      at.push("الأذان <b>" + C.fmt(n.adhan, S) + "</b>");
      if (n.iqama) at.push("الإقامة <b>" + C.fmt(n.iqama, S) + "</b>");
    }
    $("heroAt").innerHTML = at.join('<span aria-hidden="true">✦</span>');
    var h = d.getHours(), mm = String(d.getMinutes()).padStart(2, "0"), ss = String(d.getSeconds()).padStart(2, "0");
    var clock = S.use24h ? String(h).padStart(2, "0") + ":" + mm + ":" + ss : (h % 12 || 12) + ":" + mm + ":" + ss + (h < 12 ? " ص" : " م");
    $("clockNow").textContent = "الساعة الآن " + D(clock);
    return n;
  }

  function renderTable(d, n) {
    var vd = C.addDays(d, dayOffset), dm = C.day(vd, S), nowMin = d.getHours() * 60 + d.getMinutes();
    $("dayName").textContent = dayOffset === 0 ? "اليوم، " + weekday(vd) : dayOffset === 1 ? "غداً، " + weekday(vd) : dayOffset === -1 ? "أمس، " + weekday(vd) : weekday(vd);
    $("dayDates").textContent = greg(vd) + " • " + hijri(vd);
    var nextKey = dayOffset === 0 && n && n.mode !== "prayer" && n.mode !== "iqama" && !n.tomorrow ? n.key : (dayOffset === 1 && n && n.tomorrow ? n.key : null);
    var liveKey = dayOffset === 0 && n && (n.mode === "iqama" || n.mode === "prayer") ? n.key : null;
    if (n && n.mode === "ramadan") nextKey = n.iftar ? "maghrib" : (n.tomorrow ? (dayOffset === 1 ? "fajr" : null) : (dayOffset === 0 ? "fajr" : null));
    var html = dm.rows.map(function (r) {
      var cls = [];
      if (r.base === "sunrise") cls.push("sun");
      if (r.key === nextKey || r.key === liveKey) cls.push("next");
      else if (dayOffset < 0 || (dayOffset === 0 && r.adhan <= nowMin)) cls.push("past");
      var a = C.fmt(r.adhan, S, true), iq = r.iqama != null ? C.fmt(r.iqama, S, true) : null;
      var en = S.englishNames ? "<small>" + ({ fajr: "Fajr", sunrise: "Sunrise", dhuhr: "Dhuhr", jumuah: "Jumu'ah", asr: "Asr", maghrib: "Maghrib", isha: "Isha" })[r.key] + "</small>" : "";
      return '<tr class="' + cls.join(" ") + '"><td>' + r.name + en + '</td><td><span class="t num">' + a.t + '</span><span class="p">' + a.p + "</span></td><td>" +
        (iq ? '<span class="t num">' + iq.t + '</span><span class="p">' + iq.p + "</span>" : '<span style="color:var(--faint)">—</span>') + "</td></tr>";
    }).join("");
    $("times").querySelector("tbody").innerHTML = html;
    var method = (PrayerTimes.METHODS[S.method] || {}).name || "";
    var where = S.cityName || "";
    $("srcNote").textContent = (dm.source === "table" ? "من الجدول الرسمي المعتمد في المسجد" : "الحساب: " + method) + (where ? " • " + where : "");
    $("headSub").textContent = (S.cityName ? S.cityName + " • " : "") + hijri(d);
  }

  var noteKey = null;
  function renderNotes(d) {
    var key = C.dayKey(d) + Math.floor((d.getHours() * 60 + d.getMinutes()) / 5);
    if (noteKey === key) return; noteKey = key;
    var out = [], ns = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    var ICON = {
      bell: '<svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
      star: '<svg viewBox="-50 -50 100 100" style="fill:currentColor;stroke:none"><path d="M0 -44L12.6 -30.4L31.1 -31.1L30.4 -12.6L44 0L30.4 12.6L31.1 31.1L12.6 30.4L0 44L-12.6 30.4L-31.1 31.1L-30.4 12.6L-44 0L-30.4 -12.6L-31.1 -31.1L-12.6 -30.4Z"/></svg>',
      moon: '<svg viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'
    };
    // المناسبات (جنازة، درس، عيد، تراويح…)
    try {
      var dm = C.day(d, S), hj = ClockSeasons.hijri(d, S.hijriOffset);
      ClockEvents.forDay(d, { sch: dm.sch, hijri: hj, S: S }).forEach(function (ev) {
        if (ns >= ev.until) return;
        var when = ev.when || C.fmt(Math.round(ev.at / 60), S);
        out.push('<div class="card note' + (ev.tone === "mourn" ? " mourn" : "") + '"><div class="ic">' + ICON.star + '</div><div class="tx"><b>' + esc(ev.title) + "</b>" +
          (ev.person || ev.note ? "<p>" + esc([ev.person, ev.note].filter(Boolean).join(" • ")) + "</p>" : "") +
          (ev.tone === "mourn" ? "<p>إنّا لله وإنّا إليه راجعون</p>" : "") + '</div><div class="when">' + esc(when) + "</div></div>");
      });
    } catch (e) {}
    // الإعلانات (العاجل أولاً)
    try {
      ClockAnnouncements.active(d).slice().sort(function (a, b) { return (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0); }).forEach(function (a) {
        out.push('<div class="card note' + (a.urgent ? " urgent" : "") + '"><div class="ic">' + ICON.bell + '</div><div class="tx"><b>' + esc(a.title || (a.urgent ? "إعلان عاجل" : "إعلان")) + "</b>" +
          (a.text && a.title ? "<p>" + esc(a.text) + "</p>" : a.text ? "<p>" + esc(a.text) + "</p>" : "") + "</div></div>");
      });
    } catch (e) {}
    // المواسم
    if (S.showSeasons !== false) {
      try { ClockSeasons.messages(d, { hijriOffset: S.hijriOffset }).slice(0, 2).forEach(function (m) {
        out.push('<div class="card note"><div class="ic">' + ICON.moon + '</div><div class="tx"><p style="color:var(--text);margin:0">' + esc(D(m)) + "</p></div></div>");
      }); } catch (e) {}
    }
    $("notes").innerHTML = out.join("");
  }
  if (window.ClockAnnouncements) ClockAnnouncements.onChange(function () { noteKey = null; });

  $("dayPrev").addEventListener("click", function () { dayOffset = Math.max(-7, dayOffset - 1); renderTable(nowDate(), C.now(nowDate(), S)); });
  $("dayNext").addEventListener("click", function () { dayOffset = Math.min(30, dayOffset + 1); renderTable(nowDate(), C.now(nowDate(), S)); });

  // ——— الحلقة الرئيسية ———
  var lastDay = null;
  function tick() {
    var d = nowDate();
    var n = renderHero(d);
    var m = C.dayKey(d) + d.getHours() * 60 + d.getMinutes() + n.mode + n.key;
    if (m !== lastMinute) { lastMinute = m; renderTable(d, n); }
    renderNotes(d);
    if (lastDay !== C.dayKey(d)) { if (lastDay) dayOffset = 0; lastDay = C.dayKey(d); }
    if (d.getSeconds() % 15 === 0) checkAlerts(d);
  }

  // ——— الأذكار ———
  var adkKind = null, adkItems = [], adkLeft = [];
  function adkStoreKey() { return "mosqueClock.mobile.adk"; }
  function openAdhkar() {
    var d = nowDate(), dm = C.day(d, S), nowMin = d.getHours() * 60 + d.getMinutes();
    if (!adkKind) adkKind = C.adhkarKind(nowMin, dm.times);
    renderAdhkar();
  }
  function renderAdhkar() {
    document.querySelectorAll("#adkSeg button").forEach(function (b) { b.classList.toggle("on", b.dataset.k === adkKind); });
    var list = $("adkList");
    if (!Q.ready()) {
      list.innerHTML = '<div class="loading">يُجهَّز المصحف للآيات…</div>';
      Q.ensureQuran().then(renderAdhkar).catch(function () { list.innerHTML = '<div class="loading">تعذّر تحميل المصحف</div>'; });
      return;
    }
    var d = nowDate(), dm = C.day(d, S), pk = C.lastPrayer(d.getHours() * 60 + d.getMinutes(), dm);
    adkItems = C.adhkar(adkKind, S, pk);
    var store = readJSON(adkStoreKey(), {}), sk = C.dayKey(d) + ":" + adkKind + (adkKind === "after" ? ":" + pk : "");
    adkLeft = store.k === sk && Array.isArray(store.left) && store.left.length === adkItems.length ? store.left : adkItems.map(function (x) { return x.count; });
    adkLeft.key = sk;
    list.innerHTML = adkItems.map(function (x, i) {
      var tx = Q.dhikrText(x) || { text: x.text };
      var basm = tx.basmala ? '<div class="txt quran" style="text-align:center">' + esc(Q.verse(1, 1)) + "</div>" : "";
      return '<div class="card dhikr" data-i="' + i + '">' + (tx.title ? '<div class="title">' + esc(tx.title) + "</div>" : "") + basm +
        '<div class="txt' + (tx.quran ? " quran" : "") + '">' + esc(tx.text) + '</div><div class="foot"><div class="src">' + esc(x.src || "") +
        '</div><button class="counter num" aria-label="عدّ"></button></div></div>';
    }).join("") + (adkKind === "after" ? '<div class="adk-hint">أذكار ما بعد صلاة ' + C.NAMES[pk] + "</div>" : "");
    updateAdk();
  }
  function updateAdk() {
    var done = 0;
    document.querySelectorAll("#adkList .dhikr").forEach(function (el) {
      var i = +el.dataset.i, left = adkLeft[i], total = adkItems[i].count;
      el.classList.toggle("done", left <= 0);
      el.querySelector(".counter").textContent = left <= 0 ? "✓" : D(left) + (total > 1 ? " / " + D(total) : "");
      if (left <= 0) done++;
    });
    $("adkCount").textContent = D(done) + " من " + D(adkItems.length);
    $("adkBar").style.width = (adkItems.length ? done / adkItems.length * 100 : 0) + "%";
    writeJSON(adkStoreKey(), { k: adkLeft.key, left: adkLeft.slice() });
  }
  $("adkList").addEventListener("click", function (e) {
    var el = e.target.closest(".dhikr"); if (!el) return;
    var i = +el.dataset.i;
    if (adkLeft[i] <= 0) { adkLeft[i] = adkItems[i].count; updateAdk(); return; } // لمسة على المكتمل تعيده
    adkLeft[i]--;
    if (adkLeft[i] <= 0) {
      vib([25, 40, 25]); updateAdk();
      var nx = document.querySelector("#adkList .dhikr:not(.done)");
      if (nx) setTimeout(function () { nx.scrollIntoView({ behavior: "smooth", block: "center" }); }, 250);
      else toast("تقبّل الله منك ✦");
    } else { vib(12); updateAdk(); }
  });
  $("adkSeg").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; adkKind = b.dataset.k; renderAdhkar(); scrollTo(0, 0); });
  $("adkReset").addEventListener("click", function () { adkLeft = adkItems.map(function (x) { return x.count; }); adkLeft.key = readJSON(adkStoreKey(), {}).k; updateAdk(); });

  // ——— المصحف ———
  var curSurah = 0, selVerse = null;
  function surahMeta(s) {
    var q = window.CLOCK_QURAN; if (!q) return "";
    return "آياتها " + D(q.counts[s - 1]) + " • " + (q.type[s - 1] ? "مكية" : "مدنية");
  }
  function openQuranIndex() {
    if (!$("qReader").hidden) return;
    var lr = M.lastRead;
    $("qContinue").hidden = !lr;
    if (lr) $("qContinueTx").textContent = "سورة " + Q.SURAHS[lr.s - 1] + " • الآية " + D(lr.a);
    if (!Q.ready()) {
      $("qList").innerHTML = '<li class="loading" style="display:block;border:0">يُجهَّز المصحف (مرة واحدة ثم يعمل بدون إنترنت)…</li>';
      Q.ensureQuran().then(function () { renderIndex($("qSearch").value); }).catch(function () { $("qList").innerHTML = '<li style="border:0">تعذّر تحميل المصحف</li>'; });
      return;
    }
    renderIndex($("qSearch").value);
  }
  function renderIndex(q) {
    var r = C.searchSurahs(q, Q.SURAHS);
    $("qList").innerHTML = r.list.map(function (s) {
      return '<li data-s="' + s + '"' + (r.ref ? ' data-a="' + r.ref.a + '"' : "") + '><span class="no num">' + D(s) + '</span><span class="nm">' + esc(Q.surahName(s) || Q.SURAHS[s - 1]) +
        (r.ref ? ' <small style="font-size:.6em;color:var(--accent)">الآية ' + D(r.ref.a) + "</small>" : "") + '</span><span class="meta">' + surahMeta(s) + "</span></li>";
    }).join("") || '<li style="border:0;color:var(--muted)">لا نتائج</li>';
  }
  $("qSearch").addEventListener("input", function () { if (Q.ready()) renderIndex(this.value); });
  $("qList").addEventListener("click", function (e) { var li = e.target.closest("li[data-s]"); if (li) openSurah(+li.dataset.s, +li.dataset.a || 0); });
  $("qContinueBtn").addEventListener("click", function () { if (M.lastRead) openSurah(M.lastRead.s, M.lastRead.a); });
  $("qBack").addEventListener("click", function () { $("qReader").hidden = true; $("qIndex").hidden = false; curSurah = 0; openQuranIndex(); scrollTo(0, 0); });

  var readObs = null;
  function openSurah(s, a) {
    Q.ensureQuran().then(function () {
      var q = window.CLOCK_QURAN, n = q.counts[s - 1];
      if (a > n) a = n;
      curSurah = s;
      $("qIndex").hidden = true; $("qReader").hidden = false;
      $("qTitle").textContent = "سورة " + Q.surahName(s);
      var parts = [];
      for (var i = 1; i <= n; i++) parts.push('<span class="v" data-a="' + i + '">' + esc(Q.verse(s, i)) + ' <span class="mk">' + Q.ayahMark(i) + "</span></span> ");
      $("mushaf").innerHTML = '<div class="sh"><b>سورة ' + esc(Q.surahName(s)) + "</b><span>" + surahMeta(s) + " • المس الآية لتفسيرها</span></div>" +
        (s !== 1 && s !== 9 ? '<div class="basmala">' + esc(Q.verse(1, 1)) + "</div>" : "") + '<div class="text">' + parts.join("") + "</div>";
      $("qPrevS").disabled = s === 1; $("qNextS").disabled = s === 114;
      if (M.lastRead && M.lastRead.s === s) mark(M.lastRead.a, "last");
      if (a > 1) {
        var el = $("mushaf").querySelector('.v[data-a="' + a + '"]');
        if (el) { mark(a, "sel"); setTimeout(function () { el.scrollIntoView({ block: "center" }); }, 30); }
      } else scrollTo(0, 0);
      setLastRead(s, a || 1);
      watchReading();
    });
  }
  function mark(a, cls) {
    $("mushaf").querySelectorAll(".v." + cls).forEach(function (x) { x.classList.remove(cls); });
    var el = $("mushaf").querySelector('.v[data-a="' + a + '"]'); if (el) el.classList.add(cls);
  }
  function setLastRead(s, a) { M.lastRead = { s: s, a: a, at: Date.now() }; saveM(); }
  // تحفظ آخر آية ظاهرة أثناء القراءة لتعود إليها
  function watchReading() {
    if (readObs) readObs.disconnect();
    if (!("IntersectionObserver" in window)) return;
    var t;
    readObs = new IntersectionObserver(function (ents) {
      var top = null;
      ents.forEach(function (en) { if (en.isIntersecting && (!top || en.boundingClientRect.top < top.boundingClientRect.top)) top = en; });
      if (!top) return;
      clearTimeout(t);
      t = setTimeout(function () { if (curSurah) setLastRead(curSurah, +top.target.dataset.a); }, 800);
    }, { rootMargin: "-30% 0px -60% 0px" });
    $("mushaf").querySelectorAll(".v").forEach(function (v) { readObs.observe(v); });
  }
  $("mushaf").addEventListener("click", function (e) { var v = e.target.closest(".v"); if (v) openTafsir(curSurah, +v.dataset.a); });
  $("qPrevS").addEventListener("click", function () { if (curSurah > 1) openSurah(curSurah - 1, 0); });
  $("qNextS").addEventListener("click", function () { if (curSurah < 114) openSurah(curSurah + 1, 0); });
  function scaleQuran(dx) { M.quranScale = Math.round(Math.max(0.8, Math.min(1.8, M.quranScale + dx)) * 10) / 10; saveM(); applyLook(); }
  $("qSmaller").addEventListener("click", function () { scaleQuran(-0.1); });
  $("qBigger").addEventListener("click", function () { scaleQuran(0.1); });

  // ——— التفسير في الورقة السفلية ———
  function openTafsir(s, a) {
    selVerse = { s: s, a: a };
    mark(a, "sel"); setLastRead(s, a);
    openSheet("سورة " + Q.surahName(s) + " • الآية " + D(a), "");
    renderTafsir();
  }
  function tafsirRange(t, s, a) {
    var i = Q.gi(s, a), start = Q.gi(s, 1), end = Q.gi(s, window.CLOCK_QURAN.counts[s - 1]), k = i, j = i;
    while (k > start && t[k] === "") k--;
    while (j < end && t[j + 1] === "") j++;
    return { text: t[k], from: k - start + 1, to: j - start + 1 };
  }
  function renderTafsir() {
    if (!selVerse) return;
    var s = selVerse.s, a = selVerse.a, id = M.tafsir;
    var chips = Q.TAFSIRS.map(function (t) { return '<button data-t="' + t.id + '"' + (t.id === id ? ' class="on"' : "") + ">" + ({ muyassar: "الميسر", mukhtasar: "المختصر", jalalayn: "الجلالين", saadi: "السعدي" }[t.id] || t.name) + "</button>"; }).join("");
    var body = '<div class="tf-verse">' + esc(Q.verse(s, a)) + ' <span class="mk" style="color:var(--accent)">' + Q.ayahMark(a) + '</span></div><div class="tf-chips" id="tfChips">' + chips + '</div><div id="tfOut"></div>' +
      '<div class="tf-actions"><button class="btn ghost" id="tfPrev">الآية السابقة</button><button class="btn ghost" id="tfNext">الآية التالية</button></div>' +
      '<div class="tf-actions"><button class="btn ghost" id="tfCopy">نسخ</button>' + (navigator.share ? '<button class="btn ghost" id="tfShare">مشاركة</button>' : "") + "</div>";
    $("sheetBody").innerHTML = body;
    $("sheetTitle").textContent = "سورة " + Q.surahName(s) + " • الآية " + D(a);
    var meta = Q.TAFSIRS.filter(function (t) { return t.id === id; })[0] || Q.TAFSIRS[0];
    var out = $("tfOut");
    if (window.MOBILE_SINGLE_FILE && !Q.tafsir(meta.id)) {
      out.innerHTML = '<div class="loading" style="padding:16px">نسخة الملف الواحد تضم التفسير الميسر فقط. ' + meta.name + " متاح في النسخة الكاملة المستضافة.</div>";
    } else if (!Q.tafsir(meta.id)) out.innerHTML = '<div class="loading">يُحمَّل ' + meta.name + " مرة واحدة (" + D(meta.size.replace(" MB", "")) + " ميغابايت) ثم يعمل بدون إنترنت…</div>";
    Q.ensureTafsirs([meta.id]).then(function () {
      if (!selVerse || selVerse.s !== s || selVerse.a !== a || M.tafsir !== id) return;
      var T = Q.tafsir(meta.id);
      if (!T) { out.innerHTML = '<div class="loading" style="padding:16px">تعذّر تحميل التفسير. تأكد من الاتصال مرة واحدة ثم يعمل بدونه.</div>'; return; }
      var r = tafsirRange(T.t, s, a);
      out.innerHTML = (r.from !== r.to ? '<div class="chip" style="margin-bottom:8px">تفسير الآيات ' + D(r.from) + "–" + D(r.to) + " معاً</div>" : "") +
        '<div class="tf-text">' + esc(r.text) + '</div><div class="tf-by">' + esc(T.name) + " — " + esc(T.by) + "</div>";
    });
    $("tfChips").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; M.tafsir = b.dataset.t; saveM(); renderTafsir(); });
    $("tfPrev").disabled = a <= 1; $("tfNext").disabled = a >= window.CLOCK_QURAN.counts[s - 1];
    $("tfPrev").addEventListener("click", function () { openTafsir(s, a - 1); scrollToVerse(a - 1); });
    $("tfNext").addEventListener("click", function () { openTafsir(s, a + 1); scrollToVerse(a + 1); });
    var share = "﴿" + Q.verse(s, a) + "﴾ [" + Q.surahName(s) + ": " + D(a) + "]";
    $("tfCopy").addEventListener("click", function () {
      (navigator.clipboard ? navigator.clipboard.writeText(share) : Promise.reject()).then(function () { toast("نُسخت الآية"); }).catch(function () { toast("تعذّر النسخ"); });
    });
    if ($("tfShare")) $("tfShare").addEventListener("click", function () { navigator.share({ text: share }).catch(function () {}); });
  }
  function scrollToVerse(a) { var el = $("mushaf").querySelector('.v[data-a="' + a + '"]'); if (el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }

  // ——— الورقة السفلية ———
  var sheetCloseCb = null;
  function openSheet(title, html, onClose) {
    $("sheetTitle").textContent = title; if (html) $("sheetBody").innerHTML = html;
    $("sheetBg").hidden = false; $("sheet").hidden = false;
    $("sheetBody").scrollTop = 0;
    requestAnimationFrame(function () { $("sheetBg").classList.add("on"); $("sheet").classList.add("on"); });
    sheetCloseCb = onClose || null;
    document.body.style.overflow = "hidden";
  }
  function closeSheet() {
    $("sheetBg").classList.remove("on"); $("sheet").classList.remove("on");
    document.body.style.overflow = "";
    setTimeout(function () { $("sheetBg").hidden = true; $("sheet").hidden = true; }, 300);
    if (selVerse) { $("mushaf").querySelectorAll(".v.sel").forEach(function (x) { x.classList.remove("sel"); }); selVerse = null; }
    if (sheetCloseCb) { var f = sheetCloseCb; sheetCloseCb = null; f(); }
  }
  $("sheetBg").addEventListener("click", closeSheet);
  $("sheetClose").addEventListener("click", closeSheet);
  // سحب الورقة للأسفل لإغلاقها
  (function () {
    var y0 = null, sh = $("sheet");
    sh.addEventListener("touchstart", function (e) { if ($("sheetBody").scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener("touchmove", function (e) { if (y0 == null) return; var dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = "translateY(" + dy + "px)"; }, { passive: true });
    sh.addEventListener("touchend", function (e) {
      if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; sh.style.transform = "";
      if (dy > 110) closeSheet();
    });
  })();
  addEventListener("keydown", function (e) { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });

  // ——— القبلة ———
  var heading = null, sensorOn = false, alignedOnce = false;
  function buildDial(qibla) {
    var ticks = "", i;
    for (i = 0; i < 72; i++) {
      var a = i * 5, big = a % 30 === 0, r1 = big ? 128 : 133;
      ticks += '<line x1="0" y1="-' + r1 + '" x2="0" y2="-140" transform="rotate(' + a + ')" stroke="var(--' + (big ? "muted" : "faint") + ')" stroke-width="' + (big ? 2 : 1) + '"/>';
    }
    var L = [["ش", 0], ["ق", 90], ["ج", 180], ["غ", 270]].map(function (x) {
      return '<text transform="rotate(' + x[1] + ') translate(0,-108) rotate(' + -x[1] + ')" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" fill="' + (x[0] === "ش" ? "var(--warn)" : "var(--muted)") + '" font-family="Kufi, sans-serif">' + x[0] + "</text>";
    }).join("");
    var kaaba = '<g transform="rotate(' + qibla.toFixed(1) + ')"><line x1="0" y1="-30" x2="0" y2="-118" stroke="var(--accent)" stroke-width="3" stroke-dasharray="2 6" stroke-linecap="round"/>' +
      '<g transform="translate(0,-150)"><rect x="-13" y="-13" width="26" height="26" rx="3" fill="#15130f" stroke="var(--accent)" stroke-width="2"/><rect x="-13" y="-7" width="26" height="4" fill="var(--accent)"/></g></g>';
    return '<svg viewBox="-170 -170 340 340"><circle class="rim" r="142" fill="var(--surface2)" stroke="var(--line)" stroke-width="3"/>' + ticks + L + kaaba + "</svg>";
  }
  function renderQibla() {
    var qb = QB.bearing(S.latitude, S.longitude), km = QB.distanceKm(S.latitude, S.longitude);
    $("dial").innerHTML = buildDial(qb);
    $("needle").innerHTML = '<svg viewBox="-170 -170 340 340"><path d="M0 -96 L10 -60 L0 -66 L-10 -60 Z" fill="var(--text)"/><circle r="6" fill="var(--text)"/></svg>';
    $("qbDeg").textContent = "القبلة " + D(qb.toFixed(1)) + "° من الشمال";
    $("qbWhere").textContent = "باتجاه " + QB.compassName(qb) + " • المسافة إلى مكة " + D(Math.round(km).toLocaleString("en")) + " كم";
    $("qbLoc").textContent = (S.cityName || "") + " (" + D(S.latitude.toFixed(3)) + "، " + D(S.longitude.toFixed(3)) + ")";
    if (!sensorOn) {
      $("qbStatus").className = "status";
      $("qbStatus").textContent = "الشمال إلى الأعلى. شغّل البوصلة ليتحرك القرص مع الجوال.";
      $("qbStart").hidden = false;
    }
    updateCompass();
  }
  function updateCompass() {
    if (heading == null) { $("dial").style.transform = ""; return; }
    var qb = QB.bearing(S.latitude, S.longitude), dl = QB.delta(heading, qb), ok = Math.abs(dl) < 4;
    $("dial").style.transform = "rotate(" + (-heading) + "deg)";
    $("compass").classList.toggle("aligned", ok);
    var st = $("qbStatus");
    st.className = "status" + (ok ? " ok" : "");
    st.textContent = ok ? "أنت باتجاه القبلة ✦" : (dl > 0 ? "استدر يميناً " : "استدر يساراً ") + D(Math.abs(Math.round(dl))) + "°";
    if (ok && !alignedOnce) { vib(40); alignedOnce = true; } else if (!ok && Math.abs(dl) > 10) alignedOnce = false;
  }
  function onOrient(e) {
    var ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    var h = QB.headingFrom(e, ang);
    if (h == null) return;
    // تنعيم دائري بسيط
    if (heading == null) heading = h;
    else { var d = QB.delta(heading, h); heading = QB.norm(heading + d * 0.25); }
    if (curView === "qibla") updateCompass();
  }
  function startCompass() {
    function listen() {
      sensorOn = true; $("qbStart").hidden = true;
      if ("ondeviceorientationabsolute" in window) addEventListener("deviceorientationabsolute", onOrient);
      else addEventListener("deviceorientation", onOrient);
      setTimeout(function () {
        if (heading == null) {
          sensorOn = false; $("qbStart").hidden = false;
          $("qbStatus").className = "status";
          $("qbStatus").textContent = "لا توجد بوصلة متاحة على هذا الجهاز أو المتصفح. استخدم الدرجة المكتوبة مع بوصلة أو المحراب.";
        }
      }, 2500);
    }
    var DOE = window.DeviceOrientationEvent;
    if (!DOE) { $("qbStatus").textContent = "هذا المتصفح لا يدعم البوصلة."; return; }
    if (typeof DOE.requestPermission === "function") { // آيفون: يحتاج إذناً بلمسة
      DOE.requestPermission().then(function (p) { if (p === "granted") listen(); else $("qbStatus").textContent = "لم يُسمح بالوصول إلى البوصلة. فعّله من إعدادات Safari ← الحركة والاتجاه."; })
        .catch(function () { $("qbStatus").textContent = "تعذّر طلب إذن البوصلة."; });
    } else listen();
  }
  $("qbStart").addEventListener("click", startCompass);
  function useGPS(btn) {
    if (!navigator.geolocation) { toast("تحديد الموقع غير متاح في هذا المتصفح"); return; }
    if (!window.isSecureContext) { toast("تحديد الموقع يحتاج فتح التطبيق من رابط https"); return; }
    if (btn) btn.disabled = true;
    toast("يُحدَّد موقعك…");
    navigator.geolocation.getCurrentPosition(function (p) {
      if (btn) btn.disabled = false;
      M.source = "gps"; M.lat = +p.coords.latitude.toFixed(4); M.lon = +p.coords.longitude.toFixed(4); M.tz = -new Date().getTimezoneOffset() / 60;
      saveM(); recompute(); toast("تم استخدام موقعك الحالي");
      if (!$("sheet").hidden && sheetMode === "settings") renderSettings();
    }, function () { if (btn) btn.disabled = false; toast("لم يُسمح بتحديد الموقع"); }, { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 });
  }
  $("qbGps").addEventListener("click", function () { useGPS(this); });

  // ——— التنبيهات ———
  var alertList = null, alertFor = null;
  var SENT = "mosqueClock.mobile.sent";
  function notifSupported() { return !!AN || "Notification" in window; }
  function notifOn() { return M.notify && (AN ? nst().notify : notifSupported() && Notification.permission === "granted"); }
  // التطبيق: نسلّم مواعيد ٣٠ يوماً لمنبّه النظام فتصل التنبيهات والتطبيق مغلق
  var syncT = null;
  function syncNativeSoon() { if (AN) { clearTimeout(syncT); syncT = setTimeout(syncNative, 400); } }
  function syncNative() {
    if (!AN || !S) return;
    if (!M.notify) { AN.clearAlarms(); return; }
    var list = C.alerts(nowDate(), S, M, 30).map(function (a) { return { id: a.id, at: a.at.getTime(), kind: a.kind, title: a.title, body: a.body }; });
    AN.scheduleAlarms(JSON.stringify(list));
  }
  function checkAlerts(d) {
    if (AN) return; // داخل التطبيق: المنبّه الأصلي هو الذي يُنبّه (بلا تكرار)
    if (!M.notify || !notifSupported() || Notification.permission !== "granted") return;
    var k = C.dayKey(d);
    if (!alertList || alertFor !== k) { alertList = C.alerts(C.addDays(d, 0), S, M, 2); alertFor = k; }
    var sent = readJSON(SENT, {}), due = C.due(alertList, d.getTime(), sent);
    if (!due.length) return;
    due.forEach(function (a) {
      sent[a.id] = Date.now();
      notify(a.title, a.body, a.id);
      if (a.kind === "adhan") vib([200, 100, 200]);
    });
    Object.keys(sent).forEach(function (id) { if (Date.now() - sent[id] > 3 * 86400000) delete sent[id]; });
    writeJSON(SENT, sent);
  }
  function notify(title, body, tag) {
    var opt = { body: body, tag: tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png", lang: "ar", dir: "rtl", vibrate: [200, 100, 200] };
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(title, opt); }).catch(function () { try { new Notification(title, opt); } catch (e) {} });
    } else { try { new Notification(title, opt); } catch (e) {} }
  }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
  function enableNotify(on) {
    if (!on) { M.notify = false; saveM(); syncNative(); return Promise.resolve(false); }
    if (AN) {
      M.notify = true; saveM();
      if (!nst().notify) AN.requestNotifications();
      syncNative();
      return Promise.resolve(true);
    }
    if (!notifSupported()) {
      toast(isIOS() && !standalone() ? "على آيفون: ثبّت التطبيق على الشاشة الرئيسية أولاً، ثم فعّل التنبيهات منه." : "هذا المتصفح لا يدعم التنبيهات. استخدم «إضافة إلى التقويم».", 5000);
      return Promise.resolve(false);
    }
    return Promise.resolve(Notification.permission === "granted" ? "granted" : Notification.requestPermission()).then(function (p) {
      M.notify = p === "granted"; saveM();
      if (M.notify) { alertList = null; notify("تم تفعيل التنبيهات", "ستصلك تنبيهات الأذان ما دام التطبيق مفتوحاً أو في الخلفية.", "test"); }
      else toast("لم يُسمح بالتنبيهات من المتصفح");
      return M.notify;
    });
  }
  function downloadICS(days) {
    var txt = C.ics(nowDate(), S, M, days), blob = new Blob([txt], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mawaqit-" + C.dayKey(nowDate()) + ".ics";
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toast("افتح الملف وأضفه إلى التقويم", 4000);
  }

  // ——— الإعدادات ———
  var sheetMode = null;
  function pills(name, opts, val) {
    return '<div class="pills" data-name="' + name + '">' + opts.map(function (o) { return '<button data-v="' + o[0] + '"' + (String(o[0]) === String(val) ? ' class="on"' : "") + ">" + o[1] + "</button>"; }).join("") + "</div>";
  }
  function sw(name, on) { return '<label class="switch"><input type="checkbox" data-name="' + name + '"' + (on ? " checked" : "") + "><i></i></label>"; }
  function renderSettings() {
    var cities = window.OMAN_CITIES || [], groups = {};
    cities.forEach(function (c) { (groups[c[3]] = groups[c[3]] || []).push(c[0]); });
    var cityOpts = Object.keys(groups).map(function (g) { return '<optgroup label="' + g + '">' + groups[g].map(function (n) { return '<option' + (n === M.city ? " selected" : "") + ">" + n + "</option>"; }).join("") + "</optgroup>"; }).join("");
    var mosqueWhen = mosqueCache && mosqueCache.at ? new Intl.DateTimeFormat("ar-u-nu-latn", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }).format(new Date(mosqueCache.at)) : null;
    var ns = AN ? nst() : null;
    var notifNote = AN ? (M.notify && !ns.notify ? "⚠︎ الإشعارات غير مسموحة لهذا التطبيق بعد: اضغط «السماح بالإشعارات»." :
        M.notify && !ns.exact ? "⚠︎ المنبّهات الدقيقة غير مسموحة، فقد يتأخر التنبيه دقائق. اضغط «السماح بالمنبّهات الدقيقة»." :
        "تصل التنبيهات والتطبيق مغلق، حتى بعد إعادة تشغيل الجوال." + (ns.nextAlarm ? " التنبيه القادم: " + D(new Intl.DateTimeFormat("ar-u-nu-latn", { weekday: "long", hour: "numeric", minute: "2-digit" }).format(new Date(ns.nextAlarm))) + "." : "")) +
        " ويمكن تغيير صوت كل نوع من «أصوات التنبيه»."
      : isIOS()
      ? (standalone() ? "على آيفون (iOS 16.4 فأحدث) تصل التنبيهات والتطبيق مفتوح أو في الخلفية لفترة قصيرة، ويوقفها النظام إن أُغلق التطبيق." : "على آيفون لا تعمل التنبيهات إلا بعد تثبيت التطبيق على الشاشة الرئيسية.")
      : "تصل التنبيهات ما دام التطبيق مفتوحاً أو في الخلفية، وقد يوقفها نظام الجوال لتوفير البطارية إن أُغلق.";
    var html =
      '<div class="set-group"><h3>الموقع والمواقيت</h3><div class="set-list">' +
        '<div class="set-row"><div class="lb">حساب المواقيت</div>' + pills("source", [["mosque", "المسجد"], ["city", "ولاية"], ["gps", "موقعي"]], M.source) + "</div>" +
        (M.source === "city" ? '<div class="set-row"><div class="lb">الولاية</div><select data-name="city"><option value="">اختر…</option>' + cityOpts + "</select></div>" : "") +
        (M.source === "gps" ? '<div class="set-row"><div class="lb">موقعي الحالي<small>' + (M.lat != null ? D(M.lat) + "، " + D(M.lon) : "لم يُحدَّد بعد") + '</small></div><button class="btn ghost" data-act="gps">تحديث</button></div>' : "") +
        '<div class="set-row"><div class="lb"><small>' + (M.source === "mosque" ? "المواقيت والإقامة كما في شاشة " + esc(S.mosqueName) + " تماماً." : "الأذان محسوب لموقعك، والإقامة بمدد المسجد.") + "</small></div></div>" +
        '<div class="set-row"><div class="lb">نظام ٢٤ ساعة</div>' + sw("use24h", !!S.use24h) + "</div>" +
      "</div></div>" +
      '<div class="set-group"><h3>التنبيهات</h3><div class="set-list">' +
        '<div class="set-row"><div class="lb">تنبيهات الأذان</div>' + sw("notify", AN ? M.notify : M.notify && notifSupported() && Notification.permission === "granted") + "</div>" +
        '<div class="set-row"><div class="lb">تذكير قبل الأذان</div><select data-name="notifyBefore">' + [0, 5, 10, 15, 20, 30].map(function (m) { return '<option value="' + m + '"' + (+M.notifyBefore === m ? " selected" : "") + ">" + (m ? D(m) + (m <= 10 ? " دقائق" : " دقيقة") : "بدون") + "</option>"; }).join("") + "</select></div>" +
        '<div class="set-row"><div class="lb">عند الأذان</div>' + sw("notifyAdhan", M.notifyAdhan) + "</div>" +
        '<div class="set-row"><div class="lb">قبل الإقامة بخمس دقائق</div>' + sw("notifyIqama", M.notifyIqama) + "</div>" +
        (AN && M.notify && !ns.notify ? '<div class="set-row"><div class="lb">السماح بالإشعارات<small>أندرويد ١٣ فأحدث يطلب إذنك</small></div><button class="btn" data-act="anNotify">السماح</button></div>' : "") +
        (AN && M.notify && !ns.exact ? '<div class="set-row"><div class="lb">السماح بالمنبّهات الدقيقة<small>ليصل التنبيه في دقيقته (أندرويد ١٢ فأحدث)</small></div><button class="btn" data-act="anExact">السماح</button></div>' : "") +
        (AN && M.notify && !ns.batteryIgnored ? '<div class="set-row"><div class="lb">استثناء من توفير البطارية<small>بعض الجوالات (شاومي، هواوي، سامسونج…) تؤخر التنبيهات بدونه</small></div><button class="btn ghost" data-act="anBattery">فتح</button></div>' : "") +
        (AN ? '<div class="set-row"><div class="lb">أصوات التنبيه<small>صوت الأذان والتذكير والإقامة، أو كتمها</small></div><button class="btn ghost" data-act="anSounds">فتح</button></div>' +
              '<div class="set-row"><div class="lb">تجربة التنبيه</div><button class="btn ghost" data-act="anTest">تجربة</button></div>' : "") +
        (AN ? "" : '<div class="set-row"><div class="lb">إضافة المواقيت إلى تقويم الجوال<small>أضمن طريقة: منبّه التقويم يعمل والتطبيق مغلق، على آيفون وأندرويد (لـ٣٠ يوماً، كرّرها شهرياً).</small></div><button class="btn ghost" data-act="ics">إضافة</button></div>') +
      '</div><p class="honest">' + notifNote + "</p></div>" +
      '<div class="set-group"><h3>المظهر</h3><div class="set-list">' +
        '<div class="set-row"><div class="lb">السمة</div>' + pills("theme", [["auto", "تلقائي"], ["dark", "داكن"], ["light", "فاتح"]], M.theme) + "</div>" +
        '<div class="set-row"><div class="lb">حجم الخط</div>' + pills("fontScale", [[1, "عادي"], [1.12, "كبير"], [1.25, "أكبر"]], M.fontScale) + "</div>" +
      "</div></div>" +
      '<div class="set-group"><h3>المسجد</h3><div class="set-list">' +
        '<div class="set-row"><div class="lb">' + esc(S.mosqueName) + "<small>" + (mosqueWhen ? "آخر تحديث من المسجد: " + D(mosqueWhen) : http ? "لم تصل إعدادات من المسجد بعد (تُستخدم الإعدادات الافتراضية)" : AN ? (M.mosqueUrl ? "لم تصل إعدادات من المسجد بعد" : "غير مربوط بمسجد: اختر «ولاية» أو «موقعي» للمواقيت، أو اربطه بخادم المسجد أدناه") : "مفتوح كملف محلي: الإعدادات من هذا الجهاز") + '</small></div>' + (mosqueBase() !== null ? '<button class="btn ghost" data-act="refresh">تحديث</button>' : "") + "</div>" +
        (http ? '<div class="set-row"><div class="lb">للإمام والمشرف<small>تعديل المواقيت والإقامة والإعلانات والمناسبات (بالرمز السري)</small></div><a href="settings.html">لوحة التحكم</a></div>' +
                '<div class="set-row"><div class="lb">الإعلانات</div><a href="announcements.html">إدارة</a></div>' : "") +
        (AN || M.mosqueUrl ? '<div class="set-row"><div class="lb">ربط بخادم المسجد<small>' + (M.mosqueUrl ? '<span dir="ltr">' + esc(M.mosqueUrl) + "</span>" : "اختياري: عنوان server.js في المسجد (مثل http://192.168.1.10:8080) لتصلك مواقيته وإقامته وإعلاناته") + '</small></div><button class="btn ghost" data-act="mosqueUrl">' + (M.mosqueUrl ? "تغيير" : "ربط") + "</button></div>" : "") +
        (window.MOBILE_SINGLE_FILE ? "" : '<div class="set-row"><div class="lb">شاشة المسجد الكاملة</div><a href="index.html">فتح</a></div>') +
        (AN ? '<div class="set-row"><div class="lb">وضع الجهاز<small>جوال المصلي، أو التابلت، أو شاشة المسجد</small></div><a href="start.html?choose=1">تغيير</a></div>' : "") +
      "</div></div>" +
      '<p class="honest" style="text-align:center">ساعة المسجد • نسخة الجوال ٧<br>المصحف برسم المدينة (رواية حفص)، والتفاسير الأربعة تعمل بدون إنترنت بعد أول تحميل.</p>';
    $("sheetBody").innerHTML = html;
  }
  $("openSettings").addEventListener("click", function () { sheetMode = "settings"; openSheet("الإعدادات", " "); renderSettings(); });
  $("sheetBody").addEventListener("click", function (e) {
    if (sheetMode !== "settings" || selVerse) return;
    var p = e.target.closest(".pills button");
    if (p) {
      var name = p.parentNode.dataset.name, v = p.dataset.v;
      if (name === "fontScale") v = +v;
      if (name === "source" && v === "gps" && M.lat == null) { useGPS(null); return; }
      M[name] = v; saveM();
      if (name === "source" || name === "theme" || name === "fontScale") recompute();
      renderSettings(); return;
    }
    var b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "gps") useGPS(b);
    if (b.dataset.act === "ics") downloadICS(30);
    if (b.dataset.act === "anNotify") AN.requestNotifications();
    if (b.dataset.act === "anExact") AN.requestExactAlarms();
    if (b.dataset.act === "anBattery") AN.requestIgnoreBattery();
    if (b.dataset.act === "anSounds") AN.openNotificationSettings();
    if (b.dataset.act === "anTest") AN.testNotification("adhan");
    if (b.dataset.act === "mosqueUrl") {
      var u = prompt("عنوان خادم المسجد على الشبكة، مثل http://192.168.1.10:8080\nاتركه فارغاً لإلغاء الربط:", M.mosqueUrl || "");
      if (u !== null) {
        u = u.trim();
        if (u && !/^https?:\/\//i.test(u)) u = "http://" + u;
        M.mosqueUrl = u; saveM();
        if (!u) { mosqueCache = null; writeJSON(C.CACHE, null); recompute(); renderSettings(); return; }
        refreshMosque().then(function (ok) { toast(ok ? "تم الربط بالمسجد ✓" : "تعذّر الوصول للخادم. تأكد من العنوان ومن الاتصال بشبكة المسجد.", 4000); renderSettings(); });
      }
    }
    if (b.dataset.act === "refresh") refreshMosque().then(function (ok) { toast(ok ? "تم التحديث من المسجد" : "تعذّر الوصول لجهاز المسجد"); renderSettings(); });
  });
  $("sheetBody").addEventListener("change", function (e) {
    if (sheetMode !== "settings") return;
    var el = e.target, name = el.dataset.name; if (!name) return;
    if (name === "notify") { enableNotify(el.checked).then(function () { renderSettings(); }); return; }
    if (name === "use24h") { M.use24h = el.checked; }
    else if (el.type === "checkbox") M[name] = el.checked;
    else if (name === "notifyBefore") M[name] = +el.value;
    else M[name] = el.value;
    saveM(); recompute();
  });
  // عاد المستخدم من صفحة إذن في إعدادات النظام
  addEventListener("androidstatus", function () { if (sheetMode === "settings") renderSettings(); syncNativeSoon(); });
  var _close = closeSheet;
  closeSheet = function () { sheetMode = null; _close(); };
  $("sheetBg").removeEventListener("click", _close); $("sheetClose").removeEventListener("click", _close);
  $("sheetBg").addEventListener("click", function () { closeSheet(); }); $("sheetClose").addEventListener("click", function () { closeSheet(); });

  // ——— التثبيت ———
  var deferredPrompt = null;
  addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredPrompt = e;
    if (!M.installDismissed) { $("installCard").hidden = false; $("installBtn").hidden = false; }
  });
  if (isIOS() && !standalone() && !M.installDismissed) {
    $("installCard").hidden = false; $("installBtn").hidden = true;
    $("installHint").textContent = "في Safari اضغط زر المشاركة ⬆︎ ثم «إضافة إلى الشاشة الرئيسية».";
  }
  $("installBtn").addEventListener("click", function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt(); deferredPrompt.userChoice.then(function () { deferredPrompt = null; $("installCard").hidden = true; });
  });
  $("installX").addEventListener("click", function () { M.installDismissed = true; saveM(); $("installCard").hidden = true; });
  addEventListener("appinstalled", function () { $("installCard").hidden = true; });

  // ——— البدء ———
  recompute();
  var startView = (location.hash || "").replace("#", "");
  if (["times", "adhkar", "quran", "qibla"].indexOf(startView) >= 0 && startView !== "times") show(startView);
  if (params.get("open") === "settings") $("openSettings").click();
  if (params.get("surah")) { show("quran"); openSurah(+params.get("surah"), +params.get("ayah") || 0); if (params.get("tafsir")) setTimeout(function () { openTafsir(+params.get("surah"), +params.get("ayah") || 1); }, 400); }
  tick();
  setInterval(tick, 1000);
  refreshMosque();
  setInterval(refreshMosque, 10 * 60 * 1000);
  setInterval(syncNativeSoon, 6 * 3600 * 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { refreshMosque(); if (window.ClockAnnouncements) ClockAnnouncements.refresh(); tick(); } });
  window.MobileApp = { show: show, openSurah: openSurah, openTafsir: openTafsir, settings: function () { return S; } };
})();
