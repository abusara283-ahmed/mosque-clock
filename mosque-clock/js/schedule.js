/*
 * منطق أحداث اليوم (دوال صافية بلا واجهة، لتسهيل الاختبار).
 * الأوقات بالثواني من منتصف الليل.
 */
(function (root) {
  var PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  var ORDER = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

  // جدول اليوم: لكل صلاة وقت الأذان (A) والإقامة (I) ونهاية الصلاة (E) ونهاية الأذكار (Z)
  function hm(str) { var m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(str || "")); return m ? (+m[1]) * 60 + (+m[2]) : null; }
  // مدد ما بعد الصلاة (بالثواني): الأذكار ثم الآية والتفسير (الإصدار ٧)
  function postDurations(key, S) {
    var ad = S.adhkarAfter && S.adhkarAfter[key] === false ? 0 : (S.afterPrayerAdhkarMinutes || 0) * 60;
    var ay = S.ayahEnabled && S.ayahAfter && S.ayahAfter[key] ? Math.max(0, +S.ayahMinutes || 0) * 60 : 0;
    return { ad: ad, ay: ay };
  }
  // الإصدار ٨: جدول الإقامة الذكي. لكل صلاة طريقة (S.iqamaMode):
  //   minutes = بعد الأذان بعدد ثابت من الدقائق (الافتراضي)
  //   fixed   = موعد ثابت مثل 20:00 (من S.iqamaFixed)، ويرجع للدقائق إن لم يكن بعد الأذان وخلال ساعتين
  //   round   = الأذان + الدقائق ثم تقريب للأعلى لأقرب S.iqamaRound دقائق (مثل 5 ← 12:25 بدل 12:23)
  //   weekly  = موعد ثابت طوال الأسبوع (من السبت): أبعد أذان في الأسبوع + الدقائق، مقرّباً للأعلى
  // في round وweekly تعمل الدقائق كأقل فاصل، وS.iqamaMax (إن وُجد) كأقصى فاصل.
  function roundUp(m, step) { step = Math.max(1, +step || 1); return Math.ceil(m / step) * step; }
  function iqamaMinute(k, adhan, S, weekMax) {
    var gap = +S.iqama[k] || 0;
    var mode = (S.iqamaMode && S.iqamaMode[k]) || "minutes";
    var fx = S.iqamaFixed ? hm(S.iqamaFixed[k]) : null;
    // التوافق مع الإصدار ٧: موعد ثابت مكتوب يُعتمد ولو بقيت الطريقة «دقائق»
    if ((mode === "fixed" || (mode === "minutes" && fx != null)) && fx != null && fx > adhan && fx - adhan <= 120) return { at: fx, how: "fixed" };
    if (mode === "round" || mode === "weekly") {
      var base = mode === "weekly" && weekMax && weekMax[k] != null ? Math.max(weekMax[k], adhan) : adhan;
      var at = roundUp(base + gap, S.iqamaRound || 5);
      var mx = S.iqamaMax && +S.iqamaMax[k] > 0 ? +S.iqamaMax[k] : 0;
      if (mx && at - adhan > mx) at = adhan + Math.max(gap, mx); // لا يطول الانتظار أكثر من الحد
      if (at < adhan + gap) at = adhan + gap;
      return { at: at, how: mode };
    }
    return { at: adhan + gap, how: "minutes" };
  }
  // أبعد وقت أذان لكل صلاة في أسبوع التاريخ d (السبت إلى الجمعة). timesOf(date) تعيد أوقات اليوم بالدقائق.
  function weekMax(d, timesOf) {
    var start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 1) % 7));
    var out = {};
    for (var i = 0; i < 7; i++) {
      var t = timesOf(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
      PRAYERS.forEach(function (k) { if (out[k] == null || t[k] > out[k]) out[k] = t[k]; });
    }
    return out;
  }
  function needsWeek(S) { return !!S.iqamaMode && PRAYERS.some(function (k) { return S.iqamaMode[k] === "weekly"; }); }

  function build(times, friday, S, wk) {
    return PRAYERS.map(function (k) {
      var key = (k === "dhuhr" && friday) ? "jumuah" : k;
      var iq = key === "jumuah" ? { at: times[k] + (S.iqama.jumuah || 0), how: "minutes" } : iqamaMinute(k, times[k], S, wk);
      var iqMin = iq.at - times[k];
      var A = times[k] * 60, I = A + iqMin * 60;
      var E = I + ((S.prayerDuration[key] != null ? S.prayerDuration[key] : 10) * 60);
      var pd = postDurations(key, S);
      return { key: key, base: k, adhan: times[k], iqamaMin: times[k] + iqMin, iqHow: iq.how, A: A, I: I, E: E, AD: pd.ad, AY: pd.ay, Z: E + pd.ad + pd.ay };
    });
  }

  // الحالة الحالية: null (عادي) أو adhan | iqama | prayer | adhkar
  function state(ns, sch, S) {
    var out = null;
    sch.forEach(function (p) {
      var hasIqama = p.I > p.A;
      var adhanEnd = hasIqama ? Math.min(p.A + S.adhanScreenMinutes * 60, p.I) : p.A;
      if (hasIqama && ns >= p.A && ns < adhanEnd) out = { name: "adhan", p: p };
      else if (ns >= adhanEnd && ns < p.I) out = { name: "iqama", p: p, left: p.I - ns };
      else if (ns >= p.I && ns < p.E) out = { name: "prayer", p: p };
      else if (ns >= p.E && ns < p.Z) {
        var since = ns - p.E, ayahFirst = S.postOrder === "ayah";
        var first = ayahFirst ? p.AY : p.AD;
        if (since < first) out = { name: ayahFirst ? "ayah" : "adhkar", p: p, since: since, len: first };
        else out = { name: ayahFirst ? "adhkar" : "ayah", p: p, since: since - first, len: p.Z - p.E - first };
      }
    });
    return out;
  }

  // أذكار الصباح والمساء بشاشة كاملة (الإصدار ٧): نافذة تبدأ بعد أذكار الفجر/العصر أو بموعد ثابت
  function session(ns, sch, S) {
    function win(mode, start, minutes, anchor, limit) {
      if (mode !== "screen" || !(minutes > 0)) return null;
      var st = hm(start), a = st != null ? st * 60 : anchor.Z, b = Math.min(a + minutes * 60, limit.A);
      return ns >= a && ns < b ? { since: ns - a, left: b - ns, len: b - a } : null;
    }
    var m = win(S.morningMode, S.morningStart, +S.morningMinutes, sch[0], sch[1]);
    if (m) { m.name = "morning"; return m; }
    var e = win(S.eveningMode, S.eveningStart, +S.eveningMinutes, sch[2], sch[3]);
    if (e) { e.name = "evening"; return e; }
    return null;
  }

  // الحدث القادم والسابق (للعدّ التنازلي وشريط التقدّم). tomorrowFajr بالدقائق.
  function next(ns, times, tomorrowFajr) {
    var prev = { key: "isha", at: times.isha * 60 - 86400 }, nx = null;
    ORDER.forEach(function (k) {
      var at = times[k] * 60;
      if (!nx && at > ns) nx = { key: k, at: at };
      else if (!nx) prev = { key: k, at: at };
    });
    if (!nx) nx = { key: "fajr", at: 86400 + tomorrowFajr * 60, tomorrow: true };
    return { next: nx, prev: prev, left: nx.at - ns, progress: Math.max(0, Math.min(1, (ns - prev.at) / (nx.at - prev.at))) };
  }

  // راحة الشاشة: ليلاً بعد العشاء حتى قبيل الفجر، واختيارياً وقت الضحى (ما عدا الجمعة)
  function rest(ns, sch, times, S, friday) {
    var fajr = sch[0], isha = sch[4];
    if (S.nightRest) {
      var start = Math.max(isha.Z, isha.I + (S.nightRestAfterIsha || 0) * 60);
      var end = fajr.A - (S.nightRestBeforeFajr || 0) * 60;
      if (ns >= start || ns < end) return "night";
    }
    if (S.dayRest && !friday) {
      var dhuhr = sch[1];
      if (ns >= Math.max(times.sunrise * 60 + 1800, fajr.Z) && ns < dhuhr.A - 1800) return "day";
    }
    return null;
  }

  // موعد ثابت لصلاة الجمعة (مثل "12:15") يحل محل الظهر يوم الجمعة
  function applyJumuah(times, friday, S) {
    var m = friday && /^(\d{1,2}):(\d{2})$/.exec(String(S.jumuahFixed || "").trim());
    if (!m) return times;
    var out = {}, k;
    for (k in times) out[k] = times[k];
    out.dhuhr = (+m[1]) * 60 + (+m[2]);
    if (out.dhuhr <= out.sunrise || out.dhuhr >= out.asr) return times; // قيمة غير معقولة
    out.jumuahFixed = true;
    return out;
  }

  // فترة اليوم لاختيار الألوان تلقائياً
  function period(nowMin, t) {
    if (nowMin >= t.fajr && nowMin < t.sunrise + 20) return "dawn";
    if (nowMin >= t.sunrise + 20 && nowMin < t.asr) return "day";
    if (nowMin >= t.asr && nowMin < t.maghrib) return "golden";
    if (nowMin >= t.maghrib && nowMin < t.isha + 30) return "dusk";
    return "night";
  }

  root.ClockSchedule = { build: build, iqamaMinute: iqamaMinute, weekMax: weekMax, needsWeek: needsWeek, roundUp: roundUp, state: state, session: session, hm: hm, next: next, period: period, rest: rest, applyJumuah: applyJumuah, PRAYERS: PRAYERS, ORDER: ORDER };
  if (typeof module !== "undefined") module.exports = root.ClockSchedule;
})(typeof window !== "undefined" ? window : globalThis);
