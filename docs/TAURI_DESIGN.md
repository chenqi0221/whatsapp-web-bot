# WhatsApp Bot Tauri 重构设计文档

## 目标
将现有的 Node.js + Express + 浏览器前端 架构重构为 Tauri 桌面应用，保持所有现有功能。

## 架构对比

### 当前架构
```
浏览器前端 (HTML/JS/CSS) <-> Express 服务器 (Node.js) <-> WhatsApp Web.js (Puppeteer)
```

### Tauri 架构
```
Tauri 桌面应用
  - WebView 前端 (Vue 3 + TypeScript)
  - Rust 后端 (Tauri Commands)
       |
       v
  Node.js 子进程 (WhatsApp Web.js + Express API)
```

## 技术栈

### 前端
- Vue 3 + TypeScript + Vite
- Element Plus UI 组件库
- Pinia 状态管理

### 后端
- Tauri (Rust) 桌面应用框架
- Node.js 子进程运行 WhatsApp Web.js
- HTTP API 通信 (Rust <-> Node.js)

## 文件结构

```
whatsapp-bot-tauri/
├── src-tauri/                    # Rust Tauri 后端
│   ├── src/
│   │   ├── main.rs               # 应用入口
│   │   ├── lib.rs
│   │   ├── commands/             # Tauri Commands
│   │   │   ├── mod.rs
│   │   │   ├── whatsapp.rs       # WhatsApp 连接/状态
│   │   │   ├── broadcast.rs      # 群发相关
│   │   │   ├── contacts.rs       # 联系人相关
│   │   │   └── system.rs         # 系统/账号管理
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── node_process.rs   # Node.js 子进程管理
│   │   │   └── event_forwarder.rs # 事件转发到前端
│   │   └── models/
│   │       ├── mod.rs
│   │       ├── contact.rs
│   │       └── broadcast.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src-node/                     # Node.js 子进程代码
│   ├── index.js                  # 子进程入口，启动 Express
│   ├── api-server.js             # Express 路由
│   ├── services/                 # 复用现有业务逻辑
│   ├── simulators/               # 复用现有模拟器
│   └── package.json
├── src/                          # Vue 3 前端
│   ├── main.ts
│   ├── App.vue
│   ├── router/
│   ├── stores/                   # Pinia stores
│   ├── components/
│   ├── views/
│   └── api/                      # Tauri Command 封装
├── package.json
└── vite.config.ts
```

## 功能映射

| 现有功能 | Tauri 实现 | 复用策略 |
|---------|-----------|---------|
| WhatsApp 扫码连接 | Node.js 子进程 + Rust 封装 | 复用 client-manager.js |
| 二维码显示 | Tauri Event → Vue 组件 | 新组件 |
| 联系人获取 | HTTP API → Tauri Command | 复用 contacts.js 逻辑 |
| 群发消息 | HTTP API → Tauri Command | 复用 broadcast.js |
| 消息模板/随机化 | 保持 Node.js 实现 | 复用 message-randomizer.js |
| 防检测 | 保持 Node.js 实现 | 复用 anti-detection.js |
| 速率限制 | 保持 Node.js 实现 | 复用 rate-limiter.js |
| 行为模拟 | 保持 Node.js 实现 | 复用 simulators/ |
| 账号管理 | Tauri Store API | 复用 account-store.js |
| 自动回复 | 保持 Node.js 实现 | 复用 |
| 定时任务 | 保持 Node.js 实现 | 复用 |
| 群管理 | 保持 Node.js 实现 | 复用 |
| 媒体发送 | 保持 Node.js 实现 | 复用 |
| 消息记录/搜索 | 保持 Node.js 实现 | 复用 |

## 关键设计决策

1. **Node.js 子进程保留**：WhatsApp Web.js 依赖 Puppeteer，必须保留 Node.js 环境
2. **HTTP 通信**：Rust 通过 HTTP 调用 Node.js 子进程，简单成熟
3. **事件流**：Node.js Socket.IO 事件 → Rust 转发 → 前端 Tauri Event
4. **业务逻辑零改动**：所有核心逻辑原样迁移到 `src-node/`，只改入口和通信层
