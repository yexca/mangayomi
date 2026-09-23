# 快速上手

[English](../en/getting-started.md) · [简体中文](getting-started.md) · [繁體中文](../zh-Hant/getting-started.md) · [日本語](../ja/getting-started.md) · [한국어](../ko/getting-started.md)

## 环境要求

- 在 NAS 或服务器上安装 Docker 及 Docker Compose。
- 漫画以 `.zip`/`.cbz` 文件或图片文件夹的形式存放。
- 可选（用于本地开发）：Go 和 Node.js，详见
  [本地开发](../../development/local-dev.md)。

## 使用 Docker 运行

1. 将本仓库中的 `docker-compose.yml` 复制到 Docker 主机上的某个目录。它会拉取已发布的 `yexca/mangayomi` 镜像。
2. 修改 `docker-compose.yml` 中的数据卷，使其指向你的漫画目录：

   ```yaml
   volumes:
     - ./config:/config
     - /path/to/manga:/data
   ```

3. 可选：将 `.env.example` 复制为 `.env`，把 `PUID`/`PGID` 设置为文件所有者，或通过 `MANGAYOMI_PORT` 更换端口。
4. 启动服务：

   ```sh
   docker compose up -d
   ```

5. 访问 `http://<server-address>:7652`。

## 首次登录

首次访问时，系统会要求你创建一个密码（至少六个字符）。系统只有一个账户，所有设备都使用同一密码登录。会话有效期为 30 天，使用期间会自动续期。

忘记密码？请参阅[故障排查](../../operations/troubleshooting.md#forgot-the-password)。

## 添加第一个漫画库

1. 打开 **Settings**（设置），选择 **Add library**（添加漫画库）。
2. 在 **Folder**（文件夹）下选择 **Choose folder**（选择文件夹），然后选取 `/data` 中的一个文件夹。
3. 选择与你的目录结构相符的 **Folder structure**（文件夹结构），例如
   `Author/Series/Volume.cbz` 对应 `{author}/{series}`。
4. 可选：添加 **Excluded folders**（排除的文件夹）。
5. 选择 **Run preview**（运行预览），查看前 50 个作品将如何被解析。
6. 选择 **Save**（保存）。漫画库会在后台扫描，扫描完成后作品即会显示出来。

详细说明请参阅[漫画库与扫描](libraries.md)。

## 在手机上安装

在手机浏览器中打开实例，然后使用 **Add to Home Screen**（添加到主屏幕，Safari）或 **Install app**（安装应用，Chrome）。应用会以全屏方式打开，并保留最近阅读过的页面。除非使用 `localhost`，否则安装需要 HTTPS；详见 [Docker](../../operations/docker.md#reverse-proxy)。

## 后续步骤

- [阅读](reader.md)
- [浏览与管理作品](managing.md)
- [配置](../../operations/configuration.md)
