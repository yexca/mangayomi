# syntax=docker/dockerfile:1

# The build stages run on the build host and cross-compile, so multi-platform
# images only emulate the small runtime stage.
#
# Base images are pinned by digest. Go matches go.mod and Node the major in
# .nvmrc; upgrade those toolchains by hand. Dependabot refreshes Alpine.

# ---- frontend ----
FROM --platform=$BUILDPLATFORM node:24.22.1-alpine@sha256:6a1c190e17215d844926b0677f4bf87273ff7d5e54db06d3b5b5863ab0b09a3d AS web
WORKDIR /src
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ---- backend ----
FROM --platform=$BUILDPLATFORM golang:1.27.3-alpine@sha256:f2c872bcee949b7be9c490efd02b48a8a2fbf947cdf533f1c58525ec9d8170fd AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY cmd/ ./cmd/
COPY internal/ ./internal/
ARG VERSION=dev
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/mangayomi ./cmd/mangayomi

# ---- runtime ----
FROM alpine:3.22.6@sha256:5291449c3df73caf6ed85e649dec1b9e818b39a5d8c871e97afc13e9cd5e8fa8
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
