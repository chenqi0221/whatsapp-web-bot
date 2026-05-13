# WhatsApp Bot Tauri 重构计划

## 目标

将现有的 Node.js + Express + 浏览器前端 架构重构为 Tauri 桌面应用，保持所有现有功能。

## 架构对比

### 当前架构

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   浏览器前端     │────▶│  Express 服务器   │────▶│ WhatsApp Web.js │
│  (HTML/JS/CSS)  │◄────│   (Node.js)      │◄────│   (Puppeteer)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Tauri 架构

```
┌─────────────────────────┐
│      Tauri 桌面应用      │
│  ┌───────────────────┐  │
│  │   WebView 前端     │  │
│  │ (HTML/JS/CSS/Vue) │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │   Rust 后端        │  │
│  │ (Tauri Commands)  │  │
│  └───────────────────┘  │
└─────────────────────────┘
         │
         ▼
┌─────────────────────────┐
│   Node.js 子进程        │
│  (WhatsApp Web.js)      │
└─────────────────────────┘
```

## 技术栈

### 前端

- **框架**: Vue 3 + TypeScript (推荐) 或保持 HTML/JS
- **UI 组件**: Element Plus 或 Tailwind CSS
- **状态管理**: Pinia
- **构建工具**: Vite

### 后端

- **Tauri (Rust)**: 桌面应用框架，提供系统 API 和进程管理
- **Node.js 子进程**: 运行 WhatsApp Web.js (因为 Puppeteer 需要 Node.js)
- **通信**: Tauri Commands (前端 ↔ Rust) + IPC/HTTP (Rust ↔ Node.js)

## 文件结构

```
whatsapp-bot-tauri/
├── src/                          # Rust 后端代码
│   ├── main.rs                   # 应用入口
│   ├── lib.rs                    # 库入口
│   ├── commands/                 # Tauri Commands
│   │   ├── mod.rs
│   │   ├── whatsapp.rs           # WhatsApp 相关命令
│   │   ├── broadcast.rs          # 群发相关命令
│   │   ├── contacts.rs           # 联系人相关命令
│   │   └── system.rs             # 系统命令
│   ├── services/                 # 业务逻辑
│   │   ├── mod.rs
│   │   ├── node_process.rs       # Node.js 子进程管理
│   │   ├── whatsapp_client.rs    # WhatsApp 客户端封装
│   │   └── state.rs              # 应用状态管理
│   └── models/                   # 数据模型
│       ├── mod.rs
│       ├── contact.rs
│       ├── message.rs
│       └── broadcast.rs
├── src-node/                     # Node.js 子进程代码
│   ├── index.js                  # 子进程入口
│   ├── whatsapp-client.js        # WhatsApp 客户端封装
│   ├── api-server.js             # 内部 API 服务器
│   ├── services/
│   │   ├── broadcast.js          # 群发逻辑
│   │   ├── anti-detection.js     # 防检测
│   │   ├── rate-limiter.js       # 速率限制
│   │   └── message-randomizer.js # 消息随机化
│   └── package.json
├── src-frontend/                 # 前端代码
│   ├── src/
│   │   ├── main.ts               # 入口
│   │   ├── App.vue               # 根组件
│   │   ├── router/
│   │   ├── stores/               # Pinia stores
│   │   ├── components/           # Vue 组件
│   │   ├── views/                # 页面视图
│   │   └── api/                  # API 客户端
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── src-tauri/                    # Tauri 配置
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── public/
├── package.json                  # 根 package.json
└── README.md
```

## 迁移步骤

### Phase 1: 项目初始化

1. 创建 Tauri 项目结构
2. 配置 Rust + Node.js 混合环境
3. 设置开发工作流

### Phase 2: Node.js 子进程封装

1. 将现有 `web.js` 改造为子进程模式
2. 创建内部 HTTP API (供 Rust 调用)
3. 实现进程生命周期管理

### Phase 3: Rust 后端开发

1. 实现 Tauri Commands
2. 封装 Node.js 子进程调用
3. 实现状态管理和事件转发

