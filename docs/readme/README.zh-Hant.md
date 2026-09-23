<p align="center">
  <img src="../assets/mangayomi-icon.png" width="128" height="128" alt="Mangayomi logo">
</p>

<h1 align="center">Mangayomi</h1>

<p align="center">
  為你的 NAS 打造的自架漫畫庫與閱讀器。
</p>

<p align="center">
  <a href="../README.md">文件</a> ·
  <a href="../../SECURITY.md">安全性</a> ·
  <a href="../../PRIVACY.md">隱私權</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-Hans.md">简体中文</a> ·
  <a href="README.zh-Hant.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

Mangayomi 會為你原本就存放在 NAS 上的漫畫壓縮檔與圖片資料夾建立索引，依照你的資料夾結構推導出作者與系列，並透過響應式網頁閱讀器提供瀏覽；此閱讀器可在手機與平板上以 PWA 形式安裝。它由 Go 伺服器與 React 前端組成，封裝為單一 Docker 映像檔，並以 SQLite 作為資料儲存。

> [!IMPORTANT]
> Mangayomi 仍在積極開發中。升級前請先備份 `config/`，並在將執行個體開放到網路之前，先閱讀[部署安全性](../operations/security.md)的說明。刪除功能會永久移除儲存空間中的檔案。

## 主要功能

- **你的資料夾，你的結構**。可將 `/data` 下的任何資料夾新增為漫畫庫、排除子資料夾，並以 `{author}/{series}` 這類樣式描述目錄結構。儲存前的預覽會顯示每部作品將如何被解析。
- **壓縮檔與圖片資料夾**。一個 `.zip` 或 `.cbz` 檔案就是一部作品。直接包含圖片的資料夾也是一部作品，其名稱會作為標題，而非作者或系列。
- **增量與排程掃描**。可隨時手動掃描，或每 1–24 小時自動掃描。未變更的檔案會略過，而無法存取的漫畫庫根目錄絕不會清空索引。
- **專為手機打造的閱讀器**。支援由右至左或由左至右（依系列記憶）、單頁／雙頁／自動版面配置、寬幅跨頁單獨顯示、點按區域、滑動、鍵盤快速鍵，以及自動同步進度。
- **謹慎的刪除機制**。可刪除單一作品、多選項目、整個系列，或某位作者的所有作品。第一步會列出所有將被移除的檔案與資料夾，第二步則要求明確確認。
- **輕巧且注重隱私**。單一使用者密碼登入，不依賴外部服務，也不收集遙測資料。

## 快速開始

### 1. 準備部署目錄

將 [`docker-compose.yml`](../../docker-compose.yml) 以及此儲存庫的其餘內容放到 Docker 主機上（映像檔會在本機建置）。你也可以選擇將 [`.env.example`](../../.env.example) 複製為 `.env`，以變更連接埠、映像檔，或擁有你檔案的使用者。

### 2. 將 `/data` 指向你的漫畫

編輯 `docker-compose.yml` 中的 `./data:/data` 磁碟區，讓它指向你的漫畫共用資料夾，例如 `/path/to/manga:/data`。在 `.env` 中將 `PUID` 與 `PGID` 設為這些檔案的擁有者（在 NAS 上執行 `id` 即可查詢）。

### 3. 啟動 Mangayomi

```sh
docker compose up -d --build
```

開啟 <http://127.0.0.1:8080>，建立密碼，然後在 **Settings → Libraries** 下新增漫畫庫。完整操作流程請參閱[快速入門](../user/zh-Hant/getting-started.md)。

## 執行期資料

| 主機路徑 | 容器路徑 | 用途 | 需要備份？ |
| --- | --- | --- | --- |
| `./config` | `/config` | SQLite 資料庫（漫畫庫、進度、工作階段）與封面快取 | 是 |
| `./data` | `/data` | 你的漫畫。閱讀時唯讀；只有在刪除時才會寫入 | 請自行備份 |

請勿將這些執行期目錄提交至版本控制。其中可能包含私人媒體、密碼雜湊值與工作階段狀態。

## 文件

| 目標 | 從這裡開始 |
| --- | --- |
| 使用 Mangayomi | [使用者指南](../user/index.md) |
| 安裝並掃描第一個漫畫庫 | [快速入門](../user/zh-Hant/getting-started.md) |
| 設定與維運執行個體 | [維運](../operations/configuration.md) |
| 了解系統架構 | [架構](../architecture/index.md) |
| 審閱設計與安全性約定 | [設計](../development/design.md) · [安全性](../../SECURITY.md) · [隱私權](../../PRIVACY.md) |
| 查找所有公開文件 | [文件索引](../README.md) |

## 開發與貢獻

開發環境設定、驗證指令與發布流程都放在 `docs/development/` 底下，讓這份 README 能專注於安裝與產品行為。

- [本機開發](../development/local-dev.md)
- [測試](../development/testing.md)
- [貢獻指南](../../CONTRIBUTING.md)
- [Agent 指南](../../AGENTS.md)

## 安全性與隱私權

除了登入與健康檢查之外，每個 API 呼叫都需要該單一使用者的密碼。Mangayomi 不會發出任何對外的網路請求。若你發現疑似漏洞，請依照 [SECURITY.md](../../SECURITY.md) 中的私下回報流程提報；在分享記錄檔或診斷資訊之前，請先閱讀 [PRIVACY.md](../../PRIVACY.md)。
