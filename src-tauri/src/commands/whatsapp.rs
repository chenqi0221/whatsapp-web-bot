use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusResponse {
    pub status: String,
    pub message: Option<String>,
    pub client_id: Option<String>,
    pub qr: Option<String>,
    pub last_active: Option<String>,
    pub current_account: Option<String>,
    pub account_level: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub force_new: bool,
    pub client_id: Option<String>,
    pub account_name: Option<String>,
}

#[tauri::command]
pub async fn connect(request: ConnectRequest) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/connect", get_node_api_url());

    // 转换为 Node.js 后端期望的驼峰命名
    let body = serde_json::json!({
        "forceNew": request.force_new,
        "clientId": request.client_id,
        "accountName": request.account_name,
    });

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn disconnect() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/logout", get_node_api_url());
    
    let response = client
        .post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_status() -> Result<StatusResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/status", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: StatusResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
