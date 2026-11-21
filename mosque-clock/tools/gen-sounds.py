# توليد أصوات التنبيه الأصلية لساعة المسجد (عمل أصلي، يُنشر بترخيص CC0)
import numpy as np, wave, subprocess, os, sys
SR = 44100
out = sys.argv[1]
def env(n, attack=0.01, decay=2.0):
    t = np.arange(n) / SR
    a = np.minimum(1, t / attack)
    return a * np.exp(-t / decay * 3)
def bell(f, dur, decay, partials=((1,1),(2.76,.22),(5.4,.08),(0.5,.15))):
    n = int(SR * dur); t = np.arange(n) / SR; y = np.zeros(n)
    for m, a in partials:
        y += a * np.sin(2*np.pi*f*m*t) * np.exp(-t*(3+m)/decay)
    return y * np.minimum(1, t/0.008)
def soft(f, dur, decay):  # نغمة خشبية ناعمة
    n = int(SR*dur); t = np.arange(n)/SR
    y = np.sin(2*np.pi*f*t) + .3*np.sin(2*np.pi*f*4*t)*np.exp(-t*12) + .12*np.sin(2*np.pi*f*2*t)
    return y * np.exp(-t*3/decay) * np.minimum(1, t/0.004)
def seq(notes, total):
    y = np.zeros(int(SR*total))
    for at, sig in notes:
        i = int(at*SR); j = min(len(y), i+len(sig)); y[i:j] += sig[:j-i]
    return y
def save(name, y):
    y = y / (np.max(np.abs(y)) + 1e-9) * 0.85
    fade = int(SR*0.3); y[-fade:] *= np.linspace(1, 0, fade)
    pcm = (y*32767).astype(np.int16)
    wav = os.path.join(out, name + ".wav")
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",wav,"-codec:a","libmp3lame","-b:a","96k", os.path.join(out, name+".mp3")], check=True)
    os.remove(wav)
# chime: ثلاث نغمات صاعدة (دو، مي، صول) تتكرر مرتين
save("chime", seq([(i*0.6 + r*2.6, bell(f, 3.2, 2.4)) for r in range(2) for i, f in enumerate([523.25, 659.25, 783.99])], 7.5))
# bell: جرس عميق ثلاث ضربات
save("bell", seq([(i*2.2, bell(392.0, 4.5, 3.5)) for i in range(3)], 9))
# soft: لحن خشبي ناعم
save("soft", seq([(i*0.45, soft(f, 2.2, 1.6)) for i, f in enumerate([587.33, 698.46, 880.0, 698.46, 783.99])], 4.6))
# deep: نغمة عميقة ممتدة تشبه الناقوس
save("deep", seq([(0, bell(196.0, 7, 5.5, ((1,1),(2.0,.35),(3.01,.18),(4.2,.06)))), (3.2, bell(261.63, 5, 4.5))], 8.5))
# iqama: نغمتان هابطتان
save("iqama", seq([(0, bell(783.99, 3, 2.2)), (0.6, bell(587.33, 3.2, 2.4))], 4.2))
# soon: نغمة واحدة خفيفة قبل الأذان
save("soon", seq([(0, bell(659.25, 2.8, 2.0))], 3.0))
