#!/usr/bin/env node
/*
 * اختبارات الساعة:   node tests/run.js
 * ١. سلامة الحساب لكل مدن عُمان طوال السنة
 * ٢. مقارنة الظهر والشروق والغروب بخوارزمية مستقلة (NOAA)
 * ٣. قراءة جداول CSV بصيغها المختلفة
 * ٤. انتقالات الشاشات (أذان ← إقامة ← صلاة ← أذكار) والجمعة
 * ٦. طريقة وزارة الأوقاف العُمانية مقابل جداول مرجعية (tests/reference)
 * ٧. تذكيرات المواسم  ٨. هندسة مزولة اليوم  ٩. راحة الشاشة  ١٠. السماء الحقيقية (الإصدار ٤)
 * ١١. المظهر (الإصدار ٥): الخلفية التلقائية، موعد الجمعة الثابت، القوالب
 * ١٢. المناسبات ورمضان الذكي وشريط اليوم (الإصدار ٦)
 * ١٣. المصحف والتفاسير والختمة والأذكار وما بعد الصلاة والفتاوى وجداول «توقيت» (الإصدار ٧)
 * ١٤. نسخة الجوال: الموقع، جدول اليوم والصلاة القادمة، التنبيهات والتقويم، الأذكار، البحث، القبلة
 * ١٥. الإصدار ٨: الإقامة الذكية، التحقق بجداول الأوقاف، الأصوات المضمّنة، الخشوع، التشغيل التلقائي (ويندوز/لينكس/أندرويد/الخادم)
 * ١٦. الإصدار ٨٫١: الشريط المتحرك (الأنواع، الأولوية، الأيام والساعات، السرعة، المكان)
 * ٢٠. الإصدار ١١٫٢: سلاسة تبدّل الدقيقة والشريط السفلي ووضع الأداء
 * ١٩. الإصدار ١١٫١: التنقل بالريموت ووضع الفأرة وتبويبات الإعدادات
 * ١٨. الإصدار ١١: الحد الأقصى الذكي (منع التداخل)، قوالب المظهر، لوحة الإمام، القوس والزخرفة والانتقالات وانحراف الوقت
 * ٥. إن وُضعت جداول رسمية في tests/official/*.csv تُقارن بالحساب (السماح ±٢ دقيقة، أو TOL=3)
 */
var fs = require("fs"), path = require("path");
var W = require("./load")();
var S = W.ClockConfig.load(), PT = W.PrayerTimes, SCH = W.ClockSchedule;
var pass = 0, fail = 0, notes = [];
function ok(cond, msg) { if (cond) pass++; else { fail++; console.log("  ✗ " + msg); } }
function hm(m) { m = Math.round(m); return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(((m % 60) + 60) % 60).padStart(2, "0"); }
function city(lat, lon) { return W.ClockConfig.merge(S, { latitude: lat, longitude: lon, timezone: 4, useTable: false, method: "custom", adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } }); }

var CITIES = { "مسقط": [23.588, 58.3829], "صلالة": [17.0151, 54.0924], "صحار": [24.3474, 56.7299], "نزوى": [22.9333, 57.5333], "صور": [22.5667, 59.5289], "خصب": [26.1799, 56.2477], "الدقم": [19.65, 57.7] };

// ١. السلامة
console.log("١. سلامة الحساب");
Object.keys(CITIES).forEach(function (name) {
  var c = city(CITIES[name][0], CITIES[name][1]);
  for (var d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 1)) {
    var t = PT.forDate(d, c), tag = name + " " + d.toISOString().slice(0, 10);
    ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha, tag + " ترتيب الأوقات");
    ok(t.dhuhr > 11 * 60 + 30 && t.dhuhr < 12 * 60 + 45, tag + " الظهر خارج المعقول " + hm(t.dhuhr));
    ok(t.sunrise - t.fajr >= 60 && t.sunrise - t.fajr <= 100, tag + " الفجر-الشروق " + (t.sunrise - t.fajr));
  }
});

// ٢. مقارنة بخوارزمية NOAA المستقلة
console.log("٢. المقارنة بخوارزمية NOAA");
function noaa(date, lat, lon, tz) {
  var rad = Math.PI / 180;
  var doy = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / 864e5);
  var g = 2 * Math.PI / 365 * (doy - 1 + (12 - 12) / 24);
  var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  var ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl)) / rad;
  var noon = 720 - 4 * lon - eqt + tz * 60;
  return { noon: noon, rise: noon - 4 * ha, set: noon + 4 * ha };
}
var worst = { noon: 0, rise: 0, set: 0 };
Object.keys(CITIES).forEach(function (name) {
  var c = city(CITIES[name][0], CITIES[name][1]);
  for (var d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 3)) {
    var t = PT.forDate(d, c), n = noaa(d, c.latitude, c.longitude, 4);
    var dn = Math.abs(t.dhuhr - 1 - n.noon), dr = Math.abs(t.sunrise - n.rise), ds = Math.abs(t.maghrib - n.set);
    worst.noon = Math.max(worst.noon, dn); worst.rise = Math.max(worst.rise, dr); worst.set = Math.max(worst.set, ds);
    ok(dn <= 2 && dr <= 2 && ds <= 2, name + " " + d.toISOString().slice(0, 10) + " فرق أكبر من دقيقتين");
  }
});
notes.push("أكبر فرق عن NOAA بالدقائق: الظهر " + worst.noon.toFixed(1) + "، الشروق " + worst.rise.toFixed(1) + "، الغروب " + worst.set.toFixed(1));

// ٣. CSV
console.log("٣. قراءة الجداول");
var r = PT.parseCSV("التاريخ,الفجر,الشروق,الظهر,العصر,المغرب,العشاء\n06/11/2026,4:56,6:12,11:52,3:06,5:29,6:43\n٢٠٢٦-١١-٠٧\t٠٤:٥٧\t٠٦:١٣\t١١:٥٢\t١٥:٠٦\t١٧:٢٨\t١٨:٤٣\n11-08;04:58;06:13;11:52;15:06;17:28;18:43\nسطر خاطئ");
ok(r.count === 3, "عدد الأسطر المقروءة " + r.count);
ok(JSON.stringify(r.table["2026-11-06"]) === JSON.stringify(["04:56", "06:12", "11:52", "15:06", "17:29", "18:43"]), "تحويل نظام ١٢ ساعة");
ok(r.table["2026-11-07"] && r.table["2026-11-07"][5] === "18:43", "الأرقام العربية والفاصل Tab");
ok(r.table["11-08"] && r.table["11-08"][0] === "04:58", "صيغة شهر-يوم");
ok(r.errors.length === 1, "تحديد السطر الخاطئ");
PT.saveImported(r.table);
var tb = PT.forDate(new Date(2026, 10, 6), W.ClockConfig.merge(S, { useTable: true }));
ok(tb.source === "table" && tb.fajr === 4 * 60 + 56, "استخدام الجدول المستورد");
ok(PT.forDate(new Date(2026, 10, 20), W.ClockConfig.merge(S, { useTable: true })).source === "calc", "الرجوع للحساب لأيام خارج الجدول");
ok(PT.forDate(new Date(2026, 10, 6), W.ClockConfig.merge(S, { useTable: false })).source === "calc", "تعطيل الجدول");
PT.saveImported(null);

// ٤. الشاشات
console.log("٤. انتقالات الشاشات");
var times = { fajr: 300, sunrise: 370, dhuhr: 720, asr: 900, maghrib: 1050, isha: 1130 };
var sch = SCH.build(times, false, S), dh = sch[1];
function at(min, sec) { var st = SCH.state(min * 60 + (sec || 0), sch, S); return st ? st.name : "normal"; }
ok(at(719, 59) === "normal", "قبل الأذان عادي");
ok(at(720) === "adhan", "عند الأذان");
ok(at(720 + S.adhanScreenMinutes) === "iqama", "بعد شاشة الأذان عدّ الإقامة");
ok(SCH.state(720 * 60 + 600, sch, S).left === (S.iqama.dhuhr * 60 - 600), "الوقت المتبقي للإقامة");
ok(at(720 + S.iqama.dhuhr) === "prayer", "عند الإقامة");
ok(at(720 + S.iqama.dhuhr + S.prayerDuration.dhuhr) === "adhkar", "بعد الصلاة أذكار");
ok(at(720 + S.iqama.dhuhr + S.prayerDuration.dhuhr + S.afterPrayerAdhkarMinutes) === "ayah", "ثم الآية والتفسير (الإصدار ٧)");
ok(at(720 + S.iqama.dhuhr + S.prayerDuration.dhuhr + S.afterPrayerAdhkarMinutes + S.ayahMinutes) === "normal", "ثم عادي");
var fri = SCH.build(times, true, S);
ok(fri[1].key === "jumuah", "الظهر يصبح جمعة");
var fs0 = SCH.state(720 * 60 + 30, fri, S);
ok(fs0 && fs0.name === "prayer" && fs0.p.key === "jumuah", "الجمعة بلا عدّ إقامة: الخطبة مباشرة");
var n1 = SCH.next(1200 * 60, times, 301);
ok(n1.next.key === "fajr" && n1.next.tomorrow && n1.left === (86400 + 301 * 60 - 1200 * 60), "بعد العشاء القادم فجر الغد");
var n2 = SCH.next(800 * 60, times, 301);
ok(n2.next.key === "asr" && n2.progress > 0 && n2.progress < 1, "شريط التقدم بين الظهر والعصر");
ok(SCH.period(310, times) === "dawn" && SCH.period(800, times) === "day" && SCH.period(950, times) === "golden" && SCH.period(1100, times) === "dusk" && SCH.period(100, times) === "night", "فترات الألوان");

// ٥. الجداول الرسمية
var dir = path.join(__dirname, "official"), files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(function (f) { return /\.csv$/i.test(f); }) : [];
var TOL = +process.env.TOL || 2;
console.log("٥. الجداول الرسمية (" + (files.length ? files.length + " ملف" : "لا توجد ملفات في tests/official") + ")");
files.forEach(function (f) {
  // اسم الملف يحدد المدينة، مثل: muscat-2026.csv أو مسقط-2026.csv. الإعدادات من settings-defaults.js وإلا الاسم
  var base = f.replace(/\.csv$/i, "").split(/[-_]/)[0].toLowerCase();
  var EN = { muscat: "مسقط", salalah: "صلالة", sohar: "صحار", nizwa: "نزوى", sur: "صور", khasab: "خصب", duqm: "الدقم" };
  var cc = CITIES[EN[base] || base] || [S.latitude, S.longitude];
  var c = W.ClockConfig.merge(S, { latitude: cc[0], longitude: cc[1], useTable: false });
  var rr = PT.parseCSV(fs.readFileSync(path.join(dir, f), "utf8"));
  var stats = PT.KEYS.map(function () { return []; }), bad = 0;
  Object.keys(rr.table).forEach(function (k) {
    var p = k.split("-"), d = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : new Date(2026, +p[0] - 1, +p[1]);
    var t = PT.forDate(d, c);
    PT.KEYS.forEach(function (key, i) {
      var o = rr.table[k][i].split(":"), diff = (+o[0]) * 60 + (+o[1]) - t[key];
      stats[i].push(diff);
      if (Math.abs(diff) > TOL) { bad++; if (bad <= 8) console.log("  ✗ " + f + " " + k + " " + key + ": رسمي " + rr.table[k][i] + " محسوب " + hm(t[key])); }
    });
  });
  ok(bad === 0, f + ": " + bad + " وقتاً خارج ±" + TOL + " د");
  notes.push(f + " (" + rr.count + " يوماً) الوسيط لكل وقت (رسمي − محسوب): " + PT.KEYS.map(function (k, i) {
    var a = stats[i].sort(function (x, y) { return x - y; }); return k + " " + a[Math.floor(a.length / 2)] + " [" + a[0] + ".." + a[a.length - 1] + "]";
  }).join("، "));
});

