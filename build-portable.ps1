# WhatsApp Bot 便携版构建脚本
# 用法: .\build-portable.ps1
# 产出: portable\WhatsApp-Bot\ 目录，拷贝到任意 PC 即可运行

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WhatsApp Bot - 便携版构建" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Step 1: 准备工作 - 便携 Node.js
Write-Host "`n[1/4] 检查便携 Node.js..." -ForegroundColor Yellow
$nodeExe = "$ProjectRoot\src-node\node.exe"
if (-not (Test-Path $nodeExe)) {
    Write-Host "  下载 node.exe..." -ForegroundColor Gray
    $nodeUrl = "https://nodejs.org/dist/v24.15.0/win-x64/node.exe"
    Invoke-WebRequest -Uri $nodeUrl -OutFile $nodeExe -UseBasicParsing
    Write-Host "  node.exe 下载完成" -ForegroundColor Green
} else {
    Write-Host "  node.exe 已就绪" -ForegroundColor Gray
}

# Step 2: 准备工作 - 便携 Chromium
Write-Host "`n[2/4] 检查便携 Chromium..." -ForegroundColor Yellow
$chromeExe = "$ProjectRoot\src-node\.chromium\chrome-win64\chrome.exe"
if (-not (Test-Path $chromeExe)) {
    Write-Host "  正在通过 puppeteer 获取 Chromium..." -ForegroundColor Gray
    Push-Location "$ProjectRoot\src-node"
    try {
        $cachePath = & node -e "const p=require('puppeteer');console.log(p.executablePath())" 2>$null
    } finally {
        Pop-Location
    }
    if ($cachePath -and (Test-Path $cachePath)) {
        $cacheDir = Split-Path -Parent $cachePath
        $destDir = "$ProjectRoot\src-node\.chromium\chrome-win64"
        Write-Host "  复制 Chromium 到便携目录..." -ForegroundColor Gray
        robocopy $cacheDir $destDir /E /NFL /NDL /NJH /NJS /nc /ns /np
        Write-Host "  完成 ($([math]::Round((Get-ChildItem $destDir -Recurse | Measure-Object Length -Sum).Length/1GB,2)) GB)" -ForegroundColor Green
    } else {
        Write-Host "  警告: 未找到 Chromium 缓存" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Chromium 已就绪" -ForegroundColor Gray
}

# Step 3: 构建
Write-Host "`n[3/4] 编译项目..." -ForegroundColor Yellow
npx vite build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "前端构建失败" }

Push-Location "$ProjectRoot\src-tauri"
try {
    cargo build --release 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Rust 编译失败" }
} finally {
    Pop-Location
}
Write-Host "  编译完成" -ForegroundColor Green

# Step 4: 组装便携包
Write-Host "`n[4/4] 组装便携包..." -ForegroundColor Yellow
$PortableDir = "$ProjectRoot\portable\WhatsApp-Bot-v6"

# 清理旧的便携包
if (Test-Path $PortableDir) {
    Remove-Item -Recurse -Force $PortableDir
}

# 创建目录并复制 exe
New-Item -ItemType Directory -Force -Path $PortableDir | Out-Null
$exePath = "$ProjectRoot\src-tauri\target\release\whatsapp-bot-tauri.exe"
if (-not (Test-Path $exePath)) {
    throw "未找到编译产物: $exePath"
}
Copy-Item $exePath "$PortableDir\" -Force

# 复制 src-node（排除运行时数据和缓存）
$srcNodeDir = "$ProjectRoot\src-node"
robocopy $srcNodeDir "$PortableDir\src-node" /E /NFL /NDL /NJH /NJS /nc /ns /np `
    /XD node_modules\.cache .wwebjs_auth_v2 .wwebjs_cache data logs

# 创建运行时目录
New-Item -ItemType Directory -Force -Path "$PortableDir\src-node\data" | Out-Null
New-Item -ItemType Directory -Force -Path "$PortableDir\src-node\logs" | Out-Null

# 显示结果
$totalSize = (Get-ChildItem -Path $PortableDir -Recurse | Measure-Object -Property Length -Sum).Sum
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  便携版构建完成！" -ForegroundColor Green
Write-Host "  输出: $PortableDir" -ForegroundColor Green
Write-Host "  大小: $([math]::Round($totalSize/1GB,2)) GB" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  用法: 将 WhatsApp-Bot 拷贝到任意 PC，双击 whatsapp-bot-tauri.exe 运行" -ForegroundColor White
Write-Host "  首次启动会等待 Node.js + Chromium 初始化（最多60秒）" -ForegroundColor Gray