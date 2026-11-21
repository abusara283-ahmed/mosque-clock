package om.mosque.clock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * عند إقلاع الجهاز (بعد انقطاع الكهرباء مثلاً) أو تحديث التطبيق أو تغيّر الوقت والمنطقة الزمنية:
 * ١. تُعاد جدولة تنبيهات الأذان والإقامة (وضع المصلي) لأن النظام يمسح المنبّهات عند الإقلاع.
 * ٢. في وضع شاشة المسجد تُفتح الساعة وحدها.
 * أندرويد ١٠ فأحدث يسمح بفتح شاشة من الخلفية فقط إن مُنح إذن «الظهور فوق التطبيقات»،
 * أو كان التطبيق هو الشاشة الرئيسية (فيفتحه النظام نفسه).
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String a = intent.getAction();
        PrayerAlarms.rescheduleAll(context);
        boolean boot = a.endsWith("BOOT_COMPLETED") || a.endsWith("QUICKBOOT_POWERON") || a.equals(Intent.ACTION_MY_PACKAGE_REPLACED);
        if (!boot) return;
        Prefs.clearPause(context);
        if (!Prefs.bootStart(context)) return;
        KeepAliveReceiver.launch(context);
        // محاولة ثانية بعد دقيقة إن لم تظهر (بعض الصناديق تكمل الإقلاع ببطء)
        KeepAliveReceiver.schedule(context, 60000L, true);
    }
}
