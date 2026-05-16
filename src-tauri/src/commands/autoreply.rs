use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoreplyRule {
    pub keyword: String,
    pub reply: String,
    pub match_type: Option<String>,
}

#[tauri::command]
pub async fn get_autoreply_rules() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/auto-reply", get_node_api_url());
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn add_autoreply_rule(keyword: String, reply: String, match_type: Option<String>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/auto-reply", get_node_api_url());
    let body = serde_json::json!({ "keyword": keyword, "reply": reply, "matchType": match_type });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn toggle_autoreply(enabled: bool) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/auto-reply/toggle", get_node_api_url());
    let body = serde_json::json!({ "enabled": enabled });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
