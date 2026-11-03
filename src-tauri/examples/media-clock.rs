// Read-only diagnostics for player timing. No track titles or artists are printed.
use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

fn main() -> windows::core::Result<()> {
    let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()?.get()?;
    for session in manager.GetSessions()? {
        let playback = session.GetPlaybackInfo()?;
        let timeline = session.GetTimelineProperties()?;
        println!("{}: status={:?}, rate={:?}, position={}s, updated={}",
            session.SourceAppUserModelId()?, playback.PlaybackStatus()?,
            playback.PlaybackRate().and_then(|rate| rate.Value()),
            timeline.Position()?.Duration as f64 / 10_000_000.0,
            timeline.LastUpdatedTime()?.UniversalTime);
    }
    Ok(())
}
