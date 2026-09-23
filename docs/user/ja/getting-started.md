# はじめに

[English](../en/getting-started.md) · [简体中文](../zh-Hans/getting-started.md) · [繁體中文](../zh-Hant/getting-started.md) · [日本語](getting-started.md) · [한국어](../ko/getting-started.md)

## 必要なもの

- NAS またはサーバー上の Docker と Docker Compose。
- `.zip`/`.cbz` ファイル、または画像フォルダーとして保存された漫画。
- ローカル開発を行う場合（任意）：Go と Node.js。詳しくは [ローカル開発](../../development/local-dev.md) を参照してください。

## Docker で実行する

1. このリポジトリを Docker ホストに配置します。
2. `docker-compose.yml` のデータボリュームを編集し、漫画の保存先を指すようにします。

   ```yaml
   volumes:
     - ./config:/config
     - /path/to/manga:/data
   ```

3. 必要に応じて `.env.example` を `.env` にコピーし、`PUID`/`PGID` にファイルの所有者を設定します。別のポートを使う場合は `MANGAYOMI_PORT` を設定します。
4. 起動します。

   ```sh
   docker compose up -d --build
   ```

5. `http://<server-address>:8080` を開きます。

## 初回サインイン

初めてアクセスすると、パスワード（6 文字以上）の作成を求められます。アカウントは 1 つだけで、どのデバイスでも同じパスワードでサインインします。セッションの有効期間は 30 日間で、使用している間は自動的に延長されます。

パスワードを忘れた場合は、[トラブルシューティング](../../operations/troubleshooting.md#forgot-the-password)を参照してください。

## 最初のライブラリを追加する

1. **Settings**（設定）を開き、**Add library**（ライブラリを追加）を選択します。
2. **Folder**（フォルダー）で **Choose folder**（フォルダーを選択）を選び、`/data` 内のフォルダーを選択します。
3. 現在のフォルダー構成に合った **Folder structure**（フォルダー構成）を選びます。たとえば `Author/Series/Volume.cbz` という構成なら `{author}/{series}` です。
4. 必要に応じて **Excluded folders**（除外フォルダー）を追加します。
5. **Run preview**（プレビューを実行）を選ぶと、最初の 50 作品がどのように解析されるかを確認できます。
6. **Save**（保存）を選択します。ライブラリはバックグラウンドでスキャンされ、スキャンが完了すると作品が表示されます。

詳しくは[ライブラリとスキャン](libraries.md)を参照してください。

## スマートフォンにインストールする

スマートフォンのブラウザーでインスタンスを開き、**Add to Home Screen**（ホーム画面に追加、Safari）または **Install app**（アプリをインストール、Chrome）を使用します。アプリは全画面で起動し、最近読んだページをすぐに表示できるよう保持します。`localhost` を使う場合を除き、インストールには HTTPS が必要です。詳しくは [Docker](../../operations/docker.md#reverse-proxy) を参照してください。

## 次のステップ

- [読む](reader.md)
- [作品の閲覧と管理](managing.md)
- [設定リファレンス（Configuration）](../../operations/configuration.md)
