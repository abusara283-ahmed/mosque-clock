/*
 * الإصدار ١٠: السطوع التلقائي حسب وقت اليوم (دوال صافية تعمل في المتصفح وفي Node للاختبار).
 * - بعد العشاء بنصف ساعة يبدأ خفوت تدريجي يبلغ أقصاه (nightDim) خلال ساعة ونصف، ويبقى حتى قبل الفجر بـ٤٥ دقيقة
 *   ثم يعود تدريجياً ليكون السطوع كاملاً عند أذان الفجر.
 * - وقت الظهيرة (من بعد الشروق بساعة إلى العصر) سطوع أعلى: boost من ٠ إلى ١ يبلغ ذروته عند الظهر.
 * t: أوقات اليوم بالدقائق { fajr, sunrise, dhuhr, asr, maghrib, isha }
 * يُرجع { dim: ٠..nightDim (نسبة السواد فوق الشاشة), boost: ٠..١, brightness: سطوع الشاشة المقترح ٠٫١٥..١ }
 */
(function (root) {
  function mod(x) { return ((x % 1440) + 1440) % 1440; }
  function level(nowMin, t, S) {
    S = S || {};
    var max = Math.max(0, Math.min(0.7, S.nightDim == null ? 0.35 : +S.nightDim || 0));
    if (S.autoBright === false || !t) return { dim: 0, boost: 0, brightness: -1 };
    var start = t.isha + 30, full = start + 90, back = t.fajr - 45, end = t.fajr;
    var sinceStart = mod(nowMin - start), night = mod(end - start); // طول الليل من بدء الخفوت إلى الفجر
    var dim = 0;
    if (sinceStart < night) {
      var up = Math.min(1, sinceStart / Math.max(1, full - start));
      var toEnd = mod(end - nowMin), down = Math.min(1, toEnd / Math.max(1, end - back));
      dim = max * Math.min(up, down);
    }
    var boost = 0, a = t.sunrise + 60, b = t.asr;
    if (nowMin > a && nowMin < b) boost = nowMin <= t.dhuhr ? (nowMin - a) / Math.max(1, t.dhuhr - a) : (b - nowMin) / Math.max(1, b - t.dhuhr);
    boost = Math.max(0, Math.min(1, boost));
    var brightness = dim > 0 ? Math.max(0.15, 1 - dim * 1.8) : 0.75 + 0.25 * boost;
    return { dim: Math.round(dim * 1000) / 1000, boost: Math.round(boost * 1000) / 1000, brightness: Math.round(brightness * 1000) / 1000 };
  }
  var api = { level: level };
  root.ClockBright = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
