# 🧱 RICE Pay Migration & Database Infrastructure Guide

> **목적:**  
> 이 문서는 RICE Pay API 서버의 Prisma/PostgreSQL 기반 데이터베이스 마이그레이션 및 관리 절차를 표준화하여,  
> “마이그레이션 꼬임”이나 “데이터 손실” 없이 안정적인 스키마 관리를 보장하기 위한 지침서입니다.

---

## ⚙️ 1. 기본 구조

- ORM: Prisma  
- DB: PostgreSQL (local dev: `localhost:5432`, prod: AWS RDS 예정)  
- 마이그레이션 경로: `apps/api/prisma/migrations/`
- Prisma schema: `apps/api/prisma/schema.prisma`
- 마이그레이션 테이블: `_prisma_migrations`

---

## 🧩 2. 마이그레이션 절차

### ✅ 일반적인 변경
```bash
pnpm prisma migrate dev --name <migration-name>
```
- 새로운 모델 추가, 필드 추가 등 스키마 변경 시마다 수행
- `migration.sql` 파일 자동 생성 및 DB에 즉시 반영

---

### 🧪 실험용 변경
```bash
pnpm prisma migrate dev --create-only --name test-change
```
- 파일만 생성되고 실제 DB에는 적용되지 않음
- SQL 검토 후 확정 시 `pnpm prisma migrate dev`로 적용

---

### 🧱 초기화 이후 기준선 재정의 (Baseline)
```bash
pnpm prisma migrate diff   --from-empty   --to-schema-datasource prisma/schema.prisma   --script > prisma/migrations/YYYYMMDDHHMMSS_baseline/migration.sql

pnpm prisma migrate resolve --applied YYYYMMDDHHMMSS_baseline
```
> 💡 데이터는 보존한 채 “이 시점이 기준이다”라고 선언할 때 사용

---

## ⚡️ 3. 금지 사항

| ❌ 금지 행위 | ⚠️ 이유 |
|---------------|--------|
| 기존 migration.sql 파일 수정 | Prisma는 해시값이 달라지면 “modified after applied” 오류 발생 |
| 동일 migration 이름으로 rollback 반복 | `_prisma_migrations`에 중복 기록 → reset 요구 발생 |
| 수동 쿼리로 스키마 수정 | Prisma schema와 실제 DB 불일치 발생 (“drift detected”) |
| `resolve --rolled-back`로 되돌리기 | Prisma 공식적으로 rollback 미지원, 기록 꼬임 유발 |

---

## 🔁 4. 복구 및 유지보수

### ⚙️ Drift Detected / Shadow DB Error 발생 시
```bash
psql -U <user> -h localhost -c "DROP DATABASE IF EXISTS ricepay_shadow;"
psql -U <user> -h localhost -c "CREATE DATABASE ricepay_shadow;"
```

### ⚙️ Drift가 반복될 때 (데이터 유지)
```bash
pnpm prisma migrate diff   --from-empty   --to-schema-datasource prisma/schema.prisma   --script > prisma/migrations/YYYYMMDDHHMMSS_baseline/migration.sql
pnpm prisma migrate resolve --applied YYYYMMDDHHMMSS_baseline
```

### ⚙️ 완전 초기화 (데이터 삭제됨)
```bash
pnpm prisma migrate reset
```
> ⚠️ 모든 테이블, 데이터, 마이그레이션 히스토리 삭제

---

## 🛡 5. 백업 정책

### 수동 백업
```bash
pg_dump -U <user> -h localhost ricepay > ricepay_backup_$(date +%Y%m%d_%H%M).sql
```

### 복원
```bash
psql -U <user> -h localhost -d ricepay -f ricepay_backup_<timestamp>.sql
```

### 자동화 제안 (cron)
- 로컬 개발용: 1일 1회 백업
- 운영 환경: AWS RDS snapshot + S3 자동 보관

---

## 🧮 6. 데이터 일관성 관리

### ✅ Unique 제약 복원 시 절차
```sql
UPDATE "Transaction" SET "lastEventId" = NULL WHERE "lastEventId" = '';
UPDATE "Receipt" SET "shareToken" = NULL WHERE "shareToken" = '';

SELECT "shareToken", COUNT(*) FROM "Receipt" GROUP BY "shareToken" HAVING COUNT(*) > 1;
SELECT "lastEventId", COUNT(*) FROM "Transaction" GROUP BY "lastEventId" HAVING COUNT(*) > 1;
```
→ 중복이 없으면 안전하게 unique 복원 (`@unique` 추가 + migrate dev)

---

## 🚀 7. 운영 전 “스쿼시(Squash)” 절차

```bash
pnpm prisma migrate diff --from-empty --to-schema-datasource prisma/schema.prisma --script > prisma/migrations/YYYYMMDDHHMMSS_baseline/migration.sql
rm -rf prisma/migrations/*_dev*
pnpm prisma migrate resolve --applied YYYYMMDDHHMMSS_baseline
```

---

## 🧭 8. 베스트 프랙티스 요약

| 항목 | 권장 방식 |
|------|-----------|
| 스키마 변경 실험 | `--create-only` |
| 적용된 migration 변경 | ❌ 절대 금지 |
| rollback 필요 시 | 새 migration으로 revert |
| drift 해결 | baseline 생성 |
| shadow DB 문제 | drop & recreate |
| 운영 전 통합 | squash baseline |
| 정기 백업 | `pg_dump` or RDS snapshot |
| unique 복원 시 | NULL 정리 후 migrate |

---

## 🧩 9. 유용한 명령어 요약

| 목적 | 명령어 |
|------|--------|
| 현재 상태 확인 | `pnpm prisma migrate status` |
| 마이그레이션 생성 | `pnpm prisma migrate dev --name <name>` |
| 파일만 생성 | `pnpm prisma migrate dev --create-only` |
| 초기화 | `pnpm prisma migrate reset` |
| 스키마 기준선 재정의 | `pnpm prisma migrate resolve --applied <baseline>` |
| diff 출력 | `pnpm prisma migrate diff --from-empty --to-schema-datasource prisma/schema.prisma --script` |

---

## 🧠 부록: 트러블슈팅 요약

| 증상 | 원인 | 해결 |
|------|------|------|
| `modified after applied` | 기존 migration.sql 수정됨 | 파일 복원 또는 baseline 생성 |
| `relation already exists` | shadow DB 충돌 | drop & recreate shadow DB |
| `drift detected` | Prisma schema와 DB 불일치 | baseline으로 재정렬 |
| `P3018` / `P3006` | migration 실패 | `migrate reset` 또는 baseline 생성 |
| unique 추가 시 경고 | Prisma의 사전 경고 | 중복 없는지 확인 후 진행 |

---

## ✅ 결론

RICE Pay의 데이터베이스는 **한 번의 마이그레이션 꼬임이 곧 전체 스키마 붕괴**로 이어질 수 있습니다.  
이 문서를 기준으로, 모든 개발자는 다음 원칙을 반드시 지킵니다.

> “**이미 적용된 migration은 수정하지 않는다.  
> 새로운 migration만 추가한다.  
> 모든 변경은 baseline으로 정리한다.**”
