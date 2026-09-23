<p align="center">
  <img src="../assets/mangayomi-icon.png" width="128" height="128" alt="Mangayomi 로고">
</p>

<h1 align="center">Mangayomi</h1>

<p align="center">
  NAS를 위한 셀프 호스팅 만화 라이브러리 및 리더입니다.
</p>

<p align="center">
  <a href="../README.md">문서</a> ·
  <a href="../../SECURITY.md">보안</a> ·
  <a href="../../PRIVACY.md">개인정보 보호</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-Hans.md">简体中文</a> ·
  <a href="README.zh-Hant.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

Mangayomi는 NAS에 이미 보관하고 있는 만화 압축 파일과 이미지 폴더를 색인하고,
폴더 구성에서 작가와 시리즈 정보를 추출하여, 휴대폰과 태블릿에 PWA로 설치할 수
있는 반응형 웹 리더로 제공합니다. Go 서버와 React 프런트엔드로 구성되어 있으며,
SQLite를 사용하는 하나의 Docker 이미지로 패키징됩니다.

> [!IMPORTANT]
> Mangayomi는 현재 활발히 개발 중입니다. 업그레이드하기 전에 `config/`를
> 백업하고, 인스턴스를 네트워크에 공개하기 전에
> [배포 보안](../operations/security.md) 문서를 검토하십시오. 삭제 기능은
> 저장소에서 파일을 영구적으로 제거합니다.

## 주요 기능

- **내 폴더, 내 구조 그대로.** `/data` 아래의 어떤 폴더든 라이브러리로 추가하고,
  하위 폴더를 제외하고, `{author}/{series}` 같은 패턴으로 폴더 구성을 지정할 수
  있습니다. 저장하기 전에 미리보기로 각 작품이 어떻게 해석되는지 확인할 수
  있습니다.
- **압축 파일과 이미지 폴더 지원.** `.zip` 또는 `.cbz` 파일은 하나의 작품입니다.
  이미지를 직접 담고 있는 폴더도 하나의 작품이며, 폴더 이름은 작가나 시리즈가
  아니라 제목으로 사용됩니다.
- **증분 스캔과 예약 스캔.** 필요할 때 바로 스캔하거나 1–24시간마다 스캔할 수
  있습니다. 변경되지 않은 파일은 건너뛰며, 라이브러리 루트에 접근할 수 없더라도
  색인이 지워지지 않습니다.
- **휴대폰에 맞춘 리더.** 오른쪽에서 왼쪽 또는 왼쪽에서 오른쪽 읽기(시리즈별로
  기억), 단일·양면·자동 페이지 레이아웃, 넓은 펼침 페이지의 단독 표시, 탭 영역,
  스와이프, 키보드 단축키, 자동 진행 상황 동기화를 지원합니다.
- **신중한 삭제.** 작품 하나, 여러 개를 선택한 항목, 시리즈 전체 또는 한 작가의
  모든 작품을 삭제할 수 있습니다. 첫 번째 단계에서 제거될 모든 파일과 폴더를
  나열하고, 두 번째 단계에서 명시적인 확인을 요청합니다.
- **가볍고 사적인 운영.** 단일 사용자 비밀번호 로그인만 사용하며, 외부 서비스와
  원격 측정(telemetry)이 없습니다.

## 빠른 시작

### 1. 배포 디렉터리 준비하기

[`docker-compose.yml`](../../docker-compose.yml)과 이 저장소의 나머지 파일을
Docker 호스트에 둡니다(이미지는 로컬에서 빌드됩니다). 포트, 이미지, 파일 소유
사용자를 변경하려면 필요에 따라 [`.env.example`](../../.env.example)을 `.env`로
복사합니다.

### 2. `/data`가 만화를 가리키도록 설정하기

`docker-compose.yml`의 `./data:/data` 볼륨을 만화 공유 폴더를 가리키도록
수정합니다(예: `/path/to/manga:/data`). `.env`의 `PUID`와 `PGID`를 해당 파일의
소유자로 설정합니다(NAS에서 `id`를 실행하여 확인).

### 3. Mangayomi 시작하기

```sh
docker compose up -d --build
```

<http://127.0.0.1:8080>을 열고 비밀번호를 만든 다음
**Settings → Libraries**에서 라이브러리를 추가합니다. 자세한 안내는
[시작하기](../user/ko/getting-started.md)를 참고하십시오.

## 런타임 데이터

| 호스트 경로 | 컨테이너 경로 | 용도 | 백업 필요 여부 |
| --- | --- | --- | --- |
| `./config` | `/config` | SQLite 데이터베이스(라이브러리, 진행 상황, 세션)와 표지 캐시 | 예 |
| `./data` | `/data` | 사용자의 만화. 읽을 때만 읽기 접근하며, 삭제할 때만 쓰기 접근 | 사용자가 직접 백업 |

이 런타임 디렉터리는 커밋하지 마십시오. 비공개 미디어, 비밀번호 해시, 세션
상태가 포함될 수 있습니다.

## 문서

| 목적 | 시작 문서 |
| --- | --- |
| Mangayomi 사용하기 | [사용자 가이드](../user/index.md) |
| 설치하고 첫 라이브러리 스캔하기 | [시작하기](../user/ko/getting-started.md) |
| 인스턴스 구성 및 운영하기 | [운영](../operations/configuration.md) |
| 시스템 이해하기 | [아키텍처](../architecture/index.md) |
| 설계 및 보안 계약 검토하기 | [설계](../development/design.md) · [보안](../../SECURITY.md) · [개인정보 보호](../../PRIVACY.md) |
| 모든 공개 문서 찾기 | [문서 색인](../README.md) |

## 개발 및 기여

개발 환경 설정, 검증 명령, 릴리스 절차는 `docs/development/` 아래에 따로
정리되어 있으므로, 이 README는 설치와 제품 동작에 집중합니다.

- [로컬 개발](../development/local-dev.md)
- [테스트](../development/testing.md)
- [기여하기](../../CONTRIBUTING.md)
- [에이전트 가이드](../../AGENTS.md)

## 보안 및 개인정보 보호

로그인과 상태 확인(health check)을 제외한 모든 API 호출에는 단일 사용자의
비밀번호가 필요합니다.
Mangayomi는 외부로 나가는 네트워크 요청을 전혀 보내지 않습니다. 취약점이
의심되면 [SECURITY.md](../../SECURITY.md)에 안내된 비공개 절차를 통해
신고하고, 로그나 진단 정보를 공유하기 전에 [PRIVACY.md](../../PRIVACY.md)를
검토하십시오.
