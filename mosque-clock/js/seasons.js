/*
 * تذكيرات المواسم الإسلامية تلقائياً من التاريخ الهجري (تقويم أم القرى + تصحيح المستخدم):
 * رمضان والعد التنازلي له، العشر الأواخر، العيدان، عرفة، العشر من ذي الحجة، عاشوراء، رأس السنة،
 * الأيام البيض، صيام الاثنين والخميس، وسنن الجمعة.
 */
(function (root) {
  var MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  var fmt = null;
  function hijri(date, offsetDays) {
    var d = new Date(date.getTime() + (offsetDays || 0) * 86400000);
    try {
      fmt = fmt || new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" });
      var parts = {};
      fmt.formatToParts(d).forEach(function (p) { parts[p.type] = parseInt(p.value, 10); });
      return { d: parts.day, m: parts.month, y: parts.year || parts.relatedYear };
    } catch (e) { return null; }
  }
  function addDays(date, n) { var x = new Date(date); x.setDate(x.getDate() + n); return x; }
  // صيغة العدد مع "يوم" بالعربية
  function days(n) {
    if (n === 1) return "يوم واحد";
    if (n === 2) return "يومان";
    if (n <= 10) return n + " أيام";
    return n + " يوماً";
  }

  // تُرجع قائمة رسائل لليوم. opts.hijriOffset لتصحيح الهجري
  function messages(date, opts) {
    opts = opts || {};
    var off = opts.hijriOffset || 0;
    var h = hijri(date, off), ht = hijri(addDays(date, 1), off);
    if (!h || !ht) return [];
    var out = [], wd = date.getDay();
    var ramadan = h.m === 9;

    if (ramadan) {
      out.push("اليوم " + h.d + " من شهر رمضان المبارك، تقبّل الله صيامكم وقيامكم");
      if (h.d >= 20) out.push("العشر الأواخر من رمضان: تحرّوا ليلة القدر، «اللهم إنك عفوٌّ تحب العفو فاعفُ عنا»");
    } else {
      for (var i = 1; i <= 90; i++) {
        var x = hijri(addDays(date, i), off);
        if (x && x.m === 9 && x.d === 1) { out.push(i === 1 ? "غداً أول أيام شهر رمضان المبارك، بلّغنا الله وإياكم صيامه وقيامه" : "بقي على شهر رمضان المبارك " + days(i)); break; }
      }
    }
    if (h.m === 10 && h.d <= 3) out.push("عيد الفطر المبارك، تقبّل الله منا ومنكم صالح الأعمال");
    if (h.m === 12 && h.d >= 10 && h.d <= 13) out.push(h.d === 10 ? "عيد الأضحى المبارك، تقبّل الله منا ومنكم" : "أيام التشريق: أيام أكلٍ وشربٍ وذكرٍ لله");
    if (h.m === 12 && h.d === 9) out.push("اليوم يوم عرفة، يُستحب صيامه لغير الحاج، وخير الدعاء دعاء يوم عرفة");
    else if (ht.m === 12 && ht.d === 9) out.push("غداً يوم عرفة، تذكير بصيامه لغير الحاج");
    if (h.m === 12 && h.d <= 8) out.push("العشر الأوائل من ذي الحجة: أكثروا فيها من التهليل والتكبير والتحميد");
    if (h.m === 1 && h.d === 1) out.push("عامٌ هجريٌّ جديد " + h.y + " هـ، جعله الله عام خيرٍ وبركة");
    if (h.m === 1 && (h.d === 9 || h.d === 10)) out.push("اليوم " + (h.d === 10 ? "عاشوراء" : "تاسوعاء") + "، يُستحب صيامه");
    if (ht.m === 1 && (ht.d === 9 || ht.d === 10)) out.push("غداً " + (ht.d === 10 ? "عاشوراء (١٠ محرم)" : "تاسوعاء (٩ محرم)") + "، تذكير بالصيام");

    var tashreeq = function (x) { return x.m === 12 && x.d === 13; };
    if (!ramadan && ht.m !== 9 && ht.d >= 13 && ht.d <= 15 && !tashreeq(ht)) out.push("غداً من الأيام البيض (" + ht.d + " " + MONTHS[ht.m - 1] + ")، تذكير بالصيام");
    if (!ramadan && ht.m !== 9 && !(ht.m === 10 && ht.d === 1) && !(ht.m === 12 && ht.d >= 10 && ht.d <= 13) && (wd === 0 || wd === 3))
      out.push("غداً يوم " + (wd === 0 ? "الاثنين" : "الخميس") + "، يُستحب صيامه");
    if (wd === 4 || wd === 5) out.push("يوم الجمعة: أكثروا من الصلاة على النبي ﷺ، واقرؤوا سورة الكهف");
    return out;
  }

  root.ClockSeasons = { hijri: hijri, messages: messages, MONTHS: MONTHS };
})(typeof window !== "undefined" ? window : globalThis);
