use crate::services::node_process::get_node_api_url;
use crate::models::broadcast::{BroadcastProgress, BroadcastOptions};

#[tauri::command]
pub async fn start_broadcast(options: BroadcastOptions) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/broadcast", get_node_api_url());
    
    println!("[start_broadcast] Starting broadcast with options: {:?}", options);
    
    let response = client
        .post(&url)
        .json(&options)
        .send()
        .await
        .map_err(|e| {
            println!("[start_broadcast] Request failed: {}", e);
            e.to_string()
        })?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| {
        println!("[start_broadcast] JSON parse failed: {}", e);
        e.to_string()
    })?;
    
    println!("[start_broadcast] Response: {:?}", data);
    Ok(data)
}

#[tauri::command]
pub async fn stop_broadcast() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/broadcast/stop", get_node_api_url());
    
    let response = client
        .post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_broadcast_status() -> Result<BroadcastProgress, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/broadcast-status", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: BroadcastProgress = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
