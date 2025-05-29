import time
import os

# Sese ihtiyaç olmadığı için playsound importunu ve kontrolünü kaldırıyoruz.
# SOUND_ENABLED = False yapabiliriz veya tamamen kaldırabiliriz.

CYCLE_COUNT = 4

def notify(message):
    print(f"\n🔔 {message}")
    # Ses çalma kodunu kaldırıyoruz
    # if SOUND_ENABLED:
    #     try:
    #         playsound('ding.mp3')
    #     except:
    #         print("Ses çalınamadı.")

def countdown(duration, total_duration):
    bar_length = 40
    
    while duration:
        mins, secs = divmod(duration, 60)
        
        # İlerleme çubuğu hesaplaması
        progress = (total_duration - duration) / total_duration
        filled_length = int(round(progress * bar_length))
        
        bar = '█' * filled_length + ' ' * (bar_length - filled_length)
        
        # Yüzdelik oran
        percentage = int(progress * 100)

        print(f"\r⏳ {mins:02}:{secs:02} [{bar}] {percentage}%", end="")
        time.sleep(1)
        duration -= 1
    print()

def pomodoro(work_duration, short_break_duration, long_break_duration):
    session = 1
    while True:
        print(f"\n🍅 Pomodoro #{session} başlıyor. {work_duration // 60} dakika odaklan!")
        countdown(work_duration, work_duration)
        notify("Çalışma bitti! Mola zamanı.")

        if session % CYCLE_COUNT == 0:
            print(f"\n⏸️ Uzun mola zamanı! {long_break_duration // 60} dakika.")
            countdown(long_break_duration, long_break_duration)
            notify("Uzun mola bitti, tekrar çalışmaya dön.")
        else:
            print(f"\n☕ Kısa mola zamanı! {short_break_duration // 60} dakika.")
            countdown(short_break_duration, short_break_duration)
            notify("Kısa mola bitti, tekrar çalışmaya dön.")
        session += 1

if __name__ == "__main__":
    try:
        minutes = int(input("🕒 Çalışma süresini dakika cinsinden girin (örn: 25): "))
        work_duration = minutes * 60

        short_break_minutes = int(input("☕ Kısa mola süresini dakika cinsinden girin (örn: 5): "))
        short_break_duration = short_break_minutes * 60

        long_break_minutes = int(input("⏸️ Uzun mola süresini dakika cinsinden girin (örn: 15): "))
        long_break_duration = long_break_minutes * 60
        
        pomodoro(work_duration, short_break_duration, long_break_duration)
    except KeyboardInterrupt:
        print("\n⏹️ Uygulama durduruldu. Başarılar!")
    except ValueError:
        print("⛔ Geçerli bir sayı girin.")