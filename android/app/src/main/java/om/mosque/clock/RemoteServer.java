package om.mosque.clock;

import android.content.Context;
import android.content.res.AssetManager;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * الإصدار ١٠: خادم صغير داخل التطبيق (وضع «شاشة المسجد») ليعدّل الإمام الإعلانات والإقامة من جواله عبر الواي فاي.
 * يحاكي واجهة server.js نفسها، فتعمل صفحات remote.html و announcements.html و settings.html من الجوال كما هي:
 *   GET  /api/time            الوقت
 *   GET  /api/info            عناوين الشاشة في الشبكة
 *   GET  /api/settings        { rev, settings }      POST برأس X-Pin (أو X-Seed: 1 أول مرة فقط)
 *   GET  /api/announcements   [ ... ]                 POST برأس X-Pin
 *   وأي ملف آخر من ملفات الساعة المضمّنة في التطبيق (assets/public).
 * الصفحة على الشاشة نفسها تقرأ وتكتب عبر الجسر AndroidClock (لا عبر الشبكة).
 */
final class RemoteServer {
    static final int PORT = 8787;
    private static RemoteServer instance;
    private final Context ctx;
    private ServerSocket server;
    private Thread loop;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private int port = PORT;

    private RemoteServer(Context c) { ctx = c.getApplicationContext(); }

    static synchronized RemoteServer get(Context c) {
        if (instance == null) instance = new RemoteServer(c);
        return instance;
    }

    // ——— الإعدادات الأصلية ———
    static boolean enabled(Context c) { return Prefs.p(c).getBoolean("remoteOn", true); }
    static void setEnabled(Context c, boolean v) { Prefs.p(c).edit().putBoolean("remoteOn", v).apply(); }
    static synchronized String pin(Context c) {
        String p = Prefs.p(c).getString("remotePin", "");
        if (p == null || p.length() < 4) p = newPin(c);
        return p;
    }
    static synchronized String newPin(Context c) {
        String p = String.format(Locale.US, "%06d", new SecureRandom().nextInt(1000000));
        Prefs.p(c).edit().putString("remotePin", p).apply();
        return p;
    }

    synchronized void startIfWanted() {
        if (enabled(ctx) && Prefs.isScreen(ctx)) start(); else stop();
    }

