#!/usr/bin/env bash
#
# Rebuilds the bundled ambient loops from the original field recordings.
#
# Usage:
#   ./scripts/build-ambient.sh /path/to/original/recordings
#
# Each source is trimmed, downmixed to mono 44.1 kHz, loudness-normalized to
# about -20 LUFS and encoded as Ogg Vorbis. One extra second of audio is kept
# at the end; the Rust audio engine crossfades it into the head of the loop so
# playback is seamless.
set -euo pipefail

SOURCE_DIR="${1:-}"
if [ -z "$SOURCE_DIR" ] || [ ! -d "$SOURCE_DIR" ]; then
  echo "usage: $0 /path/to/original/recordings" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../src-tauri/assets/ambient"
mkdir -p "$OUT_DIR"

# name | source file | start offset (s) | loop length incl. 1s crossfade (s)
JOBS=(
  "rain|dragon-studio-relaxing-rain-444802.mp3|90|31"
  "storm|41739__digifishmusic__infinite-storm.wav|0|23"
  "wind|151770__gnrja__storm-winds.aiff|5|29"
  "waves|827530__yevgverh__ocean_coast_04_092025_0659am.wav|12|29"
  "fireplace|387128__nooneisreal__the-fireplace-3.wav|6|29"
  "forest|462137__sama66__forest-bird-1.wav|2|25"
  "cafe|331326__sim2710__150504_cafe.mp3|0.5|17"
)

TARGET_LUFS=-20
WORK_DIR="$(mktemp -d)"
trap 'rm -rf "$WORK_DIR"' EXIT

for job in "${JOBS[@]}"; do
  IFS='|' read -r name file start duration <<<"$job"
  src="$SOURCE_DIR/$file"
  if [ ! -f "$src" ]; then
    echo "missing source: $src" >&2
    exit 1
  fi

  trimmed="$WORK_DIR/$name.wav"
  ffmpeg -v error -y -ss "$start" -t "$duration" -i "$src" \
    -af "highpass=f=25,aresample=44100:resampler=soxr" -ac 1 -c:a pcm_f32le "$trimmed"

  measure=$(ffmpeg -hide_banner -nostats -i "$trimmed" \
    -af "loudnorm=I=$TARGET_LUFS:TP=-2:LRA=11:print_format=json" \
    -f null - 2>&1 | sed -n '/^{/,/^}/p')
  input_i=$(printf '%s' "$measure" | sed -n 's/.*"input_i" : "\(.*\)".*/\1/p')
  gain=$(awk -v i="$input_i" -v target="$TARGET_LUFS" 'BEGIN { printf "%.2f", target - i }')

  # The soft limiter keeps rare peaks (e.g. fire crackle) from clipping.
  ffmpeg -v error -y -i "$trimmed" \
    -af "volume=${gain}dB,alimiter=limit=0.85:attack=5:release=50:level=false:latency=true" \
    -ac 1 -ar 44100 -c:a libvorbis -q:a 5 "$OUT_DIR/$name.ogg"

  printf '%-10s gain=%+6sdB -> %s\n' "$name" "$gain" "$(du -h "$OUT_DIR/$name.ogg" | cut -f1)"
done

echo "ambient loops written to $OUT_DIR"
