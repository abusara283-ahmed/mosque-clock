/* دمج الإعدادات الافتراضية مع ما حفظه المستخدم */
(function () {
  var KEY = "mosqueClock.settings.v1";

  function isObj(v) { return v && typeof v === "object" && !Array.isArray(v); }

  function merge(base, over) {
    var out = {};
    Object.keys(base).forEach(function (k) {
      out[k] = isObj(base[k]) ? merge(base[k], {}) : base[k];
    });
    if (!isObj(over)) return out;
    Object.keys(over).forEach(function (k) {
      if (isObj(over[k]) && isObj(out[k])) out[k] = merge(out[k], over[k]);
      else out[k] = over[k];
    });
    return out;
  }

  function readSaved() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); }
    catch (e) { return {}; }
  }

  // الإصدار ٨: «سواد تام أثناء الصلاة» صار خياراً في وضع الخشوع
  function migrate(S) {
    if (S.prayerBlack) { S.khushoo = "black"; S.prayerBlack = false; }
    return S;
  }

  window.ClockConfig = {
    KEY: KEY,
    load: function () { return migrate(merge(window.CLOCK_DEFAULTS, readSaved())); },
    migrate: migrate,
    save: function (obj) {
      try { localStorage.setItem(KEY, JSON.stringify(obj)); return true; }
      catch (e) { return false; }
    },
    reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    merge: merge
  };
})();
