# mini-momguide

맘가이드 학습용 미니 클론. Express + TypeScript + Sequelize + MySQL + Redis + Elasticsearch + BullMQ.

## 실행

```bash
# 1. 의존성 설치
npm install

# 2. 인프라 띄우기 (MySQL + Redis + Elasticsearch)
npm run db:up

# 3. 서버 실행
npm run dev
```

health check: http://localhost:3000/health

## 단계

- [x] **Step 0** 프로젝트 셋업 + Docker Compose
- [ ] **Step 1** 카테고리/제품 CRUD (Sequelize)
- [ ] **Step 2** 제품 상세 + 성분 그루핑
- [ ] **Step 3** Elasticsearch 검색/aggregation
- [ ] **Step 4** BullMQ MySQL→ES 동기화
- [ ] **Step 5** (옵션) 간단 어드민
