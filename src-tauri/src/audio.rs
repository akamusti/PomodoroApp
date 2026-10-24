use serde::Deserialize;
use std::collections::HashMap;
use std::sync::{Arc, Condvar, Mutex, OnceLock};
use std::thread;

const SAMPLE_RATE: u32 = 44100;
const LOOP_SECONDS: f32 = 8.0;
const CHUNK_FRAMES: usize = 882; // 20ms at 44.1 kHz
/// Crossfade applied to the bundled ambient recordings so they loop seamlessly.
const CROSSFADE_SECONDS: f32 = 1.0;

#[derive(Clone, Debug, Deserialize)]
pub struct TrackConfig {
    pub enabled: bool,
    pub volume: f32,
}

struct MixerState {
    tracks: HashMap<String, TrackConfig>,
    cursors: HashMap<String, usize>,
    master_volume: f32,
    muted: bool,
    cue_samples: Vec<f32>,
    cue_cursor: usize,
}

impl MixerState {
    fn new() -> Self {
        Self {
            tracks: HashMap::new(),
            cursors: HashMap::new(),
            master_volume: 0.7,
            muted: false,
            cue_samples: Vec::new(),
            cue_cursor: 0,
        }
    }

    fn has_active_audio(&self) -> bool {
        let cue_active = self.cue_cursor < self.cue_samples.len();
        let ambient_active = !self.muted
            && self.master_volume > 0.0001
            && self
                .tracks
                .values()
                .any(|t| t.enabled && t.volume > 0.0001);
        cue_active || ambient_active
    }
}

pub struct AudioEngine {
    shared: Arc<(Mutex<MixerState>, Condvar)>,
}

static ENGINE: OnceLock<AudioEngine> = OnceLock::new();

pub fn get_engine() -> &'static AudioEngine {
    ENGINE.get_or_init(AudioEngine::new)
}

impl AudioEngine {
    pub fn new() -> Self {
        let shared = Arc::new((Mutex::new(MixerState::new()), Condvar::new()));
        let thread_shared = Arc::clone(&shared);

        thread::Builder::new()
            .name("pomodoro-audio-mixer".into())
            .spawn(move || {
                audio_worker_loop(thread_shared);
            })
            .expect("failed to spawn audio mixer thread");

        Self { shared }
    }

    pub fn update_ambient(
        &self,
        tracks: HashMap<String, TrackConfig>,
        master_volume: f32,
        muted: bool,
    ) {
        let (lock, cvar) = &*self.shared;
        if let Ok(mut state) = lock.lock() {
            state.tracks = tracks;
            state.master_volume = master_volume.clamp(0.0, 1.0);
            state.muted = muted;
            if state.has_active_audio() {
                cvar.notify_all();
            }
        }
    }

    pub fn trigger_cue(&self, kind: &str) {
        let cue = synthesize_cue(kind);
        if cue.is_empty() {
            return;
        }
        let (lock, cvar) = &*self.shared;
        if let Ok(mut state) = lock.lock() {
            state.cue_samples = cue;
            state.cue_cursor = 0;
            cvar.notify_all();
        }
    }
}

/// Simple deterministic PRNG (xorshift64*) so procedural synthesis needs no external rand crate.
struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Self(if seed == 0 { 0x853c49e6748fea9b } else { seed })
    }

    #[inline]
    fn next_f32_signed(&mut self) -> f32 {
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        let r = x.wrapping_mul(0x2545F4914F6CDD1D);
        let unit = (r >> 40) as f32 * (1.0 / (1u64 << 24) as f32);
        unit * 2.0 - 1.0
    }
}

/// Blends the tail of the buffer into its head and drops the tail so the
/// resulting samples can be looped without an audible seam.
fn make_seamless(mut arr: Vec<f32>, fade_len: usize) -> Vec<f32> {
    let len = arr.len();
    if fade_len == 0 || len <= fade_len * 2 {
        return arr;
    }
    let loop_len = len - fade_len;
    for i in 0..fade_len {
        let t = i as f32 / fade_len as f32;
        arr[i] = arr[i] * t + arr[loop_len + i] * (1.0 - t);
    }
    arr.truncate(loop_len);
    arr
}

fn crossfade_frames() -> usize {
    (SAMPLE_RATE as f32 * CROSSFADE_SECONDS) as usize
}

