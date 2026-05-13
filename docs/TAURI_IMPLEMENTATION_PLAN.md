# WhatsApp Bot Tauri 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有 Node.js + Express + 浏览器前端架构重构为 Tauri 桌面应用，保持所有现有功能正常。

**Architecture:** Tauri (Rust) 作为桌面应用框架管理 Node.js 子进程，Vue 3 作为前端通过 Tauri Commands 与 Rust 通信，Node.js 子进程运行 WhatsApp Web.js 并提供 HTTP API。

**Tech Stack:** Vue 3 + TypeScript + Vite + Element Plus + Pinia + Tauri (Rust) + Node.js + Express

---

## Phase 1: 初始化 Tauri 项目结构

### Task 1: 创建根 package.json 和 Vite 配置

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`

- [ ] **Step 1: 创建根 package.json**

```json
{
  "name": "whatsapp-bot-tauri",
  "version": "3.0.0",
  "description": "WhatsApp Bot Desktop App - Tauri Edition",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.0",
    "pinia": "^2.1.0",
    "element-plus": "^2.5.0",
    "@element-plus/icons-vue": "^2.3.0",
    "@tauri-apps/api": "^1.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "typescript": "^5.3.0",
    "vue-tsc": "^1.8.0",
    "vite": "^5.0.0",
    "@tauri-apps/cli": "^1.5.0"
  }
}
```

- [ ] **Step 2: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  build: {
    target: 'esnext',
    minify: 'terser'
  }
})
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WhatsApp Bot</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: 安装依赖**

Run: `npm install`
Expected: 依赖安装成功

---

### Task 2: 初始化 Tauri Rust 项目

**Files:**
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`

- [ ] **Step 1: 创建 src-tauri/Cargo.toml**

```toml
[package]
name = "whatsapp-bot-tauri"
version = "3.0.0"
description = "WhatsApp Bot Desktop App"
authors = ["you"]
license = "MIT"
repository = ""
edition = "2021"
rust-version = "1.70"

[build-dependencies]
tauri-build = { version = "1.5.0", features = [] }

[dependencies]
tauri = { version = "1.5.0", features = ["shell-open", "http-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["full"] }
reqwest = { version = "0.11", features = ["json"] }
once_cell = "1.19"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 2: 创建 src-tauri/tauri.conf.json**

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      },
      "http": {
        "all": true,
        "request": true
      },
      "process": {
        "all": true
      }
    },
    "windows": [
      {
        "title": "WhatsApp Bot",
        "width": 1400,
        "height": 900,
        "resizable": true,
        "fullscreen": false,
        "center": true,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' http://localhost:*; img-src 'self' data:; style-src 'self' 'unsafe-inline'"
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.whatsappbot.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    }
  }
}
```

- [ ] **Step 3: 创建 src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 4: 创建 src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod services;
mod models;

use commands::*;
use services::node_process;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // 启动 Node.js 子进程
            let app_handle = app.handle();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = node_process::start_node_server(app_handle).await {
                    eprintln!("Failed to start Node.js server: {}", e);
                }
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
```

- [ ] **Step 5: 安装 Rust 依赖**

Run: `cd src-tauri && cargo check`
Expected: 编译检查通过

---

### Task 3: 创建 Rust 模块结构

**Files:**
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/whatsapp.rs`
- Create: `src-tauri/src/commands/contacts.rs`
- Create: `src-tauri/src/commands/broadcast.rs`
- Create: `src-tauri/src/commands/system.rs`
- Create: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/node_process.rs`
- Create: `src-tauri/src/services/event_forwarder.rs`
- Create: `src-tauri/src/models/mod.rs`
- Create: `src-tauri/src/models/contact.rs`
- Create: `src-tauri/src/models/broadcast.rs`

- [ ] **Step 1: 创建 commands/mod.rs**

```rust
pub mod whatsapp;
pub mod contacts;
pub mod broadcast;
pub mod system;
```

- [ ] **Step 2: 创建 services/mod.rs**

```rust
pub mod node_process;
pub mod event_forwarder;
```

- [ ] **Step 3: 创建 models/mod.rs**

```rust
pub mod contact;
pub mod broadcast;
```

- [ ] **Step 4: 创建 models/contact.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chat {
    pub id: String,
    pub name: String,
    pub is_group: bool,
    pub last_message: Option<String>,
    pub participants: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub number: String,
    pub lid: Option<String>,
}
```

