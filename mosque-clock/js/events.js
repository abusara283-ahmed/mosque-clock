/*
 * المناسبات الخاصة (الإصدار ٦): صلاة الجنازة، صلاة العيد، التراويح والقيام، الدروس.
 * دوال صافية بلا واجهة لتسهيل الاختبار. الأوقات بالثواني من منتصف الليل.
 *
 * المناسبة المحفوظة في الإعدادات (S.events):
 * { id, type: "funeral"|"lesson"|"eid"|"custom", title, person, note,
 *   date: "2026-11-20", repeat: "once"|"daily"|"weekly", weekday: 0-6,
 *   anchor: "fajr"|"dhuhr"|"asr"|"maghrib"|"isha"|"time", time: "16:30", enabled: true }
 * anchor = صلاة: تُقام بعد انتهاء تلك الصلاة. anchor = time: في الموعد المكتوب.
 */
(function (root) {
  var TYPES = {
    funeral:  { name: "صلاة الجنازة", en: "Funeral prayer", dur: 15, tone: "mourn" },
    eid:      { name: "صلاة العيد", en: "Eid prayer", dur: 60, tone: "joy" },
    taraweeh: { name: "صلاة التراويح", en: "Taraweeh", dur: 90, tone: "gold" },
    qiyam:    { name: "صلاة القيام", en: "Qiyam", dur: 90, tone: "gold" },
    lesson:   { name: "درس", en: "Lesson", dur: 45, tone: "gold" },
    custom:   { name: "مناسبة", en: "Event", dur: 30, tone: "gold" }
  };
  var PRAYER_AR = { fajr: "الفجر", dhuhr: "الظهر", jumuah: "الجمعة", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
  var ANCHORS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

  function dayStr(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function parseHM(s) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return (+m[1]) * 60 + (+m[2]);
  }

  function matches(ev, d) {
    if (!ev || ev.enabled === false) return false;
    var rep = ev.repeat || "once";
    if (rep === "daily") return true;
    if (rep === "weekly") return +ev.weekday === d.getDay();
    return ev.date === dayStr(d);
  }

  // وقت المناسبة بالثواني: بعد انتهاء الصلاة المرتبطة بها أو في موعد ثابت
  function timeOf(ev, sch) {
    if (ev.anchor === "time" || !ev.anchor) { var m = parseHM(ev.time); return m == null ? null : m * 60; }
    var p = (sch || []).filter(function (x) { return x.base === ev.anchor; })[0];
    return p ? p.E : null;
  }

  function whenText(ev, sch) {
    if (ev.anchor && ev.anchor !== "time") {
      var p = (sch || []).filter(function (x) { return x.base === ev.anchor; })[0];
      return "بعد صلاة " + PRAYER_AR[p ? p.key : ev.anchor];
    }
    return "";
  }

  // مناسبات اليوم مرتبة بالوقت. ctx: { sch, hijri: {m, d}, S }
  function forDay(d, ctx) {
    var S = ctx.S || {}, sch = ctx.sch, h = ctx.hijri, out = [];
    (S.events || []).forEach(function (ev) {
      if (!matches(ev, d)) return;
      var at = timeOf(ev, sch);
      if (at == null) return;
      var T = TYPES[ev.type] || TYPES.custom;
      out.push({ id: ev.id, type: TYPES[ev.type] ? ev.type : "custom", tone: T.tone, title: ev.title || T.name, en: T.en,
        person: ev.person || "", note: ev.note || "", at: at, until: at + T.dur * 60, anchor: ev.anchor || "time", when: whenText(ev, sch) });
    });
    // تلقائية من الإعدادات
    if (h && h.m === 9 && S.taraweeh) {
      var isha = sch && sch[4];
      if (isha) out.push({ id: "auto-taraweeh", type: "taraweeh", tone: "gold", title: TYPES.taraweeh.name, en: TYPES.taraweeh.en,
        person: "", note: "", at: isha.E, until: isha.E + TYPES.taraweeh.dur * 60, anchor: "isha", when: "بعد صلاة العشاء" });
    }
    var q = parseHM(S.qiyamTime);
    if (h && h.m === 9 && h.d >= 21 && q != null && sch && q * 60 < sch[0].A) {
      out.push({ id: "auto-qiyam", type: "qiyam", tone: "gold", title: TYPES.qiyam.name, en: TYPES.qiyam.en,
        person: "", note: "العشر الأواخر", at: q * 60, until: q * 60 + TYPES.qiyam.dur * 60, anchor: "time", when: "" });
    }
    var e = parseHM(S.eidPrayerTime);
    if (h && e != null && ((h.m === 10 && h.d === 1) || (h.m === 12 && h.d === 10))) {
      out.push({ id: "auto-eid", type: "eid", tone: "joy", title: h.m === 10 ? "صلاة عيد الفطر" : "صلاة عيد الأضحى", en: "Eid prayer",
        person: "", note: "تقبّل الله منا ومنكم", at: e * 60, until: e * 60 + TYPES.eid.dur * 60, anchor: "time", when: "" });
    }
    return out.sort(function (a, b) { return a.at - b.at; });
  }

  // المناسبة التي تُبرز الآن: الأقرب من التي لم تنتهِ بعد
  function featured(list, ns) {
    for (var i = 0; i < list.length; i++) if (ns < list[i].until) return list[i];
    return null;
  }

  // مناسبة تُقام بعد صلاة معيّنة (لإظهارها في شاشة الإقامة)
  function afterPrayer(list, base) {
    return list.filter(function (x) { return x.anchor === base; })[0] || null;
  }

  // حذف المناسبات المنتهية (مرة واحدة) التي مضى عليها أكثر من يومين
  function prune(events, today) {
    var lim = new Date(today); lim.setDate(lim.getDate() - 2);
    var cut = dayStr(lim);
    return (events || []).filter(function (ev) { return (ev.repeat && ev.repeat !== "once") || !ev.date || ev.date >= cut; });
  }

  // رمضان: «الإفطار» قبل المغرب و«الإمساك» في السحر
  // nx من ClockSchedule.next، t أوقات اليوم بالدقائق، tf فجر الغد بالدقائق
  function ramadanHero(ns, nx, t, imsakMinutes, ramadanToday, ramadanTomorrow) {
    var k = nx.next.key;
    if (k === "maghrib" && ramadanToday) return { label: "موعد الإفطار", name: "الإفطار", left: nx.left, at: nx.next.at, iftar: true };
    if (k === "fajr" && imsakMinutes > 0 && (nx.next.tomorrow ? ramadanTomorrow : ramadanToday)) {
      var imsakAt = nx.next.at - imsakMinutes * 60;
      if (ns < imsakAt) return { label: "السحور", name: "الإمساك", left: imsakAt - ns, at: imsakAt, imsak: true };
    }
    return null;
  }

  // موضع اللحظة على «شريط اليوم» بين (الفجر − ساعة) و(العشاء + ساعة)
  function dayline(nowMin, t) {
    var a = t.fajr - 60, b = t.isha + 60, span = b - a;
    function pos(m) { return Math.max(0, Math.min(1, (m - a) / span)); }
    var marks = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"].map(function (k) { return { key: k, x: pos(t[k]) }; });
    var night = nowMin < t.sunrise || nowMin >= t.maghrib;
    return { now: pos(nowMin), marks: marks, night: night, inside: nowMin >= a && nowMin <= b };
  }

  // الإصدار ١٠: دروس الأيام السبعة القادمة (لشريحة «جدول الدروس») مرتبة باليوم ثم الوقت
  var DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  function weekLessons(S, from) {
    var out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
      (S && S.events || []).forEach(function (ev) {
        if (ev.type !== "lesson" || !matches(ev, d)) return;
        var anc = ev.anchor && ev.anchor !== "time";
        var at = anc ? ANCHORS.indexOf(ev.anchor) * 1000 : (parseHM(ev.time) == null ? 9999 : parseHM(ev.time));
        out.push({ day: i === 0 ? "اليوم" : i === 1 ? "غداً" : DAYS[d.getDay()], offset: i, title: ev.title || TYPES.lesson.name, person: ev.person || "",
          when: anc ? "بعد " + PRAYER_AR[ev.anchor === "dhuhr" && d.getDay() === 5 ? "jumuah" : ev.anchor] : (ev.time || ""), sort: i * 100000 + at });
      });
    }
    return out.sort(function (a, b) { return a.sort - b.sort; });
  }

  var api = { weekLessons: weekLessons, DAYS: DAYS, TYPES: TYPES, ANCHORS: ANCHORS, forDay: forDay, featured: featured, afterPrayer: afterPrayer, prune: prune,
    ramadanHero: ramadanHero, dayline: dayline, parseHM: parseHM, dayStr: dayStr, matches: matches };
  root.ClockEvents = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
