/*
 * نسخة الجوال — المنطق بلا واجهة (لتسهيل الاختبار في Node).
 * تعتمد على ملفات الساعة نفسها: PrayerTimes و ClockSchedule و ClockEvents و ClockQuran،
 * فالأوقات والإقامة والجمعة ورمضان على الجوال هي نفسها التي على شاشة المسجد.
 */
(function (root) {
  var NAMES = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", jumuah: "الجمعة", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
  var ORDER = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  var MKEY = "mosqueClock.mobile.v1";          // تفضيلات المستخدم على الجوال
  var CACHE = "mosqueClock.mobile.mosque";     // آخر إعدادات وصلت من المسجد
  var DEFAULTS = { theme: "auto", source: "mosque", city: "", lat: null, lon: null, tz: null, fontScale: 1, quranScale: 1,
    notify: false, notifyBefore: 10, notifyAdhan: true, notifyIqama: false, sound: true, tafsir: "muyassar", lastRead: null, use24h: null, installDismissed: false, mosqueUrl: "" };

  function copy(o) { var r = {}, k; for (k in o) r[k] = o[k]; return r; }
  function pad(n) { return String(n).padStart(2, "0"); }

  // إعدادات المسجد + اختيار المستخدم للموقع. المصدر "mosque" يأخذ موقع المسجد وجدوله الرسمي كما هو.
  function effective(mosque, M, cities) {
    var S = copy(mosque);
    M = M || {};
    if (M.source === "city" && M.city) {
      var c = (cities || []).filter(function (x) { return x[0] === M.city; })[0];
      if (c) { S.latitude = c[1]; S.longitude = c[2]; S.cityName = c[0]; S.timezone = 4; S.useTable = false; S.elevation = 0; }
    } else if (M.source === "gps" && isFinite(M.lat) && isFinite(M.lon) && M.lat !== null) {
      S.latitude = +M.lat; S.longitude = +M.lon; S.cityName = "موقعي الحالي"; S.useTable = false; S.elevation = 0;
      if (isFinite(M.tz) && M.tz !== null) S.timezone = +M.tz;
    }
    if (M.use24h === true || M.use24h === false) S.use24h = M.use24h;
    return S;
  }

  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function timesFor(d, S) {
    var SCH = root.ClockSchedule, fri = d.getDay() === 5;
    return SCH.applyJumuah(root.PrayerTimes.forDate(d, S), fri, S);
  }

  // جدول يوم: ست صفوف بالأذان والإقامة (بالدقائق من منتصف الليل)
  function day(d, S) {
    var SCH = root.ClockSchedule, fri = d.getDay() === 5, t = timesFor(d, S);
    var wk = SCH.needsWeek && SCH.needsWeek(S) ? SCH.weekMax(d, function (x) { return root.PrayerTimes.forDate(x, S); }) : null;
    var sch = SCH.build(t, fri, S, wk), byBase = {};
    sch.forEach(function (p) { byBase[p.base] = p; });
    var rows = ORDER.map(function (k) {
      if (k === "sunrise") return { key: k, base: k, name: NAMES.sunrise, adhan: t.sunrise, iqama: null };
      var p = byBase[k];
      return { key: p.key, base: k, name: NAMES[p.key], adhan: p.adhan, iqama: p.iqamaMin > p.adhan ? p.iqamaMin : null };
    });
    return { date: d, friday: fri, times: t, sch: sch, rows: rows, source: t.source || "calc" };
  }

  function isRamadan(d, S) {
    var h = root.ClockSeasons && root.ClockSeasons.hijri(d, S.hijriOffset || 0);
    return !!(h && h.m === 9);
  }

  // حالة اللحظة لبطاقة «الصلاة القادمة». ns = الثواني منذ منتصف الليل.
  function now(d, S) {
    var SCH = root.ClockSchedule, today = day(d, S);
    var ns = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
    var tf = timesFor(addDays(d, 1), S).fajr;
    var st = SCH.state(ns, today.sch, (function () { var x = copy(S); x.adhanScreenMinutes = 0; return x; })());
    if (st && st.name === "iqama") {
      return { mode: "iqama", label: "الإقامة بعد", key: st.p.key, name: NAMES[st.p.key], left: st.left,
        progress: (ns - st.p.A) / Math.max(1, st.p.I - st.p.A), adhan: st.p.adhan, iqama: st.p.iqamaMin, today: today, ns: ns };
    }
    if (st && st.name === "prayer") {
      return { mode: "prayer", label: "الصلاة قائمة", key: st.p.key, name: NAMES[st.p.key], left: st.p.E - ns,
        progress: (ns - st.p.I) / Math.max(1, st.p.E - st.p.I), adhan: st.p.adhan, iqama: st.p.iqamaMin, today: today, ns: ns };
    }
    var nx = SCH.next(ns, today.times, tf), k = nx.next.key, row = null;
    if (nx.next.tomorrow) row = day(addDays(d, 1), S).rows[0];
    else today.rows.forEach(function (r) { if (r.base === k) row = r; });
    var out = { mode: "next", label: k === "sunrise" ? "الشروق بعد" : "الصلاة القادمة", key: row.key, name: row.name, left: nx.left,
      progress: nx.progress, adhan: row.adhan, iqama: row.iqama, tomorrow: !!nx.next.tomorrow, today: today, ns: ns };
    if (S.ramadanHero && root.ClockEvents) {
      var rh = root.ClockEvents.ramadanHero(ns, nx, today.times, S.imsakMinutes, isRamadan(d, S), isRamadan(addDays(d, 1), S));
      if (rh) { out.mode = "ramadan"; out.label = rh.label; out.name = rh.name; out.left = rh.left; out.imsak = !!rh.imsak; out.iftar = !!rh.iftar; out.at = Math.round(rh.at / 60); }
    }
    return out;
  }

  // ——— التنبيهات ———
  // قائمة مواعيد التنبيه القادمة (كائنات Date بتوقيت الجهاز) لعدد من الأيام
  function at(d, minutes) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return new Date(x.getTime() + minutes * 60000); }
  function alerts(from, S, M, days) {
    var out = [];
    for (var i = 0; i < (days || 2); i++) {
      var d = addDays(from, i), dm = day(d, S);
      dm.rows.forEach(function (r) {
        if (r.base === "sunrise") return;
        var tag = dayKey(d) + ":" + r.key;
        if (M.notifyBefore > 0) out.push({ id: tag + ":pre", at: at(d, r.adhan - M.notifyBefore), kind: "pre",
          title: "اقترب أذان " + r.name, body: digits("بعد " + M.notifyBefore + (M.notifyBefore <= 10 ? " دقائق" : " دقيقة"), S) + (r.iqama ? "، والإقامة " + fmt(r.iqama, S) : "") });
        if (M.notifyAdhan) out.push({ id: tag + ":adhan", at: at(d, r.adhan), kind: "adhan", title: "حان الآن أذان " + r.name,
          body: r.iqama ? "الإقامة " + fmt(r.iqama, S) : (S.mosqueName || "") });
        if (M.notifyIqama && r.iqama) out.push({ id: tag + ":iqama", at: at(d, r.iqama - 5), kind: "iqama", title: "إقامة " + r.name + " بعد ٥ دقائق", body: S.mosqueName || "" });
      });
    }
    return out.sort(function (a, b) { return a.at - b.at; });
  }
  // التنبيهات التي حان وقتها ولم تُرسل (مع سماح دقيقتين حتى لا يُرسل القديم عند فتح التطبيق متأخراً)
  function due(list, nowMs, sent) {
    return list.filter(function (a) { var t = a.at.getTime(); return t <= nowMs && nowMs - t < 120000 && !(sent && sent[a.id]); });
  }

  // ——— التقويم (ics): أوثق طريقة لتنبيه يعمل والتطبيق مغلق، على آيفون وأندرويد ———
  function icsDate(dt) {
    return dt.getUTCFullYear() + pad(dt.getUTCMonth() + 1) + pad(dt.getUTCDate()) + "T" + pad(dt.getUTCHours()) + pad(dt.getUTCMinutes()) + "00Z";
  }
  function icsEscape(s) { return String(s || "").replace(/\\/g, "\\\\").replace(/[,;]/g, function (c) { return "\\" + c; }).replace(/\n/g, "\\n"); }
  function ics(from, S, M, days) {
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//mosque-clock//mobile//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "X-WR-CALNAME:" + icsEscape("مواقيت " + (S.mosqueName || "الصلاة"))];
    var stamp = icsDate(new Date());
    for (var i = 0; i < days; i++) {
      var d = addDays(from, i), dm = day(d, S);
      dm.rows.forEach(function (r) {
        if (r.base === "sunrise") return;
        var st = at(d, r.adhan), en = at(d, r.iqama || r.adhan + 15);
        L.push("BEGIN:VEVENT", "UID:" + dayKey(d) + "-" + r.key + "@mosque-clock", "DTSTAMP:" + stamp,
          "DTSTART:" + icsDate(st), "DTEND:" + icsDate(en),
          "SUMMARY:" + icsEscape("أذان " + r.name), "DESCRIPTION:" + icsEscape((r.iqama ? "الإقامة " + fmt(r.iqama, S) + " • " : "") + (S.mosqueName || "")),
          "TRANSP:TRANSPARENT");
        var before = Math.max(0, +M.notifyBefore || 0);
        L.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsEscape("أذان " + r.name), "TRIGGER:" + (before ? "-PT" + before + "M" : "PT0M"), "END:VALARM");
        L.push("END:VEVENT");
      });
    }
    L.push("END:VCALENDAR");
    return L.join("\r\n") + "\r\n";
  }

  // ——— التنسيق ———
  var AR = "٠١٢٣٤٥٦٧٨٩";
  function digits(str, S) { str = String(str); return !S || S.arabicDigits !== false ? str.replace(/[0-9]/g, function (d) { return AR[d]; }) : str; }
  function fmt(m, S, parts) {
    m = ((Math.round(m) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60;
    if (S && S.use24h) { var t = digits(pad(h) + ":" + pad(mm), S); return parts ? { t: t, p: "" } : t; }
    var p = h < 12 ? "ص" : "م", t2 = digits((h % 12 || 12) + ":" + pad(mm), S);
    return parts ? { t: t2, p: p } : t2 + " " + p;
  }
  function dur(sec, S) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return digits((h ? h + ":" + pad(m) : m) + ":" + pad(s), S);
  }

  // ——— الأذكار ———
  // kind: morning | evening | after. للأذكار بعد الصلاة: العدد ثلاثاً بعد الفجر والمغرب.
  function adhkar(kind, S, prayerKey) {
    var Q = root.ClockQuran, A = root.CLOCK_ADHKAR || {};
    var src = kind === "morning" ? S.adhkarMorningList : kind === "evening" ? S.adhkarEveningList : S.adhkarAfterList;
    var list = Q.parseAdhkar(src && src.length ? src : A[kind] || []);
    if (kind === "after") return Q.forPrayer(list, prayerKey || "dhuhr");
    return list.map(function (x) { var o = copy(x); o.count = x.n; return o; });
  }
  // الوقت المناسب لكل قائمة: الصباح من الفجر إلى الظهر، والمساء من العصر إلى العشاء، وإلا بعد الصلاة
  function adhkarKind(nowMin, t) {
    if (nowMin >= t.fajr && nowMin < t.dhuhr) return "morning";
    if (nowMin >= t.asr && nowMin < t.isha) return "evening";
    return "after";
  }
  // آخر صلاة دخل وقتها (لاختيار أعداد أذكار ما بعد الصلاة)
  function lastPrayer(nowMin, dm) {
    var k = "isha";
    dm.rows.forEach(function (r) { if (r.base !== "sunrise" && nowMin >= r.adhan) k = r.key; });
    return k;
  }

  // البحث في الفهرس: رقم سورة، أو اسم، أو مرجع ٢:٢٥٥
  function searchSurahs(q, names) {
    q = String(q || "").trim();
    var en = q.replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); });
    var ref = /^(\d{1,3})\s*[:：/]\s*(\d{1,3})$/.exec(en);
    if (ref) return { ref: { s: +ref[1], a: +ref[2] }, list: [+ref[1]].filter(function (s) { return s >= 1 && s <= 114; }) };
    if (/^\d{1,3}$/.test(en)) return { list: [+en].filter(function (s) { return s >= 1 && s <= 114; }) };
    var norm = function (s) { return s.replace(/[أإآا]/g, "ا").replace(/[ةه]/g, "ه").replace(/[ىي]/g, "ي").replace(/^ال/, "").replace(/\s+/g, ""); };
    var nq = norm(q), out = [];
    names.forEach(function (n, i) { if (!q || norm(n).indexOf(nq) >= 0) out.push(i + 1); });
    return { list: out };
  }

  var api = { NAMES: NAMES, ORDER: ORDER, MKEY: MKEY, CACHE: CACHE, DEFAULTS: DEFAULTS, effective: effective, day: day, now: now, timesFor: timesFor,
    alerts: alerts, due: due, ics: ics, fmt: fmt, dur: dur, digits: digits, adhkar: adhkar, adhkarKind: adhkarKind, lastPrayer: lastPrayer,
    searchSurahs: searchSurahs, addDays: addDays, dayKey: dayKey, at: at };
  root.MobileCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
