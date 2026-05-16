use std::io::{BufRead, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::thread;
use std::time::Duration;

use crate::BACKEND_CHILD;

const NODE_PORT: u16 = 3003;
const MAX_WAIT_SECS: u64 = 60;
const MAX_RETRY: u32 = 3;

fn get_log_path() -> PathBuf {
    let exe_parent = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."));
    exe_parent.join("startup.log")
}

fn log(msg: &str) {
    let path = get_log_path();
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
    {
        let ts = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(f, "[{}] {}", ts, msg);
    }
}

fn log_ok(msg: &str) {
    log(&format!("[OK] {}", msg));
}

fn log_err(msg: &str) {
    log(&format!("[ERR] {}", msg));
}

fn find_node_exe(src_node_dir: &Path) -> Option<PathBuf> {
    let portable_node = src_node_dir.join("node.exe");
    if portable_node.exists() {
        log_ok(&format!("Found portable node.exe: {}", portable_node.display()));
        return Some(portable_node);
    }
    log("No portable node.exe found, will use system node");
    None
}

fn find_chromium(src_node_dir: &Path) -> Option<PathBuf> {
    let portable_chrome = src_node_dir
        .join(".chromium")
        .join("chrome-win64")
        .join("chrome.exe");
    if portable_chrome.exists() {
        log_ok(&format!(
            "Found portable Chromium: {}",
            portable_chrome.display()
        ));
        return Some(portable_chrome);
    }
    log("No portable Chromium found");
    None
}

fn src_node_dir_from_exe() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let dir = exe_path.parent()?.join("src-node");
    log(&format!(
        "Checking exe-relative src-node: {}",
        dir.display()
    ));
    if dir.join("index.js").exists() {
        Some(dir)
    } else {
        log_err(&format!("src-node/index.js NOT found at: {}", dir.display()));
        None
    }
}

fn src_node_dir_dev() -> Option<PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let from_cwd = cwd.parent()?.join("src-node");
    if from_cwd.join("index.js").exists() {
        log_ok(&format!("Found src-node (dev-cwd): {}", from_cwd.display()));
        return Some(from_cwd);
    }
    let exe = std::env::current_exe().ok()?;
    let from_exe = exe.parent()?.parent()?.join("src-node");
    if from_exe.join("index.js").exists() {
        log_ok(&format!("Found src-node (dev-exe): {}", from_exe.display()));
        return Some(from_exe);
    }
    None
}

fn find_src_node() -> Option<PathBuf> {
    log("Searching for src-node directory...");
    if let Some(dir) = src_node_dir_from_exe() {
        log_ok(&format!("Found src-node (portable): {}", dir.display()));
        return Some(dir);
    }
    if let Some(dir) = src_node_dir_dev() {
        log_ok(&format!("Found src-node (dev): {}", dir.display()));
        return Some(dir);
    }
    log_err("Cannot find src-node directory!");
    None
}

#[cfg(windows)]
fn kill_port_3003() {
    let out = Command::new("cmd")
        .args([
            "/C",
            "for /f \"tokens=5\" %a in ('netstat -ano ^| findstr :3003') do taskkill /F /PID %a 2>nul",
        ])
        .output();
    match out {
        Ok(o) => {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() {
                log(&format!("Port 3003 cleanup: {}", s));
            }
        }
        _ => {}
    }
}

fn wait_for_backend(addr: &str, max_secs: u64) -> bool {
    log(&format!(
        "Waiting for backend at {} (max {}s)...",
        addr, max_secs
    ));
    for i in 0..max_secs {
        if TcpStream::connect(addr).is_ok() {
            log_ok(&format!("Backend ready at {} after {}s", addr, i));
            return true;
        }
        thread::sleep(Duration::from_secs(1));
        if i % 5 == 4 {
            log(&format!("Still waiting... {}s elapsed", i + 1));
        }
    }
    log_err(&format!(
        "Backend NOT ready at {} after {}s",
        addr, max_secs
    ));
    false
}