fn linear_resample(input: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || input.is_empty() {
        return input.to_vec();
    }
    let ratio = from_rate as f64 / to_rate as f64;
    let out_len = ((input.len() as f64) / ratio).floor() as usize;
    let mut out = Vec::with_capacity(out_len);
    for i in 0..out_len {
        let src_pos = i as f64 * ratio;
        let idx = src_pos.floor() as usize;
        let frac = (src_pos - idx as f64) as f32;
        let a = input[idx.min(input.len() - 1)];
        let b = input[(idx + 1).min(input.len() - 1)];
        out.push(a + (b - a) * frac);
    }
    out
}

/// Decodes a mono Ogg Vorbis buffer into f32 samples at `SAMPLE_RATE`.
fn decode_mono_vorbis(bytes: &[u8]) -> Option<Vec<f32>> {
    let mut reader =
        lewton::inside_ogg::OggStreamReader::new(std::io::Cursor::new(bytes)).ok()?;
    let channels = reader.ident_hdr.audio_channels as usize;
    let rate = reader.ident_hdr.audio_sample_rate;

    let mut mono: Vec<f32> = Vec::new();
    loop {
        match reader.read_dec_packet_itl() {
            Ok(Some(packet)) => {
                if packet.is_empty() {
                    continue;
                }
                if channels <= 1 {
                    mono.extend(packet.iter().map(|s| *s as f32 / 32768.0));
                } else {
                    mono.extend(packet.chunks_exact(channels).map(|frame| {
                        let sum: i32 = frame.iter().map(|s| *s as i32).sum();
                        (sum as f32 / channels as f32) / 32768.0
                    }));
                }
            }
            Ok(None) => break,
            Err(err) => {
                log::warn!("ambient: failed while decoding bundled track: {err}");
                return None;
            }
        }
    }

    if mono.is_empty() {
        return None;
    }

    if rate != SAMPLE_RATE {
        Some(linear_resample(&mono, rate, SAMPLE_RATE))
    } else {
        Some(mono)
    }
}

/// Loads one of the bundled field recordings and turns it into a seamless loop.
///
/// The assets are mono Ogg Vorbis files that already contain an extra
/// `CROSSFADE_SECONDS` tail used to blend the loop boundary.
fn load_bundled_track(track_id: &str) -> Option<Vec<f32>> {
    let bytes: &[u8] = match track_id {
        "rain" => include_bytes!("../assets/ambient/rain.ogg"),
        "storm" => include_bytes!("../assets/ambient/storm.ogg"),
        "wind" => include_bytes!("../assets/ambient/wind.ogg"),
        "waves" => include_bytes!("../assets/ambient/waves.ogg"),
        "fireplace" => include_bytes!("../assets/ambient/fireplace.ogg"),
        "forest" => include_bytes!("../assets/ambient/forest.ogg"),
        "cafe" => include_bytes!("../assets/ambient/cafe.ogg"),
        _ => return None,
    };

    let samples = decode_mono_vorbis(bytes)?;
    Some(make_seamless(samples, crossfade_frames()))
}

/// Procedurally generated noise banks. Everything else is a real recording
/// loaded on demand from `assets/ambient`.
fn generate_procedural_banks() -> HashMap<String, Vec<f32>> {
    let len = (SAMPLE_RATE as f32 * LOOP_SECONDS) as usize;
    let fade_len = SAMPLE_RATE as usize / 4; // 0.25s crossfade

    let mut rng = Rng::new(0xC0FFEE_1234_5678);

    // White noise
    let mut white = vec![0.0f32; len];
    for s in white.iter_mut() {
        *s = rng.next_f32_signed() * 0.35;
    }

    // Brown noise
    let mut brown = vec![0.0f32; len];
    let mut last_brown = 0.0f32;
    for s in brown.iter_mut() {
        let w = rng.next_f32_signed();
        last_brown = (last_brown + 0.02 * w) / 1.02;
        *s = (last_brown * 3.0).clamp(-0.95, 0.95);
    }

    let mut banks = HashMap::new();
    banks.insert("whiteNoise".into(), make_seamless(white, fade_len));
    banks.insert("brownNoise".into(), make_seamless(brown, fade_len));
    banks
}