// ٦. طريقة وزارة الأوقاف
var REF = { "oman-muscat.csv": [23.585, 58.28], "oman-sohar.csv": [24.3474, 56.7299], "oman-nizwa.csv": [22.9333, 57.5333], "oman-salalah.csv": [17.0151, 54.0924] };
console.log("٦. طريقة وزارة الأوقاف العُمانية");
ok(S.method === "oman", "الطريقة الافتراضية هي طريقة الوزارة");
Object.keys(REF).forEach(function (f) {
  var c = W.ClockConfig.merge(S, { latitude: REF[f][0], longitude: REF[f][1], useTable: false, method: "oman", adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } });
  var rr = PT.parseCSV(fs.readFileSync(path.join(__dirname, "reference", f), "utf8")), n = 0, exact = 0, over = 0, worstD = 0;
  Object.keys(rr.table).forEach(function (k) {
    var p = k.split("-"), d = new Date(2026, +p[0] - 1, +p[1]);
    if (d.getMonth() !== +p[0] - 1) return; // 29 فبراير
    var t = PT.forDate(d, c);
    PT.KEYS.forEach(function (key, i) {
      var o = rr.table[k][i].split(":"), diff = Math.abs((+o[0]) * 60 + (+o[1]) - t[key]);
      n++; if (diff === 0) exact++; if (diff > 1) over++; else worstD = Math.max(worstD, diff);
    });
  });
  ok(over <= 3, f + ": " + over + " وقتاً يتجاوز دقيقة (يُسمح بأخطاء نسخ قليلة في المصدر)");
  notes.push("الوزارة " + f + ": " + n + " وقتاً، مطابق تماماً " + Math.round(100 * exact / n) + "%، فرق دقيقة أو أقل " + Math.round(100 * (n - over) / n) + "%");
});
var cust = PT.forDate(new Date(2026, 5, 1), W.ClockConfig.merge(S, { method: "custom", useTable: false }));
var om = PT.forDate(new Date(2026, 5, 1), W.ClockConfig.merge(S, { method: "oman", useTable: false }));
ok(om.dhuhr - cust.dhuhr === 4 && om.asr - cust.asr === 5 && om.maghrib - cust.maghrib === 5 && om.isha === cust.isha && om.fajr === cust.fajr, "إزاحات طريقة عُمان");
var uq = PT.forDate(new Date(2026, 5, 1), W.ClockConfig.merge(S, { method: "ummalqura", useTable: false }));
ok(uq.isha - uq.maghrib === 90, "أم القرى: العشاء بعد المغرب بـ٩٠ دقيقة");
var uqR = PT.forDate(new Date(2027, 1, 20), W.ClockConfig.merge(S, { method: "ummalqura", useTable: false }));
ok(uqR.isha - uqR.maghrib === 120, "أم القرى في رمضان: ١٢٠ دقيقة");

// ٧. المواسم
console.log("٧. تذكيرات المواسم");
var SE = W.ClockSeasons;
function findH(m, dd, from) { for (var x = new Date(from); x.getFullYear() < 2029; x.setDate(x.getDate() + 1)) { var h = SE.hijri(x); if (h.m === m && h.d === dd) return new Date(x); } }
function addD(x, n) { var y = new Date(x); y.setDate(y.getDate() + n); return y; }
function has(list, re) { return list.some(function (m) { return re.test(m); }); }
var r1 = findH(9, 1, new Date(2026, 10, 1));
ok(r1 && r1.getFullYear() === 2027 && r1.getMonth() === 1, "أول رمضان ١٤٤٨ في فبراير ٢٠٢٧ (" + (r1 && r1.toDateString()) + ")");
ok(has(SE.messages(addD(r1, -1)), /^غداً أول أيام شهر رمضان/), "رسالة غداً رمضان");
ok(has(SE.messages(addD(r1, -2)), /بقي على شهر رمضان المبارك يومان$/), "صيغة المثنى");
ok(has(SE.messages(addD(r1, -10)), /بقي على شهر رمضان المبارك 10 أيام$/), "صيغة الجمع");
ok(has(SE.messages(addD(r1, -30)), /30 يوماً$/), "صيغة التمييز");
ok(has(SE.messages(addD(r1, 21)), /العشر الأواخر/), "العشر الأواخر");
for (var i = 0; i < 29; i++) { var dR = addD(r1, i); if (dR.getDay() === 0 || dR.getDay() === 3) ok(!has(SE.messages(dR), /يُستحب صيامه$/), "لا تذكير بصيام الاثنين في رمضان"); }
var ar = findH(12, 9, new Date(2027, 2, 1));
ok(has(SE.messages(ar), /اليوم يوم عرفة/) && has(SE.messages(addD(ar, -1)), /غداً يوم عرفة/), "عرفة");
ok(has(SE.messages(addD(ar, 1)), /عيد الأضحى/), "عيد الأضحى");
var w13 = findH(7, 13, new Date(2026, 10, 1));
ok(has(SE.messages(addD(w13, -1)), /غداً من الأيام البيض/), "الأيام البيض");
var ash = findH(1, 10, new Date(2026, 10, 1));
ok(has(SE.messages(addD(ash, -1)), /غداً عاشوراء/), "عاشوراء");
var sun = new Date(2026, 10, 15); // أحد
ok(has(SE.messages(sun), /غداً يوم الاثنين/), "الاثنين");
ok(has(SE.messages(new Date(2026, 10, 20)), /سورة الكهف/), "الجمعة");

// ٨. المزولة
console.log("٨. مزولة اليوم");
var DL = W.ClockDial;
ok(DL.angle(720, 720) === 0 && DL.angle(1080, 720) === 90 && DL.angle(360, 720) === 270, "زوايا الحلقة (الزوال أعلى)");
var pp = DL.point(90, 100); ok(Math.abs(pp.x - 100) < .01 && Math.abs(pp.y) < .01, "تحويل الزاوية إلى نقطة");
ok(/ 0 1 1 /.test(DL.arc(300, 1100, 720, 100)) && / 0 0 1 /.test(DL.arc(300, 400, 720, 100)), "علم القوس الكبير");
ok(/ 0 0 1 /.test(DL.arc(1400, 30, 720, 100)), "قوس يعبر منتصف الليل");

// ٩. راحة الشاشة
console.log("٩. راحة الشاشة");
var RS = W.ClockConfig.merge(S, { nightRest: true, nightRestAfterIsha: 60, nightRestBeforeFajr: 30, dayRest: true });
var rsch = SCH.build(times, false, RS);
ok(SCH.rest(23 * 3600, rsch, times, RS, false) === "night" && SCH.rest(2 * 3600, rsch, times, RS, false) === "night", "راحة ليلية");
ok(SCH.rest(times.fajr * 60 - 600, rsch, times, RS, false) === null, "تنتهي قبل الفجر");
ok(SCH.rest((times.isha + 30) * 60, rsch, times, RS, false) === null, "لا راحة قبل انتهاء العشاء والأذكار");
ok(SCH.rest(9 * 3600, rsch, times, RS, false) === "day" && SCH.rest(9 * 3600, rsch, times, RS, true) === null, "راحة الضحى إلا يوم الجمعة");
ok(SCH.rest(9 * 3600, rsch, times, W.ClockConfig.merge(RS, { dayRest: false }), false) === null, "راحة الضحى معطلة افتراضياً");

// ١٠. السماء الحقيقية: ارتفاع الشمس عند الأوقات المحسوبة يجب أن يطابق تعريفها
console.log("١٠. السماء الحقيقية");
var SK = W.ClockSky, worstSky = 0;
Object.keys(CITIES).forEach(function (name) {
  var c = city(CITIES[name][0], CITIES[name][1]);
  for (var d = new Date(2026, 0, 1); d.getFullYear() === 2026; d.setDate(d.getDate() + 9)) {
    var t = PT.forDate(d, c);
    function altAt(min) { var x = new Date(d); x.setHours(0, 0, 0, 0); x.setMinutes(min); return SK.sun(x, c.latitude, c.longitude, 4); }
    var f = altAt(t.fajr).alt, r = altAt(t.sunrise).alt, i = altAt(t.isha).alt, n = altAt(t.dhuhr - 1);
    worstSky = Math.max(worstSky, Math.abs(f + 18), Math.abs(i + 18), Math.abs(r + .833));
    ok(Math.abs(f + 18) < .4 && Math.abs(i + 18) < .4 && Math.abs(r + .833) < .4, name + " " + d.toISOString().slice(0, 10) + " ارتفاع الشمس عند الفجر/الشروق/العشاء");
    ok(Math.abs(n.hourAngle) < 1.2 && Math.abs(n.alt - (90 - Math.abs(c.latitude - n.decl))) < .5, name + " الزوال في أعلى السماء");
  }
});
notes.push("أكبر فرق في ارتفاع الشمس عند الأوقات (درجة): " + worstSky.toFixed(2));
ok(SK.stars(-30) === 1 && SK.stars(10) === 0, "النجوم ليلاً فقط");
var cN = SK.colors(-40), cD = SK.colors(40), cS = SK.colors(0);
ok(cN.top[2] < 40 && cD.top[2] > 150 && cS.low[0] > 230, "ألوان السماء: ليل داكن، نهار أزرق، أفق برتقالي عند الغروب");

// ١١. المظهر (الإصدار ٥)
console.log("١١. المظهر: الخلفيات والجمعة والقوالب");
require("vm").runInContext(fs.readFileSync(path.join(__dirname, "..", "js/backgrounds.js"), "utf8"), W, { filename: "js/backgrounds.js" });
var BG = W.ClockBackgrounds, tt = { fajr: 300, sunrise: 380, dhuhr: 720, asr: 920, maghrib: 1060, isha: 1140 };
ok(BG.BUILTIN.length === 9, "تسع خلفيات مدمجة");
ok(BG.BUILTIN.every(function (b) { return b.id && b.name && typeof b.html() === "string" && b.html().length > 10; }), "كل خلفية لها اسم ورسم");
ok(new Set(BG.BUILTIN.map(function (b) { return b.id; })).size === 9, "معرّفات الخلفيات فريدة");
function bgAuto(h, friday, min, period) { return BG.auto({ hijri: h, friday: friday, min: min, t: tt, period: period }); }
ok(bgAuto({ m: 10, d: 1 }, false, 600, "day") === "eid", "عيد الفطر");
ok(bgAuto({ m: 12, d: 10 }, true, 600, "day") === "eid", "عيد الأضحى يتقدّم على الجمعة");
ok(bgAuto({ m: 12, d: 14 }, false, 600, "day") === "domes", "بعد أيام التشريق يعود للعادي");
ok(bgAuto({ m: 9, d: 5 }, true, 600, "day") === "ramadan", "رمضان يتقدّم على الجمعة");
ok(bgAuto({ m: 6, d: 7 }, true, 600, "day") === "friday", "صباح الجمعة");
ok(bgAuto({ m: 6, d: 7 }, true, 1000, "golden") === "dunes", "الجمعة بعد العصر تعود للعادي");
ok(bgAuto({ m: 6, d: 7 }, false, 1300, "night") === "sky", "الليل: السماء الحية");
["dawn", "day", "golden", "dusk", "night"].forEach(function (p) { ok(!!BG.find(bgAuto({ m: 1, d: 1 }, false, 600, p)), "خلفية موجودة للفترة " + p); });
// موعد الجمعة الثابت
var AJ = SCH.applyJumuah, base = PT.forDate(new Date(2026, 10, 20), city(23.588, 58.3829));
var fx = AJ(base, true, { jumuahFixed: "12:15" });
ok(fx.dhuhr === 735 && fx.jumuahFixed === true && fx.asr === base.asr, "الجمعة الثابتة 12:15");
ok(AJ(base, false, { jumuahFixed: "12:15" }) === base, "لا يؤثر في غير الجمعة");
ok(AJ(base, true, { jumuahFixed: "" }) === base, "فارغ = وقت الظهر");
ok(AJ(base, true, { jumuahFixed: "16:30" }) === base, "موعد بعد العصر يُرفض");
ok(AJ(base, true, { jumuahFixed: "abc" }) === base, "صيغة غير صالحة تُرفض");
ok(base.dhuhr !== 735, "الجدول الأصلي لم يتغيّر");
// الجمعة الثابتة في جدول الشاشات
var schF = SCH.build(fx, true, S);
ok(schF[1].key === "jumuah" && schF[1].A === 735 * 60, "جدول الشاشات يستخدم الموعد الثابت");
// القوالب
var KEYS = ["layout", "background", "clockStyle", "clockFont", "clockScale", "bgDim"];
ok(Array.isArray(W.CLOCK_PRESETS) && W.CLOCK_PRESETS.length >= 4, "القوالب الجاهزة موجودة");
W.CLOCK_PRESETS.forEach(function (p) {
  ok(KEYS.every(function (k) { return k in p.values; }), "القالب " + p.name + " كامل");
  ok(["side", "center", "bar", "cards"].indexOf(p.values.layout) >= 0, "القالب " + p.name + ": توزيع صالح");
  ok(["digital", "analog", "ring"].indexOf(p.values.clockStyle) >= 0, "القالب " + p.name + ": شكل ساعة صالح");
  ok(p.values.background === "auto" || !!BG.find(p.values.background), "القالب " + p.name + ": خلفية موجودة");
  ok(Object.keys(p.values).every(function (k) { return k in W.CLOCK_DEFAULTS; }), "القالب " + p.name + ": مفاتيح معروفة");
});
var D = W.CLOCK_DEFAULTS;
ok(D.layout === "side" && D.background === "auto" && D.clockStyle === "digital", "الافتراضي: نافذة المحراب، خلفية تلقائية، ساعة رقمية");

