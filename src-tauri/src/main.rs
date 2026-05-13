// 暂时禁用 windows_subsystem 以便看到错误信息
// #![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;
mod models;

use commands::*;
use services::node_process;

fn main() {
    println!("Starting WhatsApp Bot Tauri application...");
    
    tauri::Builder::default()
        .setup(|app| {
            println!("Tauri setup started");
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                println!("Starting Node.js server...");
                if let Err(e) = node_process::start_node_server(app_handle).await {
                    eprintln!("Failed to start Node.js server: {}", e);
                }
            });
            println!("Tauri setup completed");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            whatsapp::connect,
            whatsapp::disconnect,
            whatsapp::get_status,
            contacts::get_chats,
            contacts::get_contacts,
            contacts::export_contacts,
            broadcast::start_broadcast,
            broadcast::stop_broadcast,
            broadcast::get_broadcast_status,
            system::get_sessions,
            system::save_account,
            system::rename_account,
            system::delete_account,
            system::set_account_level,
            system::get_daily_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
