use crate::services::node_process::get_node_api_url;

#[tauri::command]
pub async fn send_message_direct(to: String, message: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/send", get_node_api_url());
    let body = serde_json::json!({ "to": to, "message": message });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