fn synthesize_cue(kind: &str) -> Vec<f32> {
    // (freq_hz, delay_sec, duration_sec)
    let notes: &[(f32, f32, f32)] = match kind {
        "start" => &[(587.33, 0.0, 0.18), (880.0, 0.09, 0.28)],
        "complete" => &[
            (523.25, 0.0, 0.35),
            (659.25, 0.12, 0.35),
            (783.99, 0.24, 0.50),
            (1046.5, 0.38, 0.75),
        ],
        _ => return Vec::new(),
    };

    let total_sec = notes
        .iter()
        .map(|(_, d, dur)| d + dur + 0.05)
        .fold(0.0f32, f32::max);
    let total_samples = (total_sec * SAMPLE_RATE as f32) as usize;
    let mut out = vec![0.0f32; total_samples];

    for &(freq, delay, duration) in notes {
        let start = (delay * SAMPLE_RATE as f32) as usize;
        let len = (duration * SAMPLE_RATE as f32) as usize;
        let attack = (0.015 * SAMPLE_RATE as f32) as usize;
        for i in 0..len {
            if start + i >= total_samples {
                break;
            }
            let t = i as f32 / SAMPLE_RATE as f32;
            // Triangle wave in [-1.0, 1.0]
            let phase = (t * freq).fract();
            let tri = 4.0 * (phase - (phase + 0.5).floor()).abs() - 1.0;

            let env = if i < attack {
                (i as f32 / attack.max(1) as f32) * 0.20
            } else {
                let progress = (i - attack) as f32 / (len - attack).max(1) as f32;
                0.20 * (0.004f32).powf(progress)
            };
            out[start + i] += tri * env;
        }
    }

    out
}

fn audio_worker_loop(shared: Arc<(Mutex<MixerState>, Condvar)>) {
    // Procedural banks are cheap and always available; the bundled recordings
    // are decoded lazily the first time their track is enabled.
    let mut banks = generate_procedural_banks();
    let mut sink: Option<Box<dyn PcmOutput>> = None;
    let mut pcm_buf = vec![0i16; CHUNK_FRAMES * 2]; // stereo interleaved
    let mut mix_buf = vec![0.0f32; CHUNK_FRAMES];
    let chunk_duration = std::time::Duration::from_millis(20);
    let mut next_tick = std::time::Instant::now();

    loop {
        // Wait until at least one ambient track or cue is active
        {
            let (lock, cvar) = &*shared;
            let mut state = match lock.lock() {
                Ok(g) => g,
                Err(_) => return,
            };
            while !state.has_active_audio() {
                // Drop active audio sink while idle so we hold zero audio resources
                drop(sink.take());
                state = match cvar.wait(state) {
                    Ok(g) => g,
                    Err(_) => return,
                };
                next_tick = std::time::Instant::now();
            }
        }

        if sink.is_none() {
            sink = open_platform_audio_output();
            if sink.is_none() {
                // Avoid busy-spinning if no audio device is available on the host
                thread::sleep(std::time::Duration::from_millis(250));
                continue;
            }
            next_tick = std::time::Instant::now();
        }

        // Mix one 20ms chunk
        mix_buf.fill(0.0);
        {
            let (lock, _) = &*shared;
            if let Ok(mut state) = lock.lock() {
                if !state.muted && state.master_volume > 0.0001 {
                    let master = state.master_volume;
                    let active_list: Vec<(String, f32)> = state
                        .tracks
                        .iter()
                        .filter(|(_, cfg)| cfg.enabled && cfg.volume > 0.0001)
                        .map(|(k, cfg)| (k.clone(), cfg.volume * master))
                        .collect();

                    for (track_id, gain) in active_list {
                        let bank = banks.entry(track_id.clone()).or_insert_with(|| {
                            match load_bundled_track(&track_id) {
                                Some(bank) => bank,
                                None => {
                                    log::warn!(
                                        "ambient: no audio bank available for track '{track_id}'"
                                    );
                                    Vec::new()
                                }
                            }
                        });
                        if bank.is_empty() {
                            continue;
                        }
                        let bank_len = bank.len();
                        let cursor = state.cursors.entry(track_id).or_insert(0);
                        for sample in mix_buf.iter_mut() {
                            *sample += bank[*cursor] * gain;
                            *cursor += 1;
                            if *cursor >= bank_len {
                                *cursor = 0;
                            }
                        }
                    }
                }

                if state.cue_cursor < state.cue_samples.len() {
                    let rem = state.cue_samples.len() - state.cue_cursor;
                    let take = rem.min(CHUNK_FRAMES);
                    for i in 0..take {
                        mix_buf[i] += state.cue_samples[state.cue_cursor + i];
                    }
                    state.cue_cursor += take;
                    if state.cue_cursor >= state.cue_samples.len() {
                        state.cue_samples.clear();
                        state.cue_cursor = 0;
                    }
                }
            }
        }

        // Convert mono/stereo mix_buf into interleaved stereo i16 PCM with soft clipping
        for (i, &val) in mix_buf.iter().enumerate() {
            let clamped = val.clamp(-0.98, 0.98);
            let s = (clamped * 32767.0) as i16;
            pcm_buf[i * 2] = s;
            pcm_buf[i * 2 + 1] = s;
        }

        if let Some(out) = sink.as_mut() {
            if !out.write_interleaved(&pcm_buf) {
                sink = None;
                continue;
            }
        }

        // Real-time 20ms pacing so pipes never over-buffer and volume sliders respond instantly
        next_tick += chunk_duration;
        let now = std::time::Instant::now();
        if next_tick > now {
            thread::sleep(next_tick - now);
        } else if now.duration_since(next_tick) > std::time::Duration::from_millis(60) {
            next_tick = now;
        }
    }
}

