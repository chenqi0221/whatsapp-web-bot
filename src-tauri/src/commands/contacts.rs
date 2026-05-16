use crate::services::node_process::get_node_api_url;
use crate::models::contact::{Chat, Contact};

#[tauri::command]
pub async fn get_chats() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/chats", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_contacts() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/contacts-list", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn export_contacts() -> Result<String, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/export-contacts", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let csv = response.text().await.map_err(|e| e.to_string())?;
    Ok(csv)
}

#[tauri::command]
pub async fn get_unchatted_contacts() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/contacts/unchatted", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_profile() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/profile", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
