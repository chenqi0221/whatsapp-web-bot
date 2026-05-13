use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub last_used: Option<String>,
}

#[tauri::command]
pub async fn get_sessions() -> Result<Vec<Account>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/sessions", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let sessions: Vec<Account> = serde_json::from_value(data["sessions"].clone())
        .map_err(|e| e.to_string())?;
    Ok(sessions)
}

#[tauri::command]
pub async fn save_account(client_id: String, name: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/save", get_node_api_url());
    
    let body = serde_json::json!({
        "clientId": client_id,
        "name": name
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
pub async fn rename_account(id: String, name: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/rename", get_node_api_url());
    
    let body = serde_json::json!({
        "id": id,
        "name": name
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
pub async fn delete_account(id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/delete", get_node_api_url());
    
    let body = serde_json::json!({ "id": id });
    
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
pub async fn set_account_level(level: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/set-account-level", get_node_api_url());
    
    let body = serde_json::json!({ "level": level });
    
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
pub async fn get_daily_stats() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/daily-stats", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