fn build_node_cmd(
    src_node_dir: &Path,
    node_exe: &Option<PathBuf>,
    chromium: &Option<PathBuf>,
) -> Command {
    let node_cmd = node_exe
        .as_ref()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| "node".to_string());

    let index_js = src_node_dir.join("index.js");

    log(&format!("Node binary: {}", node_cmd));
    log(&format!("Entry point: {}", index_js.display()));
    log(&format!("Working dir: {}", src_node_dir.display()));

    let mut cmd = Command::new(&node_cmd);
    cmd.arg(&index_js)
        .current_dir(src_node_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(ref chrome) = chromium {
        let chrome_path = chrome.to_string_lossy().to_string();
        cmd.env("PUPPETEER_EXECUTABLE_PATH", &chrome_path);
        log(&format!("PUPPETEER_EXECUTABLE_PATH={}", chrome_path));
    } else {
        log("PUPPETEER_EXECUTABLE_PATH not set (no portable chromium)");
    }
    cmd.env("WA_AUTH_PATH", "./.wwebjs_auth_v2");
    cmd.env("DB_PATH", "./data/bot.db");
    cmd.env("LOG_FILE_PATH", "./logs/app.log");

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    cmd
}

fn spawn_and_wait(
    src_node_dir: &Path,
    node_exe: &Option<PathBuf>,
    chromium: &Option<PathBuf>,
    attempt: u32,
) -> Option<Child> {
    log(&format!(
        "Spawning Node.js (attempt {}/{})...",
        attempt + 1,
        MAX_RETRY
    ));

    let mut cmd = build_node_cmd(src_node_dir, node_exe, chromium);

    let mut child = match cmd.spawn() {
        Ok(c) => {
            let pid = c.id();
            log_ok(&format!("Node.js spawned with PID={}", pid));
            c
        }
        Err(e) => {
            log_err(&format!("Failed to spawn Node.js: {}", e));
            return None;
        }
    };

    let addr = format!("127.0.0.1:{}", NODE_PORT);
    let ready = wait_for_backend(&addr, MAX_WAIT_SECS);

    if ready {
        log_ok("Node.js backend started successfully");
        Some(child)
    } else {
        let pid = child.id();
        log_err(&format!(
            "Backend port {} not ready in {}s, killing PID={}",
            NODE_PORT, MAX_WAIT_SECS, pid
        ));
        let _ = child.kill();
        #[cfg(windows)]
        kill_port_3003();
        None
    }
}

pub fn start_backend() {
    log("=== Backend startup sequence start ===");

    // 始终先清理残留端口，避免旧进程干扰检测
    #[cfg(windows)]
    kill_port_3003();
    thread::sleep(Duration::from_millis(500));

    let src_node_dir = match find_src_node() {
        Some(d) => d,
        None => {
            log_err("FATAL: Cannot find src-node directory!");
            return;
        }
    };

    let node_exe = find_node_exe(&src_node_dir);
    let chromium = find_chromium(&src_node_dir);

    for attempt in 0..MAX_RETRY {
        if attempt > 0 {
            #[cfg(windows)]
            kill_port_3003();
            thread::sleep(Duration::from_secs(3));
        }
        if let Some(mut child) = spawn_and_wait(&src_node_dir, &node_exe, &chromium, attempt) {
            if let Some(stdout) = child.stdout.take() {
                thread::spawn(move || {
                    let reader = std::io::BufReader::new(stdout);
                    for line in reader.lines() {
                        if let Ok(l) = line {
                            log(&format!("[Node.js] {}", l));
                        }
                    }
                });
            }
            if let Some(stderr) = child.stderr.take() {
                thread::spawn(move || {
                    let reader = std::io::BufReader::new(stderr);
                    for line in reader.lines() {
                        if let Ok(l) = line {
                            log(&format!("[Node.js ERR] {}", l));
                        }
                    }
                });
            }

            if let Ok(mut guard) = BACKEND_CHILD.lock() {
                *guard = Some(child);
            }

            log_ok("=== Backend startup sequence complete ===");
            return;
        }
    }

    log_err(&format!(
        "=== Backend startup FAILED after {} attempts ===",
        MAX_RETRY
    ));
}

pub fn get_node_api_url() -> String {
    format!("http://127.0.0.1:{}", NODE_PORT)
}