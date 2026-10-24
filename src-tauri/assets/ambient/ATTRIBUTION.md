# Ambient Sound Credits

The ambient soundscapes in this directory are loop-ready excerpts of freely
licensed recordings. Every file was converted to mono 44.1 kHz Ogg Vorbis,
loudness-normalized to roughly -20 LUFS and given a 1 second crossfade tail so
it can be looped seamlessly (see `src-tauri/src/audio.rs`).

| Asset | Track | Original recording | Author | License |
| --- | --- | --- | --- | --- |
| `rain.ogg` | Rain | `relaxing-rain-444802.mp3` | Dragon Studio (Pixabay) | Pixabay Content License |
| `storm.ogg` | Storm & Thunder | [Infinite Storm](https://freesound.org/s/41739/) | digifishmusic | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `wind.ogg` | Breezy Wind | [Storm Winds](https://freesound.org/s/151770/) | gnrja | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| `waves.ogg` | Ocean Waves | [Ocean Coast 04](https://freesound.org/s/827530/) | yevgverh | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `fireplace.ogg` | Fireplace | [The Fireplace 3](https://freesound.org/s/387128/) | nooneisreal | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `forest.ogg` | Forest Birds | [Forest Bird 1](https://freesound.org/s/462137/) | sama66 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `cafe.ogg` | Coffee Shop | [150504_cafe.mp3](https://freesound.org/s/331326/) | sim2710 | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |

CC BY 4.0 requires attribution when the sounds are redistributed; keep this
file with the project when shipping binaries. The White Noise and Deep Brown
Noise tracks are synthesized at runtime and need no attribution.

## Regenerating the loops

```bash
./scripts/build-ambient.sh /path/to/folder/with/original/recordings
```

The script needs `ffmpeg` (with `libvorbis`) and rewrites every file in this
directory.
