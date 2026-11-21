/*
 * حساب أوقات الصلاة فلكياً (بدون إنترنت).
 * المعادلات: موقع الشمس التقريبي (دقة دقيقة تقريباً) ثم زاوية الساعة لكل وقت.
 * يُرجع الأوقات كدقائق من منتصف الليل بالتوقيت المحلي المحدد في الإعدادات.
 */
(function () {
  var rad = Math.PI / 180, deg = 180 / Math.PI;
  function sin(d) { return Math.sin(d * rad); }
  function cos(d) { return Math.cos(d * rad); }
  function tan(d) { return Math.tan(d * rad); }
  function asin(x) { return Math.asin(x) * deg; }
  function acos(x) { return Math.acos(Math.max(-1, Math.min(1, x))) * deg; }
  function atan2(y, x) { return Math.atan2(y, x) * deg; }
  function wrap(a, m) { a = a % m; return a < 0 ? a + m : a; }

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }

  // ميل الشمس ومعادلة الزمن عند يوم جولياني معيّن
  function sun(jd) {
    var D = jd - 2451545.0;
    var g = wrap(357.529 + 0.98560028 * D, 360);
    var q = wrap(280.459 + 0.98564736 * D, 360);
    var L = wrap(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    var e = 23.439 - 0.00000036 * D;
    var RA = wrap(atan2(cos(e) * sin(L), cos(L)) / 15, 24);
    var eqt = q / 15 - RA;
    if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
    return { decl: asin(sin(e) * sin(L)), eqt: eqt };
  }

  // ——— طرق الحساب الجاهزة ———
  // oman: مطابقة لتقويم وزارة الأوقاف والشؤون الدينية في عُمان: الفجر والعشاء ١٨°، والظهر والعصر والمغرب
  //       متأخرة ٥ دقائق احتياطاً (تحققنا منها على جداول مسقط وصحار ونزوى وصلالة: الفرق لا يتجاوز دقيقة).
  //       ملاحظة: الظهر يتضمن أصلاً دقيقة احتياط، لذا إزاحته هنا ٤.
  var METHODS = {
    oman:      { name: "وزارة الأوقاف والشؤون الدينية (عُمان)", fajr: 18, isha: 18, offset: { dhuhr: 4, asr: 5, maghrib: 5 } },
    ummalqura: { name: "أم القرى (السعودية)", fajr: 18.5, ishaMinutes: 90, ramadanIshaMinutes: 120 },
    mwl:       { name: "رابطة العالم الإسلامي", fajr: 18, isha: 17 },
    egypt:     { name: "الهيئة المصرية العامة للمساحة", fajr: 19.5, isha: 17.5 },
    custom:    { name: "مخصّصة (الزوايا أدناه)" }
  };
  function isRamadan(date) {
    try {
      var m = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { month: "numeric" }).format(date);
      return parseInt(m, 10) === 9;
    } catch (e) { return false; }
  }
  // دمج الطريقة المختارة مع إعدادات المستخدم (التعديل اليدوي يُضاف فوق إزاحة الطريقة)
  function resolve(date, s) {
    var m = METHODS[s.method] || METHODS.custom;
    if (m === METHODS.custom) return s;
    var r = {}, k;
    for (k in s) r[k] = s[k];
    r.fajrAngle = m.fajr;
    r.ishaAngle = m.isha || s.ishaAngle;
    r.ishaFixedMinutes = m.ishaMinutes ? (m.ramadanIshaMinutes && isRamadan(date) ? m.ramadanIshaMinutes : m.ishaMinutes) : 0;
    r.maghribAfterSunset = 0;
    r.adjust = {};
    ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"].forEach(function (x) {
      r.adjust[x] = ((s.adjust && s.adjust[x]) || 0) + ((m.offset && m.offset[x]) || 0);
    });
    // العشاء في طريقة عُمان من الغروب الفلكي، فلا تتأثر بإزاحة المغرب
    return r;
  }

  function compute(date, s) {
    s = resolve(date, s);
    var lat = s.latitude, lon = s.longitude, tz = s.timezone;
    var jd0 = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lon / 360;

    function noon(t) { return wrap(12 - sun(jd0 + t / 24).eqt, 24); }
    // وقت عندما تكون الشمس على زاوية angle تحت الأفق (dir: -1 قبل الزوال، +1 بعده)
    function atAngle(angle, t, dir) {
      var sp = sun(jd0 + t / 24);
      var h = acos((-sin(angle) - sin(sp.decl) * sin(lat)) / (cos(sp.decl) * cos(lat))) / 15;
      return noon(t) + dir * h;
    }
    function asrTime(t) {
      var f = s.asrMethod === "hanafi" ? 2 : 1;
      var sp = sun(jd0 + t / 24);
      var alt = -atan2(1, f + tan(Math.abs(lat - sp.decl))); // زاوية الارتفاع سالبة لأن atAngle تأخذ "تحت الأفق"
      return atAngle(alt, t, 1);
    }

    var riseAngle = 0.833 + 0.0347 * Math.sqrt(Math.max(0, s.elevation || 0));
    // تقدير أولي ثم تكرار مرتين لتحسين الدقة
    var t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (var i = 0; i < 2; i++) {
      t = {
        fajr: atAngle(s.fajrAngle, t.fajr, -1),
        sunrise: atAngle(riseAngle, t.sunrise, -1),
        dhuhr: noon(t.dhuhr),
        asr: asrTime(t.asr),
        sunset: atAngle(riseAngle, t.sunset, 1),
        isha: atAngle(s.ishaAngle, t.isha, 1)
      };
    }

    var shift = tz - lon / 15; // من التوقيت الشمسي إلى التوقيت المحلي
    var adj = s.adjust || {};
    function toMin(h, key, extra) {
      return Math.round((h + shift) * 60 + (extra || 0) + (adj[key] || 0));
    }
    var res = {
      fajr: toMin(t.fajr, "fajr"),
      sunrise: toMin(t.sunrise, "sunrise"),
      dhuhr: toMin(t.dhuhr, "dhuhr", 1), // دقيقة احتياط بعد الزوال
      asr: toMin(t.asr, "asr"),
      maghrib: toMin(t.sunset, "maghrib", s.maghribAfterSunset || 0)
    };
    res.isha = s.ishaFixedMinutes > 0
      ? res.maghrib + s.ishaFixedMinutes + (adj.isha || 0)
      : toMin(t.isha, "isha");
    return res;
  }

  // ——— الجداول الرسمية ———
  // المصادر بالترتيب: جدول مستورد من صفحة الإعدادات (محفوظ في الجهاز) ← data/prayer-table.js ← الحساب الفلكي.
  // المفاتيح: "2026-11-06" لتاريخ محدد، أو "11-06" لكل السنوات. القيمة: [فجر, شروق, ظهر, عصر, مغرب, عشاء].
  var KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  var TABLE_KEY = "mosqueClock.table.v1";
  var importedCache;

  function pad2(n) { return String(n).padStart(2, "0"); }
  function importedTable() {
    if (importedCache !== undefined) return importedCache;
    try { importedCache = JSON.parse(localStorage.getItem(TABLE_KEY) || "null"); }
    catch (e) { importedCache = null; }
    return importedCache;
  }
  function toMinutes(str) {
    var p = String(str).split(":");
    return (+p[0]) * 60 + (+p[1]);
  }
  function lookup(tbl, date) {
    if (!tbl) return null;
    var md = pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
    return tbl[date.getFullYear() + "-" + md] || tbl[md] || null;
  }
  function fromTable(date, s) {
    if (!s.useTable) return null;
    var row = lookup(importedTable(), date) || lookup(window.PRAYER_TABLE, date);
    if (!row || row.length < 6) return null;
    var out = {};
    KEYS.forEach(function (key, i) { out[key] = toMinutes(row[i]); });
    out.source = "table";
    return out;
  }

  // تحويل نص CSV (منسوخ من جدول الوزارة أو Excel) إلى جدول.
  // كل سطر: التاريخ ثم ستة أوقات. يقبل: 2026-11-06 أو 06/11/2026 أو 11-06، وأرقاماً عربية، ونظام 12 ساعة.
  function parseCSV(text) {
    var AR = "٠١٢٣٤٥٦٧٨٩", FA = "۰۱۲۳۴۵۶۷۸۹";
    text = String(text).replace(/[٠-٩]/g, function (d) { return AR.indexOf(d); })
                       .replace(/[۰-۹]/g, function (d) { return FA.indexOf(d); });
    var table = {}, errors = [], count = 0;
    text.split(/\r?\n/).forEach(function (line, n) {
      // الإصدار ٧: يقبل أيضاً ملفات «توقيت» (wtimes-*.js) بأسطر مثل  "01-01~~~~~05:30|06:49|12:18|15:21|17:42|18:56",
      line = line.trim().replace(/^["']|["'],?$/g, "").replace(/~+/g, ",");
      if (!line || /^(var|\[|\]|-{3,})/.test(line)) return;
      var cells = line.split(/[,;\t|]+/).map(function (c) { return c.trim(); }).filter(Boolean);
      // الإصدار ٨: التاريخ الميلادي في أي عمود (جداول الأوقاف قد تبدأ باسم اليوم أو بالتاريخ الهجري)
      var key = null, m, di = -1;
      for (var c = 0; c < cells.length && !key; c++) {
        var date = cells[c];
        if ((m = date.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/)) && +m[1] >= 1900) key = m[1] + "-" + pad2(m[2]) + "-" + pad2(m[3]);
        else if ((m = date.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/)) && +m[3] >= 1900) key = m[3] + "-" + pad2(m[2]) + "-" + pad2(m[1]);
        else if (c === 0 && (m = date.match(/^(\d{1,2})-(\d{1,2})$/))) key = pad2(m[1]) + "-" + pad2(m[2]);
        if (key) di = c;
      }
      if (!key) { if (n > 0) errors.push(n + 1); return; } // السطر الأول قد يكون عناوين
      var times = cells.slice(di + 1).filter(function (c) { return /^\d{1,2}:\d{2}/.test(c); }).slice(0, 6);
      if (times.length < 6) { errors.push(n + 1); return; }
      var mins = times.map(function (t) {
        var v = toMinutes(t.match(/^\d{1,2}:\d{2}/)[0]);
        if (/(م|pm|PM|مساء)\s*$/.test(t) && v < 720) v += 720; // «٣:٠٦ م»
        if (/(ص|am|AM|صباح)\s*$/.test(t) && v >= 720) v -= 720; // «١٢:١٠ ص»
        return v;
      });
      // نظام 12 ساعة: ما بعد الظهر يُضاف له 12 ساعة إن جاء أصغر من سابقه
      for (var i = 2; i < 6; i++) {
        while (mins[i] < mins[i - 1] - 30 && mins[i] < 720) mins[i] += 720;
      }
      table[key] = mins.map(function (v) { return pad2(Math.floor(v / 60)) + ":" + pad2(v % 60); });
      count++;
    });
    return { table: table, count: count, errors: errors };
  }

  window.PrayerTimes = {
    forDate: function (date, s) {
      var t = fromTable(date, s);
      if (t) return t;
      t = compute(date, s); t.source = "calc"; return t;
    },
    compute: compute,
    METHODS: METHODS,
    resolve: resolve,
    parseCSV: parseCSV,
    TABLE_KEY: TABLE_KEY,
    saveImported: function (tbl) {
      importedCache = tbl;
      try { if (tbl) localStorage.setItem(TABLE_KEY, JSON.stringify(tbl)); else localStorage.removeItem(TABLE_KEY); return true; }
      catch (e) { return false; }
    },
    imported: importedTable,
    KEYS: KEYS
  };
})();