// ١٢. المناسبات (الإصدار ٦)
console.log("١٢. المناسبات ورمضان الذكي وشريط اليوم");
var EV = W.ClockEvents;
var day = new Date(2026, 10, 19), friDay = new Date(2026, 10, 20);
var tE = { fajr: 300, sunrise: 380, dhuhr: 720, asr: 920, maghrib: 1060, isha: 1140 };
var schE = SCH.build(tE, false, S), schFri = SCH.build(tE, true, S);
function withEv(list, extra) { return W.ClockConfig.merge(S, Object.assign({ events: list }, extra || {})); }
var fun = { id: "a", type: "funeral", person: "المرحوم سالم", anchor: "asr", repeat: "once", date: "2026-11-19" };
var L1 = EV.forDay(day, { sch: schE, hijri: { m: 6, d: 8 }, S: withEv([fun]) });
ok(L1.length === 1 && L1[0].at === schE[2].E && L1[0].tone === "mourn", "الجنازة بعد العصر وقتها نهاية صلاة العصر");
ok(L1[0].when === "بعد صلاة العصر", "نص الموعد: بعد صلاة العصر");
ok(EV.forDay(new Date(2026, 10, 18), { sch: schE, hijri: { m: 6, d: 7 }, S: withEv([fun]) }).length === 0, "مناسبة المرة الواحدة لا تظهر في يوم آخر");
ok(EV.featured(L1, 600 * 60) === L1[0], "تُبرز من بداية اليوم");
ok(EV.featured(L1, schE[2].E + 10 * 60) === L1[0], "تبقى أثناء وقتها");
ok(EV.featured(L1, schE[2].E + 16 * 60) === null, "تختفي بعد انقضائها");
ok(EV.afterPrayer(L1, "asr") === L1[0] && EV.afterPrayer(L1, "dhuhr") === null, "تُربط بشاشة إقامة العصر فقط");
var off = Object.assign({}, fun, { enabled: false });
ok(EV.forDay(day, { sch: schE, hijri: { m: 6, d: 8 }, S: withEv([off]) }).length === 0, "المناسبة المعطّلة لا تظهر");
var les = { id: "b", type: "lesson", title: "درس الفقه", anchor: "time", time: "20:15", repeat: "weekly", weekday: 4 };
var L2 = EV.forDay(day, { sch: schE, hijri: { m: 6, d: 8 }, S: withEv([les, fun]) });
ok(L2.length === 2 && L2[0].type === "funeral" && L2[1].at === (20 * 60 + 15) * 60, "الدرس الأسبوعي يوم الخميس بساعة محددة، والترتيب بالوقت");
ok(EV.forDay(friDay, { sch: schFri, hijri: { m: 6, d: 9 }, S: withEv([les]) }).length === 0, "الدرس الأسبوعي لا يظهر في غير يومه");
ok(EV.forDay(day, { sch: schE, hijri: { m: 6, d: 8 }, S: withEv([{ type: "custom", anchor: "time", time: "25:00", repeat: "daily" }]) }).length === 0, "ساعة غير صالحة تُرفض");
var jf = EV.forDay(friDay, { sch: schFri, hijri: { m: 6, d: 9 }, S: withEv([{ type: "funeral", person: "x", anchor: "dhuhr", repeat: "daily" }]) });
ok(jf[0].when === "بعد صلاة الجمعة", "يوم الجمعة: بعد صلاة الجمعة");
// تلقائية المواسم
var R = EV.forDay(day, { sch: schE, hijri: { m: 9, d: 5 }, S: withEv([], { taraweeh: true, qiyamTime: "02:30" }) });
ok(R.length === 1 && R[0].type === "taraweeh" && R[0].at === schE[4].E, "التراويح بعد العشاء في رمضان");
var R2 = EV.forDay(day, { sch: schE, hijri: { m: 9, d: 23 }, S: withEv([], { taraweeh: true, qiyamTime: "02:30" }) });
ok(R2.length === 2 && R2[0].type === "qiyam" && R2[0].at === 150 * 60, "القيام في العشر الأواخر قبل الفجر");
ok(EV.forDay(day, { sch: schE, hijri: { m: 9, d: 5 }, S: withEv([], { taraweeh: false }) }).length === 0, "التراويح قابلة للإيقاف");
ok(EV.forDay(day, { sch: schE, hijri: { m: 8, d: 5 }, S: withEv([], { taraweeh: true }) }).length === 0, "لا تراويح خارج رمضان");
var E1 = EV.forDay(day, { sch: schE, hijri: { m: 10, d: 1 }, S: withEv([], { eidPrayerTime: "06:00" }) });
ok(E1.length === 1 && E1[0].title === "صلاة عيد الفطر" && E1[0].at === 360 * 60, "صلاة عيد الفطر");
ok(EV.forDay(day, { sch: schE, hijri: { m: 12, d: 10 }, S: withEv([], { eidPrayerTime: "06:00" }) })[0].title === "صلاة عيد الأضحى", "صلاة عيد الأضحى");
ok(EV.forDay(day, { sch: schE, hijri: { m: 12, d: 11 }, S: withEv([], { eidPrayerTime: "06:00" }) }).length === 0, "لا صلاة عيد في غير يومه");
// التنظيف
var pr = EV.prune([{ date: "2026-11-10" }, { date: "2026-11-17" }, { date: "2026-11-25" }, { date: "2026-01-01", repeat: "weekly" }], day);
ok(pr.length === 3 && pr[0].date === "2026-11-17", "حذف المناسبات المنتهية منذ أكثر من يومين فقط");
// رمضان الذكي
var tomF = 301;
var nxM = SCH.next(1000 * 60, tE, tomF), rhM = EV.ramadanHero(1000 * 60, nxM, tE, 10, true, true);
ok(rhM && rhM.iftar && rhM.left === 60 * 60, "قبل المغرب في رمضان: الإفطار بعد ساعة");
ok(EV.ramadanHero(1000 * 60, nxM, tE, 10, false, false) === null, "خارج رمضان لا تغيير");
var nxF = SCH.next(240 * 60, tE, tomF), rhF = EV.ramadanHero(240 * 60, nxF, tE, 10, true, true);
ok(rhF && rhF.imsak && rhF.left === 50 * 60, "في السحر: الإمساك قبل الفجر بعشر دقائق");
ok(EV.ramadanHero(295 * 60, SCH.next(295 * 60, tE, tomF), tE, 10, true, true) === null, "بعد الإمساك يعود العدّ للفجر");
var nxN = SCH.next(1380 * 60, tE, tomF), rhN = EV.ramadanHero(1380 * 60, nxN, tE, 10, false, true);
ok(rhN && rhN.imsak && rhN.left === (86400 + (tomF - 10) * 60) - 1380 * 60, "ليلة أول رمضان: الإمساك يُحسب لفجر الغد");
ok(EV.ramadanHero(240 * 60, nxF, tE, 0, true, true) === null, "الإمساك ٠ = بلا عدّ");
// شريط اليوم
var DL = EV.dayline(720, tE);
ok(DL.marks.length === 6 && DL.marks[0].x > 0 && DL.marks[5].x < 1, "شريط اليوم: ست علامات داخل الحدود");
ok(DL.marks.every(function (m, i, a) { return !i || m.x > a[i - 1].x; }), "العلامات مرتبة");
ok(!DL.night && EV.dayline(1200, tE).night && EV.dayline(100, tE).now === 0, "الشمس نهاراً والقمر ليلاً، والليل المتأخر في أول الشريط");
var D6 = W.CLOCK_DEFAULTS;
ok(Array.isArray(D6.events) && D6.taraweeh === true && D6.dayline === true && D6.englishNames === false, "الإعدادات الافتراضية للإصدار ٦");