- [ ] **Step 5: 创建 models/broadcast.rs**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastProgress {
    pub running: bool,
    pub current: i32,
    pub total: i32,
    pub results: Vec<BroadcastResult>,
    pub message: Option<String>,
    pub interval: i32,
    pub daily_sent: i32,
    pub daily_limit: i32,
    pub remaining: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastResult {
    pub name: String,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BroadcastOptions {
    pub message: Vec<String>,
    pub interval: i32,
    pub random_interval: bool,
    pub randomize_msg: bool,
    pub length_randomize: bool,
    pub simulate_typing: bool,
    pub simulate_mouse: bool,
    pub respect_hours: bool,
    pub random_pause: bool,
    pub exclude_groups: bool,
    pub personalize: bool,
    pub target_type: String,
    pub manual_numbers: Option<String>,
    pub account_level: String,
}
```

---

## Phase 2: 迁移 Node.js 业务逻辑到子进程

### Task 4: 创建 src-node 子进程入口和 API 服务器

**Files:**
- Create: `src-node/package.json`
- Create: `src-node/index.js`
- Create: `src-node/api-server.js`

- [ ] **Step 1: 创建 src-node/package.json**

```json
{
  "name": "whatsapp-bot-node",
  "version": "3.0.0",
  "description": "WhatsApp Bot Node.js Backend Service",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^5.2.1",
    "socket.io": "^4.8.3",
    "whatsapp-web.js": "github:wwebjs/whatsapp-web.js#main",
    "puppeteer": "^24.41.0",
    "qrcode": "^1.5.3",
    "cors": "^2.8.5"
  }
}
```

- [ ] **Step 2: 创建 src-node/index.js**

```javascript
const { startApiServer } = require('./api-server');

const PORT = process.env.NODE_PORT || 3003;

async function main() {
    console.log('Starting WhatsApp Bot Node.js service...');
    
    try {
        const server = await startApiServer(PORT);
        console.log(`API server running on port ${PORT}`);
        
        // 通知父进程已就绪
        if (process.send) {
            process.send({ type: 'ready', port: PORT });
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();
```

- [ ] **Step 3: 创建 src-node/api-server.js**

```javascript
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { createStatusRoutes } = require('./routes/status');
const { createContactsRoutes } = require('./routes/contacts');
const { createBroadcastRoutes } = require('./routes/broadcast');
const { getClientRef, getClientState } = require('./services/client-manager');
const { logout, initClient } = require('./services/client-manager');

async function startApiServer(port) {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server, {
        cors: { origin: '*' }
    });

    app.use(cors());
    app.use(express.json({ limit: '50mb' }));

    const clientRef = getClientRef();
    const clientState = getClientState();

    // 注册路由
    createStatusRoutes(app, clientRef, clientState, io, logout, initClient);
    createContactsRoutes(app, clientRef, clientState);
    createBroadcastRoutes(app, clientRef, clientState, io);

    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            resolve(server);
        });
        server.on('error', reject);
    });
}

