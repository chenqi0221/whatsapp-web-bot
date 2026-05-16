use std::net::TcpStream;
use std::time::Duration;

use crate::services::node_process;
use crate::BACKEND_CHILD;

#[tauri::command]
pub fn check_backend_health() -> String {
    let addr = "127.0.0.1:3003";
    match TcpStream::connect_timeout(
        &addr.parse().unwrap(),
        Duration::from_secs(2),
    ) {
        Ok(_) => "alive".to_string(),
        Err(_) => "dead".to_string(),
    }
}

#[tauri::command]
pub fn restart_backend() -> String {
    log_to_file("[restart_backend] Manual restart requested");

    // Kill existing child process
    if let Ok(mut guard) = BACKEND_CHILD.lock() {
        if let Some(mut child) = guard.take() {
            let pid = child.id();
            let _ = child.kill();
            log_to_file(&format!("[restart_backend] Killed old backend PID={}", pid));
        }
    }

    // Kill any leftover process on port 3003
    #[cfg(windows)]
    {
        let _ = std::process::Command::new("cmd")
            .args([
                "/C",
                "for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :3003') do taskkill /F /PID %a 2>nul",
            ])
            .output();
    }

    std::thread::sleep(std::time::Duration::from_secs(2));

    // Start backend in background thread
    std::thread::spawn(|| {
        node_process::start_backend();
    });

    log_to_file("[restart_backend] Backend restart initiated");
    "restarting".to_string()
}

fn log_to_file(msg: &str) {
    use std::io::Write;
    let exe_parent = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let path = exe_parent.join("startup.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let _ = writeln!(
            f,
            "[{}] {}",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
            msg
        );
    }
}