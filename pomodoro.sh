#!/usr/bin/env bash
# PomodoroApp - Bash sürümü (renkli)
# Python gerekmez, terminalde çalışır. Kullanım: bash pomodoro.sh

CYCLE_COUNT=4

RESET='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[91m'
GREEN='\033[92m'
YELLOW='\033[93m'
CYAN='\033[96m'
MAGENTA='\033[95m'

print_banner() {
    echo -e "${BOLD}${RED}   🍅  POMODORO${RESET}"
    echo -e "${DIM}  odaklan • mola • tekrarla${RESET}"
    echo -e "${DIM}──────────────────────────────────────────────${RESET}"
}

cycle_dots() {
    local session=$1
    local filled=$(( (session - 1) % CYCLE_COUNT + 1 ))
    local dots=""
    local i
    for ((i = 0; i < filled; i++)); do dots+="●"; done
    for ((i = filled; i < CYCLE_COUNT; i++)); do dots+="○"; done
    echo -e "${DIM}[$dots] ($filled/$CYCLE_COUNT)${RESET}"
}

notify() {
    echo -e "\n${BOLD}${YELLOW}🔔 $1${RESET}\a"
}

countdown() {
    local duration=$1
    local total_duration=$2
    local color=$3
    local bar_length=30

    if [ "$total_duration" -le 0 ]; then
        return
    fi

    while [ "$duration" -gt 0 ]; do
        local mins=$((duration / 60))
        local secs=$((duration % 60))
        local elapsed=$((total_duration - duration))
        local filled_length=$((elapsed * bar_length / total_duration))
        local percentage=$((elapsed * 100 / total_duration))

        local bar=""
        local i
        for ((i = 0; i < filled_length; i++)); do bar+="█"; done
        for ((i = filled_length; i < bar_length; i++)); do bar+="░"; done

        printf "\r${color}${BOLD}⏳ %02d:%02d${RESET} ${color}[%s]${RESET} ${DIM}%3d%%${RESET}" "$mins" "$secs" "$bar" "$percentage"
        sleep 1
        duration=$((duration - 1))
    done
    echo
}

is_number() {
    [[ "$1" =~ ^[0-9]+$ ]]
}

pomodoro() {
    local work_duration=$1
    local short_break_duration=$2
    local long_break_duration=$3
    local session=1
    local work_min=$((work_duration / 60))
    local short_min=$((short_break_duration / 60))
    local long_min=$((long_break_duration / 60))

    print_banner
    while true; do
        echo -e "\n${BOLD}${GREEN}🍅 Pomodoro #$session${RESET} $(cycle_dots "$session")"
        echo -e "${GREEN}▶ $work_min dakika odaklan!${RESET}"
        countdown "$work_duration" "$work_duration" "$GREEN"
        notify "Çalışma bitti! Mola zamanı."

        if [ $((session % CYCLE_COUNT)) -eq 0 ]; then
            echo -e "\n${BOLD}${MAGENTA}⏸️ Uzun mola zamanı! $long_min dakika.${RESET}"
            countdown "$long_break_duration" "$long_break_duration" "$MAGENTA"
            notify "Uzun mola bitti, tekrar çalışmaya dön."
        else
            echo -e "\n${BOLD}${CYAN}☕ Kısa mola zamanı! $short_min dakika.${RESET}"
            countdown "$short_break_duration" "$short_break_duration" "$CYAN"
            notify "Kısa mola bitti, tekrar çalışmaya dön."
        fi
        echo -e "${DIM}──────────────────────────────────────────────${RESET}"
        session=$((session + 1))
    done
}

trap 'echo -e "\n${DIM}⏹️ Uygulama durduruldu. Başarılar!${RESET}"; exit 0' INT

print_banner
read -p "🕒 Çalışma süresi (dk, örn: 25): " minutes
read -p "☕ Kısa mola süresi (dk, örn: 5): " short_break_minutes
read -p "⏸️ Uzun mola süresi (dk, örn: 15): " long_break_minutes

if ! is_number "$minutes" || ! is_number "$short_break_minutes" || ! is_number "$long_break_minutes"; then
    echo -e "${RED}⛔ Geçerli bir sayı girin.${RESET}"
    exit 1
fi

pomodoro $((minutes * 60)) $((short_break_minutes * 60)) $((long_break_minutes * 60))
