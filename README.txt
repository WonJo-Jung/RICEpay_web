# RicePay Fixed Setup

## 설치 방법
1. 의존성 설치
```
pnpm i
```

2. React 버전 18.2.0 맞추기 (경고 제거용)
```
pnpm up react@18.2.0 react-dom@18.2.0 --latest
```

3. API .env 설정
```
cp apps/api/.env.example apps/api/.env
```

4. DB 마이그레이션
```
cd apps/api
pnpm dlx prisma migrate dev
```

5. 개발 서버 실행
```
pnpm dev
```