trait PcmOutput: Send {
    fn write_interleaved(&mut self, samples: &[i16]) -> bool;
}

// ============================================================================
// LINUX AUDIO BACKENDS
// Prioritizes clean host audio subprocess (pacat / pw-cat / aplay) so AppImages
// built on Ubuntu 22.04 never suffer from glibc/libpulse symbol clashes on
// Fedora, Arch, or Debian, followed by direct libpulse-simple / ALSA fallbacks.
// ============================================================================
#[cfg(target_os = "linux")]
fn open_platform_audio_output() -> Option<Box<dyn PcmOutput>> {
    if let Some(sub) = linux_audio::SubprocessOutput::try_new() {
        return Some(Box::new(sub));
    }
    if let Some(pa) = linux_audio::PulseSimpleOutput::try_new() {
        return Some(Box::new(pa));
    }
    if let Some(alsa) = linux_audio::AlsaOutput::try_new() {
        return Some(Box::new(alsa));
    }
    None
}

#[cfg(target_os = "linux")]
mod linux_audio {
    use super::{PcmOutput, SAMPLE_RATE};
    use std::ffi::{c_char, c_int, c_void, CString};
    use std::io::Write;
    use std::process::{Child, Command, Stdio};

    const RTLD_LAZY: c_int = 1;

    unsafe extern "C" {
        fn dlopen(filename: *const c_char, flags: c_int) -> *mut c_void;
        fn dlsym(handle: *mut c_void, symbol: *const c_char) -> *mut c_void;
    }

    #[repr(C)]
    struct PaSampleSpec {
        format: c_int,
        rate: u32,
        channels: u8,
    }

    #[repr(C)]
    struct PaBufferAttr {
        maxlength: u32,
        tlength: u32,
        prebuf: u32,
        minreq: u32,
        fragsize: u32,
    }

    type PaSimpleNewFn = unsafe extern "C" fn(
        server: *const c_char,
        name: *const c_char,
        dir: c_int,
        dev: *const c_char,
        stream_name: *const c_char,
        ss: *const PaSampleSpec,
        map: *const c_void,
        attr: *const PaBufferAttr,
        error: *mut c_int,
    ) -> *mut c_void;

    type PaSimpleWriteFn = unsafe extern "C" fn(
        s: *mut c_void,
        data: *const c_void,
        bytes: usize,
        error: *mut c_int,
    ) -> c_int;

    type PaSimpleFreeFn = unsafe extern "C" fn(s: *mut c_void);

    pub struct PulseSimpleOutput {
        simple: *mut c_void,
        write_fn: PaSimpleWriteFn,
        free_fn: PaSimpleFreeFn,
    }

    unsafe impl Send for PulseSimpleOutput {}

