# 시작하기

[English](../en/getting-started.md) · [简体中文](../zh-Hans/getting-started.md) · [繁體中文](../zh-Hant/getting-started.md) · [日本語](../ja/getting-started.md) · [한국어](getting-started.md)

## 요구 사항

- NAS 또는 서버에 설치된 Docker와 Docker Compose
- `.zip`/`.cbz` 파일 또는 이미지 폴더 형태의 만화
- 선택 사항(로컬 개발용): Go와 Node.js.
  [로컬 개발](../../development/local-dev.md)을 참고하십시오.

## Docker로 실행하기

1. 이 저장소를 Docker 호스트에 둡니다.
2. `docker-compose.yml`의 데이터 볼륨이 만화가 있는 위치를 가리키도록
   수정합니다.

   ```yaml
   volumes:
     - ./config:/config
     - /path/to/manga:/data
   ```

3. 필요하면 `.env.example`을 `.env`로 복사한 뒤 `PUID`/`PGID`를 파일 소유자에
   맞게 설정하거나, 다른 포트를 쓰려면 `MANGAYOMI_PORT`를 설정합니다.
4. 실행합니다.

   ```sh
   docker compose up -d --build
   ```

5. `http://<server-address>:8080`을 엽니다.

## 첫 로그인

처음 접속하면 비밀번호(6자 이상)를 만들라는 화면이 나옵니다. 계정은 하나뿐이며,
모든 기기에서 같은 비밀번호로 로그인합니다. 세션은 30일 동안 유지되고, 사용하는
동안 계속 연장됩니다.

비밀번호를 잊으셨다면 [문제 해결](../../operations/troubleshooting.md#forgot-the-password)을 참고하십시오.

## 첫 라이브러리 추가하기

1. **Settings**(설정)를 열고 **Add library**(라이브러리 추가)를 선택합니다.
2. **Folder**(폴더)에서 **Choose folder**(폴더 선택)를 선택하고 `/data` 안의
   폴더를 고릅니다.
3. 폴더 구성에 맞는 **Folder structure**(폴더 구조)를 고릅니다. 예를 들어
   `Author/Series/Volume.cbz` 구성이라면 `{author}/{series}`를 선택합니다.
4. 필요하면 **Excluded folders**(제외 폴더)를 추가합니다.
5. **Run preview**(미리보기 실행)를 선택하면 처음 50개 작품이 어떻게 해석되는지
   확인할 수 있습니다.
6. **Save**(저장)를 선택합니다. 라이브러리는 백그라운드에서 스캔되며, 스캔이
   끝나는 즉시 작품이 표시됩니다.

자세한 내용은 [라이브러리와 스캔](libraries.md)을 참고하십시오.

## 휴대폰에 설치하기

휴대폰 브라우저에서 인스턴스를 열고 **Add to Home Screen**(홈 화면에 추가,
Safari) 또는 **Install app**(앱 설치, Chrome)을 사용합니다. 앱은 전체 화면으로
열리며, 최근에 읽은 페이지를 계속 볼 수 있도록 보관합니다. `localhost`를
사용하는 경우가 아니라면 설치하려면 HTTPS가 필요합니다.
[Docker](../../operations/docker.md#reverse-proxy)를 참고하십시오.

## 다음 단계

- [읽기](reader.md)
- [작품 탐색과 관리](managing.md)
- [구성](../../operations/configuration.md)
