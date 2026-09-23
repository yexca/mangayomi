.PHONY: backend-format backend-vet backend-test backend-race backend-coverage backend-verify backend-vuln backend-build backend-run sample-data
.PHONY: frontend-install frontend-dev frontend-build frontend-lint frontend-typecheck frontend-audit
.PHONY: docs docs-links docs-locales sensitive-check
.PHONY: docker-build docker-up docker-down docker-status docker-logs smoke
.PHONY: ci-style ci-backend ci-frontend ci-local ci

GO ?= go
NPM ?= npm
NODE ?= node
DOCKER ?= docker
DOCKER_IMAGE ?= mangayomi:dev
DOCKER_COMPOSE_DEV ?= $(DOCKER) compose -f docker-compose.dev.yml
DOCKER_BUILD_ARGS ?=
GOVULNCHECK_VERSION ?= v1.7.0
GO_DIRS := cmd internal scripts

ifeq ($(OS),Windows_NT)
APP_VERSION := $(shell powershell -NoProfile -Command "(Get-Content -Raw VERSION).Trim()")
BIN := bin/mangayomi.exe
else
APP_VERSION := $(shell tr -d '\r\n' < VERSION)
BIN := bin/mangayomi
endif

GO_LDFLAGS := -X main.version=$(APP_VERSION)

# ---- backend ----

backend-format:
	$(GO) run ./scripts/gofmtcheck $(GO_DIRS)

backend-vet:
	$(GO) vet ./...

backend-test:
	$(GO) test ./...

# Requires cgo (a C toolchain) for the race detector.
backend-race:
	$(GO) test -race ./...

backend-coverage:
	$(GO) test -count=1 -covermode atomic -coverprofile coverage.out ./...
	$(GO) tool cover -func coverage.out

backend-verify:
	$(GO) mod verify

backend-vuln:
	$(GO) run golang.org/x/vuln/cmd/govulncheck@$(GOVULNCHECK_VERSION) ./...

backend-build:
	$(GO) build -trimpath -ldflags "$(GO_LDFLAGS)" -o $(BIN) ./cmd/mangayomi

backend-run:
	$(GO) run -ldflags "$(GO_LDFLAGS)" ./cmd/mangayomi

# Writes a small synthetic library for local development.
sample-data:
	$(GO) run ./cmd/sampledata data/sample

# ---- frontend ----

frontend-install:
	cd web && $(NPM) ci

frontend-dev: frontend-install
	cd web && $(NPM) run dev

frontend-build: frontend-install
	cd web && $(NPM) run build

frontend-lint: frontend-install
	cd web && $(NPM) run lint

frontend-typecheck: frontend-install
	cd web && $(NPM) run typecheck

frontend-audit: frontend-install
	cd web && $(NPM) audit --audit-level=moderate

# ---- docs and privacy ----

docs: docs-links docs-locales

docs-links:
	$(NODE) scripts/check-doc-links.mjs

docs-locales:
	$(NODE) scripts/check-doc-locales.mjs

sensitive-check:
	$(NODE) scripts/check-sensitive.mjs

# ---- docker ----

docker-build:
	$(DOCKER) build $(DOCKER_BUILD_ARGS) --build-arg VERSION=$(APP_VERSION) -t $(DOCKER_IMAGE) .

docker-up:
	$(DOCKER_COMPOSE_DEV) up -d --build

docker-down:
	$(DOCKER_COMPOSE_DEV) down

docker-status:
	$(DOCKER_COMPOSE_DEV) ps

docker-logs:
	$(DOCKER_COMPOSE_DEV) logs --no-color --tail 200 mangayomi

smoke: docker-build
	$(NODE) scripts/smoke.mjs $(DOCKER_IMAGE)

# ---- aggregates ----

ci-style: backend-format frontend-lint frontend-typecheck docs

ci-backend: backend-verify backend-vet backend-test backend-race backend-vuln

ci-frontend: frontend-audit frontend-build

# Everything GitHub Actions runs, available locally.
ci-local: ci-style ci-backend ci-frontend smoke

ci: ci-local
