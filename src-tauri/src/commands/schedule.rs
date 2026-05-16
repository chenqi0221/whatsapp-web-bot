use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;

#[tauri::command]
pub async fn get_scheduled_tasks() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/scheduled-tasks", get_node_api_url());
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn create_scheduled_task(
    name: String,
    task_type: String,
    daily_time: Option<String>,
    time: Option<String>,
    message: String,
    target: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/scheduled-tasks", get_node_api_url());
    let body = serde_json::json!({
        "name": name,
        "type": task_type,
        "dailyTime": daily_time,
        "time": time,
        "message": message,
        "target": target,
    });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
