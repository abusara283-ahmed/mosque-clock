package om.mosque.clock;

import android.app.Application;

/** تعافٍ ذاتي: إن انهار التطبيق في وضع شاشة المسجد يُعاد فتحه بعد ٣ ثوانٍ (حتى ٥ مرات في ١٠ دقائق). */
public class ClockApp extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((t, e) -> {
            try {
                Prefs.noteCrash(this);
                if (Prefs.isScreen(this) && Prefs.crashCount(this) <= 5) KeepAliveReceiver.schedule(this, 3000L, true);
            } catch (Throwable ignored) { }
            if (prev != null) prev.uncaughtException(t, e);
        });
        PrayerAlarms.rescheduleAll(this);
    }
}