    impl PulseSimpleOutput {
        pub fn try_new() -> Option<Self> {
            let candidates = [
                "libpulse-simple.so.0",
                "/usr/lib64/libpulse-simple.so.0",
                "/usr/lib/x86_64-linux-gnu/libpulse-simple.so.0",
                "/usr/lib/libpulse-simple.so.0",
            ];
            unsafe {
                let mut handle = std::ptr::null_mut();
                for path in candidates {
                    let c_path = CString::new(path).ok()?;
                    handle = dlopen(c_path.as_ptr(), RTLD_LAZY);
                    if !handle.is_null() {
                        break;
                    }
                }
                if handle.is_null() {
                    return None;
                }

                let sym_new = dlsym(handle, b"pa_simple_new\0".as_ptr() as *const c_char);
                let sym_write = dlsym(handle, b"pa_simple_write\0".as_ptr() as *const c_char);
                let sym_free = dlsym(handle, b"pa_simple_free\0".as_ptr() as *const c_char);
                if sym_new.is_null() || sym_write.is_null() || sym_free.is_null() {
                    return None;
                }

                let new_fn: PaSimpleNewFn = std::mem::transmute(sym_new);
                let write_fn: PaSimpleWriteFn = std::mem::transmute(sym_write);
                let free_fn: PaSimpleFreeFn = std::mem::transmute(sym_free);

                let app_name = CString::new("Pomodoro").ok()?;
                let stream_name = CString::new("Ambient Sounds").ok()?;
                let spec = PaSampleSpec {
                    format: 3, // PA_SAMPLE_S16LE
                    rate: SAMPLE_RATE,
                    channels: 2,
                };
                let attr = PaBufferAttr {
                    maxlength: u32::MAX,
                    tlength: 882 * 4 * 2, // ~40ms target buffer
                    prebuf: u32::MAX,
                    minreq: u32::MAX,
                    fragsize: u32::MAX,
                };
                let mut err: c_int = 0;
                let simple = new_fn(
                    std::ptr::null(),
                    app_name.as_ptr(),
                    1, // PA_STREAM_PLAYBACK
                    std::ptr::null(),
                    stream_name.as_ptr(),
                    &spec,
                    std::ptr::null(),
                    &attr,
                    &mut err,
                );
                if simple.is_null() {
                    return None;
                }

                Some(Self {
                    simple,
                    write_fn,
                    free_fn,
                })
            }
        }
    }

    impl PcmOutput for PulseSimpleOutput {
        fn write_interleaved(&mut self, samples: &[i16]) -> bool {
            unsafe {
                let mut err: c_int = 0;
                let bytes = std::slice::from_raw_parts(
                    samples.as_ptr() as *const u8,
                    samples.len() * std::mem::size_of::<i16>(),
                );
                let res = (self.write_fn)(
                    self.simple,
                    bytes.as_ptr() as *const c_void,
                    bytes.len(),
                    &mut err,
                );
                res >= 0
            }
        }
    }

    impl Drop for PulseSimpleOutput {
        fn drop(&mut self) {
            unsafe {
                if !self.simple.is_null() {
                    (self.free_fn)(self.simple);
                }
            }
        }
    }

    // ALSA dlopen fallback
    type SndPcmOpenFn = unsafe extern "C" fn(
        pcm: *mut *mut c_void,
        name: *const c_char,
        stream: c_int,
        mode: c_int,
    ) -> c_int;
    type SndPcmSetParamsFn = unsafe extern "C" fn(
        pcm: *mut c_void,
        format: c_int,
        access: c_int,
        channels: u32,
        rate: u32,
        soft_resample: c_int,
        latency: u32,
    ) -> c_int;
    type SndPcmWriteiFn =
        unsafe extern "C" fn(pcm: *mut c_void, buffer: *const c_void, size: usize) -> isize;
    type SndPcmRecoverFn =
        unsafe extern "C" fn(pcm: *mut c_void, err: c_int, silent: c_int) -> c_int;
    type SndPcmCloseFn = unsafe extern "C" fn(pcm: *mut c_void) -> c_int;

    pub struct AlsaOutput {
        pcm: *mut c_void,
        writei_fn: SndPcmWriteiFn,
        recover_fn: SndPcmRecoverFn,
        close_fn: SndPcmCloseFn,
    }

    unsafe impl Send for AlsaOutput {}

