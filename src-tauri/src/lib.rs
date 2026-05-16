use std::process::Child;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::{Manager, Emitter};

pub mod commands;
pub mod services;
pub mod models;

use commands::*;
use services::node_process;

pub static BACKEND_CHILD: Lazy<Mutex<Option<Child>>> = Lazy::new(|| Mutex::new(None));

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            std::thread::spawn(move || {
                node_process::start_backend();
                let _ = app_handle.emit("node-ready", {});
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            whatsapp::connect,
            whatsapp::disconnect,
            whatsapp::get_status,
            contacts::get_chats,
            contacts::get_contacts,
            contacts::export_contacts,
            contacts::get_unchatted_contacts,
            contacts::get_profile,
            broadcast::start_broadcast,
            broadcast::stop_broadcast,
            broadcast::get_broadcast_status,
            system::get_sessions,
            system::save_account,
            system::rename_account,
            system::delete_account,
            system::set_account_level,
            system::get_daily_stats,
            system::create_account,
            system::search_accounts,
            system::get_account_detail,
            system::update_account,
            system::batch_delete_accounts,
            system::get_account_stats,
            system::get_account_history,
            system::global_set_account_level,
            backend::check_backend_health,
            backend::restart_backend,
            proxy::proxy_get,
            proxy::proxy_post,
            proxy::proxy_put,
            proxy::proxy_delete,
            autoreply::get_autoreply_rules,
            autoreply::add_autoreply_rule,
            autoreply::toggle_autoreply,
            schedule::get_scheduled_tasks,
            schedule::create_scheduled_task,
            chat::send_message_direct,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                log::info!("App exiting, cleaning up backend...");
                if let Ok(mut guard) = BACKEND_CHILD.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}