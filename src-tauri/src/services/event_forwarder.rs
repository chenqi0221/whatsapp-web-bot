use tauri::Manager;

pub fn forward_event(app_handle: tauri::AppHandle, event_type: &str, data: serde_json::Value) {
    app_handle.emit_all(event_type, data).unwrap_or_default();
}
