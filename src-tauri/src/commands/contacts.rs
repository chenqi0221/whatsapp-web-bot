use crate::services::node_process::get_node_api_url;
use crate::models::contact::{Chat, Contact};

#[tauri::command]
pub async fn get_chats() -> Result<Vec<Chat>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/chats", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let chats: Vec<Chat> = serde_json::from_value(data["chats"].clone())
        .map_err(|e| e.to_string())?;
    Ok(chats)
}

#[tauri::command]
pub async fn get_contacts() -> Result<Vec<Contact>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/contacts-list", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let contacts: Vec<Contact> = serde_json::from_value(data["contacts"].clone())
        .map_err(|e| e.to_string())?;
    Ok(contacts)
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
