package om.mosque.clock;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

import org.json.JSONObject;

/**
 * الإصدار ١١: قياس انحراف ساعة الجهاز عن التوقيت الدقيق (SNTP) دون أي مكتبة.
 * يعمل في خيط خلفي ويحفظ آخر نتيجة؛ الصفحة تقرأها عبر AndroidClock.timeSync().
 * الدقة النموذجية: عشرات الملّي ثانية على الواي فاي.
 */
final class TimeSync {
    private static final String[] SERVERS = { "time.google.com", "pool.ntp.org", "time.cloudflare.com" };
    private static volatile long offset, rtt, at;
    private static volatile String server = "";
    private static volatile boolean running;

    static String json() {
        if (System.currentTimeMillis() - at > 30 * 60 * 1000L) refresh();
        if (at == 0) return "";
        try {
            return new JSONObject().put("offset", offset).put("rtt", rtt).put("at", at).put("server", server).toString();
        } catch (Exception e) { return ""; }
    }

    static void refresh() {
        if (running) return;
        running = true;
        new Thread(() -> {
            try {
                for (String s : SERVERS) { if (query(s)) break; }
            } finally { running = false; }
        }, "mc-timesync").start();
    }

    private static boolean query(String host) {
        try (DatagramSocket sock = new DatagramSocket()) {
            sock.setSoTimeout(4000);
            InetAddress addr = InetAddress.getByName(host);
            byte[] buf = new byte[48];
            buf[0] = 0x1B; // LI=0, VN=3, Mode=3 (عميل)
            long t1 = System.currentTimeMillis();
            writeTs(buf, 40, t1);
            sock.send(new DatagramPacket(buf, buf.length, addr, 123));
            DatagramPacket resp = new DatagramPacket(buf, buf.length);
            sock.receive(resp);
            long t4 = System.currentTimeMillis();
            long t2 = readTs(buf, 32), t3 = readTs(buf, 40);
            if (t2 <= 0 || t3 <= 0) return false;
            offset = ((t2 - t1) + (t3 - t4)) / 2;
            rtt = (t4 - t1) - (t3 - t2);
            server = host; at = System.currentTimeMillis();
            return true;
        } catch (Exception e) { return false; }
    }

    private static final long OFFSET_1900 = 2208988800L;
    private static long readTs(byte[] b, int o) {
        long sec = 0, frac = 0;
        for (int i = 0; i < 4; i++) sec = (sec << 8) | (b[o + i] & 0xff);
        for (int i = 4; i < 8; i++) frac = (frac << 8) | (b[o + i] & 0xff);
        return (sec - OFFSET_1900) * 1000L + (frac * 1000L) / 0x100000000L;
    }
    private static void writeTs(byte[] b, int o, long ms) {
        long sec = ms / 1000L + OFFSET_1900, frac = (ms % 1000L) * 0x100000000L / 1000L;
        for (int i = 3; i >= 0; i--) { b[o + i] = (byte) (sec & 0xff); sec >>= 8; }
        for (int i = 7; i >= 4; i--) { b[o + i] = (byte) (frac & 0xff); frac >>= 8; }
    }
}
