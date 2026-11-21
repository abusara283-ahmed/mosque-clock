/*
 * الأصوات (الإصدار ٨): أصوات مضمّنة في مجلد audio تعمل بدون إنترنت، وملف أذان يرفعه المستخدم
 * يُحفظ في الجهاز (IndexedDB)، ونغمة مولّدة في المتصفح احتياطاً إن تعذّر تشغيل الملف.
 * ملاحظة: المتصفحات تمنع الصوت قبل أول لمسة على الشاشة. في شاشة المسجد شغّل Chrome بالخيار:
 *   --autoplay-policy=no-user-gesture-required  (سكربتات التشغيل التلقائي تضيفه وحدها)
 */
(function () {
  var ctx = null;
  function ac() {
    if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  ["click", "keydown", "touchstart"].forEach(function (ev) { addEventListener(ev, function () { ac(); }, { once: true }); });

  function bell(c, freq, at, dur, vol) {
    var o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.type = "sine"; o2.type = "sine";
    o.frequency.value = freq; o2.frequency.value = freq * 2.76; // نغمة جرس معدنية خفيفة
    var g2 = c.createGain(); g2.gain.value = 0.18;
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.start(at); o2.start(at); o.stop(at + dur + 0.05); o2.stop(at + dur + 0.05);
  }
  // kind: adhan (ثلاث نغمات صاعدة) | iqama (نغمتان) | soon (نغمة واحدة)
  function chime(kind, volume) {
    var c = ac(); if (!c) return;
    var v = Math.max(0.02, Math.min(1, volume == null ? 0.6 : volume)), t = c.currentTime + 0.05;
    var seq = kind === "adhan" ? [523.25, 659.25, 783.99] : kind === "iqama" ? [783.99, 587.33] : [659.25];
    seq.forEach(function (f, i) { bell(c, f, t + i * 0.55, 2.4, v); });
  }
  var audioEl = null, objUrl = null;
  function playFile(url, volume, fallback) {
    try {
      audioEl = audioEl || new Audio();
      audioEl.pause();
      audioEl.src = url; audioEl.volume = volume == null ? 1 : Math.max(0, Math.min(1, volume));
      var p = audioEl.play();
      if (p && p.catch) return p.catch(function () { chime(fallback || "adhan", volume); });
    } catch (e) { chime(fallback || "adhan", volume); }
  }
  function stop() { try { if (audioEl) audioEl.pause(); } catch (e) {} }

  // ——— الملفات المرفوعة: تُحفظ في IndexedDB فتعمل بلا إنترنت ولا تحتاج نسخ ملفات ———
  var DB = "mosqueClock.audio", STORE = "files";
  function db() {
    return new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no idb"));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(STORE, mode), st = t.objectStore(STORE), out = fn(st);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
        t.onerror = function () { rej(t.error); };
      });
    });
  }
  function saveUpload(role, file) {
    return tx("readwrite", function (st) { return st.put({ name: file.name, size: file.size, type: file.type, blob: file, at: Date.now() }, role); });
  }
  function getUpload(role) { return tx("readonly", function (st) { return st.get(role); }); }
  function removeUpload(role) { return tx("readwrite", function (st) { return st.delete(role); }); }

  var BUILTIN = { chime: 1, bell: 1, soft: 1, deep: 1, iqama: 1, soon: 1 };
  // snd: اسم صوت مضمّن | file | upload | none ، role: adhan | fajr | iqama | soon
  function play(snd, S, role) {
    S = S || {};
    var vol = S.soundVolume == null ? 0.6 : S.soundVolume;
    var fb = role === "iqama" ? "iqama" : role === "soon" ? "soon" : "adhan";
    if (!snd || snd === "none") return Promise.resolve(false);
    if (snd === "file") { if (S.adhanAudio) return Promise.resolve(playFile(S.adhanAudio, vol, fb)); snd = "chime"; }
    if (snd === "upload") {
      var tryRoles = role === "fajr" ? ["fajr", "adhan"] : [role === "iqama" ? "iqama" : "adhan"];
      var pick = function (i) {
        if (i >= tryRoles.length) return Promise.reject(new Error("none"));
        return getUpload(tryRoles[i]).then(function (rec) { return rec && rec.blob ? rec : pick(i + 1); });
      };
      return pick(0).then(function (rec) {
        if (objUrl) URL.revokeObjectURL(objUrl);
        objUrl = URL.createObjectURL(rec.blob);
        return playFile(objUrl, vol, fb);
      }).catch(function () { return playFile("audio/" + (fb === "adhan" ? "chime" : fb) + ".mp3", vol, fb); });
    }
    if (!BUILTIN[snd]) snd = fb === "adhan" ? "chime" : fb;
    return Promise.resolve(playFile("audio/" + snd + ".mp3", vol, fb));
  }
  window.ClockSound = { chime: chime, playFile: playFile, play: play, stop: stop, unlock: ac,
    saveUpload: saveUpload, getUpload: getUpload, removeUpload: removeUpload, BUILTIN: Object.keys(BUILTIN) };
})();
