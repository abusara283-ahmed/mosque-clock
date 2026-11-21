package om.mosque.clock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** رنين منبّه الصلاة: يُظهر الإشعار ويضبط الموعد التالي. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if ("android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(a)) {
            PrayerAlarms.rescheduleAll(context);   // مُنح إذن المنبّهات الدقيقة: نعيد الضبط بدقة
            return;
        }
        PrayerAlarms.fire(context);
    }
}
