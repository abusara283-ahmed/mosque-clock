package om.mosque.clock;

import android.app.admin.DeviceAdminReceiver;

/**
 * اختياري لشاشات المسجد المخصّصة: يجعل التطبيق «مالك الجهاز» فيُقفل عليه الجهاز كلياً (kiosk) بلا تأكيد.
 * يُفعّل مرة واحدة على جهاز جديد بلا حسابات:  adb shell dpm set-device-owner om.mosque.clock/.AdminReceiver
 * ويُلغى من إعدادات الساعة: «إلغاء مالك الجهاز» (AndroidClock.clearDeviceOwner)، ثم يمكن حذف التطبيق عادياً.
 */
public class AdminReceiver extends DeviceAdminReceiver { }
