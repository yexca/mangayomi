<p align="center">
  <img src="../assets/mangayomi-icon.png" width="128" height="128" alt="Mangayomi logo">
</p>

<h1 align="center">Mangayomi</h1>

<p align="center">
  为你的 NAS 打造的自托管漫画库与阅读器。
</p>

<p align="center">
  <a href="../README.md">文档</a> ·
  <a href="../../SECURITY.md">安全</a> ·
  <a href="../../PRIVACY.md">隐私</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-Hans.md">简体中文</a> ·
  <a href="README.zh-Hant.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

Mangayomi 会为你已存放在 NAS 上的漫画压缩包和图片文件夹建立索引，根据文件夹结构识别作者和系列，并通过响应式网页阅读器提供阅读服务；该阅读器可作为 PWA 安装到手机和平板上。Mangayomi 由 Go 服务端和 React 前端组成，打包为一个以 SQLite 为存储的 Docker 镜像。

> [!IMPORTANT]
> Mangayomi 仍在积极开发中。升级前请备份 `config/`，并在将实例暴露到网络之前阅读[部署安全](../operations/security.md)说明。删除功能会从你的存储中永久移除文件。

## 主要功能

- **你的文件夹，你的结构**。可将 `/data` 下的任意文件夹添加为漫画库，排除子文件夹，并用 `{author}/{series}` 之类的模式描述目录结构。保存前，预览会展示每个作品将如何被解析。
- **支持压缩包和图片文件夹**。一个 `.zip` 或 `.cbz` 文件就是一个作品。直接包含图片的文件夹同样是一个作品，其名称会作为标题，而不会被当作作者或系列。
- **增量扫描与定时扫描**。可按需扫描，也可每 1–24 小时自动扫描。未变化的文件会被跳过，漫画库根目录无法访问时也绝不会清空索引。
- **专为手机打造的阅读器**。支持从右到左或从左到右阅读（按系列记忆）、单页 / 双页 / 自动页面布局、宽幅跨页单独显示、点击区域翻页、滑动翻页、键盘快捷键，以及自动同步阅读进度。
- **谨慎的删除机制**。可删除单个作品、多选的作品、整个系列或某位作者的全部作品。第一步会列出将被移除的每个文件和文件夹，第二步则要求你明确确认。
- **轻量且注重隐私**。单用户密码登录，不依赖任何外部服务，没有遥测。

## 快速开始

### 1. 准备部署目录

将 [`docker-compose.yml`](../../docker-compose.yml) 和本仓库的其余内容放到 Docker 主机上（镜像在本地构建）。可选：将 [`.env.example`](../../.env.example) 复制为 `.env`，以更改端口、镜像或文件所有者用户。

### 2. 将 `/data` 指向你的漫画

修改 `docker-compose.yml` 中的 `./data:/data` 数据卷，使其指向你的漫画共享目录，例如 `/path/to/manga:/data`。在 `.env` 中将 `PUID` 和 `PGID` 设置为这些文件的所有者（在 NAS 上运行 `id` 即可查看）。

### 3. 启动 Mangayomi

```sh
docker compose up -d --build
```

打开 <http://127.0.0.1:8080>，创建密码，然后在 **Settings → Libraries** 中添加漫画库。完整步骤请参阅[快速上手](../user/zh-Hans/getting-started.md)。

## 运行时数据

| 主机路径 | 容器路径 | 用途 | 是否备份？ |
| --- | --- | --- | --- |
| `./config` | `/config` | SQLite 数据库（漫画库、阅读进度、会话）和封面缓存 | 是 |
| `./data` | `/data` | 你的漫画。阅读时只读取，仅在你删除时写入 | 由你自行备份 |

请勿提交这些运行时目录。它们可能包含私人媒体、密码哈希和会话状态。

## 文档

| 目标 | 从这里开始 |
| --- | --- |
| 使用 Mangayomi | [用户指南](../user/index.md) |
| 安装并扫描第一个漫画库 | [快速上手](../user/zh-Hans/getting-started.md) |
| 配置和运维实例 | [运维](../operations/configuration.md) |
| 了解系统原理 | [架构](../architecture/index.md) |
| 查阅设计与安全约定 | [设计](../development/design.md) · [安全](../../SECURITY.md) · [隐私](../../PRIVACY.md) |
| 查找所有公开文档 | [文档索引](../README.md) |

## 开发与贡献

开发环境搭建、验证命令和发布流程都放在 `docs/development/` 下，这样本 README 可以专注于安装和产品功能。

- [本地开发](../development/local-dev.md)
- [测试](../development/testing.md)
- [贡献指南](../../CONTRIBUTING.md)
- [Agent 指南](../../AGENTS.md)

## 安全与隐私

除登录和健康检查外，所有 API 调用都需要该唯一用户的密码。
Mangayomi 不会发起任何出站网络请求。如发现疑似漏洞，请按照 [SECURITY.md](../../SECURITY.md) 中的私下报告流程进行报告；在分享日志或诊断信息之前，请先阅读 [PRIVACY.md](../../PRIVACY.md)。
