# 快速入門

[English](../en/getting-started.md) · [简体中文](../zh-Hans/getting-started.md) · [繁體中文](getting-started.md) · [日本語](../ja/getting-started.md) · [한국어](../ko/getting-started.md)

## 系統需求

- NAS 或伺服器上已安裝 Docker 與 Docker Compose。
- 漫畫以 `.zip`／`.cbz` 檔案或圖片資料夾的形式存放。
- 選用，供本機開發使用：Go 與 Node.js；請參閱[本機開發](../../development/local-dev.md)。

## 使用 Docker 執行

1. 將此儲存庫放到 Docker 主機上。
2. 編輯 `docker-compose.yml` 中的資料磁碟區，讓它指向你的漫畫：

   ```yaml
   volumes:
     - ./config:/config
     - /path/to/manga:/data
   ```

3. 選擇性地將 `.env.example` 複製為 `.env`，並將 `PUID`／`PGID` 設為檔案擁有者，或設定 `MANGAYOMI_PORT` 以改用其他連接埠。
4. 啟動：

   ```sh
   docker compose up -d --build
   ```

5. 開啟 `http://<server-address>:8080`。

## 首次登入

第一次造訪時，系統會要求你建立一組密碼（至少六個字元）。系統只有一個帳號，在每台裝置上都使用同一組密碼登入。工作階段有效期為 30 天，使用期間會自動延長。

忘記密碼了嗎？請參閱[疑難排解](../../operations/troubleshooting.md#forgot-the-password)。

## 新增第一個漫畫庫

1. 開啟 **Settings**（設定），然後選擇 **Add library**（新增漫畫庫）。
2. 在 **Folder**（資料夾）下選擇 **Choose folder**（選擇資料夾），並挑選 `/data` 內的某個資料夾。
3. 選擇符合你目錄結構的 **Folder structure**（資料夾結構），例如 `Author/Series/Volume.cbz` 就選 `{author}/{series}`。
4. 視需要新增 **Excluded folders**（排除的資料夾）。
5. 選擇 **Run preview**（執行預覽），查看前 50 部作品會如何被解析。
6. 選擇 **Save**（儲存）。漫畫庫會在背景進行掃描，掃描完成後作品就會出現。

詳細說明請參閱[漫畫庫與掃描](libraries.md)。

## 安裝到手機

在手機瀏覽器中開啟執行個體，然後使用 **Add to Home Screen**（加入主畫面，Safari）或 **Install app**（安裝應用程式，Chrome）。應用程式會以全螢幕開啟，並保留最近閱讀過的頁面。除非使用 `localhost`，否則安裝需要 HTTPS；請參閱 [Docker](../../operations/docker.md#reverse-proxy)。

## 後續步驟

- [閱讀](reader.md)
- [瀏覽與管理作品](managing.md)
- [組態設定](../../operations/configuration.md)
