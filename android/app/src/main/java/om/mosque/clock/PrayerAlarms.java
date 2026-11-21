package om.mosque.clock;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * تنبيهات الأذان والإقامة للمصلين، تعمل والتطبيق مغلق.
 * الصفحة (mobile.js) تحسب المواعيد لثلاثين يوماً بالمنطق نفسه الذي تعرضه، وتسلّمها هنا.
 * نحفظ القائمة ونضبط منبّهاً واحداً للموعد التالي فقط؛ وعند رنينه نُظهر الإشعار ونضبط الذي بعده.
 * - منبّه دقيق (setExactAndAllowWhileIdle / setAlarmClock) إن سمح النظام (أندرويد ١٢ فأحدث يتطلب الإذن، ويُمنح يدوياً في ١٤ فأحدث).
 * - وإلا منبّه غير دقيق قد يتأخر دقائق، وتُظهر الصفحة تنبيهاً لطلب الإذن.
 * - بعد الإقلاع أو تغيير الوقت تُعاد الجدولة من القائمة المحفوظة (BootReceiver).
 */
final class PrayerAlarms {
    private PrayerAlarms() {}

    static final String CH_ADHAN = "adhan_v1", CH_PRE = "pre_v1", CH_IQAMA = "iqama_v1", CH_INFO = "info_v1";
    private static final int REQ = 100;
    private static final long LATE_OK = 3 * 60 * 1000L;   // نُظهر الإشعار إن تأخر حتى ٣ دقائق، وأقدم من ذلك يُتجاهل

    static SharedPreferences sp(Context c) { return c.getSharedPreferences("prayer_alarms", Context.MODE_PRIVATE); }

    /** تستقبل من الصفحة: [{id, at(ms), kind: pre|adhan|iqama, title, body}] */
    static int save(Context c, String json) {
        JSONArray in;
        try { in = new JSONArray(json == null ? "[]" : json); } catch (Exception e) { return -1; }
        JSONArray out = new JSONArray();
        long now = System.currentTimeMillis();
        for (int i = 0; i < in.length(); i++) {
            JSONObject o = in.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at", 0);
            if (at <= now - LATE_OK) continue;
            out.put(o);
        }
        sp(c).edit().putString("list", out.toString()).putBoolean("enabled", out.length() > 0)
                .putBoolean("runwayWarned", false).apply();
        scheduleNext(c);
        return out.length();
    }