    impl AlsaOutput {
        pub fn try_new() -> Option<Self> {
            let candidates = [
                "/usr/lib64/libasound.so.2",
                "/usr/lib/x86_64-linux-gnu/libasound.so.2",
                "libasound.so.2",
            ];
            unsafe {
                let mut handle = std::ptr::null_mut();
                for path in candidates {
                    let c_path = CString::new(path).ok()?;
                    handle = dlopen(c_path.as_ptr(), RTLD_LAZY);
                    if !handle.is_null() {
                        break;
                    }
                }
                if handle.is_null() {
                    return None;
                }

                let sym_open = dlsym(handle, b"snd_pcm_open\0".as_ptr() as *const c_char);
                let sym_params = dlsym(handle, b"snd_pcm_set_params\0".as_ptr() as *const c_char);
                let sym_writei = dlsym(handle, b"snd_pcm_writei\0".as_ptr() as *const c_char);
                let sym_recover = dlsym(handle, b"snd_pcm_recover\0".as_ptr() as *const c_char);
                let sym_close = dlsym(handle, b"snd_pcm_close\0".as_ptr() as *const c_char);
                if sym_open.is_null()
                    || sym_params.is_null()
                    || sym_writei.is_null()
                    || sym_recover.is_null()
                    || sym_close.is_null()
                {
                    return None;
                }

                let open_fn: SndPcmOpenFn = std::mem::transmute(sym_open);
                let params_fn: SndPcmSetParamsFn = std::mem::transmute(sym_params);
                let writei_fn: SndPcmWriteiFn = std::mem::transmute(sym_writei);
                let recover_fn: SndPcmRecoverFn = std::mem::transmute(sym_recover);
                let close_fn: SndPcmCloseFn = std::mem::transmute(sym_close);

                let mut pcm: *mut c_void = std::ptr::null_mut();
                let dev = CString::new("default").ok()?;
                if open_fn(&mut pcm, dev.as_ptr(), 0, 0) < 0 || pcm.is_null() {
                    return None;
                }

                // SND_PCM_FORMAT_S16_LE = 2, SND_PCM_ACCESS_RW_INTERLEAVED = 3
                if params_fn(pcm, 2, 3, 2, SAMPLE_RATE, 1, 80_000) < 0 {
                    close_fn(pcm);
                    return None;
                }

                Some(Self {
                    pcm,
                    writei_fn,
                    recover_fn,
                    close_fn,
                })
            }
        }
    }

    impl PcmOutput for AlsaOutput {
        fn write_interleaved(&mut self, samples: &[i16]) -> bool {
            unsafe {
                let frames = samples.len() / 2;
                let res = (self.writei_fn)(self.pcm, samples.as_ptr() as *const c_void, frames);
                if res < 0 {
                    let rec = (self.recover_fn)(self.pcm, res as c_int, 1);
                    return rec >= 0;
                }
                true
            }
        }
    }

    impl Drop for AlsaOutput {
        fn drop(&mut self) {
            unsafe {
                if !self.pcm.is_null() {
                    (self.close_fn)(self.pcm);
                }
            }
        }
    }

    pub struct SubprocessOutput {
        child: Child,
    }

    impl SubprocessOutput {
        pub fn try_new() -> Option<Self> {
            let commands: &[(&str, &[&str])] = &[
                (
                    "pacat",
                    &[
                        "--playback",
                        "--rate=44100",
                        "--channels=2",
                        "--format=s16le",
                        "--latency-msec=40",
                    ],
                ),
                (
                    "pw-cat",
                    &[
                        "--playback",
                        "--raw",
                        "--rate",
                        "44100",
                        "--channels",
                        "2",
                        "--format",
                        "s16",
                        "-",
                    ],
                ),
                (
                    "aplay",
                    &["-q", "-f", "S16_LE", "-c", "2", "-r", "44100", "-t", "raw", "-"],
                ),
            ];

            let appimage_vars = [
                "LD_LIBRARY_PATH",
                "GIO_MODULE_DIR",
                "GSETTINGS_SCHEMA_DIR",
                "GTK_PATH",
                "GTK_EXE_PREFIX",
                "GTK_DATA_PREFIX",
                "GI_TYPELIB_PATH",
                "GDK_PIXBUF_MODULE_FILE",
                "GTK_IM_MODULE_FILE",
            ];

            for &(bin, args) in commands {
                let mut cmd = Command::new(bin);
                cmd.args(args)
                    .stdin(Stdio::piped())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                for var in appimage_vars {
                    cmd.env_remove(var);
                }

                if let Ok(mut child) = cmd.spawn() {
                    let primer = [0u8; 704];
                    let wrote = child
                        .stdin
                        .as_mut()
                        .map(|s| s.write_all(&primer).is_ok())
                        .unwrap_or(false);
                    std::thread::sleep(std::time::Duration::from_millis(15));
                    if wrote && matches!(child.try_wait(), Ok(None)) {
                        return Some(Self { child });
                    }
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
            None
        }
    }

    impl PcmOutput for SubprocessOutput {
        fn write_interleaved(&mut self, samples: &[i16]) -> bool {
            if !matches!(self.child.try_wait(), Ok(None)) {
                return false;
            }
            if let Some(stdin) = self.child.stdin.as_mut() {
                let bytes = unsafe {
                    std::slice::from_raw_parts(
                        samples.as_ptr() as *const u8,
                        samples.len() * std::mem::size_of::<i16>(),
                    )
                };
                stdin.write_all(bytes).is_ok()
            } else {
                false
            }
        }
    }

    impl Drop for SubprocessOutput {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }
}

// ============================================================================
// WINDOWS AUDIO BACKEND (Native WinMM waveOut API)
// ============================================================================
#[cfg(target_os = "windows")]
fn open_platform_audio_output() -> Option<Box<dyn PcmOutput>> {
    windows_audio::WinMmOutput::try_new().map(|w| Box::new(w) as Box<dyn PcmOutput>)
}

#[cfg(target_os = "windows")]
mod windows_audio {
    use super::{PcmOutput, CHUNK_FRAMES, SAMPLE_RATE};
    use std::ffi::c_void;
    use std::thread;
    use std::time::Duration;