// ١٣. الإصدار ٧: المصحف والتفاسير وحلقة الذكر والفتاوى
console.log("١٣. المصحف والتفاسير والأذكار والفتاوى (الإصدار ٧)");
(function () {
  var vm = require("vm");
  function run(f) { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), W, { filename: f }); }
  ["data/quran/quran.js", "js/quran.js", "js/adhkar-data.js", "js/fatwa.js"].forEach(run);
  var QR = W.ClockQuran, Qd = W.CLOCK_QURAN, ids = QR.TAFSIRS.map(function (t) { return t.id; });
  ids.forEach(function (id) { run("data/tafsir/" + id + ".js"); });
  // المصحف
  var V = Qd.text.split("\n");
  ok(V.length === 6236 && Qd.counts.length === 114 && Qd.counts.reduce(function (a, b) { return a + b; }, 0) === 6236, "المصحف: ١١٤ سورة و٦٢٣٦ آية");
  ok(Qd.juz.length === 30 && Qd.juz[0] === 0 && QR.locate(Qd.juz[29]).s === 78 && QR.locate(Qd.juz[29]).a === 1, "بدايات الأجزاء (جزء عمّ من النبأ)");
  ok(Qd.sajda.length === 15, "مواضع السجدة ١٥");
  ok(/^قُلۡ هُوَ/.test(QR.verse(112, 1)) && QR.verse(2, 255).replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "").indexOf("ٱلحي ٱلقيوم") > 0, "نص الإخلاص وآية الكرسي");
  ok(!/[ٖٗٞ]/.test(Qd.text), "علامات التنوين المفتوح محوّلة لما يدعمه خط المصحف");
  ok(QR.SURAHS.length === 114 && QR.SURAHS[17] === "الكهف" && Qd.names[17] === "الكهف", "أسماء السور");
  // التفاسير
  ids.forEach(function (id) {
    var t = W.CLOCK_TAFSIR[id];
    ok(t && t.t.length === 6236 && t.t[0] && t.t.filter(Boolean).length > 1400, "التفسير " + id + ": ٦٢٣٦ موضعاً");
  });
  // المقاطع: كل مقطع داخل سورة واحدة، ولكل تفسير مختار نص فيه
  var bad = 0;
  for (var i = 0; i < 6236; i += 7) {
    var ps = QR.passageAt(i, ["muyassar", "saadi", "jalalayn", "mukhtasar"], { maxAyat: 5 });
    if (ps.i > i || ps.j < i || QR.locate(ps.j).s !== ps.s || ps.j - ps.i > 6 || ps.tafsirs.length !== 4) bad++;
  }
  ok(bad === 0, "المقاطع سليمة وتجمع آيات التفسير الواحد (" + bad + " مخالفة)");
  // الختمة المتتابعة تمر على كل آيات النطاق مرة واحدة بلا فجوات
  var SS = W.ClockConfig.merge(S, { ayahMode: "khatma", ayahFrom: 78, ayahTo: 114, tafsirs: ["muyassar", "saadi"], khatmaStart: "" });
  QR.resetKhatma();
  var seen = [], guard = 0, first = QR.nextPassage(SS, "x"), p = first;
  while (guard++ < 1000) {
    for (var k = p.i; k <= p.j; k++) seen.push(k);
    p = QR.nextPassage(SS, "x");
    if (p.i === first.i) break;
  }
  var from = W.CLOCK_QURAN.counts.slice(0, 77).reduce(function (a, b) { return a + b; }, 0);
  ok(seen.length === 6236 - from && seen.every(function (v, n) { return v === from + n; }), "ختمة جزء عمّ: " + seen.length + " آية متتابعة بلا تكرار");
  ok(QR.khatma().rounds === 1, "عدّاد الختمات");
  var SK = W.ClockConfig.merge(SS, { khatmaStart: "18:1", ayahFrom: 1, ayahTo: 114 });
  QR.resetKhatma();
  var k1 = QR.nextPassage(SK, "x");
  ok(k1.s === 18 && k1.a1 === 1, "بداية الختمة من سورة الكهف");
  var R = W.ClockConfig.merge(S, { ayahMode: "random", tafsirs: ["muyassar"] });
  ok(QR.nextPassage(R, "2026-11-19dhuhr").i === QR.nextPassage(R, "2026-11-19dhuhr").i && QR.nextPassage(R, "a").i !== QR.nextPassage(R, "b").i, "المقطع المختار ثابت لنفس اليوم والصلاة");
  // تقسيم الصفحات
  var long = W.CLOCK_TAFSIR.saadi.t[QR.gi(2, 255)], pages = QR.paginate(long, 400);
  ok(pages.length > 3 && pages.every(function (x) { return x.length <= 400 * 1.15 + 5; }), "تقسيم تفسير آية الكرسي (السعدي) إلى " + pages.length + " صفحات");
  ok(pages.join(" ").replace(/\s+/g, "") === long.replace(/\s+/g, ""), "لا يضيع حرف عند التقسيم");
  ok(QR.paginate("نص قصير", 400).length === 1, "النص القصير صفحة واحدة");
  // الأذكار
  var A = QR.parseAdhkar(W.CLOCK_ADHKAR.after);
  var mu = A.filter(function (d) { return d.q && d.q.s === 112; })[0];
  ok(mu && mu.n === 1 && mu.nFM === 3, "المعوذات: مرة، وثلاثاً بعد الفجر والمغرب");
  ok(QR.forPrayer(A, "fajr").some(function (d) { return /يُحيي ويُميت/.test(d.text) && d.count === 10; }) && !QR.forPrayer(A, "dhuhr").some(function (d) { return /يُحيي ويُميت/.test(d.text); }), "التهليل العشر بعد الفجر والمغرب فقط");
  ok(QR.forPrayer(A, "jumuah").length === QR.forPrayer(A, "dhuhr").length, "الجمعة كالظهر");
  var kursi = QR.dhikrText(A.filter(function (d) { return d.q && d.q.a === 255; })[0]);
  ok(kursi && kursi.quran && kursi.text.indexOf(QR.verse(2, 255)) === 0 && /۝/.test(kursi.text), "آية الكرسي من المصحف بالرسم العثماني");
  ok(QR.parseAdhkar(W.CLOCK_ADHKAR.morning).length >= 15 && QR.parseAdhkar(W.CLOCK_ADHKAR.evening).length >= 15, "أذكار الصباح والمساء كاملة");
  ok(QR.parseAdhkar(["سبحان الله | ٣٣ | مسلم | العصر"])[0].only.join() === "asr", "تقييد الذكر بصلاة");
  // الجدول: ما بعد الصلاة
  var t7 = { fajr: 300, sunrise: 370, dhuhr: 720, asr: 900, maghrib: 1050, isha: 1130 };
  var S7 = W.ClockConfig.merge(S, { afterPrayerAdhkarMinutes: 5, ayahMinutes: 4, adhkarAfter: { asr: false }, ayahAfter: { dhuhr: true, asr: true, maghrib: false } });
  var s7 = SCH.build(t7, false, S7), E = s7[1].E;
  ok(SCH.state(E + 10, s7, S7).name === "adhkar" && SCH.state(E + 300, s7, S7).name === "ayah" && SCH.state(E + 540, s7, S7) === null, "الظهر: أذكار ٥ ثم آية ٤ ثم عادي");
  ok(SCH.state(s7[2].E + 10, s7, S7).name === "ayah" && s7[2].Z === s7[2].E + 240, "العصر بلا أذكار: الآية مباشرة");
  ok(s7[3].Z === s7[3].E + 300, "المغرب بلا آية: الأذكار فقط");
  var S8 = W.ClockConfig.merge(S7, { postOrder: "ayah" });
  ok(SCH.state(SCH.build(t7, false, S8)[1].E + 10, SCH.build(t7, false, S8), S8).name === "ayah", "ترتيب: الآية أولاً");
  var fr7 = SCH.build(t7, true, S7);
  ok(fr7[1].key === "jumuah" && fr7[1].AY === 0, "الجمعة بلا آية افتراضياً (الخطبة تكفي)");
  // إقامة بموعد ثابت
  var S9 = W.ClockConfig.merge(S, { iqamaFixed: { isha: "19:30", fajr: "09:00" } });
  var s9 = SCH.build(t7, false, S9);
  ok(s9[4].I === (19 * 60 + 30) * 60 && s9[0].I === (300 + S.iqama.fajr) * 60, "إقامة ثابتة للعشاء، ويُهمل الموعد البعيد عن الأذان");
  // أذكار الصباح والمساء
  var sm = SCH.build(t7, false, S);
  var m1 = SCH.session(sm[0].Z + 60, sm, S), m2 = SCH.session(sm[2].Z + 60, sm, S);
  ok(m1 && m1.name === "morning" && m2 && m2.name === "evening" && SCH.session(sm[0].Z - 60, sm, S) === null, "الصباح بعد أذكار الفجر، والمساء بعد أذكار العصر");
  ok(SCH.session(sm[0].Z + S.morningMinutes * 60 + 5, sm, S) === null, "تنتهي بعد مدتها");
  var SM = W.ClockConfig.merge(S, { morningStart: "06:30", morningMode: "screen", eveningMode: "off" });
  ok(SCH.session(390 * 60 + 5, sm, SM).name === "morning" && SCH.session(sm[2].Z + 60, sm, SM) === null, "موعد ثابت للصباح، وإيقاف المساء");
  // الفتاوى
  var F = W.ClockFatwa.parse(fs.readFileSync(path.join(__dirname, "..", "data/fatwas-template.txt"), "utf8"));
  ok(F.list.length === 2 && F.errors.length === 0 && /سطر أو فقرة ثانية/.test(F.list[0].a) && F.list[0].src, "قراءة نموذج الفتاوى");
  var F2 = W.ClockFatwa.parse("السؤال: ما حكم كذا؟\nالجواب: الجواب الأول\n\nفقرة ثانية\n---\nس: سؤال بلا جواب\n---\nس: ثالث\nج: جوابه");
  ok(F2.list.length === 2 && /فقرة ثانية/.test(F2.list[0].a) && F2.errors.length === 1, "صيغ بديلة وتجاهل الناقص");
  // جداول «توقيت»
  var tw = PT.parseCSV('var JS_TIMES =\n[\n"-------------(1)---",\n"01-01~~~~~05:30|06:49|12:18|15:21|17:42|18:56",\n"01-02~~~~~05:30|06:50|12:19|15:22|17:42|18:57",\n];');
  ok(tw.count === 2 && tw.errors.length === 0 && tw.table["01-02"][5] === "18:57", "استيراد ملف ولاية من «توقيت»");
  var D7 = W.CLOCK_DEFAULTS;
  ok(D7.ayahEnabled && D7.tafsirs[0] === "muyassar" && D7.dockPos === "bottom" && D7.morningMode === "screen" && D7.watchdog && D7.annMode === "screen", "الإعدادات الافتراضية للإصدار ٧");
})();