module.exports = { startApiServer };
```

---

### Task 5: 复用现有业务逻辑到 src-node

**Files:**
- Copy: `src/services/*` → `src-node/services/`
- Copy: `src/simulators/*` → `src-node/simulators/`
- Copy: `src/server/routes/*` → `src-node/routes/`
- Copy: `config/*` → `src-node/config/`

- [ ] **Step 1: 复制服务层代码**

复制以下文件到 src-node/services/:
- client-manager.js
- anti-detection.js
- rate-limiter.js
- message-randomizer.js
- broadcast.js
- session-manager.js
- account-store.js

- [ ] **Step 2: 复制模拟器代码**

复制以下文件到 src-node/simulators/:
- typing.js
- mouse.js
- scroll.js
- behavior.js

- [ ] **Step 3: 复制路由代码**

复制以下文件到 src-node/routes/:
- status.js
- contacts.js
- broadcast.js

- [ ] **Step 4: 复制配置**

复制以下文件到 src-node/config/:
- default.js
- rate-limits.js

- [ ] **Step 5: 修复路径引用**

修改所有复制后的文件中的 require 路径，确保路径正确。

---

### Task 6: 实现 Rust Node.js 子进程管理

**Files:**
- Create: `src-tauri/src/services/node_process.rs`

- [ ] **Step 1: 创建 node_process.rs**

```rust
use std::process::{Command, Stdio};
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tauri::api::process::{Command as TauriCommand, CommandEvent};
use tauri::Manager;

static NODE_PORT: Lazy<Mutex<u16>> = Lazy::new(|| Mutex::new(3003));

pub async fn start_node_server(app_handle: tauri::AppHandle) -> Result<(), String> {
    let node_path = std::env::current_dir()
        .map_err(|e| e.to_string())?
        .join("src-node")
        .join("index.js");

    let (mut rx, _child) = TauriCommand::new_sidecar("node")
        .map_err(|e| e.to_string())?
        .args(&[node_path.to_string_lossy().to_string()])
        .spawn()
        .map_err(|e| e.to_string())?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stdout(line) => {
                println!("Node: {}", line);
                if line.contains("API server running") {
                    // 通知前端 Node.js 已就绪
                    app_handle.emit_all("node-ready", {}).unwrap();
                }
            }
            CommandEvent::Stderr(line) => {
                eprintln!("Node err: {}", line);
            }
            CommandEvent::Error(e) => {
                eprintln!("Node process error: {}", e);
            }
            CommandEvent::Terminated(payload) => {
                println!("Node process terminated: {:?}", payload);
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

pub fn get_node_api_url() -> String {
    let port = NODE_PORT.lock().unwrap();
    format!("http://localhost:{}", *port)
}
```

---

## Phase 3: 开发 Rust 后端 Commands

### Task 7: 实现 WhatsApp Commands

**Files:**
- Create: `src-tauri/src/commands/whatsapp.rs`

- [ ] **Step 1: 创建 whatsapp.rs**

```rust
use serde::{Deserialize, Serialize};
use tauri::State;
use reqwest;
use crate::services::node_process::get_node_api_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusResponse {
    pub status: String,
    pub qr: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub force_new: bool,
    pub client_id: Option<String>,
    pub account_name: Option<String>,
}

#[tauri::command]
pub async fn connect(request: ConnectRequest) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/connect", get_node_api_url());
    
    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn disconnect() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/logout", get_node_api_url());
    
    let response = client
        .post(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_status() -> Result<StatusResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/status", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: StatusResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
```

---

### Task 8: 实现 Contacts Commands

**Files:**
- Create: `src-tauri/src/commands/contacts.rs`

- [ ] **Step 1: 创建 contacts.rs**

```rust
use serde::{Deserialize, Serialize};
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
```

---

### Task 9: 实现 Broadcast Commands

**Files:**
- Create: `src-tauri/src/commands/broadcast.rs`

- [ ] **Step 1: 创建 broadcast.rs**

```rust
use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;
use crate::models::broadcast::{BroadcastProgress, BroadcastOptions};

#[tauri::command]
pub async fn start_broadcast(options: BroadcastOptions) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/broadcast", get_node_api_url());
    
    let response = client
        .post(&url)
        .json(&options)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
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
```

---

### Task 10: 实现 System Commands

**Files:**
- Create: `src-tauri/src/commands/system.rs`

- [ ] **Step 1: 创建 system.rs**

```rust
use serde::{Deserialize, Serialize};
use crate::services::node_process::get_node_api_url;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub last_used: Option<String>,
}

#[tauri::command]
pub async fn get_sessions() -> Result<Vec<Account>, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/sessions", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let sessions: Vec<Account> = serde_json::from_value(data["sessions"].clone())
        .map_err(|e| e.to_string())?;
    Ok(sessions)
}

#[tauri::command]
pub async fn save_account(client_id: String, name: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/save", get_node_api_url());
    
    let body = serde_json::json!({
        "clientId": client_id,
        "name": name
    });
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn rename_account(id: String, name: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/rename", get_node_api_url());
    
    let body = serde_json::json!({
        "id": id,
        "name": name
    });
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn delete_account(id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/account/delete", get_node_api_url());
    
    let body = serde_json::json!({ "id": id });
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn set_account_level(level: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/set-account-level", get_node_api_url());
    
    let body = serde_json::json!({ "level": level });
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

#[tauri::command]
pub async fn get_daily_stats() -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let url = format!("{}/api/daily-stats", get_node_api_url());
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let data: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}
```

---

## Phase 4: 重构前端为 Vue 3

### Task 11: 创建 Vue 3 入口和基础结构

**Files:**
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/router/index.ts`
- Create: `src/stores/whatsapp.ts`
- Create: `src/stores/broadcast.ts`
- Create: `src/api/tauri.ts`

- [ ] **Step 1: 创建 src/main.ts**

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'

const app = createApp(App)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')
```

- [ ] **Step 2: 创建 src/App.vue**

```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
}
</style>
```

- [ ] **Step 3: 创建 src/router/index.ts**

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import MainLayout from '@/layouts/MainLayout.vue'
import Dashboard from '@/views/Dashboard.vue'
import Broadcast from '@/views/Broadcast.vue'
import Contacts from '@/views/Contacts.vue'
import Settings from '@/views/Settings.vue'

const routes = [
    {
        path: '/',
        component: MainLayout,
        children: [
            { path: '', name: 'Dashboard', component: Dashboard },
            { path: 'broadcast', name: 'Broadcast', component: Broadcast },
            { path: 'contacts', name: 'Contacts', component: Contacts },
            { path: 'settings', name: 'Settings', component: Settings },
        ]
    }
]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router
```

- [ ] **Step 4: 创建 src/api/tauri.ts**

```typescript
import { invoke } from '@tauri-apps/api'

// WhatsApp API
export const whatsappApi = {
    connect: (forceNew: boolean, clientId?: string, accountName?: string) =>
        invoke('connect', { request: { force_new: forceNew, client_id: clientId, account_name: accountName } }),
    disconnect: () => invoke('disconnect'),
    getStatus: () => invoke('get_status'),
}

// Contacts API
export const contactsApi = {
    getChats: () => invoke('get_chats'),
    getContacts: () => invoke('get_contacts'),
    exportContacts: () => invoke('export_contacts'),
}

// Broadcast API
export const broadcastApi = {
    start: (options: any) => invoke('start_broadcast', { options }),
    stop: () => invoke('stop_broadcast'),
    getStatus: () => invoke('get_broadcast_status'),
}

// System API
export const systemApi = {
    getSessions: () => invoke('get_sessions'),
    saveAccount: (clientId: string, name: string) => invoke('save_account', { clientId, name }),
    renameAccount: (id: string, name: string) => invoke('rename_account', { id, name }),
    deleteAccount: (id: string) => invoke('delete_account', { id }),
    setAccountLevel: (level: string) => invoke('set_account_level', { level }),
    getDailyStats: () => invoke('get_daily_stats'),
}
```

---

### Task 12: 创建主布局和核心页面

**Files:**
- Create: `src/layouts/MainLayout.vue`
- Create: `src/views/Dashboard.vue`
- Create: `src/views/Broadcast.vue`
- Create: `src/views/Contacts.vue`
- Create: `src/views/Settings.vue`

- [ ] **Step 1: 创建 MainLayout.vue**

```vue
<template>
  <el-container class="main-layout">
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <el-icon><ChatDotRound /></el-icon>
        <span>WhatsApp Bot</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="sidebar-menu"
        background-color="#1a1a2e"
        text-color="#fff"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>控制台</span>
        </el-menu-item>
        <el-menu-item index="/broadcast">
          <el-icon><Promotion /></el-icon>
          <span>群发消息</span>
        </el-menu-item>
        <el-menu-item index="/contacts">
          <el-icon><UserFilled /></el-icon>
          <span>联系人</span>
        </el-menu-item>
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>设置</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <div class="header-right">
          <el-tag :type="connectionStatus.type">
            {{ connectionStatus.text }}
          </el-tag>
        </div>
      </el-header>
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useWhatsAppStore } from '@/stores/whatsapp'

const store = useWhatsAppStore()

const connectionStatus = computed(() => {
    switch (store.status) {
        case 'ready': return { type: 'success' as const, text: '已连接' }
        case 'qr': return { type: 'warning' as const, text: '等待扫码' }
        case 'authenticated': return { type: 'info' as const, text: '认证中' }
        case 'disconnected': return { type: 'danger' as const, text: '未连接' }
        default: return { type: 'info' as const, text: store.status }
    }
})

onMounted(() => {
    store.startPolling()
})
</script>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background: #1a1a2e;
  color: #fff;
}

.logo {
  padding: 20px;
  font-size: 18px;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #333;
}

.sidebar-menu {
  border-right: none;
}

.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.main-content {
  background: #f5f5f5;
  padding: 20px;
  overflow-y: auto;
}
</style>
```

- [ ] **Step 2: 创建 Dashboard.vue**

```vue
<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>连接状态</span>
            </div>
          </template>
          
          <div v-if="store.status === 'qr'" class="qr-section">
            <p>请使用 WhatsApp 扫描下方二维码</p>
            <img :src="qrCodeUrl" alt="QR Code" class="qr-image" />
          </div>
          
          <div v-else-if="store.status === 'ready'" class="status-ready">
            <el-result
              icon="success"
              title="已连接"
              sub-title="WhatsApp 连接正常"
            />
          </div>
          
          <div v-else class="status-disconnected">
            <el-result
              icon="info"
              title="未连接"
              :sub-title="statusMessage"
            >
              <template #extra>
                <el-button type="primary" @click="handleConnect">
                  连接 WhatsApp
                </el-button>
              </template>
            </el-result>
          </div>
        </el-card>
        
        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>今日统计</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ dailyStats.sent || 0 }}</div>
                <div class="stat-label">已发送</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ dailyStats.failed || 0 }}</div>
                <div class="stat-label">失败</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ dailyStats.remaining || 0 }}</div>
                <div class="stat-label">剩余配额</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>账号管理</span>
            </div>
          </template>
          <div class="account-list">
            <div
              v-for="account in sessions"
              :key="account.id"
              class="account-item"
            >
              <span>{{ account.name }}</span>
              <el-button
                type="primary"
                size="small"
                @click="switchAccount(account.id)"
              >
                切换
              </el-button>
            </div>
          </div>
          <el-button
            type="success"
            style="width: 100%; margin-top: 10px"
            @click="createNewAccount"
          >
            新建账号
          </el-button>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWhatsAppStore } from '@/stores/whatsapp'
import { systemApi } from '@/api/tauri'

const store = useWhatsAppStore()
const sessions = ref<any[]>([])
const dailyStats = ref<any>({})

const qrCodeUrl = computed(() => {
    if (store.qr) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(store.qr)}`
    }
    return ''
})

const statusMessage = computed(() => {
    switch (store.status) {
        case 'disconnected': return '点击连接按钮开始'
        case 'retrying': return '正在重试...'
        case 'auth_failure': return '认证失败，请重试'
        default: return store.status
    }
})

const handleConnect = async () => {
    await store.connect(false)
}

const switchAccount = async (clientId: string) => {
    await store.connect(false, clientId)
}

const createNewAccount = async () => {
    await store.connect(true)
}

const loadSessions = async () => {
    try {
        const result: any = await systemApi.getSessions()
        sessions.value = result.sessions || []
    } catch (e) {
        console.error('Failed to load sessions:', e)
    }
}

const loadDailyStats = async () => {
    try {
        dailyStats.value = await systemApi.getDailyStats()
    } catch (e) {
        console.error('Failed to load daily stats:', e)
    }
}

onMounted(() => {
    loadSessions()
    loadDailyStats()
})
</script>

<style scoped>
.dashboard {
  padding: 0;
}

.card-header {
  font-weight: bold;
}

.qr-section {
  text-align: center;
  padding: 20px;
}

.qr-image {
  width: 200px;
  height: 200px;
  margin-top: 10px;
}

.stat-item {
  text-align: center;
  padding: 20px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #409EFF;
}

.stat-label {
  margin-top: 5px;
  color: #666;
}

.account-list {
  max-height: 300px;
  overflow-y: auto;
}

.account-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
}
</style>
```

- [ ] **Step 3: 创建 Broadcast.vue**

```vue
<template>
  <div class="broadcast">
    <el-row :gutter="20">
      <el-col :span="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>群发消息</span>
            </div>
          </template>
          
          <el-form :model="form" label-position="top">
            <el-form-item
              v-for="i in 5"
              :key="i"
              :label="`消息模板 ${i}`"
            >
              <el-input
                v-model="form.messages[i-1]"
                type="textarea"
                :rows="3"
                :placeholder="i === 1 ? '输入要发送的消息... 使用 {name} 插入联系人名字' : '可选'"
              />
            </el-form-item>
            
            <el-form-item label="发送间隔 (毫秒)">
              <el-input-number v-model="form.interval" :min="1000" :step="1000" />
            </el-form-item>
            
            <el-form-item>
              <el-checkbox v-model="form.randomInterval">随机间隔（更像真人）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.randomizeMsg">随机化消息内容（防检测）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.lengthRandomize">消息长度随机化</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.simulateTyping">模拟打字输入</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.simulateMouse">模拟鼠标移动</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.respectHours">只在合理时间发送（9:00-22:00）</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.randomPause">随机暂停</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.excludeGroups">排除群组</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="form.personalize">自动插入联系人名字</el-checkbox>
            </el-form-item>
            
            <el-form-item label="账号安全级别">
              <el-select v-model="form.accountLevel">
                <el-option label="新账号（每天30条）" value="new" />
                <el-option label="稳定账号（每天80条）" value="established" />
                <el-option label="老账号（每天150条）" value="mature" />
              </el-select>
            </el-form-item>
            
            <el-form-item label="群发对象">
              <el-select v-model="form.targetType">
                <el-option label="已有聊天记录" value="chats" />
                <el-option label="所有联系人" value="contacts" />
                <el-option label="未聊天联系人" value="nohistory" />
                <el-option label="手动输入号码" value="manual" />
              </el-select>
            </el-form-item>
            
            <el-form-item v-if="form.targetType === 'manual'" label="手机号码列表">
              <el-input
                v-model="form.manualNumbers"
                type="textarea"
                :rows="5"
                placeholder="86138xxxxxxx|张三"
              />
            </el-form-item>
          </el-form>
          
          <div class="actions">
            <el-button
              type="primary"
              size="large"
              :loading="isRunning"
              @click="startBroadcast"
            >
              开始群发
            </el-button>
            <el-button
              type="danger"
              size="large"
              :disabled="!isRunning"
              @click="stopBroadcast"
            >
              停止
            </el-button>
          </div>
        </el-card>
      </el-col>
      
      <el-col :span="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>发送进度</span>
            </div>
          </template>
          
          <div v-if="progress" class="progress-section">
            <el-progress
              :percentage="progressPercentage"
              :status="progressStatus"
            />
            <div class="progress-info">
              <p>当前: {{ progress.current }} / {{ progress.total }}</p>
              <p>今日发送: {{ progress.daily_sent }} / {{ progress.daily_limit }}</p>
              <p>剩余配额: {{ progress.remaining }}</p>
            </div>
          </div>
          
          <div v-else class="empty-state">
            尚未开始群发
          </div>
        </el-card>
        
        <el-card style="margin-top: 20px">
          <template #header>
            <div class="card-header">
              <span>发送结果</span>
            </div>
          </template>
          <div class="results-list">
            <div
              v-for="(result, index) in results"
              :key="index"
              class="result-item"
              :class="result.status"
            >
              <span>{{ result.name }}</span>
              <el-tag :type="result.status === 'success' ? 'success' : 'danger'" size="small">
                {{ result.status === 'success' ? '成功' : '失败' }}
              </el-tag>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { broadcastApi, systemApi } from '@/api/tauri'

const form = ref({
    messages: ['', '', '', '', ''],
    interval: 10000,
    randomInterval: true,
    randomizeMsg: true,
    lengthRandomize: true,
    simulateTyping: false,
    simulateMouse: false,
    respectHours: true,
    randomPause: true,
    excludeGroups: true,
    personalize: true,
    targetType: 'chats',
    manualNumbers: '',
    accountLevel: 'new'
})

const isRunning = ref(false)
const progress = ref<any>(null)
const results = ref<any[]>([])
let pollTimer: ReturnType<typeof setInterval> | null = null

const progressPercentage = computed(() => {
    if (!progress.value || progress.value.total === 0) return 0
    return Math.round((progress.value.current / progress.value.total) * 100)
})

const progressStatus = computed(() => {
    if (!isRunning.value && progress.value?.current === progress.value?.total) {
        return 'success'
    }
    return ''
})

const startBroadcast = async () => {
    try {
        const messages = form.value.messages.filter(m => m.trim())
        if (messages.length === 0) {
            ElMessage.warning('请至少输入一条消息')
            return
        }
        
        await systemApi.setAccountLevel(form.value.accountLevel)
        
        const options = {
            message: messages,
            interval: form.value.interval,
            random_interval: form.value.randomInterval,
            randomize_msg: form.value.randomizeMsg,
            length_randomize: form.value.lengthRandomize,
            simulate_typing: form.value.simulateTyping,
            simulate_mouse: form.value.simulateMouse,
            respect_hours: form.value.respectHours,
            random_pause: form.value.randomPause,
            exclude_groups: form.value.excludeGroups,
            personalize: form.value.personalize,
            target_type: form.value.targetType,
            manual_numbers: form.value.manualNumbers || null,
            account_level: form.value.accountLevel
        }
        
        await broadcastApi.start(options)
        isRunning.value = true
        ElMessage.success('群发已开始')
        startPolling()
    } catch (e: any) {
        ElMessage.error('启动失败: ' + e.message)
    }
}

const stopBroadcast = async () => {
    try {
        await broadcastApi.stop()
        isRunning.value = false
        ElMessage.info('群发已停止')
    } catch (e: any) {
        ElMessage.error('停止失败: ' + e.message)
    }
}

const startPolling = () => {
    pollTimer = setInterval(async () => {
        try {
            const status: any = await broadcastApi.getStatus()
            progress.value = status
            if (status.results) {
                results.value = status.results
            }
            if (!status.running && isRunning.value) {
                isRunning.value = false
                clearInterval(pollTimer!)
            }
        } catch (e) {
            console.error('Poll error:', e)
        }
    }, 1000)
}

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.broadcast {
  padding: 0;
}

.card-header {
  font-weight: bold;
}

.actions {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.progress-section {
  padding: 10px;
}

.progress-info {
  margin-top: 15px;
}

.progress-info p {
  margin: 5px 0;
  color: #666;
}

.results-list {
  max-height: 400px;
  overflow-y: auto;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
```

---

### Task 13: 创建 Pinia Stores

**Files:**
- Create: `src/stores/whatsapp.ts`
- Create: `src/stores/broadcast.ts`

- [ ] **Step 1: 创建 whatsapp.ts**

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { whatsappApi, systemApi } from '@/api/tauri'

export const useWhatsAppStore = defineStore('whatsapp', () => {
    const status = ref('disconnected')
    const qr = ref('')
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const isConnected = computed(() => status.value === 'ready')
    const isWaitingForQr = computed(() => status.value === 'qr')

    const connect = async (forceNew = false, clientId?: string) => {
        try {
            const result: any = await whatsappApi.connect(forceNew, clientId)
            if (result.success) {
                startPolling()
            }
            return result
        } catch (e) {
            console.error('Connect error:', e)
            throw e
        }
    }

    const disconnect = async () => {
        try {
            await whatsappApi.disconnect()
            status.value = 'disconnected'
            qr.value = ''
            stopPolling()
        } catch (e) {
            console.error('Disconnect error:', e)
        }
    }

    const checkStatus = async () => {
        try {
            const result: any = await whatsappApi.getStatus()
            status.value = result.status
            qr.value = result.qr || ''
        } catch (e) {
            console.error('Status check error:', e)
        }
    }

    const startPolling = () => {
        if (pollTimer) clearInterval(pollTimer)
        pollTimer = setInterval(checkStatus, 2000)
    }

    const stopPolling = () => {
        if (pollTimer) {
            clearInterval(pollTimer)
            pollTimer = null
        }
    }

    return {
        status,
        qr,
        isConnected,
        isWaitingForQr,
        connect,
        disconnect,
        checkStatus,
        startPolling,
        stopPolling
    }
})
```

---

## Phase 5: 集成测试与功能验收

### Task 14: 构建和测试

- [ ] **Step 1: 安装所有依赖**

Run: `npm install`
Expected: 前端依赖安装成功

Run: `cd src-tauri && cargo check`
Expected: Rust 编译检查通过

- [ ] **Step 2: 开发模式测试**

Run: `npm run tauri:dev`
Expected: Tauri 应用启动，前端和 Rust 后端正常运行

- [ ] **Step 3: 功能验收检查清单**

- [ ] WhatsApp 扫码连接正常
- [ ] 二维码正确显示
- [ ] 联系人列表获取正常
- [ ] 群发消息功能正常
- [ ] 消息随机化生效
- [ ] 速率限制生效
- [ ] 防检测脚本注入正常
- [ ] 账号管理功能正常
- [ ] 每日统计正确
- [ ] 发送进度实时更新
- [ ] 停止群发功能正常

- [ ] **Step 4: 生产构建测试**

Run: `npm run tauri:build`
Expected: 生成 Windows 安装程序

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Puppeteer 在 Tauri 中不稳定 | 高 | Node.js 作为子进程运行，与 Tauri 隔离 |
| 进程通信性能问题 | 中 | 使用 HTTP API，必要时优化 |
| 前端重构引入 Bug | 中 | 保持功能对照测试 |
| 构建配置复杂 | 低 | 参考 Tauri 官方文档 |

## 回退策略

如果 Tauri 迁移遇到无法解决的问题：
1. 保留现有 Node.js + Express 版本
2. 使用 Electron 作为替代方案