    const WAVE_FORMAT_PCM: u16 = 1;
    const WAVE_MAPPER: u32 = u32::MAX;
    const WHDR_DONE: u32 = 0x00000001;
    const NUM_BUFFERS: usize = 4;

    #[repr(C)]
    struct WaveFormatEx {
        w_format_tag: u16,
        n_channels: u16,
        n_samples_per_sec: u32,
        n_avg_bytes_per_sec: u32,
        n_block_align: u16,
        w_bits_per_sample: u16,
        cb_size: u16,
    }

    #[repr(C)]
    struct WaveHdr {
        lp_data: *mut u8,
        dw_buffer_length: u32,
        dw_bytes_recorded: u32,
        dw_user: usize,
        dw_flags: u32,
        dw_loops: u32,
        lp_next: *mut WaveHdr,
        reserved: usize,
    }

    #[link(name = "winmm")]
    unsafe extern "system" {
        fn waveOutOpen(
            phwo: *mut *mut c_void,
            u_device_id: u32,
            pwfx: *const WaveFormatEx,
            dw_callback: usize,
            dw_instance: usize,
            fdw_open: u32,
        ) -> u32;
        fn waveOutPrepareHeader(hwo: *mut c_void, pwh: *mut WaveHdr, cbwh: u32) -> u32;
        fn waveOutUnprepareHeader(hwo: *mut c_void, pwh: *mut WaveHdr, cbwh: u32) -> u32;
        fn waveOutWrite(hwo: *mut c_void, pwh: *mut WaveHdr, cbwh: u32) -> u32;
        fn waveOutReset(hwo: *mut c_void) -> u32;
        fn waveOutClose(hwo: *mut c_void) -> u32;
    }

    pub struct WinMmOutput {
        hwo: *mut c_void,
        buffers: Vec<Vec<u8>>,
        headers: Vec<Box<WaveHdr>>,
        cur_idx: usize,
    }

    unsafe impl Send for WinMmOutput {}

    impl WinMmOutput {
        pub fn try_new() -> Option<Self> {
            unsafe {
                let fmt = WaveFormatEx {
                    w_format_tag: WAVE_FORMAT_PCM,
                    n_channels: 2,
                    n_samples_per_sec: SAMPLE_RATE,
                    n_avg_bytes_per_sec: SAMPLE_RATE * 4,
                    n_block_align: 4,
                    w_bits_per_sample: 16,
                    cb_size: 0,
                };
                let mut hwo: *mut c_void = std::ptr::null_mut();
                if waveOutOpen(&mut hwo, WAVE_MAPPER, &fmt, 0, 0, 0) != 0 || hwo.is_null() {
                    return None;
                }

                let byte_len = CHUNK_FRAMES * 4;
                let mut buffers = Vec::with_capacity(NUM_BUFFERS);
                let mut headers = Vec::with_capacity(NUM_BUFFERS);

                for _ in 0..NUM_BUFFERS {
                    let mut buf = vec![0u8; byte_len];
                    let mut hdr = Box::new(WaveHdr {
                        lp_data: buf.as_mut_ptr(),
                        dw_buffer_length: byte_len as u32,
                        dw_bytes_recorded: 0,
                        dw_user: 0,
                        dw_flags: WHDR_DONE,
                        dw_loops: 0,
                        lp_next: std::ptr::null_mut(),
                        reserved: 0,
                    });
                    waveOutPrepareHeader(
                        hwo,
                        &mut *hdr as *mut WaveHdr,
                        std::mem::size_of::<WaveHdr>() as u32,
                    );
                    hdr.dw_flags |= WHDR_DONE;
                    buffers.push(buf);
                    headers.push(hdr);
                }

                Some(Self {
                    hwo,
                    buffers,
                    headers,
                    cur_idx: 0,
                })
            }
        }
    }