    static void clear(Context c) {
        sp(c).edit().putString("list", "[]").putBoolean("enabled", false).apply();
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c));
    }

    static void rescheduleAll(Context c) { if (sp(c).getBoolean("enabled", false)) scheduleNext(c); }

    static JSONArray list(Context c) {
        try { return new JSONArray(sp(c).getString("list", "[]")); } catch (Exception e) { return new JSONArray(); }
    }

    static boolean canExact(Context c) {
        if (Build.VERSION.SDK_INT < 31) return true;
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        return am != null && am.canScheduleExactAlarms();
    }

    static boolean notificationsAllowed(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return false;
        if (Build.VERSION.SDK_INT >= 24 && !nm.areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    private static PendingIntent pending(Context c) {
        Intent i = new Intent(c, AlarmReceiver.class).setAction("om.mosque.clock.PRAYER_ALARM");
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(c, REQ, i, f);
    }

    /** أقرب موعد قادم لم يُرسل بعد */
    static JSONObject next(Context c) {
        JSONArray l = list(c);
        long now = System.currentTimeMillis(), fired = sp(c).getLong("firedUpTo", 0);
        JSONObject best = null;
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            if (at <= fired || at < now - LATE_OK) continue;
            if (best == null || at < best.optLong("at")) best = o;
        }
        return best;
    }

    static void scheduleNext(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = pending(c);
        am.cancel(pi);
        JSONObject n = next(c);
        if (n == null) return;
        long at = Math.max(n.optLong("at"), System.currentTimeMillis() + 1000);
        try {
            if (canExact(c)) {
                if ("adhan".equals(n.optString("kind")) && Build.VERSION.SDK_INT >= 21) {
                    // منبّه «ساعة»: أعلى أولوية ويخرج الجهاز من السكون العميق، بلا حدّ لعدد المرات
                    Intent show = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    PendingIntent showPi = PendingIntent.getActivity(c, REQ + 1, show, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
                    am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showPi), pi);
                } else if (Build.VERSION.SDK_INT >= 23) {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } else {
                    am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
                }
            } else if (Build.VERSION.SDK_INT >= 23) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);   // قد يتأخر دقائق
            } else {
                am.set(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            // سُحب إذن المنبّهات الدقيقة للتوّ: نرجع لغير الدقيق
            if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            else am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    /** يُستدعى عند رنين المنبّه: يُظهر كل ما حان وقته ثم يضبط التالي */
    static void fire(Context c) {
        JSONArray l = list(c);
        long now = System.currentTimeMillis(), fired = sp(c).getLong("firedUpTo", 0), maxAt = fired, lastAt = 0;
        for (int i = 0; i < l.length(); i++) {
            JSONObject o = l.optJSONObject(i);
            if (o == null) continue;
            long at = o.optLong("at");
            lastAt = Math.max(lastAt, at);
            if (at <= fired || at > now + 30000) continue;   // لم يحن بعد (نسمح بنصف دقيقة مبكراً)
            maxAt = Math.max(maxAt, at);
            if (now - at > LATE_OK) continue;                  // فات وقته كثيراً (الجهاز كان مطفأً)
            show(c, o);
        }
        sp(c).edit().putLong("firedUpTo", maxAt).apply();
        // قاربت المواعيد المحفوظة على النفاد (لم يُفتح التطبيق منذ أسابيع)
        if (lastAt > 0 && lastAt - now < 3L * 86400000 && !sp(c).getBoolean("runwayWarned", false)) {
            sp(c).edit().putBoolean("runwayWarned", true).apply();
            post(c, CH_INFO, 7, "افتح ساعة المسجد", "افتح التطبيق مرة ليحدّث مواقيت الأسابيع القادمة ويستمر التنبيه.", null);
        }
        scheduleNext(c);
    }

    static void show(Context c, JSONObject o) {
        String kind = o.optString("kind", "adhan");
        String ch = "pre".equals(kind) ? CH_PRE : "iqama".equals(kind) ? CH_IQAMA : CH_ADHAN;
        int id = 1000 + ("pre".equals(kind) ? 1 : "iqama".equals(kind) ? 2 : 0);
        post(c, ch, id, o.optString("title", "حان وقت الصلاة"), o.optString("body", ""), kind);
    }

    static void post(Context c, String channel, int id, String title, String body, String kind) {
        if (!notificationsAllowed(c)) return;
        ensureChannels(c);
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        Intent open = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, channel) : legacyBuilder(c, kind);
        b.setSmallIcon(R.drawable.ic_stat_clock)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new Notification.BigTextStyle().bigText(body))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true);
        if (Build.VERSION.SDK_INT >= 21) {
            b.setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PUBLIC).setColor(0xFFC9A54C);
        }
        try { nm.notify(id, b.build()); } catch (Exception ignored) { }
    }

    @SuppressWarnings("deprecation")
    private static Notification.Builder legacyBuilder(Context c, String kind) {
        Notification.Builder b = new Notification.Builder(c);
        b.setPriority("pre".equals(kind) ? Notification.PRIORITY_DEFAULT : Notification.PRIORITY_HIGH);
        if (kind != null) b.setSound(sound(c, kind)).setVibrate(new long[]{0, 250, 120, 250});
        return b;
    }

    static Uri sound(Context c, String kind) {
        int res = "pre".equals(kind) ? R.raw.notify_soon : "iqama".equals(kind) ? R.raw.notify_iqama : R.raw.notify_adhan;
        return Uri.parse("android.resource://" + c.getPackageName() + "/" + res);
    }

    /** قنوات الإشعارات (أندرويد ٨ فأحدث): يغيّر المستخدم صوت كل قناة أو يكتمها من إعدادات النظام */
    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CH_ADHAN) != null) return;
        AudioAttributes aa = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build();
        NotificationChannel adhan = new NotificationChannel(CH_ADHAN, "الأذان", NotificationManager.IMPORTANCE_HIGH);
        adhan.setDescription("تنبيه عند دخول وقت الصلاة");
        adhan.setSound(sound(c, "adhan"), aa);
        adhan.enableVibration(true);
        adhan.setVibrationPattern(new long[]{0, 250, 120, 250});
        adhan.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        NotificationChannel pre = new NotificationChannel(CH_PRE, "قبل الأذان", NotificationManager.IMPORTANCE_DEFAULT);
        pre.setDescription("تذكير قبل الأذان بدقائق");
        pre.setSound(sound(c, "pre"), aa);
        NotificationChannel iq = new NotificationChannel(CH_IQAMA, "الإقامة", NotificationManager.IMPORTANCE_HIGH);
        iq.setDescription("تنبيه قبل الإقامة");
        iq.setSound(sound(c, "iqama"), aa);
        iq.enableVibration(true);
        NotificationChannel info = new NotificationChannel(CH_INFO, "معلومات التطبيق", NotificationManager.IMPORTANCE_LOW);
        nm.createNotificationChannel(adhan);
        nm.createNotificationChannel(pre);
        nm.createNotificationChannel(iq);
        nm.createNotificationChannel(info);
    }
}