### Phase 4: 前端重构

1. 迁移现有 HTML/CSS/JS 到 Vue 3
2. 使用 Tauri API 替代直接 HTTP 调用
3. 保持所有 UI 功能和交互

### Phase 5: 功能测试

1. 测试 WhatsApp 连接
2. 测试联系人获取
3. 测试群发功能
4. 测试所有防检测特性

### Phase 6: 构建发布

1. 配置 Windows 构建
2. 创建安装程序
3. 自动更新配置

## 关键设计决策

### 1. 为什么保留 Node.js 子进程？

- WhatsApp Web.js 依赖 Puppeteer，需要完整的 Node.js 环境
- Puppeteer 的 Chrome DevTools Protocol 在 Rust 中难以直接实现
- 保持现有业务逻辑不变，减少迁移风险

### 2. Rust ↔ Node.js 通信方式

- **方案 A**: HTTP API (推荐)
    - Node.js 子进程启动内部 HTTP 服务器
    - Rust 通过 HTTP 客户端调用
    - 简单、成熟、易于调试

- **方案 B**: stdin/stdout IPC
    - 通过标准输入输出传递 JSON 消息
    - 更轻量，但调试困难

### 3. 前端框架选择

- **方案 A**: Vue 3 + TypeScript (推荐)
    - 现代化、类型安全
    - 组件化，易于维护
    - 生态丰富

- **方案 B**: 保持原生 HTML/JS
    - 迁移成本低
    - 但长期维护困难

## 功能映射

| 现有功能      | Tauri 实现                  | 文件位置                              |
| ------------- | --------------------------- | ------------------------------------- |
| WhatsApp 连接 | Node.js 子进程 + Rust 封装  | `src-node/whatsapp-client.js`         |
| 二维码显示    | WebSocket 事件 → Tauri 事件 | `src-frontend/components/QRCode.vue`  |
| 联系人获取    | HTTP API → Tauri Command    | `src/commands/contacts.rs`            |
| 群发消息      | HTTP API → Tauri Command    | `src/commands/broadcast.rs`           |
| 消息模板      | localStorage → Tauri Store  | `src-frontend/stores/templates.ts`    |
| 防检测        | 保持 Node.js 实现           | `src-node/services/anti-detection.js` |
| 速率限制      | 保持 Node.js 实现           | `src-node/services/rate-limiter.js`   |
| 实时状态      | Socket.IO → Tauri Events    | `src/services/whatsapp_client.rs`     |

## 开发计划

### Week 1: 基础架构

- [ ] 初始化 Tauri 项目
- [ ] 配置 Vue 3 + Vite 前端
- [ ] 创建 Node.js 子进程框架
- [ ] 实现基本的进程通信

### Week 2: 核心功能迁移

- [ ] 迁移 WhatsApp 连接逻辑
- [ ] 实现二维码显示
- [ ] 迁移联系人获取
- [ ] 实现实时状态更新

### Week 3: 业务功能迁移

- [ ] 迁移群发功能
- [ ] 迁移消息模板系统
- [ ] 迁移防检测机制
- [ ] 迁移速率限制

### Week 4: 测试与优化

- [ ] 完整功能测试
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 构建配置

### Week 5: 发布准备

- [ ] Windows 安装程序
- [ ] 自动更新
- [ ] 文档编写
- [ ] 最终测试

## 风险与缓解

| 风险                        | 影响 | 缓解措施                   |
| --------------------------- | ---- | -------------------------- |
| Puppeteer 在 Tauri 中不稳定 | 高   | 充分测试，保留回退方案     |
| 进程通信性能问题            | 中   | 使用高效序列化，必要时优化 |
| 前端重构引入 Bug            | 中   | 保持功能对照测试           |
| 构建配置复杂                | 低   | 参考 Tauri 官方文档        |

## 回退策略

如果 Tauri 迁移遇到无法解决的问题：

1. 保留现有 Node.js + Express 版本
2. 使用 Electron 作为替代方案
3. 继续使用浏览器版本
