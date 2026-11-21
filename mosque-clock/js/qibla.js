/*
 * اتجاه القبلة والمسافة إلى الكعبة (نسخة الجوال) — دوال صافية لتسهيل الاختبار.
 * الاتجاه بالدرجات من الشمال الحقيقي مع عقارب الساعة (اتجاه الدائرة العظمى).
 */
(function (root) {
  var KAABA = { lat: 21.422487, lon: 39.826206 };
  var rad = Math.PI / 180, deg = 180 / Math.PI;
  function norm(a) { a = a % 360; return a < 0 ? a + 360 : a; }
  function bearing(lat, lon) {
    var p1 = lat * rad, p2 = KAABA.lat * rad, dl = (KAABA.lon - lon) * rad;
    var y = Math.sin(dl) * Math.cos(p2);
    var x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return norm(Math.atan2(y, x) * deg);
  }
  function distanceKm(lat, lon) {
    var p1 = lat * rad, p2 = KAABA.lat * rad, dp = p2 - p1, dl = (KAABA.lon - lon) * rad;
    var a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
    return 6371.0088 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  // الفرق بين اتجاه الجهاز واتجاه القبلة في المدى (−١٨٠، ١٨٠]: موجب = استدر يميناً
  function delta(heading, qibla) { var d = norm(qibla - heading); return d > 180 ? d - 360 : d; }
  // اتجاه الجهاز من حدث deviceorientation: iOS يعطي webkitCompassHeading، وأندرويد alpha المطلق
  function headingFrom(e, screenAngle) {
    if (e == null) return null;
    if (typeof e.webkitCompassHeading === "number" && !isNaN(e.webkitCompassHeading)) return norm(e.webkitCompassHeading);
    if (e.absolute === true || e.type === "deviceorientationabsolute") {
      if (typeof e.alpha !== "number" || isNaN(e.alpha)) return null;
      return norm(360 - e.alpha + (screenAngle || 0));
    }
    return null;
  }
  var DIRS = ["الشمال", "الشمال الشرقي", "الشرق", "الجنوب الشرقي", "الجنوب", "الجنوب الغربي", "الغرب", "الشمال الغربي"];
  function compassName(b) { return DIRS[Math.round(norm(b) / 45) % 8]; }
  var api = { KAABA: KAABA, bearing: bearing, distanceKm: distanceKm, delta: delta, headingFrom: headingFrom, compassName: compassName, norm: norm };
  root.ClockQibla = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
