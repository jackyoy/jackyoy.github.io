# System Diagnostic Log Visualizer & Diff Tool
# 系統診斷日誌視覺化與比對工具

[English](#english) | [繁體中文](#繁體中文)

---

## <a name="繁體中文"></a>繁體中文

### 📖 專案簡介
這是一個輕量級、**純前端 (Client-Side Only)** 的網頁工具，專為系統工程師與運維人員 (DevOps/SRE) 設計。它能將純文字格式的系統診斷日誌（System Diagnostic Logs）轉換為易讀的 HTML 報告，並提供強大的**左右並排差異比對 (Side-by-Side Diff)** 功能。

本工具完全在您的瀏覽器中運行，**不會將任何檔案上傳至伺服器**，確保敏感的系統資訊（如 IP、使用者帳號、Crontab 設定）絕對安全。

### ✨ 核心功能

* **🛡️ 隱私優先**：所有運算皆在本地瀏覽器完成，無後端伺服器，資料零外洩風險。
* **👁️ 單檔視覺化**：自動解析雜亂的 Log 文字檔，生成帶有左側導航欄的 HTML 報告。
* **⚖️ 雙檔精準比對 (Git-Style Diff)**：
    * 支援上傳「基準檔案 (Base)」與「對照檔案 (Target)」。
    * 內建 **Myers' Diff Algorithm**（與 Git 核心相同的演算法），即使檔案中間插入了大量內容，也能精準對齊後續相同的區塊。
    * 採用**左右並排 (Split View)** 顯示，直觀呈現新增（綠色）、刪除（紅色）與修改（黃色）的內容。
    * 具備 **Lookahead (向前看)** 機制，防止因單行差異導致的後續對齊錯位。
* **📂 多格式支援**：
    * 支援 `.txt`, `.html`, `.htm` 格式。
    * 內建智慧文字萃取，可處理被另存為網頁的 Log 檔。
* **🔄 便捷操作**：支援拖放上傳、一鍵下載 HTML 報告、以及一鍵重置狀態。

### 🚀 快速開始

1.  確認專案目錄中包含以下三個檔案（需位於同一路徑）：
    * `index.html` (結構)
    * `index.css` (樣式)
    * `index.js` (邏輯)
2.  直接使用瀏覽器（Chrome, Edge, Firefox, Safari）開啟 `index.html`。
3.  **單檔模式**：上傳一個檔案，點擊「開始轉換」。
4.  **比對模式**：分別上傳兩個檔案，點擊「開始精準比對」。

### 📝 支援的日誌格式

本工具會自動偵測並支援以下兩種常見的日誌結構：

**1. DIAG 格式 (Section Based)**
常見於系統自動收集腳本。
```text
==================================================
  [ SECTION ] PCI Devices & Network Info
==================================================
Content here...
```

**2. STATIC 格式 (Command Based)**
包含指令說明與原始指令。
```text
==================================================
說明: 檢查 RHEL 發行版本
指令: cat /etc/redhat-release
--------------------------------------------------
Red Hat Enterprise Linux release 8.9
```

### 🛠️ 技術棧
* **HTML5 / CSS3** (Flexbox Layout)
* **JavaScript (ES6+)**
* **No External Dependencies**: 無需安裝 Node.js、React 或 Vue，隨開即用。

---

## <a name="english"></a>English

### 📖 Introduction
A lightweight, **Client-Side Only** web tool designed for System Engineers and DevOps/SREs. It transforms raw text-based system diagnostic logs into readable HTML reports and provides a powerful **Side-by-Side Diff** feature.

This tool runs entirely in your browser. **No files are uploaded to any server**, ensuring that sensitive system information (IPs, user accounts, crontabs) remains 100% private and secure.

### ✨ Key Features

* **🛡️ Privacy First**: All processing is done locally in the browser. No backend server involved.
* **👁️ Single File Visualization**: Automatically parses messy log files into a clean HTML report with a sidebar navigation.
* **⚖️ Precision Side-by-Side Diff**:
    * Upload a "Base" file and a "Target" file for comparison.
    * Powered by **Myers' Diff Algorithm** (the same algorithm used by Git), ensuring perfect alignment even with large block insertions or deletions.
    * **Split View** display highlights additions (Green), deletions (Red), and modifications (Yellow).
    * Includes **Lookahead Alignment** to prevent visual misalignment caused by single-line shifts.
* **📂 Multi-Format Support**:
    * Supports `.txt`, `.html`, and `.htm` files.
    * Smart text extraction for logs saved as web pages.
* **🔄 User Friendly**: Drag-and-drop support, one-click HTML report download, and instant reset functionality.

### 🚀 Quick Start

1.  Ensure the following three files are in the same directory:
    * `index.html`
    * `index.css`
    * `index.js`
2.  Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari).
3.  **Single Mode**: Upload one file and click "Start Conversion".
4.  **Diff Mode**: Upload two files and click "Start Precision Diff".

### 📝 Supported Log Formats

The tool automatically detects and parses the following log structures:

**1. DIAG Format (Section Based)**
Common in automated system collection scripts.
```text
==================================================
  [ SECTION ] PCI Devices & Network Info
==================================================
Content here...
```

**2. STATIC Format (Command Based)**
Includes description and command meta-data.
```text
==================================================
說明: Check RHEL Release
指令: cat /etc/redhat-release
--------------------------------------------------
Red Hat Enterprise Linux release 8.9
```

### 🛠️ Tech Stack
* **HTML5 / CSS3** (Flexbox Layout)
* **JavaScript (ES6+)**
* **No External Dependencies**: No Node.js, React, or Vue required. Just open and run.