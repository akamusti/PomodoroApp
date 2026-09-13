import time
import os


CYCLE_COUNT = 4

RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"

BANNER = f"""{BOLD}{RED}
   🍅  POMODORO
  {DIM}odaklan • mola • tekrarla{RESET}"""

DIVIDER = f"{DIM}{'─' * 46}{RESET}"


def supports_color():
    return os.getenv("NO_COLOR") is None


def cycle_dots(session):
    filled = ((session - 1) % CYCLE_COUNT) + 1
    dots = "●" * filled + "○" * (CYCLE_COUNT - filled)
    return f"{DIM}[{dots}] ({filled}/{CYCLE_COUNT}){RESET}"


def print_banner():
    print(BANNER)
    print(DIVIDER)


def notify(message):
    print(f"\n{BOLD}{YELLOW}🔔 {message}{RESET}\a")


def countdown(duration, total_duration, color=GREEN):
    bar_length = 30

    if total_duration <= 0:
        return

    while duration:
        mins, secs = divmod(duration, 60)

        progress = (total_duration - duration) / total_duration
        filled_length = int(round(progress * bar_length))

        bar = "█" * filled_length + "░" * (bar_length - filled_length)
        percentage = int(progress * 100)

        print(f"\r{color}{BOLD}⏳ {mins:02}:{secs:02}{RESET} {color}[{bar}]{RESET} {DIM}{percentage:3}%{RESET}", end="", flush=True)
        time.sleep(1)
        duration -= 1
    print()


def pomodoro(work_duration, short_break_duration, long_break_duration):
    session = 1
    print_banner()
    while True:
        print(f"\n{BOLD}{GREEN}🍅 Pomodoro #{session}{RESET} {cycle_dots(session)}")
        print(f"{GREEN}▶ {work_duration // 60} dakika odaklan!{RESET}")
        countdown(work_duration, work_duration, GREEN)
        notify("Çalışma bitti! Mola zamanı.")

        if session % CYCLE_COUNT == 0:
            print(f"\n{BOLD}{MAGENTA}⏸️ Uzun mola zamanı! {long_break_duration // 60} dakika.{RESET}")
            countdown(long_break_duration, long_break_duration, MAGENTA)
            notify("Uzun mola bitti, tekrar çalışmaya dön.")
        else:
            print(f"\n{BOLD}{CYAN}☕ Kısa mola zamanı! {short_break_duration // 60} dakika.{RESET}")
            countdown(short_break_duration, short_break_duration, CYAN)
            notify("Kısa mola bitti, tekrar çalışmaya dön.")
        print(DIVIDER)
        session += 1


if __name__ == "__main__":
    try:
        print_banner()
        minutes = int(input("🕒 Çalışma süresi (dk, örn: 25): "))
        work_duration = minutes * 60

        short_break_minutes = int(input("☕ Kısa mola süresi (dk, örn: 5): "))
        short_break_duration = short_break_minutes * 60

        long_break_minutes = int(input("⏸️ Uzun mola süresi (dk, örn: 15): "))
        long_break_duration = long_break_minutes * 60

        pomodoro(work_duration, short_break_duration, long_break_duration)
    except KeyboardInterrupt:
        print(f"\n{DIM}⏹️ Uygulama durduruldu. Başarılar!{RESET}")
    except ValueError:
        print(f"{RED}⛔ Geçerli bir sayı girin.{RESET}")