    impl PcmOutput for WinMmOutput {
        fn write_interleaved(&mut self, samples: &[i16]) -> bool {
            unsafe {
                let idx = self.cur_idx;
                self.cur_idx = (self.cur_idx + 1) % NUM_BUFFERS;

                // Wait until this ring slot finishes playing
                let mut spins = 0;
                while (self.headers[idx].dw_flags & WHDR_DONE) == 0 {
                    thread::sleep(Duration::from_millis(2));
                    spins += 1;
                    if spins > 200 {
                        return false;
                    }
                }

                let src_bytes = std::slice::from_raw_parts(
                    samples.as_ptr() as *const u8,
                    samples.len() * std::mem::size_of::<i16>(),
                );
                let copy_len = src_bytes.len().min(self.buffers[idx].len());
                self.buffers[idx][..copy_len].copy_from_slice(&src_bytes[..copy_len]);
                self.headers[idx].dw_buffer_length = copy_len as u32;
                self.headers[idx].dw_flags &= !WHDR_DONE;

                let res = waveOutWrite(
                    self.hwo,
                    &mut *self.headers[idx] as *mut WaveHdr,
                    std::mem::size_of::<WaveHdr>() as u32,
                );
                res == 0
            }
        }
    }

    impl Drop for WinMmOutput {
        fn drop(&mut self) {
            unsafe {
                if !self.hwo.is_null() {
                    waveOutReset(self.hwo);
                    for hdr in self.headers.iter_mut() {
                        waveOutUnprepareHeader(
                            self.hwo,
                            &mut **hdr as *mut WaveHdr,
                            std::mem::size_of::<WaveHdr>() as u32,
                        );
                    }
                    waveOutClose(self.hwo);
                }
            }
        }
    }
}

#[cfg(not(any(target_os = "linux", target_os = "windows")))]
fn open_platform_audio_output() -> Option<Box<dyn PcmOutput>> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::Command;

    #[test]
    fn bundled_ambient_tracks_decode() {
        let tracks = [
            "rain",
            "storm",
            "wind",
            "waves",
            "fireplace",
            "forest",
            "cafe",
        ];
        for id in tracks {
            let bank = load_bundled_track(id).expect("bundled track should decode");
            let seconds = bank.len() as f32 / SAMPLE_RATE as f32;
            let peak = bank.iter().fold(0.0f32, |m, s| m.max(s.abs()));
            let rms =
                (bank.iter().map(|s| s * s).sum::<f32>() / bank.len() as f32).sqrt();

            assert!(
                (12.0..=40.0).contains(&seconds),
                "{id}: unexpected loop length {seconds}s"
            );
            assert!(bank.iter().all(|s| s.is_finite()), "{id}: non-finite samples");
            assert!((0.05..=1.0).contains(&peak), "{id}: peak {peak} out of range");
            assert!((0.01..=0.6).contains(&rms), "{id}: rms {rms} out of range");
            println!("{id}: {seconds:.1}s peak={peak:.3} rms={rms:.3}");
        }
    }

    #[test]
    #[ignore = "requires a running audio server (PulseAudio/PipeWire/ALSA)"]
    fn enabled_track_opens_audio_output() {
        let mut tracks = HashMap::new();
        tracks.insert(
            "rain".to_string(),
            TrackConfig {
                enabled: true,
                volume: 1.0,
            },
        );
        get_engine().update_ambient(tracks, 0.9, false);
        thread::sleep(std::time::Duration::from_millis(1500));

        let playing = ["pacat", "pw-cat", "aplay"].iter().any(|bin| {
            Command::new("pgrep")
                .args(["-x", bin])
                .status()
                .map(|status| status.success())
                .unwrap_or(false)
        });
        assert!(playing, "no ambient audio stream was opened");
    }
}
