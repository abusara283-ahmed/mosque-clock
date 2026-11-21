/*
 * الإصدار ٨: التحقق من الدقة بجداول وزارة الأوقاف.
 * يقارن جدولاً رسمياً (يُقرأ بـ PrayerTimes.parseCSV) بالحساب الفلكي بالإعدادات الحالية،
 * ويعطي لكل وقت: نسبة المطابقة التامة، وضمن دقيقة، وضمن دقيقتين، وأكبر فرق، والوسيط،
 * وأسوأ الأيام، واقتراح تعديل يدوي بالدقائق. دوال صافية تعمل في المتصفح وفي Node.
 */
(function (root) {
  var KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  var NAMES = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
  function toMin(s) { var p = String(s).split(":"); return (+p[0]) * 60 + (+p[1]); }
  function hm(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"); }
  // مفتاح الجدول: 2026-11-06 أو 11-06 (بلا سنة = السنة المعطاة)
  function dateOf(key, year) {
    var p = key.split("-");
    return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : new Date(year || new Date().getFullYear(), +p[0] - 1, +p[1]);
  }
  function median(a) { var b = a.slice().sort(function (x, y) { return x - y; }); return b.length ? b[Math.floor(b.length / 2)] : 0; }

  // table: { "2026-11-06": ["04:56", ...] } ، S: الإعدادات ، opts: { year, tolerance, compute(date, S) }
  function compare(table, S, opts) {
    opts = opts || {};
    var PT = root.PrayerTimes, calcS = root.ClockConfig ? root.ClockConfig.merge(S, { useTable: false }) : S;
    var computeFn = opts.compute || function (d, s) { return PT.compute(d, s); };
    var tol = opts.tolerance == null ? 1 : opts.tolerance;
    var per = {}, rows = [];
    KEYS.forEach(function (k) { per[k] = { key: k, name: NAMES[k], diffs: [], worst: [] }; });
    Object.keys(table).sort().forEach(function (dk) {
      var d = dateOf(dk, opts.year), t = computeFn(d, calcS), row = { date: dk, cells: [] };
      KEYS.forEach(function (k, i) {
        var off = toMin(table[dk][i]), calc = Math.round(t[k]), diff = off - calc;
        per[k].diffs.push(diff);
        per[k].worst.push({ date: dk, official: table[dk][i], calc: hm(calc), diff: diff });
        row.cells.push({ key: k, official: table[dk][i], calc: hm(calc), diff: diff });
      });
      rows.push(row);
    });
    var all = [], suggest = {}, out = [];
    KEYS.forEach(function (k) {
      var P = per[k], n = P.diffs.length;
      if (!n) return;
      var abs = P.diffs.map(Math.abs);
      all = all.concat(abs);
      var med = median(P.diffs);
      P.worst.sort(function (a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
      out.push({
        key: k, name: P.name, n: n, median: med,
        exact: abs.filter(function (x) { return x === 0; }).length / n,
        within1: abs.filter(function (x) { return x <= 1; }).length / n,
        within2: abs.filter(function (x) { return x <= 2; }).length / n,
        maxAbs: Math.max.apply(null, abs), min: Math.min.apply(null, P.diffs), max: Math.max.apply(null, P.diffs),
        worst: P.worst.slice(0, 5).filter(function (w) { return w.diff !== 0; })
      });
      // نقترح التعديل فقط إن كان الفرق ثابتاً (الوسيط دقيقة فأكثر)
      suggest[k] = Math.abs(med) >= 1 ? med : 0;
    });
    var n = all.length;
    var overall = n ? {
      n: n, days: rows.length,
      exact: all.filter(function (x) { return x === 0; }).length / n,
      within1: all.filter(function (x) { return x <= 1; }).length / n,
      within2: all.filter(function (x) { return x <= 2; }).length / n,
      maxAbs: Math.max.apply(null, all),
      outside: all.filter(function (x) { return x > tol; }).length
    } : { n: 0, days: 0, exact: 0, within1: 0, within2: 0, maxAbs: 0, outside: 0 };
    var verdict = !n ? "لا بيانات" : overall.maxAbs <= 1 ? "ممتاز: كل الأوقات ضمن دقيقة من الجدول الرسمي" :
      overall.within2 >= 0.99 ? "جيد: الأغلب ضمن دقيقتين" : "يحتاج تعديلاً: استخدم الجدول الرسمي أو التعديل المقترح";
    return { perKey: out, overall: overall, suggest: suggest, rows: rows, verdict: verdict, tolerance: tol };
  }

  // تقرير CSV مفصّل لكل يوم (يفتح في Excel، بترميز UTF-8 مع BOM)
  function reportCSV(res) {
    var head = ["التاريخ"].concat([].concat.apply([], KEYS.map(function (k) { return [NAMES[k] + " رسمي", NAMES[k] + " محسوب", NAMES[k] + " فرق"]; })));
    var lines = [head.join(",")];
    res.rows.forEach(function (r) {
      lines.push([r.date].concat([].concat.apply([], r.cells.map(function (c) { return [c.official, c.calc, c.diff]; }))).join(","));
    });
    lines.push("");
    lines.push("الملخص,المطابقة التامة,ضمن دقيقة,ضمن دقيقتين,أكبر فرق,الوسيط");
    res.perKey.forEach(function (p) {
      lines.push([p.name, pct(p.exact), pct(p.within1), pct(p.within2), p.maxAbs, p.median].join(","));
    });
    return "﻿" + lines.join("\r\n") + "\r\n";
  }
  function pct(x) { return Math.round(x * 1000) / 10 + "%"; }

  // تطبيق التعديل المقترح على إعدادات (يُضاف لما هو موجود)
  function applySuggest(S, suggest) {
    var adj = {};
    KEYS.forEach(function (k) { adj[k] = (+((S.adjust || {})[k]) || 0) + (+suggest[k] || 0); });
    return adj;
  }

  // الإصدار ١٠: فرق اليوم بين صف الجدول الرسمي ["04:56", ...] والأوقات المعروضة t (بالدقائق). يُرجع ما تجاوز السماح فقط
  function todayDiff(row, t, tol) {
    tol = tol == null ? 1 : tol;
    if (!row || row.length < 6 || !t) return [];
    var out = [];
    KEYS.forEach(function (k, i) {
      var diff = toMin(row[i]) - Math.round(t[k]);
      if (Math.abs(diff) > tol) out.push({ key: k, name: NAMES[k], diff: diff, official: row[i], calc: hm(t[k]) });
    });
    return out;
  }

  var api = { todayDiff: todayDiff, compare: compare, reportCSV: reportCSV, applySuggest: applySuggest, dateOf: dateOf, pct: pct, KEYS: KEYS, NAMES: NAMES };
  root.ClockVerify = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
