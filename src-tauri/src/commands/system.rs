use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub phone: Option<String>,
    pub level: Option<String>,
    pub status: Option<String>,
    pub daily_sent: Option<i64>,
    pub daily_limit: Option<i64>,
    pub total_sent: Option<i64>,
    pub total_failed: Option<i64>,
    pub last_active: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountListResponse {
    pub success: bool,
    pub accounts: Option<Vec<Account>>,
    pub total: Option<i64>,
    pub sessions: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountUpdateRequest {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub level: Option<String>,
}

#[tauri::command]
pub async fn get_sessions() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts", get_node_api_url());
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_account_detail(id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/{}", get_node_api_url(), id);
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn search_accounts(query: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/search?q={}", get_node_api_url(), query);
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn save_account(client_id: String, name: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/save", get_node_api_url());
    let body = serde_json::json!({ "clientId": client_id, "name": name });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn create_account(name: String, phone: Option<String>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts", get_node_api_url());
    let body = serde_json::json!({ "name": name, "phone": phone });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn rename_account(id: String, name: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/rename", get_node_api_url());
    let body = serde_json::json!({ "id": id, "name": name });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn update_account(id: String, name: Option<String>, phone: Option<String>, level: Option<String>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/{}", get_node_api_url(), id);
    let body = serde_json::json!({ "name": name, "phone": phone, "level": level });
    let response = client.put(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn delete_account(id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/{}", get_node_api_url(), id);
    let response = client.delete(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn batch_delete_accounts(ids: Vec<String>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/batch-delete", get_node_api_url());
    let body = serde_json::json!({ "ids": ids });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn set_account_level(id: String, level: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/{}/level", get_node_api_url(), id);
    let body = serde_json::json!({ "level": level });
    let response = client.put(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_account_stats(id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/accounts/{}/stats", get_node_api_url(), id);
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_account_history(id: String, limit: Option<i64>) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let limit = limit.unwrap_or(20);
    let url = format!("{}/api/accounts/{}/history?limit={}", get_node_api_url(), id, limit);
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_daily_stats() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/daily-stats", get_node_api_url());
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn global_set_account_level(level: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/set-account-level", get_node_api_url());
    let body = serde_json::json!({ "level": level });
    let response = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}