// ١٤. نسخة الجوال
console.log("١٤. نسخة الجوال");
(function () {
  var vm = require("vm");
  ["data/oman-cities.js", "js/qibla.js", "js/mobile-core.js"].forEach(function (f) { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", f), "utf8"), W, { filename: f }); });
  var MC = W.MobileCore, QB = W.ClockQibla, WD = vm.runInContext("Date", W);
  // القبلة مقابل قيم مرجعية معروفة (±٠٫٥°)
  [["لندن", 51.5074, -0.1278, 118.99], ["نيويورك", 40.7128, -74.006, 58.48], ["جاكرتا", -6.2, 106.8, 295.15], ["مسقط", 23.588, 58.3829, 266.44]].forEach(function (c) {
    ok(Math.abs(QB.bearing(c[1], c[2]) - c[3]) < 0.5, "القبلة " + c[0] + " " + QB.bearing(c[1], c[2]).toFixed(2));
  });
  ok(Math.abs(QB.distanceKm(23.588, 58.3829) - 1920) < 15, "المسافة مسقط ← مكة");
  ok(QB.delta(350, 10) === 20 && QB.delta(10, 350) === -20 && QB.headingFrom({ webkitCompassHeading: 90 }) === 90 && QB.headingFrom({ type: "deviceorientationabsolute", alpha: 90 }) === 270 && QB.headingFrom({ alpha: 90 }) === null, "اتجاه الجهاز والفرق");
  // الموقع: المسجد كما هو، أو ولاية، أو موقعي
  var Sm = MC.effective(S, { source: "mosque" }), Sc = MC.effective(S, { source: "city", city: "صلالة" }, W.OMAN_CITIES), Sg = MC.effective(S, { source: "gps", lat: 24.1, lon: 56.9, tz: 4 });
  ok(Sm.latitude === S.latitude && Sm.useTable === S.useTable, "مصدر المسجد لا يغيّر شيئاً");
  ok(Sc.cityName === "صلالة" && Math.abs(Sc.latitude - 17.0151) < 0.01 && Sc.useTable === false && Sg.latitude === 24.1 && Sg.useTable === false, "الولاية وموقعي يحسبان بلا جدول المسجد");
  ok(MC.effective(S, { source: "gps", lat: null, lon: null }).latitude === S.latitude, "موقع غير محدد ← موقع المسجد");
  // جدول اليوم والجمعة
  var fri = new WD(2026, 10, 20), thu = new WD(2026, 10, 19);
  var df = MC.day(fri, S), dt = MC.day(thu, S);
  ok(df.rows.length === 6 && df.rows[2].key === "jumuah" && df.rows[2].name === "الجمعة" && dt.rows[2].key === "dhuhr", "الجمعة بدل الظهر يوم الجمعة");
  ok(dt.rows[1].iqama === null && dt.rows[0].iqama - dt.rows[0].adhan === S.iqama.fajr && dt.rows[4].iqama - dt.rows[4].adhan === S.iqama.maghrib, "الإقامة بمدد المسجد");
  // اللحظة: قبل الأذان، بين الأذان والإقامة، أثناء الصلاة، بعد العشاء
  function atMin(d, m) { var x = new WD(d); x.setHours(0, 0, 0, 0); return new WD(x.getTime() + m * 60000); }
  var asr = dt.rows[3];
  var n1 = MC.now(atMin(thu, asr.adhan - 10), S), n2 = MC.now(atMin(thu, asr.adhan + 3), S), n3 = MC.now(atMin(thu, asr.iqama + 2), S), n4 = MC.now(atMin(thu, 23 * 60), S);
  ok(n1.mode === "next" && n1.key === "asr" && n1.left === 600, "الصلاة القادمة والعدّ");
  ok(n2.mode === "iqama" && n2.left === (asr.iqama - asr.adhan - 3) * 60 && n2.progress > 0 && n2.progress < 1, "العدّ للإقامة");
  ok(n3.mode === "prayer" && n3.label === "الصلاة قائمة", "أثناء الصلاة");
  ok(n4.mode === "next" && n4.key === "fajr" && n4.tomorrow === true && n4.adhan === MC.day(fri, S).rows[0].adhan, "بعد العشاء: فجر الغد");
  // التنبيهات
  var M = { notifyBefore: 10, notifyAdhan: true, notifyIqama: true };
  var al = MC.alerts(thu, S, M, 2);
  ok(al.length === 2 * 5 * 3 - 1 && al[0].at <= al[1].at, "مواعيد التنبيه ليومين (الجمعة بلا إقامة منفصلة)");
  var adh = al.filter(function (a) { return a.id === MC.dayKey(thu) + ":asr:adhan"; })[0];
  ok(adh && adh.at.getHours() * 60 + adh.at.getMinutes() === asr.adhan, "تنبيه الأذان في وقته");
  ok(MC.due(al, adh.at.getTime() + 30000, {}).some(function (a) { return a.id === adh.id; }) && MC.due(al, adh.at.getTime() + 30000, (function () { var o = {}; o[adh.id] = 1; return o; })()).every(function (a) { return a.id !== adh.id; }) && !MC.due(al, adh.at.getTime() + 600000, {}).some(function (a) { return a.id === adh.id; }), "لا يتكرر التنبيه ولا يُرسل القديم");
  var cal = MC.ics(thu, S, M, 30);
  ok((cal.match(/BEGIN:VEVENT/g) || []).length === 150 && (cal.match(/TRIGGER:-PT10M/g) || []).length === 150 && /^BEGIN:VCALENDAR\r\n/.test(cal) && /END:VCALENDAR\r\n$/.test(cal), "ملف التقويم ٣٠ يوماً بمنبّهات");
  // الأذكار
  var mo = MC.adhkar("morning", S), af = MC.adhkar("after", S, "fajr"), ad = MC.adhkar("after", S, "dhuhr");
  ok(mo.length === W.CLOCK_ADHKAR.morning.length && mo[1].q && mo[1].count === 3, "أذكار الصباح بعددها");
  var ikh = function (l) { return l.filter(function (x) { return x.q && x.q.s === 112; })[0]; };
  ok(ikh(af).count === 3 && ikh(ad).count === 1, "المعوذات ثلاثاً بعد الفجر ومرة بعد الظهر");
  ok(MC.adhkarKind(dt.times.fajr + 30, dt.times) === "morning" && MC.adhkarKind(dt.times.asr + 30, dt.times) === "evening" && MC.adhkarKind(dt.times.isha + 30, dt.times) === "after", "اختيار القائمة حسب الوقت");
  ok(MC.lastPrayer(dt.times.maghrib + 5, dt) === "maghrib" && MC.lastPrayer(60, dt) === "isha", "آخر صلاة دخل وقتها");
  // البحث في الفهرس
  var SN = W.ClockQuran.SURAHS;
  ok(MC.searchSurahs("الكهف", SN).list[0] === 18 && MC.searchSurahs("كهف", SN).list[0] === 18 && MC.searchSurahs("١٨", SN).list[0] === 18, "البحث بالاسم والرقم");
  var r = MC.searchSurahs("٢:٢٥٥", SN);
  ok(r.ref && r.ref.s === 2 && r.ref.a === 255 && MC.searchSurahs("abc", SN).list.length === 0 && MC.searchSurahs("", SN).list.length === 114, "البحث بالمرجع وبلا نتائج");
  // التنسيق
  ok(MC.fmt(13 * 60 + 5, { arabicDigits: true }) === "١:٠٥ م" && MC.fmt(13 * 60 + 5, { use24h: true, arabicDigits: false }) === "13:05" && MC.dur(3725, { arabicDigits: false }) === "1:02:05", "تنسيق الأوقات");
  // ملفات التطبيق
  var root = path.join(__dirname, "..");
  var man = JSON.parse(fs.readFileSync(path.join(root, "manifest-mobile.webmanifest"), "utf8"));
  ok(man.start_url === "./m.html" && man.display === "standalone" && man.id, "بيان تطبيق الجوال");
  var swTxt = fs.readFileSync(path.join(root, "sw.js"), "utf8"), html = fs.readFileSync(path.join(root, "m.html"), "utf8");
  var refs = (html.match(/(?:src|href)="([^"#:]+)"/g) || []).map(function (x) { return x.replace(/^(src|href)="|"$/g, ""); });
  ok(refs.every(function (f) { return fs.existsSync(path.join(root, f)); }), "كل ملفات m.html موجودة");
  ok(refs.filter(function (f) { return /\.(js|css)$/.test(f); }).every(function (f) { return swTxt.indexOf('"' + f + '"') >= 0; }), "كل ملفات m.html محفوظة للعمل بدون إنترنت");
})();

// ١٥. الإصدار ٨
console.log("١٥. الإصدار ٨: الإقامة الذكية والتحقق والأصوات والتشغيل التلقائي");
(function () {
  var root = path.join(__dirname, "..");
  var base = W.ClockConfig.merge(S, { iqama: { fajr: 20, dhuhr: 15, asr: 15, maghrib: 10, isha: 20, jumuah: 0 } });
  var T = { fajr: 293, sunrise: 370, dhuhr: 723, asr: 923, maghrib: 1061, isha: 1137 }; // 04:53 … 12:03 … 18:57
  function iq(over, k, wk) { var X = W.ClockConfig.merge(base, over); return SCH.build(T, false, X, wk).filter(function (r) { return r.base === k; })[0]; }
  ok(iq({}, "dhuhr").iqamaMin === 738 && iq({}, "dhuhr").iqHow === "minutes", "الإقامة بالدقائق: 12:03 + 15 = 12:18");
  ok(iq({ iqamaMode: { dhuhr: "round" } }, "dhuhr").iqamaMin === 740, "التقريب لأقرب ٥: 12:18 ← 12:20");
  ok(iq({ iqamaMode: { dhuhr: "round" }, iqamaRound: 15 }, "dhuhr").iqamaMin === 750, "التقريب لأقرب ١٥: 12:18 ← 12:30");
  ok(iq({ iqamaMode: { isha: "fixed" }, iqamaFixed: { isha: "19:30" } }, "isha").iqamaMin === 1170, "موعد ثابت للعشاء 19:30");
  ok(iq({ iqamaMode: { isha: "fixed" }, iqamaFixed: { isha: "18:50" } }, "isha").iqamaMin === 1157, "الموعد الثابت قبل الأذان يرجع للدقائق");
  ok(iq({ iqamaFixed: { isha: "19:30" } }, "isha").iqamaMin === 1170, "توافق الإصدار ٧: موعد ثابت مكتوب مع طريقة الدقائق");
  ok(iq({ iqamaMode: { fajr: "round" }, iqamaRound: 15, iqamaMax: { fajr: 22 } }, "fajr").iqamaMin === 293 + 22, "أقصى فاصل يمنع طول الانتظار");
  // الأسبوعي: موعد واحد من السبت إلى الجمعة
  var Sx = W.ClockConfig.merge(base, { iqamaMode: { fajr: "weekly", isha: "weekly" }, useTable: false });
  var tf = function (d) { return PT.forDate(d, Sx); }, seen = {}, satDiff = true;
  for (var i = 0; i < 7; i++) {
    var d = new Date(2026, 5, 13 + i); // السبت ١٣ يونيو ٢٠٢٦ إلى الجمعة
    var wk = SCH.weekMax(d, tf), r = SCH.build(tf(d), d.getDay() === 5, Sx, wk);
    seen[r[0].iqamaMin] = 1; seen["i" + r[4].iqamaMin] = 1;
    ok(r[0].iqamaMin >= r[0].adhan + 20 && r[0].iqamaMin % 5 === 0, "الأسبوعي بعد الأذان بالفاصل الأدنى ومقرّب " + i);
  }
  ok(Object.keys(seen).length === 2, "الإقامة الأسبوعية ثابتة طوال الأسبوع (الفجر والعشاء)");
  var nextWeek = SCH.build(tf(new Date(2026, 5, 20)), false, Sx, SCH.weekMax(new Date(2026, 5, 20), tf))[0].iqamaMin;
  ok(SCH.weekMax(new Date(2026, 5, 19), tf).fajr === SCH.weekMax(new Date(2026, 5, 13), tf).fajr && typeof nextWeek === "number", "الأسبوع يبدأ يوم السبت");
  ok(SCH.needsWeek(Sx) && !SCH.needsWeek(base), "يحسب أوقات الأسبوع فقط عند الحاجة");
  ok(SCH.build(T, true, W.ClockConfig.merge(base, { iqamaMode: { dhuhr: "weekly" } }))[1].key === "jumuah", "الجمعة تبقى بإعدادها الخاص");

  // التحقق بجداول الأوقاف
  var V = (function () { var vm = require("vm"); vm.runInContext(fs.readFileSync(path.join(root, "js/verify.js"), "utf8"), W); return W.ClockVerify; })();
  var mus = PT.parseCSV(fs.readFileSync(path.join(__dirname, "reference", "oman-muscat.csv"), "utf8"));
  var Sm = W.ClockConfig.merge(S, { latitude: 23.585, longitude: 58.28 });
  var res = V.compare(mus.table, Sm, { year: 2026 });
  ok(res.overall.days === 365 && res.overall.within1 === 1 && res.overall.maxAbs <= 1 && /ممتاز/.test(res.verdict), "مقارنة جدول مسقط: كل الأوقات ضمن دقيقة");
  var shifted = {}; Object.keys(mus.table).forEach(function (k) { shifted[k] = mus.table[k].map(function (t, i) { if (i !== 4) return t; var m = +t.split(":")[0] * 60 + +t.split(":")[1] + 3; return hm(m); }); });
  var r2 = V.compare(shifted, Sm, { year: 2026 });
  ok(r2.suggest.maghrib === 3 && r2.suggest.fajr === 0 && /يحتاج/.test(r2.verdict), "اقتراح تعديل +٣ للمغرب عند فرق ثابت");
  var adjS = W.ClockConfig.merge(Sm, { adjust: V.applySuggest(Sm, r2.suggest) });
  ok(V.compare(shifted, adjS, { year: 2026 }).overall.maxAbs <= 1, "بعد تطبيق التعديل المقترح يعود الفرق ضمن دقيقة");
  var csv = V.reportCSV(res);
  ok(csv.charCodeAt(0) === 0xFEFF && csv.split("\r\n").length > 370 && /الفجر رسمي/.test(csv), "تقرير CSV مفصّل يفتح في Excel");
  // صيغ جداول الأوقاف: اسم اليوم أولاً، تاريخ هجري، ص/م
  var aw = PT.parseCSV("اليوم,الهجري,الميلادي,الفجر,الشروق,الظهر,العصر,المغرب,العشاء\nالسبت,1448/06/01,21/11/2026,٤:٥٨ ص,٦:١٧ ص,١١:٥٣ ص,٣:٠٦ م,٥:٢٨ م,٦:٤٤ م");
  ok(aw.count === 1 && aw.table["2026-11-21"] && aw.table["2026-11-21"].join(" ") === "04:58 06:17 11:53 15:06 17:28 18:44", "قراءة جدول بعمود اليوم والهجري و«ص/م»");
  var cli = require("child_process").spawnSync(process.execPath, [path.join(root, "tools/compare-official.js"), path.join(__dirname, "reference/oman-sohar.csv"), "--city=صحار"], { encoding: "utf8" });
  ok(cli.status === 0 && /الإجمالي/.test(cli.stdout) && /ممتاز|جيد/.test(cli.stdout), "أداة سطر الأوامر للمقارنة");

  // الإعدادات والترحيل
  ok(W.ClockConfig.migrate({ prayerBlack: true, khushoo: "calm" }).khushoo === "black", "ترحيل «سواد تام» إلى وضع الخشوع");
  ["iqamaMode", "iqamaRound", "iqamaMax", "khushoo", "khushooBefore", "khushooDim", "adhanSound", "fajrSound", "iqamaSound", "preAlertMinutes", "hideCursorSeconds", "clockCheck"].forEach(function (k) {
    ok(W.CLOCK_DEFAULTS[k] !== undefined, "إعداد افتراضي " + k);
  });

  // الأصوات المضمّنة
  ["chime", "bell", "soft", "deep", "iqama", "soon"].forEach(function (n) {
    var f = path.join(root, "audio", n + ".mp3"), b = fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0);
    ok(b.length > 20000 && (b[0] === 0x49 || (b[0] === 0xFF && (b[1] & 0xE0) === 0xE0)), "صوت مضمّن صالح " + n + ".mp3");
  });
  ok(/CC0/.test(fs.readFileSync(path.join(root, "audio/SOURCES.txt"), "utf8")), "مصدر الأصوات وترخيصها موثّق");
  var swTxt = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  var swFiles = (swTxt.match(/"([^"]+\.(?:js|css|html|mp3|woff2|png|svg|webmanifest))"/g) || []).map(function (x) { return x.slice(1, -1); });
  ok(swFiles.length > 50 && swFiles.every(function (f) { return fs.existsSync(path.join(root, f)); }), "كل ملفات العمل بدون إنترنت موجودة (" + swFiles.length + ")");
  ok(/audio\/chime\.mp3/.test(swTxt) && /js\/verify\.js/.test(swTxt), "الأصوات والتحقق ضمن ملفات العمل بدون إنترنت");
  var setHtml = fs.readFileSync(path.join(root, "settings.html"), "utf8");
  var keys = {}; (setHtml.match(/\sdata-k="([^"]+)"/g) || []).forEach(function (x) { var k = x.slice(9, -1); keys[k] = (keys[k] || 0) + 1; });
  ok(Object.keys(keys).every(function (k) { return keys[k] === 1; }), "لا يتكرر أي حقل في صفحة الإعدادات " + Object.keys(keys).filter(function (k) { return keys[k] > 1; }).join(","));
  ok(Object.keys(keys).every(function (k) { var v = k.split(".").reduce(function (a, x) { return a == null ? a : a[x]; }, W.CLOCK_DEFAULTS); return v !== undefined; }), "كل حقول الإعدادات لها قيمة افتراضية");
  var setRefs = (setHtml.match(/src="([^"#:?]+\.js)"/g) || []).map(function (x) { return x.slice(5, -1); });
  ok(setRefs.every(function (f) { return fs.existsSync(path.join(root, f)); }), "كل سكربتات صفحة الإعدادات موجودة");

  // التشغيل التلقائي: لينكس
  var sh = require("child_process");
  ["install.sh", "kiosk.sh", "stop.sh", "uninstall.sh"].forEach(function (f) {
    var r = sh.spawnSync("bash", ["-n", path.join(root, "autostart/linux", f)]);
    ok(r.status === 0, "صياغة سكربت لينكس " + f);
  });
  var st = sh.spawnSync("bash", [path.join(root, "autostart/linux/install.sh"), "--status"], { encoding: "utf8", env: { PATH: process.env.PATH, HOME: "/tmp/mc-test-home" } });
  var stj = null; try { stj = JSON.parse(st.stdout); } catch (e) {}
  ok(stj && stj.platform === "linux" && stj.installed === false, "حالة التثبيت على لينكس بصيغة JSON");
  var kio = fs.readFileSync(path.join(root, "autostart/linux/kiosk.sh"), "utf8");
  ok(/--kiosk/.test(kio) && /--autoplay-policy=no-user-gesture-required/.test(kio) && /exited_cleanly/.test(kio) && /xset -dpms/.test(kio) && /unclutter/.test(kio) && /flock/.test(kio), "kiosk.sh: ملء الشاشة، الصوت، تجاوز «استعادة الصفحات»، منع الإطفاء، إخفاء المؤشر، نسخة واحدة");
  // ويندوز
  var ps = fs.readFileSync(path.join(root, "autostart/windows/mosque-clock.ps1"));
  var pst = ps.toString("utf8");
  ok(ps[0] === 0xEF && ps[1] === 0xBB && ps[2] === 0xBF, "سكربت ويندوز بترميز UTF-8 مع BOM (لعرض العربية في PowerShell 5)");
  var bal = function (o, c) { var n = 0; pst.replace(/'[^'\r\n]*'|"[^"\r\n]*"/g, "").split("").forEach(function (ch) { if (ch === o) n++; if (ch === c) n--; }); return n; };
  ok(bal("{", "}") === 0 && bal("(", ")") === 0, "توازن الأقواس في سكربت ويندوز");
  ok(!/\$args\s*=/.test(pst) && /Register-ScheduledTask/.test(pst) && /Startup/.test(pst) && /--kiosk/.test(pst) && /SetThreadExecutionState/.test(pst) && /SetForegroundWindow/.test(pst) && /powercfg/.test(pst), "ويندوز: مهمة مجدولة أو مجلد بدء التشغيل، kiosk، منع السكون، العودة للأمام");
  ["install-autostart.bat", "uninstall-autostart.bat", "stop-clock.bat", "start-clock.bat"].forEach(function (f) {
    var t = fs.readFileSync(path.join(root, "autostart/windows", f), "utf8");
    ok(/\r\n/.test(t) && !/[^\x00-\x7F]/.test(t), "ملف " + f + " بنهايات أسطر ويندوز وحروف لاتينية فقط");
  });

  // واجهة الخادم /api/autostart (تشغيل server.js فعلياً على منفذ مؤقت)
  var probe = "var cp=require('child_process'),http=require('http');var port=18000+Math.floor(Math.random()*900);" +
    "var srv=cp.spawn(process.execPath,[process.argv[1]],{env:Object.assign({},process.env,{PORT:port,CLOCK_PIN:'9876',HOME:'/tmp/mc-test-home'}),stdio:'ignore'});" +
    "function req(m,h,b,cb){var r=http.request({host:'127.0.0.1',port:port,path:'/api/autostart',method:m,headers:h},function(res){var d='';res.on('data',function(c){d+=c});res.on('end',function(){cb(res.statusCode,d)})});r.on('error',function(){cb(0,'')});if(b)r.write(b);r.end();}" +
    "setTimeout(function(){req('GET',{},null,function(c1,d1){req('POST',{'X-Pin':'0000'},JSON.stringify({action:'enable'}),function(c2){req('GET',{},null,function(c3,a){srv.kill();console.log(JSON.stringify({c1:c1,d1:d1,c2:c2}));});});});},700);";
  var pr = sh.spawnSync(process.execPath, ["-e", probe, path.join(root, "server.js")], { encoding: "utf8", timeout: 20000 });
  var pj = null; try { pj = JSON.parse(pr.stdout.trim().split("\n").pop()); } catch (e) {}
  var d1 = null; try { d1 = JSON.parse(pj.d1); } catch (e) {}
  ok(pj && pj.c1 === 200 && d1 && d1.platform === "linux" && d1.supported === true, "الخادم: حالة التشغيل التلقائي GET /api/autostart");
  ok(pj && pj.c2 === 403, "الخادم: التفعيل يرفض رمزاً سرياً خاطئاً");
  // أندرويد (الإصدار ٩: مشروع Capacitor في المجلد الأب ../android، وفحوصه التفصيلية في scripts/check-android.js)
  var aroot = path.join(root, "..", "android");
  if (fs.existsSync(aroot)) {
    var man = fs.readFileSync(path.join(aroot, "app/src/main/AndroidManifest.xml"), "utf8");
    ok(/BOOT_COMPLETED/.test(man) && /SYSTEM_ALERT_WINDOW/.test(man) && /LEANBACK_LAUNCHER/.test(man) && /category.HOME/.test(man) && /android:banner/.test(man), "أندرويد: الإقلاع، الظهور فوق التطبيقات، التلفاز، الشاشة الرئيسية");
    var jdir = path.join(aroot, "app/src/main/java/om/mosque/clock");
    var main = fs.readFileSync(path.join(jdir, "MainActivity.java"), "utf8"), plug = fs.readFileSync(path.join(jdir, "ClockPlugin.java"), "utf8");
    ok(/FLAG_KEEP_SCREEN_ON/.test(main) && /setMediaPlaybackRequiresUserGesture\(false\)/.test(plug) && /setTextZoom\(100\)/.test(plug) && /onRenderProcessGone/.test(plug), "أندرويد: الشاشة مضاءة، الصوت بلا لمس، حجم خط ثابت، تعافٍ من الانهيار");
  } else notes.push("مجلد android غير موجود بجانب الساعة (يُفحص في حزمة الإصدار ٩)");
})();

// ١٦. الإصدار ٨٫١: الشريط المتحرك
console.log("١٦. الإصدار ٨٫١: الشريط المتحرك للإعلانات");
(function () {
  var root = path.join(__dirname, "..");
  require("vm").runInContext(fs.readFileSync(path.join(root, "js/ticker.js"), "utf8"), W);
  var TK = W.ClockTicker, sat = new Date(2026, 10, 21, 17, 30); // السبت ٥:٣٠ م
  ok(TK.isActive({ text: "x" }, sat) && !TK.isActive({ text: "x", enabled: false }, sat) && !TK.isActive({ title: "" , text: "" }, sat), "التفعيل والنص");
  ok(!TK.isActive({ text: "x", from: "2026-11-22" }, sat) && !TK.isActive({ text: "x", to: "2026-11-20" }, sat) && TK.isActive({ text: "x", from: "2026-11-21", to: "2026-11-21" }, sat), "تاريخ البداية والنهاية");
  ok(TK.isActive({ text: "x", days: [6] }, sat) && !TK.isActive({ text: "x", days: [5] }, sat) && TK.isActive({ text: "x", days: [] }, sat), "أيام الأسبوع");
  ok(TK.isActive({ text: "x", timeFrom: "17:00", timeTo: "21:00" }, sat) && !TK.isActive({ text: "x", timeFrom: "18:00", timeTo: "21:00" }, sat) && !TK.isActive({ text: "x", timeTo: "17:30" }, sat), "ساعات العرض");
  ok(TK.isActive({ text: "x", timeFrom: "22:00", timeTo: "04:00" }, new Date(2026, 10, 21, 2, 0)) && !TK.isActive({ text: "x", timeFrom: "22:00", timeTo: "04:00" }, sat), "ساعات تعبر منتصف الليل");
  var L = [{ id: "a", text: "عادي" }, { id: "b", text: "مهم", kind: "lesson", priority: 3 }, { id: "c", text: "عاجل", urgent: true }, { id: "d", text: "شاشة", show: "screen" }, { id: "e", text: "شريط", show: "ticker", kind: "dua" }];
  var scr = TK.items(L, { annMode: "screen" }, sat).map(function (x) { return x.id; });
  ok(scr[0] === "c" && scr.indexOf("a") < 0 && scr.indexOf("d") < 0 && scr.indexOf("e") >= 0, "وضع «العاجل فقط»: العاجل أولاً وما اختير للشريط");
  var tic = TK.items(L, { annMode: "ticker" }, sat).map(function (x) { return x.id; });
  ok(tic[0] === "c" && tic.filter(function (x) { return x === "b"; }).length === 3 && tic.indexOf("d") < 0 && tic.indexOf("a") >= 0, "كل الإعلانات في الشريط، والمهم جداً ثلاث مرات");
  ok(tic.every(function (x, i) { return i === 0 || x !== tic[i - 1]; }), "التكرار موزّع لا متتالٍ: " + tic.join(""));
  ok(TK.items(L, { annMode: "ticker", tickerEnabled: false }, sat).length === 0, "إيقاف الشريط من الإعدادات");
  ok(TK.onScreen(L[0], { annMode: "screen" }) && !TK.onScreen(L[2], { annMode: "both" }) && TK.onScreen(L[3], { annMode: "ticker" }) && !TK.onScreen(L[4], { annMode: "both" }), "ما يظهر بالشاشة الكاملة");
  ok(TK.items(L, { annMode: "ticker" }, sat).filter(function (x) { return x.id === "e"; })[0].label === "دعاء", "تسمية النوع");
  ok(TK.tone(TK.items([{ id: "z", text: "x", kind: "condolence" }], { annMode: "ticker" }, sat)) === "mourn" && TK.tone(TK.items(L, { annMode: "ticker" }, sat)) === "urgent", "نبرة التعزية والعاجل");
  ok(TK.duration(3000, 1920, "slow") > TK.duration(3000, 1920, "normal") && TK.duration(3000, 1920, "normal") > TK.duration(3000, 1920, "fast") && TK.duration(10, 1920, "fast") === 8, "السرعة تتحكم في مدة الدورة");
  ["tickerEnabled", "tickerSpeed", "tickerDir"].forEach(function (k) { ok(W.CLOCK_DEFAULTS[k] !== undefined, "إعداد افتراضي " + k); });
  var idx = fs.readFileSync(path.join(root, "index.html"), "utf8"), sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  ok(idx.indexOf("js/ticker.js") >= 0 && idx.indexOf("js/ticker.js") < idx.indexOf("js/announcements.js") && sw.indexOf('"js/ticker.js"') >= 0, "الشريط محمّل قبل الإعلانات ومحفوظ للعمل بلا إنترنت");
})();

// ١٧. الإصدار ١٠
console.log("١٧. الإصدار ١٠: الساعة والأحجام والسطوع والدروس والنسخ الاحتياطي ولوحة الإمام");
(function () {
  var root = path.join(__dirname, ".."), vmr = require("vm");
  ["js/brightness.js", "js/backup.js", "js/verify.js"].forEach(function (f) { vmr.runInContext(fs.readFileSync(path.join(root, f), "utf8"), W); });
  var D = W.CLOCK_DEFAULTS;
  ok(D.ampmPos === "left" && D.showSeconds === true && D.clockWeight === "auto" && D.tickerAlways === true && D.autoBright === true, "الإعدادات الافتراضية للإصدار ١٠ (ص/م يساراً، الشريط يتحرك دائماً)");
  ["landscape", "portrait"].forEach(function (o) { ok(["clock", "analog", "name", "date", "hero", "prayers", "ticker"].every(function (k) { return D.sizes[o][k] === 1; }), "أحجام " + o + " الافتراضية ١٠٠٪"); });
  var P = W.CLOCK_SIZE_PRESETS;
  ok(P.length === 4 && P.some(function (p) { return p.id === "tv"; }) && P.some(function (p) { return p.id === "portrait" && p.orient === "portrait"; }) && P.some(function (p) { return p.id === "default"; }), "قوالب الأحجام: تلفاز، صغيرة، عمودية، الافتراضي");
  ok(P.every(function (p) { return Object.keys(D.sizes.landscape).every(function (k) { return p.values[k] >= 0.4 && p.values[k] <= 2.5; }); }), "قيم القوالب ضمن حدود المنزلقات");
  var m = W.ClockConfig.merge(D, { sizes: { portrait: { clock: 1.4 } } });
  ok(m.sizes.portrait.clock === 1.4 && m.sizes.portrait.date === 1 && m.sizes.landscape.clock === 1, "دمج حجم عمودي محفوظ مع الافتراضي دون المساس بالأفقي");

  // السطوع
  var BR = W.ClockBright, t = { fajr: 300, sunrise: 385, dhuhr: 717, asr: 903, maghrib: 1045, isha: 1118 };
  var L0 = BR.level(t.isha + 10, t, D), L1 = BR.level(t.isha + 75, t, D), L2 = BR.level(t.isha + 125, t, D), L3 = BR.level(60, t, D);
  ok(L0.dim === 0 && L1.dim > 0 && L1.dim < D.nightDim && Math.abs(L2.dim - D.nightDim) < 1e-9 && Math.abs(L3.dim - D.nightDim) < 1e-9, "خفوت تدريجي بعد العشاء يبلغ أقصاه ويبقى بعد منتصف الليل");
  ok(BR.level(t.fajr - 20, t, D).dim < D.nightDim && BR.level(t.fajr, t, D).dim === 0 && BR.level(t.fajr + 5, t, D).dim === 0, "يعود السطوع كاملاً عند أذان الفجر");
  ok(BR.level(t.dhuhr, t, D).boost === 1 && BR.level(t.sunrise + 30, t, D).boost === 0 && BR.level(t.asr + 5, t, D).boost === 0, "ذروة السطوع عند الظهر");
  ok(BR.level(t.dhuhr, t, D).brightness === 1 && BR.level(60, t, D).brightness < 0.5 && BR.level(60, t, D).brightness >= 0.15, "سطوع الشاشة المقترح (أندرويد) بين ١٥٪ و١٠٠٪");
  ok(BR.level(60, t, W.ClockConfig.merge(D, { autoBright: false })).brightness === -1, "إيقاف السطوع التلقائي يعيد سطوع النظام");
  ok(BR.level(60, t, W.ClockConfig.merge(D, { nightDim: 5 })).dim <= 0.7, "حدّ أقصى للخفوت ٧٠٪");

  // فرق اليوم عن الجدول الرسمي
  var V = W.ClockVerify, row = ["05:01", "06:25", "12:00", "15:03", "17:25", "18:41"], tt = { fajr: 301, sunrise: 385, dhuhr: 717, asr: 903, maghrib: 1045, isha: 1118 };
  var dd = V.todayDiff(row, tt, 1);
  ok(dd.length === 2 && dd[0].key === "dhuhr" && dd[0].diff === 3 && dd[1].key === "isha" && dd[1].diff === 3, "تنبيه الفرق أكثر من دقيقة فقط (الفجر بفرق دقيقة لا يُنبَّه)");
  ok(V.todayDiff(null, tt).length === 0 && V.todayDiff(row, null).length === 0, "لا تنبيه بلا جدول");

  // النسخ الاحتياطي
  var BK = W.ClockBackup, b = BK.build({ mosqueName: "س" }, [{ id: 1, text: "x" }], { "11-21": row }, new Date(2026, 10, 21));
  var back = BK.parse(JSON.stringify(b));
  ok(back.full && back.settings.mosqueName === "س" && back.announcements.length === 1 && back.table["11-21"][2] === "12:00", "نسخة كاملة: الإعدادات والإعلانات والجدول في ملف واحد");
  var old = BK.parse(JSON.stringify({ mosqueName: "قديم", iqama: { fajr: 20 } }));
  ok(!old.full && old.settings.mosqueName === "قديم" && old.announcements === null, "يقبل ملف الإعدادات القديم");
  var bad = 0; ["[]", "5", "{\"kind\":\"mosque-clock-backup\"}"].forEach(function (x) { try { BK.parse(x); } catch (e) { bad++; } });
  ok(bad === 3, "يرفض الملفات غير الصالحة");
  ok(/^mosque-clock-backup-2026-11-21\.json$/.test(BK.fileName(new Date(2026, 10, 21))), "اسم ملف النسخة بالتاريخ");

  // جدول الدروس
  var E = W.ClockEvents, S10 = W.ClockConfig.merge(D, { events: [
    { id: "l1", type: "lesson", title: "درس الفقه", person: "سالم", repeat: "weekly", weekday: 1, anchor: "maghrib" },
    { id: "l2", type: "lesson", title: "تفسير", repeat: "weekly", weekday: 6, anchor: "time", time: "20:00" },
    { id: "f1", type: "funeral", repeat: "once", date: "2026-11-21", anchor: "asr" },
    { id: "l3", type: "lesson", title: "متوقف", repeat: "daily", enabled: false } ] });
  var wk = E.weekLessons(S10, new Date(2026, 10, 21)); // السبت
  ok(wk.length === 2 && wk[0].title === "تفسير" && wk[0].day === "اليوم" && wk[1].title === "درس الفقه" && wk[1].day === "الاثنين" && wk[1].when === "بعد المغرب", "جدول الدروس: الأسبوعي فقط، مرتب، بلا الجنائز ولا المتوقف");
  ok(E.weekLessons(W.ClockConfig.merge(D, { events: [{ type: "lesson", title: "جمعة", repeat: "weekly", weekday: 5, anchor: "dhuhr" }] }), new Date(2026, 10, 21))[0].when === "بعد الجمعة", "درس بعد صلاة الجمعة يُسمّى بها");

  // ملفات الصفحات
  var idx = fs.readFileSync(path.join(root, "index.html"), "utf8"), app = fs.readFileSync(path.join(root, "js/app.js"), "utf8"), look = fs.readFileSync(path.join(root, "js/look.js"), "utf8");
  var sw = fs.readFileSync(path.join(root, "sw.js"), "utf8"), set = fs.readFileSync(path.join(root, "settings.html"), "utf8"), css = fs.readFileSync(path.join(root, "css/look.css"), "utf8");
  ok(/<div class="clock num"><span class="ampm" id="ampm"><\/span><span id="hm"><\/span>/.test(idx), "ص/م داخل سطر الساعة قبل الأرقام (يسارها في سطر LTR)");
  ok(/body:not\(\[data-ampm="right"\]\) \.dk-ap \{ order: -1/.test(fs.readFileSync(path.join(root, "css/reader.css"), "utf8")) && /<span class="ampm" id="ampm"><\/span><span id="hm">/.test(fs.readFileSync(path.join(root, "classic.html"), "utf8")), "ص/م يسار الساعة أيضاً في شريط الوقت أثناء الأذكار وفي التصميم الكلاسيكي");
  ok(/#clockBox \.clock \{ direction: ltr/.test(css) && /#clockBox\.no-sec #aS/.test(css), "اتجاه سطر الساعة وإخفاء الثواني وعقربها");
  ok(/function placeAmpm/.test(look) && /applySizes\(\)/.test(look) && /n\.sizes = S\.sizes/.test(look), "موضع ص/م، الأحجام لكل اتجاه، والأحجام لا تُستبدل بإعدادات الجوال");
  ok(/tickerAlways === false/.test(app) && /tickerCheck\(/.test(app) && /classList\.add\("js"\)/.test(app), "الشريط يتحرك ولو كان النص قصيراً، مع تحريك برمجي احتياطي");
  ok(idx.indexOf("js/health.js") > 0 && idx.indexOf("js/brightness.js") > 0 && idx.indexOf("location.reload") < 0, "المراقب الذاتي في health.js");
  ["js/brightness.js", "js/health.js", "js/backup.js", "remote.html"].forEach(function (f) { ok(sw.indexOf('"' + f + '"') >= 0 && fs.existsSync(path.join(root, f)), "محفوظ للعمل بلا إنترنت: " + f); });
  ok(/mosque-clock-v1[01]/.test(sw), "إصدار المخزن v10 أو أحدث");
  ["ampmPos", "showSeconds", "clockWeight", "tickerAlways", "autoBright", "nightDim", "verifyWarn", "lessonLead", "lessonsSlide", "sizes.landscape.clock", "sizes.landscape.ticker"].forEach(function (k) { ok(set.indexOf('data-k="' + k + '"') >= 0, "حقل الإعدادات " + k); });
  ok(/ClockBackup\.build/.test(set) && /ClockBackup\.parse/.test(set), "الإعدادات: نسخة احتياطية كاملة واستعادتها");
  var rem = fs.readFileSync(path.join(root, "remote.html"), "utf8");
  ok(/api\/settings/.test(rem) && /api\/announcements/.test(rem) && /X-Pin/.test(rem) && /iqamaFixed/.test(rem) && /khutbaTopic/.test(rem), "لوحة الإمام: الإقامة والخطبة والإعلانات بالرمز السري");
})();

// ١٨. الإصدار ١١
console.log("١٨. الإصدار ١١: الحد الأقصى الذكي ومنع التداخل والتطويرات البصرية");
(function () {
  var root = path.join(__dirname, ".."), F = require(path.join(root, "js/fit.js")), D = W.CLOCK_DEFAULTS;
  var R = function (l, t, r, b) { return { left: l, top: t, right: r, bottom: b }; }, V = R(0, 0, 1000, 600);
  // كشف المشكلات
  ok(F.issues({ clock: R(0, 0, 100, 100), hero: R(50, 50, 200, 200) }, {}).length === 1, "تداخل منطقتين يُكتشف");
  ok(F.issues({ clock: R(0, 0, 100, 100), hero: R(101, 0, 200, 100) }, {}).length === 0, "منطقتان متجاورتان بلا تداخل");
  ok(F.issues({ clock: R(0, 0, 100, 100), hero: R(98, 0, 200, 100) }, {}, 3).length === 0, "تلامس أقل من ٣ بكسل مسموح");
  ok(F.issues({ analog: R(0, 0, 100, 100), clock: R(20, 20, 80, 80) }, {}).length === 0, "أرقام الحلقة داخل دائرتها ليست تداخلاً");
  ok(F.issues({ clock: R(-20, 0, 100, 100) }, { clock: V })[0].type === "out", "الخروج من حدود الشاشة يُكتشف");
  ok(F.issues({ clock: R(0, 0, 100, 20) }, {}, 3, { clock: 40 })[0].type === "small", "ساعة أصغر من الحد الأدنى تُكتشف");
  ok(F.issues({}, {}, 3, {}, ["prayers"])[0].type === "clip", "نص مقصوص داخل البطاقات يُكتشف");
  ok(F.issues({ clock: null, hero: R(0, 0, 10, 10) }, {}).length === 0, "العنصر المخفي لا يُحسب");
  // اختيار ما يُصغَّر
  ok(F.pick([{ type: "overlap", a: "clock", b: "hero" }], { clock: 2, hero: 1.2 }) === "clock", "يُصغَّر الأكبر من المتداخلَين");
  ok(F.pick([{ type: "overlap", a: "clock", b: "hero" }], { clock: 1, hero: 1 }) === null, "لا يُصغَّر ما هو على حجمه الافتراضي");
  ok(F.pick([{ type: "small", a: "clock" }], { clock: 1, prayers: 1.5, hero: 1.2 }) === "prayers", "الساعة المضغوطة: يُصغَّر أكبر العناصر المكبّرة الأخرى");
  ok(F.pick([{ type: "clip", a: "prayers" }], { prayers: 1.4, clock: 2 }) === "prayers", "نص مقصوص في البطاقات: تُصغَّر البطاقات");
  // حلقة الملاءمة على تخطيط وهمي: الساعة تكبر نحو البطاقات وتتداخل بعد ١٫٥
  var mock = function (eff) { return { rects: { clock: R(0, 0, 400 * eff.clock, 200), prayers: R(600, 0, 1000, 200) }, bounds: { clock: V, prayers: V } }; };
  var cur, rep = F.solve({ clock: 2.5, prayers: 1 }, function (e) { cur = e; }, function () { return mock(cur); });
  ok(rep.issues.length === 0 && rep.effective.clock === 1.5 && rep.reduced.join() === "clock", "الحل: الساعة تُصغَّر إلى أقصى حجم بلا تداخل بالضبط (" + rep.effective.clock + ")");
  ok(rep.iterations <= 12, "الحل سريع: تصغير خشن ثم استرداد دقيق (" + rep.iterations + " قياسات بدل ٢٠)");
  var warm = F.solve({ clock: 2.5, prayers: 1 }, function (e) { cur = e; }, function () { return mock(cur); }, 120, { start: rep.effective });
  ok(warm.iterations === 1 && warm.effective.clock === 1.5, "الفحص الدوري من النتيجة السابقة: قياس واحد فقط");
  ok(F.pick([{ type: "small", a: "clock" }], { clock: 1, analog: 1.8, prayers: 1.2 }, ["clock", "prayers"]) === "prayers", "لا يُصغَّر حجم غير ظاهر (العقارب في الساعة الرقمية)");
  ok(rep.requested.clock === 2.5, "الحجم المطلوب يبقى محفوظاً (يعود تلقائياً إن اتسع المكان)");
  var rep2 = F.solve({ clock: 1.2, prayers: 1 }, function (e) { cur = e; }, function () { return mock(cur); });
  ok(rep2.reduced.length === 0 && rep2.iterations === 1, "حجم يتسع له المكان لا يُمس (قياس واحد)");
  // الإعدادات والملفات
  ok(D.smartFit === true && D.patterns === "season" && D.cinematic === true, "الإعدادات الافتراضية للإصدار ١١");
  var idx = fs.readFileSync(path.join(root, "index.html"), "utf8"), look = fs.readFileSync(path.join(root, "js/look.js"), "utf8"), set = fs.readFileSync(path.join(root, "settings.html"), "utf8");
  var sw = fs.readFileSync(path.join(root, "sw.js"), "utf8"), css = fs.readFileSync(path.join(root, "css/look.css"), "utf8"), rem = fs.readFileSync(path.join(root, "remote.html"), "utf8");
  var ts = fs.readFileSync(path.join(root, "js/timesync.js"), "utf8"), app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  ok(idx.indexOf("js/fit.js") > 0 && idx.indexOf("js/fit.js") < idx.indexOf("js/look.js") && sw.indexOf('"js/fit.js"') >= 0, "محرك الملاءمة محمّل قبل look.js ومحفوظ للعمل بلا إنترنت");
  ok(/mosque-clock-v11/.test(sw), "إصدار المخزن v11");
  ok(/ClockFit\.solve/.test(look) && /type: "fit"/.test(look) && /S\.smartFit === false/.test(look), "الصفحة تطبّق الملاءمة وتبلغ المعاينة بالنتيجة، ويمكن إيقافها");
  ok(/data-k="smartFit"/.test(set) && /id="fitNote"/.test(set) && /type !== "fit"/.test(set), "الإعدادات: خيار الحد الأقصى الذكي وتنبيه التقليص من المعاينة الحية");
  ok(/mosque-clock-look/.test(set) && /id="tplExport"/.test(set) && /id="tplImport"/.test(set) && /"sizes", "smartFit"/.test(set), "قوالب المظهر: تصدير واستيراد كملف وتشمل الأحجام");
  ok(/id="lLayout"/.test(rem) && /id="lStyle"/.test(rem) && /remoteLook/.test(rem) && /remoteLookAt/.test(look), "لوحة الإمام: التوزيع وشكل الساعة وحجمها (يُطبّق مرة واحدة على الاتجاه الحالي)");
  ok(/id="aArc"/.test(look) && /\.a-arc/.test(css), "قوس الصلاة القادمة على ساعة العقارب");
  ok(/id="pattern"/.test(idx) && /function renderPattern/.test(look) && /body\.kh-prayer \.spattern/.test(css) && /prefers-reduced-motion/.test(css), "الزخرفة الموسمية تتوقف أثناء الصلاة وفي الوضع الخفيف");
  ok(/" cine"/.test(app) && /classList\.add\("leave"\)/.test(app) && /irisIn/.test(css) && /lightSweep/.test(css), "انتقالات الأذان والإقامة والخروج المتدرّج");
  ok(/timeSync/.test(ts) && /"drift"/.test(ts) && /abs < 1000/.test(ts) && /"jump"/.test(ts), "انحراف الوقت: SNTP في أندرويد، شارة فوق ثانية، كشف قفزات ساعة الجهاز");
  ["smartFit", "patterns", "cinematic"].forEach(function (k) { ok(set.indexOf('data-k="' + k + '"') >= 0, "حقل الإعدادات " + k); });
  ok(fs.existsSync(path.join(root, "tools/visual-check.js")), "أداة فحص اللقطات الآلي موجودة");
})();

// ١٩. الإصدار ١١٫١: الريموت في الإعدادات
console.log("١٩. الإصدار ١١٫١: التنقل بالريموت ووضع الفأرة وتبويبات الإعدادات");
(function () {
  var root = path.join(__dirname, ".."), set = fs.readFileSync(path.join(root, "settings.html"), "utf8"), tv = fs.readFileSync(path.join(root, "js/tvnav.js"), "utf8");
  var aa = fs.readFileSync(path.join(root, "js/android-app.js"), "utf8"), sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  ok(set.indexOf("js/tvnav.js") > 0 && set.indexOf("js/tvnav.js") > set.indexOf("js/android-app.js") && sw.indexOf('"js/tvnav.js"') >= 0, "التنقل بالريموت محمّل في الإعدادات ومحفوظ للعمل بلا إنترنت");
  ok(/ty === "range" && editing === a && !vertical/.test(tv) && /setEditing\(editing === a \? null : a\)/.test(tv), "المنزلقة: يمين/يسار للقيمة في وضع التعديل فقط، وموافق يدخله ويخرج منه");
  ok(/e\.preventDefault\(\); e\.stopImmediatePropagation\(\);\s*move\(dir\)/.test(tv), "أعلى/أسفل ينقلان التحديد دائماً (يُمنع السلوك الأصلي الذي يحبسه)");
  ok(/function frame/.test(tv) && /Date\.now\(\) - holdStart/.test(tv) && /function clickAt/.test(tv) && /classList\.add\("idle"\)/.test(tv), "وضع الفأرة: حركة متسارعة ونقرة واختفاء المؤشر عند السكون");
  ok(/TvNav\.back\(\)/.test(aa) && /TvNav\.cursor\(\)/.test(aa), "زر الرجوع يخرج من وضع الفأرة/التعديل، وزر القائمة يبدّله");
  var tabs = (set.match(/role="tab" data-t="/g) || []).length, secs = (set.match(/<section data-tab="/g) || []).length, all = (set.match(/<section[ >]/g) || []).length;
  ok(tabs === 5 && secs === all, "الإعدادات في ٥ تبويبات وكل قسم منسوب لتبويب (" + secs + "/" + all + ")");
  ok(/id="tvCursorBtn"/.test(set), "زر وضع الفأرة في رأس الإعدادات");
  ok(fs.existsSync(path.join(root, "tools/remote-check.js")), "أداة اختبار الريموت الآلي موجودة");
})();

// ٢٠. الإصدار ١١٫٢: السلاسة
console.log("٢٠. الإصدار ١١٫٢: سلاسة تبدّل الدقيقة والشريط السفلي ووضع الأداء");
(function () {
  var root = path.join(__dirname, ".."), app = fs.readFileSync(path.join(root, "js/app.js"), "utf8"), css = fs.readFileSync(path.join(root, "css/look.css"), "utf8");
  var perf = fs.readFileSync(path.join(root, "js/perf.js"), "utf8"), idx = fs.readFileSync(path.join(root, "index.html"), "utf8"), mih = fs.readFileSync(path.join(root, "js/mihrab.js"), "utf8");
  var set = fs.readFileSync(path.join(root, "settings.html"), "utf8"), sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
  ok(!/#hm\.flip|hmFlip.*blur|setDigits[\s\S]{0,400}blur/.test(app) && /function setDigits/.test(app) && /@keyframes dgIn \{ from \{ opacity: \.2; transform: translateY\(\.1em\); \}/.test(css), "تبدّل الأرقام: الرقم المتغير وحده، إزاحة وشفافية بلا ضبابية");
  ok(!/@keyframes dgIn[^}]*blur/.test(css), "لا ضبابية في حركة الأرقام");
  ok(/1000 - \(now\(\)\.getTime\(\) % 1000\)/.test(app) && /requestAnimationFrame\(function \(\) \{ tick\(\); loop\(\); \}\)/.test(app) && !/setInterval\(tick, 250\);\n\}\)\(\);/.test(app), "تحديث واحد عند بداية كل ثانية مع إطار الشاشة");
  ok(/getSeconds\(\) >= 58 \|\| d\.getSeconds\(\) <= 1/.test(app) && /% 15 === 7/.test(app) && /!c\.quiet/.test(fs.readFileSync(path.join(root, "js/look.js"), "utf8")), "الأعمال الثقيلة والشرائح بعيداً عن لحظة تبدّل الدقيقة");
  ok(/getSeconds\(\) - 5\) \/ 10\)/.test(mih) && /function setA/.test(mih) && /\.sun \{ transition: opacity 4s !important; \}/.test(css), "السماء: لا تتحدث عند تبدّل الدقيقة، ولا انزلاق دائم للشمس");
  ok(/slide-layer/.test(app) && /stack\.style\.height = need/.test(app) && /\.slide-layer\.on \{ opacity: 1/.test(css) && /slMarq/.test(css), "الشريط السفلي: طبقتان بتلاشٍ متقاطع وارتفاع محجوز ومرور أفقي للنص الطويل");
  ok(idx.indexOf("js/perf.js") > idx.indexOf("js/app.js") && sw.indexOf('"js/perf.js"') >= 0 && /data-act="fps"/.test(idx) && /rel="preload" href="fonts\/amiri-arabic\.woff2"/.test(idx), "وضع الأداء ومقياس السلاسة وتحميل الخطوط مسبقاً");
  ok(/body\.perf-saver \*[^{]*\{ -webkit-backdrop-filter: none !important; backdrop-filter: none !important; \}/.test(css) && /s\.fps < 45/.test(perf) && /data-k="perfMode"/.test(set) && W.CLOCK_DEFAULTS.perfMode === "auto", "وضع التوفير التلقائي عند ضعف السلاسة، وخيار في الإعدادات");
})();

console.log("\n" + notes.join("\n"));
console.log("\nالنتيجة: " + pass + " ناجح، " + fail + " فاشل");
process.exit(fail ? 1 : 0);
