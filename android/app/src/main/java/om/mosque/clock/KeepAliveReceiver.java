package om.mosque.clock;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;

/** يعيد الساعة للأمام (وضع الشاشة) إن غطّاها تطبيق آخر أو أُغلقت أو انهارت دون طلب خروج. */
public class KeepAliveReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (MainActivity.visible) return;
        boolean force = intent != null && intent.getBooleanExtra("force", false);
        if (!Prefs.keepFront(context) && !(force && Prefs.bootStart(context))) return;
        launch(context);
        // نعيد الجدولة ما دامت الساعة غير ظاهرة (مثلاً لم يُمنح إذن الظهور بعد)
        schedule(context, Math.max(60000L, Prefs.frontDelayMs(context)), false);
    }

    static void launch(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        try { c.startActivity(i); } catch (Exception ignored) { }
    }

    private static PendingIntent pi(Context c, boolean force) {
        Intent i = new Intent(c, KeepAliveReceiver.class).putExtra("force", force);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(c, 8, i, f);
    }

    static void schedule(Context c, long delayMs, boolean force) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long at = SystemClock.elapsedRealtime() + delayMs;
        if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi(c, force));
        else am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi(c, force));
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pi(c, false));
    }
}
