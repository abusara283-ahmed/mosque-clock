/*
 * السماء الحقيقية: ارتفاع الشمس واتجاهها لحظياً من الإحداثيات، ولون السماء المقابل لهذا الارتفاع.
 * تُستخدم في «نافذة المحراب» لترسم سماء المسجد كما هي خارجه الآن. دوال صافية لتسهيل الاختبار.
 */
(function (root) {
  var rad = Math.PI / 180;
  function wrap(a, m) { a %= m; return a < 0 ? a + m : a; }

  // موقع الشمس: الارتفاع والسمت (درجات) وزاوية الساعة. date: لحظة حقيقية، tz: فرق التوقيت المحلي المعتمد
  function sun(date, lat, lon, tz) {
    var y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
    var hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
    var ut = hours - tz;
    var jd = 367 * y - Math.floor(7 * (y + Math.floor((mo + 9) / 12)) / 4) + Math.floor(275 * mo / 9) + d - 730531.5 + ut / 24; // أيام منذ J2000
    var g = wrap(357.529 + 0.98560028 * jd, 360), q = wrap(280.459 + 0.98564736 * jd, 360);
    var L = wrap(q + 1.915 * Math.sin(g * rad) + 0.020 * Math.sin(2 * g * rad), 360), e = 23.439 - 0.00000036 * jd;
    var ra = Math.atan2(Math.cos(e * rad) * Math.sin(L * rad), Math.cos(L * rad)) / rad / 15;
    ra = wrap(ra, 24);
    var decl = Math.asin(Math.sin(e * rad) * Math.sin(L * rad)) / rad;
    var eqt = q / 15 - ra; if (eqt > 12) eqt -= 24; if (eqt < -12) eqt += 24;
    var solar = ut + lon / 15 + eqt;                // التوقيت الشمسي الحقيقي
    var H = wrap((solar - 12) * 15 + 180, 360) - 180; // زاوية الساعة: سالبة صباحاً
    var sinAlt = Math.sin(lat * rad) * Math.sin(decl * rad) + Math.cos(lat * rad) * Math.cos(decl * rad) * Math.cos(H * rad);
    var alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) / rad;
    var az = Math.atan2(Math.sin(H * rad), Math.cos(H * rad) * Math.sin(lat * rad) - Math.tan(decl * rad) * Math.cos(lat * rad)) / rad + 180;
    return { alt: alt, az: wrap(az, 360), hourAngle: H, decl: decl };
  }

  // ألوان السماء (أعلى، وسط، أفق) حسب ارتفاع الشمس، مع مزج سلس بين المحطات
  var KEYS = [
    { alt: -90, top: [3, 6, 18], mid: [6, 11, 30], low: [12, 20, 46] },
    { alt: -18, top: [4, 8, 24], mid: [9, 15, 40], low: [20, 28, 62] },
    { alt: -10, top: [10, 18, 52], mid: [40, 40, 92], low: [120, 72, 110] },
    { alt: -3,  top: [22, 40, 92], mid: [96, 80, 140], low: [236, 128, 96] },
    { alt: 3,   top: [38, 72, 140], mid: [150, 140, 170], low: [252, 176, 104] },
    { alt: 12,  top: [44, 104, 180], mid: [120, 168, 214], low: [246, 214, 160] },
    { alt: 30,  top: [30, 100, 186], mid: [96, 160, 222], low: [196, 226, 244] },
    { alt: 90,  top: [22, 88, 178], mid: [84, 150, 220], low: [180, 218, 242] }
  ];
  function mix(a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }); }
  function colors(alt) {
    for (var i = 1; i < KEYS.length; i++) {
      if (alt <= KEYS[i].alt) {
        var A = KEYS[i - 1], B = KEYS[i], t = (alt - A.alt) / (B.alt - A.alt);
        return { top: mix(A.top, B.top, t), mid: mix(A.mid, B.mid, t), low: mix(A.low, B.low, t) };
      }
    }
    var Z = KEYS[KEYS.length - 1]; return { top: Z.top, mid: Z.mid, low: Z.low };
  }
  function css(c) { return "rgb(" + c.join(",") + ")"; }
  // ظهور النجوم: ١ في الليل التام، ٠ بعد الشفق
  function stars(alt) { return Math.max(0, Math.min(1, (-alt - 6) / 10)); }

  root.ClockSky = { sun: sun, colors: colors, css: css, stars: stars };
})(typeof window !== "undefined" ? window : globalThis);
