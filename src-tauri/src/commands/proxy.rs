use serde_json::Value;
use crate::services::node_process::get_node_api_url;

#[tauri::command]
pub async fn proxy_get(path: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", get_node_api_url(), path);
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn proxy_post(path: String, body: Option<Value>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", get_node_api_url(), path);
    let mut req = client.post(&url);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let response = req.send().await.map_err(|e| e.to_string())?;
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn proxy_put(path: String, body: Option<Value>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", get_node_api_url(), path);
    let mut req = client.put(&url);
    if let Some(b) = body {
        req = req.json(&b);
    }
    let response = req.send().await.map_err(|e| e.to_string())?;
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn proxy_delete(path: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", get_node_api_url(), path);
    let response = client.delete(&url).send().await.map_err(|e| e.to_string())?;
    let data: Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}