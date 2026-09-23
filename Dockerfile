# syntax=docker/dockerfile:1

# The build stages run on the build host and cross-compile, so multi-platform
# images only emulate the small runtime stage.

# ---- frontend ----
FROM --platform=$BUILDPLATFORM node:24-alpine AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- backend ----
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
ARG VERSION=dev
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/mangayomi ./cmd/mangayomi

# ---- runtime ----
FROM alpine:3.22
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
