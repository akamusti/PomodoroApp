#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#define CYCLE_COUNT 4
#define BAR_LENGTH 40

void notify_msg(const char *message) {
    printf("\n🔔 %s\n", message);
    fflush(stdout);
}

void countdown(int duration, int total_duration) {
    if (total_duration <= 0) return;
    char bar[BAR_LENGTH * 3 + 1]; // █ UTF-8'de 3 bayt

    while (duration > 0) {
        int mins = duration / 60;
        int secs = duration % 60;
        int elapsed = total_duration - duration;
        int filled = elapsed * BAR_LENGTH / total_duration;
        int percentage = elapsed * 100 / total_duration;

        int pos = 0;
        for (int i = 0; i < filled; i++) { memcpy(bar + pos, "█", 3); pos += 3; }
        for (int i = filled; i < BAR_LENGTH; i++) { bar[pos++] = ' '; }
        bar[pos] = '\0';

        printf("\r⏳ %02d:%02d [%s] %d%%", mins, secs, bar, percentage);
        fflush(stdout);
        sleep(1);
        duration--;
    }
    printf("\n");
    fflush(stdout);
}

void pomodoro(int work_duration, int short_break_duration, int long_break_duration) {
    int session = 1;
    while (1) {
        printf("\n🍅 Pomodoro #%d başlıyor. %d dakika odaklan!\n", session, work_duration / 60);
        countdown(work_duration, work_duration);
        notify_msg("Çalışma bitti! Mola zamanı.");

        if (session % CYCLE_COUNT == 0) {
            printf("\n⏸️ Uzun mola zamanı! %d dakika.\n", long_break_duration / 60);
            countdown(long_break_duration, long_break_duration);
            notify_msg("Uzun mola bitti, tekrar çalışmaya dön.");
        } else {
            printf("\n☕ Kısa mola zamanı! %d dakika.\n", short_break_duration / 60);
            countdown(short_break_duration, short_break_duration);
            notify_msg("Kısa mola bitti, tekrar çalışmaya dön.");
        }
        session++;
    }
}

int main(void) {
    char buf[64];
    char *end;
    long minutes, short_min, long_min;

    printf("🕒 Çalışma süresini dakika cinsinden girin (örn: 25): ");
    fflush(stdout);
    if (!fgets(buf, sizeof buf, stdin)) return 0;
    minutes = strtol(buf, &end, 10);
    if (end == buf || minutes < 0) { printf("⛔ Geçerli bir sayı girin.\n"); return 1; }

    printf("☕ Kısa mola süresini dakika cinsinden girin (örn: 5): ");
    fflush(stdout);
    if (!fgets(buf, sizeof buf, stdin)) return 0;
    short_min = strtol(buf, &end, 10);
    if (end == buf || short_min < 0) { printf("⛔ Geçerli bir sayı girin.\n"); return 1; }

    printf("⏸️ Uzun mola süresini dakika cinsinden girin (örn: 15): ");
    fflush(stdout);
    if (!fgets(buf, sizeof buf, stdin)) return 0;
    long_min = strtol(buf, &end, 10);
    if (end == buf || long_min < 0) { printf("⛔ Geçerli bir sayı girin.\n"); return 1; }

    pomodoro((int)(minutes * 60), (int)(short_min * 60), (int)(long_min * 60));
    return 0;
}
