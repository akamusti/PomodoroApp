#!/usr/bin/env bash
# PomodoroApp - Bash sürümü
# Python gerekmez, terminalde çalışır. Kullanım: ./pomodoro.sh

CYCLE_COUNT=4

notify() {
    echo -e "\n🔔 $1"
}

countdown() {
    local duration=$1
    local total_duration=$2
    local bar_length=40

    # 0 dakikalık girişe karşı koruma (Python sürümünde sıfıra bölünme hatası verir)
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
        for ((i = filled_length; i < bar_length; i++)); do bar+=" "; done

        printf "\r⏳ %02d:%02d [%s] %d%%" "$mins" "$secs" "$bar" "$percentage"
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

    while true; do
        echo -e "\n🍅 Pomodoro #$session başlıyor. $work_min dakika odaklan!"
        countdown "$work_duration" "$work_duration"
        notify "Çalışma bitti! Mola zamanı."

        if [ $((session % CYCLE_COUNT)) -eq 0 ]; then
            echo -e "\n⏸️ Uzun mola zamanı! $long_min dakika."
            countdown "$long_break_duration" "$long_break_duration"
            notify "Uzun mola bitti, tekrar çalışmaya dön."
        else
            echo -e "\n☕ Kısa mola zamanı! $short_min dakika."
            countdown "$short_break_duration" "$short_break_duration"
            notify "Kısa mola bitti, tekrar çalışmaya dön."
        fi
        session=$((session + 1))
    done
}

trap 'echo -e "\n⏹️ Uygulama durduruldu. Başarılar!"; exit 0' INT

read -p "🕒 Çalışma süresini dakika cinsinden girin (örn: 25): " minutes
read -p "☕ Kısa mola süresini dakika cinsinden girin (örn: 5): " short_break_minutes
read -p "⏸️ Uzun mola süresini dakika cinsinden girin (örn: 15): " long_break_minutes

if ! is_number "$minutes" || ! is_number "$short_break_minutes" || ! is_number "$long_break_minutes"; then
    echo "⛔ Geçerli bir sayı girin."
    exit 1
fi

pomodoro $((minutes * 60)) $((short_break_minutes * 60)) $((long_break_minutes * 60))
