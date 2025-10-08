#!/usr/bin/env bash
set -euo pipefail

# ── 위치 계산 (apps/api 기준) ────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"          # apps/api
ENV_FILE="${APP_DIR}/.env"

# ── .env 자동 로드 (없으면 스킵; CI/크론에서 동작) ───────────
if [ -f "${ENV_FILE}" ]; then
  set -a
  . "${ENV_FILE}"
  set +a
fi

# ── 환경변수 읽기(외부에서 오버라이드 가능) ──────────────────
LICENSE_KEY="${MAXMIND_LICENSE_KEY:-}"
DB_DIR="${GEOIP_DB_DIR:-}"
TMP_DIR="$(mktemp -d)"

if [[ -z "$LICENSE_KEY" ]]; then
  echo "ERROR: MAXMIND_LICENSE_KEY is not set (in ${ENV_FILE} or environment)"
  exit 1
fi

mkdir -p "$DB_DIR"

# ── 동시에 받을 Edition 목록 정의 ────────────────────────────
EDITIONS=("GeoLite2-City" "GeoLite2-Country")

for EDITION in "${EDITIONS[@]}"; do
  echo "────────────────────────────────────────────"
  echo "Downloading ${EDITION}..."
  curl -fsSL \
    "https://download.maxmind.com/app/geoip_download?edition_id=${EDITION}&license_key=${LICENSE_KEY}&suffix=tar.gz" \
    -o "${TMP_DIR}/${EDITION}.tar.gz"

  echo "Extracting ${EDITION}..."
  tar -xzf "${TMP_DIR}/${EDITION}.tar.gz" -C "${TMP_DIR}"

  MMDB_PATH="$(find "${TMP_DIR}" -name "${EDITION}.mmdb" | head -n 1)"
  if [[ ! -f "$MMDB_PATH" ]]; then
    # GeoLite2의 경우 폴더명이 버전별로 바뀌므로 fallback 탐색
    MMDB_PATH="$(find "${TMP_DIR}" -type f -name "*.mmdb" | grep "${EDITION}" | head -n 1 || true)"
  fi

  if [[ -f "$MMDB_PATH" ]]; then
    DEST="${DB_DIR}/${EDITION}.mmdb"
    mv -f "$MMDB_PATH" "$DEST"
    echo "✅ Updated: $DEST"
  else
    echo "⚠️ WARNING: ${EDITION}.mmdb not found"
  fi

  # tmp 내 각 edition의 압축 해제 폴더 정리
  rm -rf "${TMP_DIR:?}/"*
done

rm -rf "$TMP_DIR"
echo "────────────────────────────────────────────"
echo "All MaxMind GeoLite2 DBs updated successfully!"