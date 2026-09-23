# 漫画库与扫描

[English](../en/libraries.md) · [简体中文](libraries.md) · [繁體中文](../zh-Hant/libraries.md) · [日本語](../ja/libraries.md) · [한국어](../ko/libraries.md)

漫画库是 `/data` 中由 Mangayomi 建立索引的一个文件夹。你可以创建多个漫画库，例如一个存放漫画，一个存放画集。各漫画库的文件夹不能相互重叠。

## 什么算作一个作品

- 一个 `.zip` 或 `.cbz` 文件就是一个作品，去掉扩展名后的文件名即为标题。
- 直接包含图片（JPEG、PNG、GIF、WebP、BMP、AVIF）的文件夹也是一个作品，文件夹名即为标题，Mangayomi 不会再查看其子文件夹。
- 其他文件夹仅作为容器，Mangayomi 会继续查找其中的内容。

页面按自然顺序排列，因此 `2.jpg` 排在 `10.jpg` 之前。隐藏文件以及 `@eaDir`、`#recycle` 等 NAS 系统文件夹会被忽略。

## 文件夹结构

**Folder structure**（文件夹结构）模式用于说明每个作品上层各级文件夹的含义。

| 模式 | 目录结构 | 结果 |
| --- | --- | --- |
| `{author}/{series}` | `Author/Series/Vol 01.cbz` | 作者、系列、标题 |
| `{series}` | `Series/Vol 01.cbz` | 系列、标题 |
| `{author}` | `Author/Title.cbz` | 作者、标题 |
| 扁平（无元数据） | 任意 | 仅标题 |
| 自定义，例如 `{ignore}/{author}/{series}` | `Magazine/Author/Series/Vol 01.cbz` | 跳过第一级 |

使用 `{author}/{series}` 时：

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

装满图片的文件夹始终被视为作品，而不会被当作作者或系列，即使它位于模式中 `{series}` 所对应的层级。比模式更深的层级会被忽略。

表单会显示所选模式的示例目录树。**Run preview**（运行预览）会列出扫描器将找到的前 50 个作品及其标题、作者、系列和路径，方便你在保存前检查模式是否正确。

## 排除的文件夹

**Add excluded folder**（添加排除的文件夹）会打开一个仅限于该漫画库文件夹内的文件夹选择器。被排除文件夹中的所有内容都会被跳过；此前已从中索引的作品会在下次扫描时从漫画库中移除（文件本身不受影响）。

## 默认阅读方向

**Right to left**（从右到左）适合日本漫画，**Left to right**（从左到右）适合美漫以及导出为分页形式的条漫。阅读器会对该漫画库中的所有作品使用此默认方向，直到你在阅读器中为某个系列更改方向为止。

## 扫描

- 保存漫画库，或更改其文件夹、模式或排除项时，会开始扫描。
- **Scan now**（立即扫描，即漫画库旁边的刷新按钮）可按需扫描；**Scan all**（全部扫描，有多个漫画库时显示）会扫描所有漫画库。
- **Automatic scan**（自动扫描）可设置为每 1、6、12 或 24 小时扫描一次，或从不自动扫描（**Manual only**，仅手动）。

扫描是增量进行的：未变化的文件会被跳过，已变化的文件会重新读取，新文件会被添加，缺失的文件会被移除。扫描进行时，侧边栏和漫画库列表会显示已找到的作品数量。

如果漫画库文件夹无法读取（例如 NAS 共享未挂载），扫描会报错停止，并保留现有索引。

## 编辑与移除

- 更改模式会重新标注作品，并保留阅读进度。
- 更改文件夹则会从头开始：旧索引及其阅读进度都会被丢弃。
- **Remove library**（移除漫画库）会从 Mangayomi 中移除该漫画库及其阅读进度，磁盘上的文件不受影响。

## 相关文档

- [扫描（架构）](../../architecture/scanning.md)
- [故障排查](../../operations/troubleshooting.md)
