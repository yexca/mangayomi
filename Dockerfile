# syntax=docker/dockerfile:1

# The build stages run on the build host and cross-compile, so multi-platform
# images only emulate the small runtime stage.
#
# Base images are pinned by digest. Go matches go.mod and Node matches
# .nvmrc; upgrade those toolchains by hand. Dependabot refreshes Alpine.

# ---- frontend ----
FROM --platform=$BUILDPLATFORM node:24.22.1-alpine@sha256:6a1c190e17215d844926b0677f4bf87273ff7d5e54db06d3b5b5863ab0b09a3d AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- backend ----
FROM --platform=$BUILDPLATFORM golang:1.27.4-alpine@sha256:0a5f7fe796599ff487605987432e7619ae45beeb2fba4c2ce0b907879932aebf AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
ARG VERSION=dev
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/mangayomi ./cmd/mangayomi

# ---- runtime ----
FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
RUN apk add --no-cache ca-certificates tzdata su-exec
COPY --from=server /out/mangayomi /app/mangayomi
COPY --from=web /src/dist /app/web
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV MANGAYOMI_ADDR=:7652 \
    MANGAYOMI_CONFIG_DIR=/config \
    MANGAYOMI_DATA_DIR=/data \
    MANGAYOMI_WEB_DIR=/app/web \
    PUID=1000 \
    PGID=1000

VOLUME ["/config", "/data"]
EXPOSE 7652
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/app/mangayomi", "healthcheck"]
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["serve"]
