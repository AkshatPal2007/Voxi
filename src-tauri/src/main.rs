#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MediaSession {
    id: String,
    title: String,
    artist: String,
    album: String,
    playing: bool,
    position: f64,
    duration: f64,
    rate: f64,
}

#[cfg(windows)]
fn manager() -> Result<windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager, String> {
    windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .and_then(|op| op.get()).map_err(|e| e.to_string())
}

fn read_media_sessions() -> Result<Vec<MediaSession>, String> {
    #[cfg(windows)]
    {
        use windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus;
        let sessions = manager()?.GetSessions().map_err(|e| e.to_string())?;
        let mut result = Vec::new();
        for session in sessions {
            let read = || -> windows::core::Result<MediaSession> {
                let info = session.TryGetMediaPropertiesAsync()?.get()?;
                let timeline = session.GetTimelineProperties()?;
                let start = timeline.StartTime()?.Duration;
                let playback = session.GetPlaybackInfo()?;
                let playing = playback.PlaybackStatus()? == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
                let rate = playback.PlaybackRate().and_then(|value| value.Value()).unwrap_or(1.0);
                let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs_f64() + 11_644_473_600.0;
                let updated = timeline.LastUpdatedTime()?.UniversalTime as f64 / 10_000_000.0;
                let duration = ((timeline.EndTime()?.Duration - start) as f64 / 10_000_000.0).max(0.0);
                let elapsed = if playing && updated > 11_644_473_600.0 { (now - updated).max(0.0) * rate } else { 0.0 };
                let position = ((timeline.Position()?.Duration - start) as f64 / 10_000_000.0 + elapsed).max(0.0);
                Ok(MediaSession {
                    id: session.SourceAppUserModelId()?.to_string(),
                    title: info.Title()?.to_string(),
                    artist: info.Artist()?.to_string(),
                    album: info.AlbumTitle()?.to_string(),
                    playing,
                    position: if duration > 0.0 { position.min(duration) } else { position },
                    duration,
                    rate,
                })
            };
            if let Ok(item) = read() { result.push(item); }
        }
        Ok(result)
    }
    #[cfg(not(windows))]
    Err("Windows media sessions are available only on Windows.".into())
}

#[tauri::command]
async fn media_sessions() -> Result<Vec<MediaSession>, String> {
    tauri::async_runtime::spawn_blocking(read_media_sessions).await.map_err(|error| error.to_string())?
}

#[tauri::command]
fn media_control(id: String, action: String) -> Result<bool, String> {
    #[cfg(windows)]
    {
        let sessions = manager()?.GetSessions().map_err(|e| e.to_string())?;
        for session in sessions {
            if session.SourceAppUserModelId().map_err(|e| e.to_string())?.to_string() != id { continue; }
            let operation = match action.as_str() {
                "toggle" => session.TryTogglePlayPauseAsync(),
                "next" => session.TrySkipNextAsync(),
                "previous" => session.TrySkipPreviousAsync(),
                _ => return Err("Unsupported media action".into()),
            };
            return operation.and_then(|op| op.get()).map_err(|e| e.to_string());
        }
        Err("This player is no longer available.".into())
    }
    #[cfg(not(windows))]
    { let _ = (id, action); Err("Windows only".into()) }
}

fn main() {
    // Read-only diagnostics: run target/debug/voxi.exe --probe from PowerShell.
    if std::env::args().any(|a| a == "--probe") {
        match read_media_sessions() {
            Ok(sessions) => {
                println!("Windows media bridge OK; {} session(s)", sessions.len());
                for session in sessions {
                    println!("{} | {} | {} | playing={} | {}/{}s", session.id, session.title, session.artist, session.playing, session.position, session.duration);
                }
            }
            Err(error) => { eprintln!("Media bridge failed: {error}"); std::process::exit(1); }
        }
        return;
    }
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![media_sessions, media_control])
        .run(tauri::generate_context!())
        .expect("Could not start Voxi");
}
