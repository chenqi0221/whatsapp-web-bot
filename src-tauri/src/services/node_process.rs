use std::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::Manager;

static NODE_PORT: Lazy<Mutex<u16>> = Lazy::new(|| Mutex::new(3003));

pub async fn start_node_server(app_handle: tauri::AppHandle) -> Result<(), String> {
    let possible_paths = [
        // 1. 便携版：与 exe 同目录的 src-node
        std::env::current_exe().ok().and_then(|exe| {
            exe.parent().map(|exe_dir| exe_dir.join("src-node").join("index.js"))
        }),
        // 2. 开发模式：从 cwd (src-tauri) 的父目录找
        std::env::current_dir().ok().and_then(|cwd| {
            cwd.parent().map(|parent| parent.join("src-node").join("index.js"))
        }),
        // 3. release 构建：从 target/release 向上两级到项目根
        std::env::current_exe().ok().and_then(|exe| {
            exe.parent().and_then(|dir| {
                dir.parent().map(|project_root| project_root.join("src-node").join("index.js"))
            })
        }),
    ];

    let mut node_path = None;
    let mut src_node_dir = None;

    for path_option in &possible_paths {
        if let Some(ref path) = path_option {
            println!("Checking path: {:?}", path);
            if path.exists() {
                println!("Found src-node at: {:?}", path);
                node_path = Some(path.clone());
                src_node_dir = path.parent().map(|p| p.to_path_buf());
                break;
            }
        }
    }

    let node_path = node_path.ok_or_else(|| {
        let tried: Vec<String> = possible_paths.iter()
            .filter_map(|p| p.as_ref().map(|p| p.to_string_lossy().to_string()))
            .collect();
        format!("Cannot find src-node/index.js! Tried: {:?}", tried)
    })?;

    let src_node_dir = src_node_dir.ok_or("Cannot determine src-node directory")?;

    println!("Using Node.js path: {:?}", node_path);
    println!("Using src-node directory: {:?}", src_node_dir);

    // 启动 Node.js 子进程，从 src-node 目录运行，避免读取父目录的 package.json
    let mut cmd = tokio::process::Command::new("node");
    cmd.arg(node_path.to_string_lossy().to_string())
        .current_dir(&src_node_dir)  // 关键：从 src-node 目录运行
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    
    let mut child = cmd
        .spawn()
        .map_err(|e: std::io::Error| e.to_string())?;

    // 读取 stdout
    if let Some(stdout) = child.stdout.take() {
        let app_handle_clone = app_handle.clone();
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                println!("[Node.js] {}", line);
                // 如果看到 API server running，通知前端
                if line.contains("API server running") {
                    app_handle_clone.emit_all("node-ready", {}).unwrap_or_default();
                }
            }
        });
    }

    // 读取 stderr
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            use tokio::io::{AsyncBufReadExt, BufReader};
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                eprintln!("[Node.js ERROR] {}", line);
            }
        });
    }

    // 等待一段时间让服务器启动
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    
    println!("Node.js process started with PID: {:?}", child.id());

    Ok(())
}

pub fn get_node_api_url() -> String {
    let port = NODE_PORT.lock().unwrap();
    format!("http://localhost:{}", *port)
}
