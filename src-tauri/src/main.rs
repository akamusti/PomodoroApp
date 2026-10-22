// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Prevent WebKitWebProcess crash with DMA-BUF renderer on modern Linux (Fedora, Mesa, NVIDIA, Wayland)
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            // SAFETY: Setting environment variable before any threads or WebKit/GTK runtimes are initialized
            unsafe {
                std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            }
        }
    }

    app_lib::run();
}
