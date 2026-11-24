/*
 * الإعدادات الافتراضية لساعة المسجد.
 * أي قيمة تُغيَّر من صفحة الإعدادات تُحفظ في ذاكرة المتصفح (localStorage)
 * وتتقدّم على القيم هنا. لإعادة الضبط استخدم زر "استعادة الافتراضي".
 */
window.CLOCK_DEFAULTS = {
  // ——— المسجد والموقع ———
  mosqueName: "جامع الحي",
  cityName: "مسقط",
  latitude: 23.5880,
  longitude: 58.3829,
  timezone: 4,            // فرق التوقيت عن غرينتش بالساعات (عُمان +4)
  elevation: 0,           // الارتفاع عن سطح البحر بالمتر (يؤثر قليلاً على الشروق والغروب)

  // ——— طريقة الحساب ———
  // oman = تقويم وزارة الأوقاف العُمانية (موصى به) | ummalqura | mwl | egypt | custom (الزوايا أدناه)
  method: "oman",
  fajrAngle: 18,          // زاوية الفجر
  ishaAngle: 18,          // زاوية العشاء
  ishaFixedMinutes: 0,    // إن كانت أكبر من صفر: العشاء = المغرب + هذه الدقائق (بدل الزاوية)
  asrMethod: "standard",  // standard = الجمهور (ظل المثل) ، hanafi = ظل المثلين
  maghribAfterSunset: 0,  // دقائق تضاف للغروب للحصول على المغرب
  // تعديل يدوي بالدقائق لكل وقت (لمطابقة تقويم وزارة الأوقاف)
  adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  // استخدام جدول سنوي جاهز (data/prayer-table.js) إن وُجد بدل الحساب
  useTable: true,

  // ——— الإقامة (دقائق بعد الأذان) ———
  iqama: { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20, jumuah: 0 },
  // مدة بقاء شاشة "الصلاة قائمة" بعد الإقامة (بالدقائق)
  prayerDuration: { fajr: 10, dhuhr: 10, asr: 10, maghrib: 8, isha: 10, jumuah: 30 },
  adhanScreenMinutes: 2,      // مدة إظهار شاشة الأذان
  afterPrayerAdhkarMinutes: 5, // مدة أذكار ما بعد الصلاة
  dimDuringPrayer: true,       // تعتيم الشاشة أثناء الصلاة

  // ——— التاريخ ———
  hijriOffset: 0,         // تصحيح التاريخ الهجري بالأيام (+1 / -1)
  use24h: false,          // نظام 24 ساعة
  arabicDigits: true,     // أرقام عربية مشرقية (٠١٢٣)

  // ——— المحتوى ———
  showWeather: true,
  showSlides: true,
  slideSeconds: 15,
  customMessages: [
    "فضلاً أغلق هاتفك الجوال قبل الصلاة",
    "استووا واعتدلوا، وسدّوا الفُرَج"
  ],

  // ——— الإعلانات ———
  annEveryMinutes: 4,     // تُعرض شاشة الإعلانات كل كذا دقيقة (في الأوقات العادية فقط)
  annSeconds: 15,         // مدة عرض كل إعلان بالثواني
  annMode: "screen",      // الإصدار ٧: screen = شاشة كاملة دورية (والعاجل في شريط متحرك) | ticker = كلها في شريط متحرك | both

  // ——— التذكيرات والصوت ———
  showSeasons: true,      // تذكيرات المواسم (رمضان، الأيام البيض، الاثنين والخميس، عرفة، عاشوراء...)
  imsakMinutes: 10,       // في رمضان: الإمساك قبل الفجر بهذه الدقائق (٠ = إخفاء)
  soundAlerts: true,      // نغمة جرس هادئة عند الأذان والإقامة (تحتاج لمسة واحدة للشاشة أو خيار التشغيل التلقائي في Chrome)
  soundVolume: 0.6,
  adhanAudio: "",         // ملف أذان اختياري مثل audio/adhan.mp3 يُشغَّل بدل النغمة

  // ——— راحة الشاشة (حماية من الاحتراق وتوفير الكهرباء) ———
  nightRest: true,        // شاشة سوداء بساعة خافتة متنقلة في الليل
  nightRestAfterIsha: 60, // تبدأ بعد إقامة العشاء بكذا دقيقة
  nightRestBeforeFajr: 30,// وتنتهي قبل أذان الفجر بكذا دقيقة
  dayRest: false,         // وكذلك من بعد الشروق بنصف ساعة إلى قبل الظهر بنصف ساعة
  pixelShift: true,       // إزاحة المحتوى بضع نقاط كل دقيقة لحماية شاشات OLED/البلازما

  // ——— التشغيل ———
  dailyReload: true,      // إعادة تحميل الصفحة يومياً بعد أذكار الفجر (لتحديث كل شيء وتنظيف الذاكرة)

  // ——— المظهر ———
  layout: "side",         // side = نافذة المحراب | center = الساعة في المنتصف | bar = شريط سفلي | cards = بطاقات | classic = مزولة اليوم (الإصدار ٣)
  layoutRotateMinutes: 0, // تدوير التوزيعات تلقائياً كل كذا دقيقة (٠ = إيقاف)
  background: "auto",     // auto أو معرّف خلفية مدمجة أو custom:<رقم> لصورة مرفوعة
  bgDim: 0.35,            // تعتيم الخلفية لوضوح النص (٠ – ٠٫٨)
  bgBlur: 0,              // تمويه الخلفية بالبكسل (٠ – ٢٠)
  clockStyle: "digital",  // digital | analog | ring
  clockFont: "kufi",      // kufi | naskh | light | system
  clockColor: "",         // لون الساعة (فارغ = لون التصميم)
  clockScale: 1,          // حجم الساعة (٠٫٧ – ١٫٤)
  customPresets: [],      // قوالب محفوظة: [{ name, values }]
  fridayLeadMinutes: 90,  // وضع الجمعة يبدأ قبل الأذان بكذا دقيقة
  jumuahFixed: "",        // موعد ثابت للجمعة مثل 12:15 (فارغ = وقت الظهر)
  // ——— الإصدار ٦: المناسبات واللغة وشريط اليوم ———
  events: [],             // مناسبات خاصة: جنازة، درس، عيد... (تُدار من الإعدادات ← المناسبات)
  taraweeh: true,         // في رمضان: بطاقة «صلاة التراويح بعد العشاء»
  qiyamTime: "",          // موعد صلاة القيام في العشر الأواخر مثل 02:30 (فارغ = لا تظهر)
  eidPrayerTime: "",      // موعد صلاة العيد مثل 06:00 (يظهر يومي العيدين فقط)
  ramadanHero: true,      // في رمضان: عدّ تنازلي «الإفطار» قبل المغرب و«الإمساك» في السحر
  englishNames: false,    // سطر إنجليزي صغير تحت أسماء الصلوات للمصلين من غير العرب
  dayline: true,          // شريط اليوم: الصلوات على خط تتحرك عليه الشمس أو القمر
  // ——— الإصدار ٧: ما بعد الصلاة (أذكار + آية وتفسير) ———
  adhkarAfter: { fajr: true, dhuhr: true, jumuah: true, asr: true, maghrib: true, isha: true }, // أذكار بعد كل صلاة
  adhkarAfterList: [],    // فارغ = القائمة الافتراضية في js/adhkar-data.js
  ayahEnabled: true,      // آية وتفسير بعد الصلاة
  ayahAfter: { fajr: true, dhuhr: true, jumuah: false, asr: true, maghrib: true, isha: true },
  ayahMinutes: 5,         // مدة الآية والتفسير بعد الأذكار
  postOrder: "adhkar",    // adhkar = الأذكار ثم الآية | ayah = الآية ثم الأذكار
  ayahMode: "khatma",     // khatma = ختمة متتابعة تكمل من حيث توقفت | random = مقطع مختار كل مرة
  ayahFrom: 1, ayahTo: 114, // نطاق السور (مثلاً ٧٨ إلى ١١٤ = جزء عمّ)
  khatmaStart: "",        // بداية الختمة مثل 18:1 (فارغ = من أول النطاق)
  tafsirs: ["muyassar"],  // التفاسير المعروضة بالترتيب: muyassar | mukhtasar | jalalayn | saadi (فارغ = الآية فقط)
  tafsirRotate: "all",    // all = كل التفاسير المختارة لكل مقطع بالترتيب | alternate = واحد بالتناوب
  maxAyat: 5,             // أقصى عدد آيات في المقطع الواحد
  readSpeed: 14,          // سرعة القراءة (حرف في الثانية) لتحديد مدة كل صفحة
  dockPos: "bottom",      // موضع شريط الساعة والمواقيت أثناء الأذكار والآيات: bottom | top | side
  // ——— أذكار الصباح والمساء ———
  morningMode: "screen",  // screen = شاشة كاملة في وقتها + الشرائح | slides = في الشرائح فقط | off
  morningStart: "",       // فارغ = بعد أذكار الفجر مباشرة، أو ساعة مثل 05:30
  morningMinutes: 25,
  eveningMode: "screen",
  eveningStart: "",       // فارغ = بعد أذكار العصر مباشرة، أو ساعة مثل 16:30
  eveningMinutes: 20,
  adhkarMorningList: [], adhkarEveningList: [], // فارغ = القوائم الافتراضية
  // ——— الفتاوى ———
  fatwaEnabled: true,     // تظهر فقط إن وُجدت فتاوى (ملف يُرفع من الإعدادات)
  fatwaEveryMinutes: 12,  // فتوى كل كذا دقيقة في الأوقات العادية
  fatwas: [],             // [{ title, q, a, src }] تُملأ من ملف txt
  fatwaFile: "",          // اسم الملف المرفوع (للعرض فقط)
  // ——— الإصدار ٧: التشغيل والدقة والخشوع والهوية ———
  autoFullscreen: true,   // ملء الشاشة تلقائياً عند أول لمسة أو ضغطة
  watchdog: true,         // إعادة تشغيل ذاتية إن توقفت الساعة أو تكررت الأخطاء
  iqamaFixed: { fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" }, // إقامة بموعد ثابت مثل 20:00 (فارغ = بعد الأذان بالدقائق)
  rowsReminder: true,     // في آخر دقيقة قبل الإقامة: «استووا واعتدلوا… وأغلقوا الهواتف»
  prayerBlack: false,     // أثناء الصلاة: سواد تام بلا نص (أقصى خشوع وأقل إضاءة)
  khutbaTopic: "",        // موضوع خطبة الجمعة
  khatib: "",             // اسم الخطيب
  logo: "",               // شعار المسجد (يُرفع من الإعدادات ويُحفظ كصورة صغيرة)
  accentColor: "",        // لون الهوية (فارغ = ذهبي التصميم)
  safeMargin: 0,          // هامش أمان للتلفاز بالنسبة المئوية (٠ – ٦) إن قُصّت الأطراف
  liteMode: false,        // وضع خفيف للأجهزة الضعيفة: بلا تمويه ولا حركات ثقيلة
  // ——— الإصدار ٨٫١: الشريط المتحرك ———
  tickerEnabled: true,    // إظهار الشريط المتحرك (العاجل وما يُختار للشريط)
  tickerSpeed: "normal",  // slow | normal | fast
  tickerDir: "rtl",       // rtl = يتحرك نحو اليمين كالقنوات العربية | ltr
  // ——— الإصدار ٨: الإقامة الذكية ———
  // لكل صلاة: minutes (دقائق بعد الأذان) | fixed (موعد ثابت من iqamaFixed) | round (تقريب للأعلى) | weekly (ثابت طوال الأسبوع)
  iqamaMode: { fajr: "minutes", dhuhr: "minutes", asr: "minutes", maghrib: "minutes", isha: "minutes" },
  iqamaRound: 5,          // خطوة التقريب بالدقائق في round وweekly (5 أو 10 أو 15)
  iqamaMax: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, // أقصى فاصل بعد الأذان (٠ = بلا حد)
  // ——— الإصدار ٨: وضع الخشوع ———
  khushoo: "calm",        // off | calm (هدوء: لا حركة ولا شريط ولا إعلانات وتعتيم) | black (سواد تام أثناء الصلاة)
  khushooBefore: 3,       // يبدأ الهدوء قبل الإقامة بكذا دقيقة (رمز «أغلق الهاتف» وإخفاء الشريط المتحرك)
  khushooDim: 0.12,       // سطوع الشاشة أثناء الصلاة في وضع الهدوء (٠٫٠٥ – ٠٫٥)
  // ——— الإصدار ٨: الأصوات المضمّنة (تعمل بدون إنترنت) ———
  adhanSound: "chime",    // chime (نغمة مولّدة) | bell | soft | deep | file (ملف من adhanAudio) | upload (ملف مرفوع محفوظ في الجهاز) | none
  fajrSound: "same",      // same = مثل بقية الصلوات، أو أي قيمة من القائمة أعلاه
  iqamaSound: "iqama",    // iqama | bell | soft | none
  preAlertMinutes: 0,     // تنبيه خفيف قبل الأذان بكذا دقيقة (٠ = إيقاف)
  // ——— الإصدار ٨: التشغيل الدائم ———
  hideCursorSeconds: 3,   // يختفي مؤشر الفأرة بعد كذا ثانية من آخر حركة (٠ = لا يظهر أبداً)
  clockCheck: true,       // تنبيه إن كانت ساعة الجهاز غير مضبوطة (مثلاً بعد انقطاع الكهرباء في جهاز بلا بطارية ساعة)
  theme: "auto",          // auto (يتغيّر مع وقت اليوم) | emerald | night | sand
  orientation: "auto",    // auto | landscape | portrait
  // ——— الإصدار ١٠: الساعة والأحجام والسطوع ———
  ampmPos: "left",        // موضع ص/م: left يسار الأرقام | right يمينها | below تحتها
  showSeconds: true,      // إظهار الثواني (وعقرب الثواني في الساعة ذات العقارب)
  clockWeight: "auto",    // سمك خط الساعة: auto (حسب الخط) | 400 | 600 | 800 | 900
  // أحجام العناصر (١ = الافتراضي) لكل اتجاه شاشة على حدة: الساعة الرقمية، ذات العقارب، الاسم، التاريخ، الصلاة القادمة، بطاقات الصلوات، الشريط
  sizes: {
    landscape: { clock: 1, analog: 1, name: 1, date: 1, hero: 1, prayers: 1, ticker: 1 },
    portrait: { clock: 1, analog: 1, name: 1, date: 1, hero: 1, prayers: 1, ticker: 1 }
  },
  smartFit: true,
  perfMode: "auto",       // الإصدار ١١٫٢: auto | high | saver (التوفير: بلا تمويه زجاجي ولا حركات زخرفية دائمة)
  patterns: "season",     // الإصدار ١١: زخرفة هندسية متحركة: season = في رمضان والجمعة والعيد | always | off
  cinematic: true,        // الإصدار ١١: انتقالات سينمائية لشاشات الأذان والإقامة         // الإصدار ١١: الحد الأقصى الذكي (يصغّر ما يسبب تداخلاً تلقائياً)
  tickerAlways: true,     // الشريط يتحرك دائماً ولو كان النص قصيراً
  autoBright: true,       // سطوع تلقائي: خفوت تدريجي بعد العشاء وسطوع أعلى وقت الظهيرة
  nightDim: 0.35,         // أقصى خفوت ليلاً (٠ – ٠٫٧)
  verifyWarn: true,       // تنبيه على الشاشة إن اختلف الحساب عن الجدول الرسمي المستورد بأكثر من دقيقة
  lessonLead: 30,         // قبل الدرس بكذا دقيقة يظهر عدّ تنازلي في الشريط المتحرك (٠ = إيقاف)
  lessonsSlide: true      // شريحة «جدول الدروس هذا الأسبوع» وموضوع خطبة الجمعة
};

/* الإصدار ١٠: قوالب الأحجام الجاهزة */
window.CLOCK_SIZE_PRESETS = [
  { id: "tv", name: "تلفاز كبير", orient: "landscape", values: { clock: 1.25, analog: 1.1, name: 1.1, date: 1.15, hero: 1.1, prayers: 1.15, ticker: 1.2 } },
  { id: "small", name: "شاشة صغيرة", orient: "landscape", values: { clock: 1.15, analog: 1.05, name: 1.05, date: 1.1, hero: 1.1, prayers: 1.2, ticker: 1.15 } },
  { id: "portrait", name: "شاشة عمودية", orient: "portrait", values: { clock: 1.1, analog: 1, name: 1, date: 1.05, hero: 1.05, prayers: 1.1, ticker: 1.1 } },
  { id: "default", name: "الحجم الافتراضي", orient: "", values: { clock: 1, analog: 1, name: 1, date: 1, hero: 1, prayers: 1, ticker: 1 } }
];

/* قوالب جاهزة بلمسة واحدة (صفحة الإعدادات) */
window.CLOCK_PRESETS = [
  { id: "classic", name: "كلاسيكي", values: { layout: "side", background: "auto", clockStyle: "digital", clockFont: "kufi", clockColor: "", clockScale: 1, bgDim: 0.35, bgBlur: 0, layoutRotateMinutes: 0 } },
  { id: "modern", name: "عصري", values: { layout: "cards", background: "geometry", clockStyle: "ring", clockFont: "light", clockColor: "#ffffff", clockScale: 1, bgDim: 0.3, bgBlur: 0, layoutRotateMinutes: 0 } },
  { id: "ramadan", name: "رمضاني", values: { layout: "center", background: "ramadan", clockStyle: "digital", clockFont: "naskh", clockColor: "#f8e3a6", clockScale: 1.1, bgDim: 0.2, bgBlur: 0, layoutRotateMinutes: 0 } },
  { id: "heritage", name: "تراثي", values: { layout: "bar", background: "mashrabiya", clockStyle: "analog", clockFont: "kufi", clockColor: "#f8e3a6", clockScale: 1, bgDim: 0.25, bgBlur: 0, layoutRotateMinutes: 0 } },
  { id: "showcase", name: "عرض متجدد", values: { layout: "side", background: "auto", clockStyle: "digital", clockFont: "kufi", clockColor: "", clockScale: 1, bgDim: 0.35, bgBlur: 0, layoutRotateMinutes: 10 } }
];