    synchronized void start() {
        if (server != null && !server.isClosed()) return;
        for (int p = PORT; p < PORT + 5; p++) {
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(p));
                server = s; port = p;
                break;
            } catch (IOException e) { /* المنفذ مشغول: التالي */ }
        }
        if (server == null) return;
        final ServerSocket s = server;
        loop = new Thread(() -> {
            while (!s.isClosed()) {
                try { final Socket c = s.accept(); pool.execute(() -> handle(c)); }
                catch (IOException e) { if (s.isClosed()) break; }
            }
        }, "mosque-remote");
        loop.setDaemon(true);
        loop.start();
    }

    synchronized void stop() {
        try { if (server != null) server.close(); } catch (IOException ignored) {}
        server = null;
    }

    boolean running() { return server != null && !server.isClosed(); }

    // ——— التخزين (ملفات صغيرة داخل التطبيق) ———
    private File file(String name) { return new File(ctx.getFilesDir(), name); }
    private synchronized String read(String name) {
        File f = file(name);
        if (!f.exists()) return null;
        try (FileInputStream in = new FileInputStream(f)) { return new String(readAll(in, 8_000_000), StandardCharsets.UTF_8); }
        catch (IOException e) { return null; }
    }
    private synchronized boolean write(String name, String txt) {
        File tmp = file(name + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(txt.getBytes(StandardCharsets.UTF_8)); }
        catch (IOException e) { return false; }
        return tmp.renameTo(file(name));
    }

    String settingsJson() { String s = read("remote-settings.json"); return s == null ? "{\"rev\":0,\"settings\":null}" : s; }
    String announcementsJson() { return read("remote-ann.json"); }

    /** يحفظ الإعدادات ويرجع رقم المراجعة، أو 0 إن كان المحتوى غير صالح */
    long putSettings(String json) {
        try {
            JSONObject o = new JSONObject(json);
            long rev = System.currentTimeMillis();
            JSONObject w = new JSONObject();
            w.put("rev", rev); w.put("settings", o);
            return write("remote-settings.json", w.toString()) ? rev : 0;
        } catch (Exception e) { return 0; }
    }
    /** أول مرة فقط: الشاشة تضع إعداداتها ليبدأ الجوال منها */
    long seedSettings(String json) {
        if (file("remote-settings.json").exists()) {
            try { return new JSONObject(settingsJson()).optLong("rev", 0); } catch (Exception e) { return 0; }
        }
        return putSettings(json);
    }
    boolean putAnnouncements(String json) {
        try { JSONArray a = new JSONArray(json); return write("remote-ann.json", a.toString()); }
        catch (Exception e) { return false; }
    }

    List<String> urls() {
        List<String> out = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress ad : Collections.list(ni.getInetAddresses())) {
                    if (ad instanceof Inet4Address && !ad.isLoopbackAddress()) {
                        String u = "http://" + ad.getHostAddress() + ":" + port;
                        if (ni.getName().startsWith("wlan") || ni.getName().startsWith("eth")) out.add(0, u); else out.add(u);
                    }
                }
            }
        } catch (Exception ignored) {}
        return out;
    }

    JSONObject info() {
        JSONObject o = new JSONObject();
        try {
            o.put("enabled", enabled(ctx) && running());
            o.put("wanted", enabled(ctx));
            o.put("port", port);
            o.put("pin", pin(ctx));
            o.put("urls", new JSONArray(urls()));
        } catch (Exception ignored) {}
        return o;
    }

    // ——— HTTP ———
    private static byte[] readAll(InputStream in, int max) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[16384]; int n;
        while ((n = in.read(buf)) > 0) { b.write(buf, 0, n); if (b.size() > max) throw new IOException("too big"); }
        return b.toByteArray();
    }
    private static String line(InputStream in) throws IOException {
        ByteArrayOutputStream b = new ByteArrayOutputStream(); int c;
        while ((c = in.read()) >= 0) { if (c == '\n') break; if (c != '\r') b.write(c); if (b.size() > 8192) throw new IOException("line"); }
        if (c < 0 && b.size() == 0) return null;
        return new String(b.toByteArray(), StandardCharsets.UTF_8);
    }

    private void handle(Socket sock) {
        try (Socket s = sock) {
            s.setSoTimeout(15000);
            InputStream in = s.getInputStream();
            OutputStream out = s.getOutputStream();
            String req = line(in);
            if (req == null) return;
            String[] parts = req.split(" ");
            if (parts.length < 2) { send(out, 400, "text/plain", new byte[0]); return; }
            String method = parts[0], path = parts[1];
            Map<String, String> h = new HashMap<>();
            String l;
            while ((l = line(in)) != null && l.length() > 0) {
                int i = l.indexOf(':');
                if (i > 0) h.put(l.substring(0, i).trim().toLowerCase(Locale.US), l.substring(i + 1).trim());
            }
            int q = path.indexOf('?'); if (q >= 0) path = path.substring(0, q);
            path = java.net.URLDecoder.decode(path, "UTF-8");
            byte[] body = new byte[0];
            int len = 0;
            try { len = Integer.parseInt(h.containsKey("content-length") ? h.get("content-length") : "0"); } catch (NumberFormatException ignored) {}
            if (len > 6_000_000) { send(out, 413, "application/json", "{\"error\":\"size\"}".getBytes(StandardCharsets.UTF_8)); return; }
            if (len > 0) {
                body = new byte[len]; int got = 0;
                while (got < len) { int n = in.read(body, got, len - got); if (n < 0) break; got += n; }
            }
            route(out, method, path, h, new String(body, StandardCharsets.UTF_8));
        } catch (Exception ignored) {}
    }

    private boolean pinOk(Map<String, String> h) { return pin(ctx).equals(h.get("x-pin")); }

    private void route(OutputStream out, String method, String path, Map<String, String> h, String body) throws IOException {
        String J = "application/json; charset=utf-8";
        if (path.equals("/api/time")) { json(out, 200, "{\"now\":" + System.currentTimeMillis() + "}"); return; }
        if (path.equals("/api/info")) { JSONObject o = new JSONObject(); try { o.put("urls", new JSONArray(urls())); } catch (Exception ignored) {} json(out, 200, o.toString()); return; }
        if (path.equals("/api/settings")) {
            if ("GET".equals(method)) { json(out, 200, settingsJson()); return; }
            if ("POST".equals(method)) {
                boolean seed = "1".equals(h.get("x-seed")) && !file("remote-settings.json").exists();
                if (!seed && !pinOk(h)) { json(out, 403, "{\"error\":\"pin\"}"); return; }
                long rev = putSettings(body);
                json(out, rev > 0 ? 200 : 400, rev > 0 ? "{\"ok\":true,\"rev\":" + rev + "}" : "{\"error\":\"json\"}");
                return;
            }
            json(out, 405, "{}"); return;
        }
        if (path.equals("/api/announcements")) {
            if ("GET".equals(method)) { String a = announcementsJson(); json(out, a == null ? 404 : 200, a == null ? "[]" : a); return; }
            if ("POST".equals(method)) {
                if (!pinOk(h)) { json(out, 403, "{\"error\":\"pin\"}"); return; }
                boolean ok = putAnnouncements(body);
                json(out, ok ? 200 : 400, ok ? "{\"ok\":true}" : "{\"error\":\"json\"}");
                return;
            }
            json(out, 405, "{}"); return;
        }
        if (path.startsWith("/api/")) { json(out, 404, "{}"); return; }
        if (!"GET".equals(method) && !"HEAD".equals(method)) { send(out, 405, "text/plain", new byte[0]); return; }
        if (path.equals("/") || path.isEmpty()) path = "/remote.html";
        if (path.contains("..") || path.contains("\\")) { send(out, 403, "text/plain", new byte[0]); return; }
        AssetManager am = ctx.getAssets();
        try (InputStream in = am.open("public" + path)) {
            byte[] data = readAll(in, 20_000_000);
            send(out, 200, mime(path), data);
        } catch (IOException e) {
            send(out, 404, "text/plain; charset=utf-8", "غير موجود".getBytes(StandardCharsets.UTF_8));
        }
    }

    private static String mime(String p) {
        String x = p.toLowerCase(Locale.US);
        if (x.endsWith(".html")) return "text/html; charset=utf-8";
        if (x.endsWith(".js")) return "text/javascript; charset=utf-8";
        if (x.endsWith(".css")) return "text/css; charset=utf-8";
        if (x.endsWith(".json") || x.endsWith(".webmanifest")) return "application/json; charset=utf-8";
        if (x.endsWith(".svg")) return "image/svg+xml";
        if (x.endsWith(".png")) return "image/png";
        if (x.endsWith(".jpg") || x.endsWith(".jpeg")) return "image/jpeg";
        if (x.endsWith(".woff2")) return "font/woff2";
        if (x.endsWith(".mp3")) return "audio/mpeg";
        if (x.endsWith(".txt") || x.endsWith(".csv")) return "text/plain; charset=utf-8";
        return "application/octet-stream";
    }
    private static void json(OutputStream out, int code, String s) throws IOException {
        send(out, code, "application/json; charset=utf-8", s.getBytes(StandardCharsets.UTF_8));
    }
    private static void send(OutputStream out, int code, String type, byte[] data) throws IOException {
        String reason = code == 200 ? "OK" : code == 403 ? "Forbidden" : code == 404 ? "Not Found" : code == 400 ? "Bad Request" : "Error";
        String head = "HTTP/1.1 " + code + " " + reason + "\r\nContent-Type: " + type + "\r\nContent-Length: " + data.length +
                "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.UTF_8));
        out.write(data);
        out.flush();
    }
}
