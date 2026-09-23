# 漫畫庫與掃描

[English](../en/libraries.md) · [简体中文](../zh-Hans/libraries.md) · [繁體中文](libraries.md) · [日本語](../ja/libraries.md) · [한국어](../ko/libraries.md)

漫畫庫是 `/data` 內由 Mangayomi 建立索引的資料夾。你可以建立多個漫畫庫，例如一個放漫畫、一個放畫冊。各漫畫庫的資料夾不能互相重疊。

## 什麼算是一部作品

- 一個 `.zip` 或 `.cbz` 檔案就是一部作品，去掉副檔名後的檔名即為標題。
- 直接包含圖片（JPEG、PNG、GIF、WebP、BMP、AVIF）的資料夾也是一部作品，資料夾名稱即為標題，Mangayomi 不會再往下查看它的子資料夾。
- 其他資料夾只是容器，Mangayomi 會往裡面尋找作品。

頁面會依自然順序排列，因此 `2.jpg` 會排在 `10.jpg` 之前。隱藏檔案以及 `@eaDir`、`#recycle` 等 NAS 系統資料夾會被忽略。

## 資料夾結構

**Folder structure**（資料夾結構）樣式用來說明每部作品上層各資料夾所代表的意義。

| 樣式 | 目錄結構 | 結果 |
| --- | --- | --- |
| `{author}/{series}` | `Author/Series/Vol 01.cbz` | 作者、系列、標題 |
| `{series}` | `Series/Vol 01.cbz` | 系列、標題 |
| `{author}` | `Author/Title.cbz` | 作者、標題 |
| 扁平（無中繼資料） | 任意 | 僅標題 |
| 自訂，例如 `{ignore}/{author}/{series}` | `Magazine/Author/Series/Vol 01.cbz` | 略過第一層 |

使用 `{author}/{series}` 時：

```text
Author A/
  Series One/
    Vol 01.cbz        -> Author A · Series One · "Vol 01"
    Vol 02/           -> Author A · Series One · "Vol 02"
      001.jpg
      002.jpg
  Oneshot.zip         -> Author A · no series · "Oneshot"
Loose Artbook/        -> no author · no series · "Loose Artbook"
  001.jpg
```

裝滿圖片的資料夾一律視為作品，絕不會被當成作者或系列，即使它位於樣式中 `{series}` 所在的層級也一樣。比樣式更深的層級會被忽略。

表單會針對所選樣式顯示範例目錄樹。**Run preview**（執行預覽）會列出掃描器將找到的前 50 部作品，包含標題、作者、系列與路徑，讓你在儲存前先確認樣式是否正確。

## 排除的資料夾

**Add excluded folder**（新增排除的資料夾）會開啟一個僅限於漫畫庫資料夾範圍內的資料夾選擇器。排除資料夾內的所有內容都會被略過，而先前已從中建立索引的作品，會在下次掃描時從漫畫庫中移除（檔案本身不受影響）。

## 預設閱讀方向

**Right to left**（由右至左）適合日本漫畫，**Left to right**（由左至右）適合匯出成頁面的美式漫畫與條漫。閱讀器會對漫畫庫中的每部作品套用此預設值，直到你在閱讀器中變更某個系列的閱讀方向為止。

## 掃描

- 儲存漫畫庫，或變更其資料夾、樣式或排除項目時，都會開始掃描。
- **Scan now**（立即掃描，即漫畫庫旁的重新整理按鈕）可隨時手動掃描；**Scan all**（全部掃描，在有多個漫畫庫時顯示）會掃描所有漫畫庫。
- **Automatic scan**（自動掃描）會每隔 1、6、12 或 24 小時重複掃描，或選擇永不自動掃描（**Manual only**，僅手動）。

掃描採增量方式：未變更的檔案會略過，已變更的檔案會重新讀取，新檔案會加入，消失的檔案則會移除。掃描進行時，側邊欄與漫畫庫清單會顯示目前已找到的作品數量。

如果無法讀取漫畫庫資料夾（例如 NAS 共用資料夾未掛載），掃描會以錯誤中止，並保留現有的索引。

## 編輯與移除

- 變更樣式會重新標記作品，並保留閱讀進度。
- 變更資料夾則會從頭開始：舊的索引及其進度都會被捨棄。
- **Remove library**（移除漫畫庫）會從 Mangayomi 中移除該漫畫庫及其進度，磁碟上的檔案不受影響。

## 相關文件

- [掃描（架構）](../../architecture/scanning.md)
- [疑難排解](../../operations/troubleshooting.md)
