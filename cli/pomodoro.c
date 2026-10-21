#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define CYCLE_COUNT 4
#define BAR_LENGTH 30

#define RESET   "\033[0m"
#define BOLD    "\033[1m"
#define DIM     "\033[2m"
#define RED     "\033[91m"
#define GREEN   "\033[92m"
#define YELLOW  "\033[93m"
#define CYAN    "\033[96m"
#define MAGENTA "\033[95m"

#define DIVIDER DIM "──────────────────────────────────────────────" RESET

void print_banner(void) {
    printf(BOLD RED "   🍅  POMODORO\n" RESET);
    printf(DIM "  odaklan • mola • tekrarla\n" RESET);
    printf(DIVIDER "\n");
    fflush(stdout);
}

void print_cycle(int session) {
    int filled = ((session - 1) % CYCLE_COUNT) + 1;
    printf(DIM "[");
    for (int i = 0; i < filled; i++) printf("●");
    for (int i = filled; i < CYCLE_COUNT; i++) printf("○");
    printf("] (%d/%d)" RESET, filled, CYCLE_COUNT);
}

void notify_msg(const char *message) {
    printf("\n" BOLD YELLOW "🔔 %s" RESET "\a\n", message);
    fflush(stdout);
}

void countdown(int duration, int total_duration, const char *color) {
    if (total_duration <= 0) return;
    // █ ve ░ UTF-8'de 3'er bayt
    static char bar[BAR_LENGTH * 3 + 1];

    while (duration > 0) {
        int mins = duration / 60;
        int secs = duration % 60;
        int elapsed = total_duration - duration;
        int filled = elapsed * BAR_LENGTH / total_duration;
        int percentage = elapsed * 100 / total_duration;

        int pos = 0;
        for (int i = 0; i < filled; i++) { memcpy(bar + pos, "█", 3); pos += 3; }
        for (int i = filled; i < BAR_LENGTH; i++) { memcpy(bar + pos, "░", 3); pos += 3; }
        bar[pos] = '\0';

        printf("\r%s" BOLD "⏳ %02d:%02d" RESET " %s[%s]" RESET " " DIM "%3d%%" RESET,
               color, mins, secs, color, bar, percentage);
        fflush(stdout);
        sleep(1);
        duration--;
    }
    printf("\n");
    fflush(stdout);
}

void pomodoro(int work_duration, int short_break_duration, int long_break_duration) {
    int session = 1;
    print_banner();
    while (1) {
        printf("\n" BOLD GREEN "🍅 Pomodoro #%d" RESET " ", session);
        print_cycle(session);
        printf("\n" GREEN "▶ %d dakika odaklan!" RESET "\n", work_duration / 60);
        countdown(work_duration, work_duration, GREEN);
        notify_msg("Çalışma bitti! Mola zamanı.");

        if (session % CYCLE_COUNT == 0) {
            printf("\n" BOLD MAGENTA "⏸️ Uzun mola zamanı! %d dakika." RESET "\n", long_break_duration / 60);
            countdown(long_break_duration, long_break_duration, MAGENTA);
            notify_msg("Uzun mola bitti, tekrar çalışmaya dön.");
        } else {
            printf("\n" BOLD CYAN "☕ Kısa mola zamanı! %d dakika." RESET "\n", short_break_duration / 60);
            countdown(short_break_duration, short_break_duration, CYAN);
            notify_msg("Kısa mola bitti, tekrar çalışmaya dön.");
        }
        printf(DIVIDER "\n");
        session++;
    }
}

int main(void) {
    char buf[64];
    char *end;
    long minutes, short_min, long_min;

    print_banner();
    printf("🕒 Çalışma süresi (dk, örn: 25): ");
    fflush(stdout);
    if (!fgets(buf, sizeof buf, stdin)) return 0;
    minutes = strtol(buf, &end, 10);
    if (end == buf || minutes < 0) { printf(RED "⛔ Geçerli bir sayı girin.\n" RESET); return 1; }

    printf("☕ Kısa mola süresi (dk, örn: 5): ");
    fflush(stdout);
    if (!fgets(buf, sizeof buf, stdin)) return 0;
    short_min = strtol(buf, &end, 10);
    if (end == buf || short_min < 0) { printf(RED "⛔ Geçerli bir sayı girin.\n" RESET); return 1; }

    printf("⏸️ Uzun mola süresi (dk, örn: 15): ");
    fflush(stdout);
    if (!fgets(buf, sizeof buf, stdin)) return 0;
    long_min = strtol(buf, &end, 10);
    if (end == buf || long_min < 0) { printf(RED "⛔ Geçerli bir sayı girin.\n" RESET); return 1; }

    pomodoro((int)(minutes * 60), (int)(short_min * 60), (int)(long_min * 60));
    return 0;
}
