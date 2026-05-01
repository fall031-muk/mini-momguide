# mini-momguide

맘가이드(육아 성분 분석 앱)의 핵심 도메인을 학습 목적으로 재현한 백엔드 프로젝트.
실제 맘가이드 API 응답을 DevTools로 분석하고, 채용 JD 스택에 맞춰 설계했습니다.

## 기술 스택

| 영역 | 기술 |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express |
| ORM | Sequelize (MySQL) |
| Search | Elasticsearch 8 + nori (한글 형태소 분석) |
| Queue | BullMQ (Redis) |
| Cache | Redis (ioredis) |
| Infra | Docker Compose (MySQL, Redis, ES, Kibana) |
| Logging | Pino |
| Validation | Zod |
| Auth | JWT (jsonwebtoken) + bcrypt |

## 아키텍처

```
┌────────────────────────────────────────────────────────┐
│  Client                                                │
└──────────┬─────────────────────────────────────────────┘
           │ HTTP
           ▼
┌────────────────────────────────────────────────────────┐
│  Express API Server                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐ │
│  │Categories│ │Products  │ │Reviews   │ │Search     │ │
│  │  route   │ │  route   │ │  route   │ │  route    │ │
│  │  service │ │  service │ │  service │ │  service  │ │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘ │
│       │             │            │             │       │
│       ▼             ▼            ▼             ▼       │
│  ┌─────────┐  ┌──────────┐              ┌──────────┐  │
│  │Sequelize│  │  BullMQ  │              │ ES Client│  │
│  │ Models  │  │ Producer │              │          │  │
│  └────┬────┘  └────┬─────┘              └────┬─────┘  │
└───────┼─────────────┼───────────────────────┼─────────┘
        │             │                       │
        ▼             ▼                       ▼
   ┌─────────┐   ┌─────────┐          ┌──────────────┐
   │  MySQL  │   │  Redis  │          │Elasticsearch │
   │ (Source │   │ (Queue +│          │ (Search      │
   │ of Truth│   │  Cache) │          │  Index)      │
   └─────────┘   └────┬────┘          └──────────────┘
                      │                       ▲
                      ▼                       │
               ┌─────────────┐                │
               │ BullMQ      │    indexProductById()
               │ Workers     │────────────────┘
               │             │
               │ - indexer   │  제품 변경 → ES 색인
               │ - views     │  5분마다 Redis→DB flush
               │ - ranking   │  매일 03:00 랭킹 재계산
               └─────────────┘
```

## 데이터 모델 (ERD)

```
┌──────────────┐         ┌──────────────────────┐
│  categories  │◄────┐   │       brands         │
│──────────────│     │   │──────────────────────│
│ id (PK)      │     │   │ id (PK)              │
│ name         │     │   │ name (UQ)            │
│ parent_id FK │─────┘   │ img_url              │
│ depth        │ self-ref └──────────┬───────────┘
│ sort_order   │                     │
└──────┬───────┘                     │
       │ 1:N                         │ 1:N
       ▼                             ▼
          ┌────────────────────────┐
          │       products         │
          │────────────────────────│
          │ id (PK)                │
          │ name                   │
          │ brand_id FK            │
          │ category_id FK         │
          │ views, score_sum/cnt   │
          │ product_grade    A~X   │
          │ ingredient_grade O/△/X │
          │ rank, rank_diff        │
          └──┬─────────────────┬───┘
             │ 1:N             │ N:M
             ▼                 ▼
      ┌──────────────┐   ┌──────────────────────┐
      │   reviews    │   │ product_ingredients  │
      │──────────────│   │──────────────────────│
      │ id (PK)      │   │ product_id (PK,FK)   │
      │ user_id FK   │   │ ingredient_id (PK,FK)│
      │ product_id FK│   │ display_order        │
      │ score 1~5    │   └──────────┬───────────┘
      │ content      │              │
      └──────┬───────┘              ▼
             │           ┌──────────────────────┐
             ▼           │     ingredients      │
      ┌──────────────┐   │──────────────────────│
      │    users     │   │ id (PK)              │
      │──────────────│   │ kor_name, eng_name   │
      │ id (PK)      │   │ ewg_grade       A~X  │
      │ nickname(UQ) │   │ is_fragrance (bool)  │
      └──────────────┘   │ is_sls_sles  (bool)  │
                         │ is_color     (bool)  │
                         │ is_humid     (bool)  │
                         │ is_allergic  (bool)  │
                         └──────────────────────┘
```

## API 목록

### Public API

| Method | Path | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| GET | `/api/categories` | 카테고리 트리 (재귀 조립) |
| POST | `/api/categories` | 카테고리 생성 |
| GET | `/api/products` | 제품 리스트 (필터/정렬/페이지네이션) |
| GET | `/api/products/:id` | 제품 상세 + 성분 다축 그루핑 |
| POST | `/api/products` | 제품 생성 → BullMQ로 ES 자동 색인 |
| GET | `/api/brands` | 브랜드 목록 |
| POST | `/api/brands` | 브랜드 생성 |
| GET | `/api/products/:id/reviews` | 리뷰 목록 |
| POST | `/api/products/:id/reviews` | 리뷰 작성 → 평점 집계 + ES 재색인 |

### Auth API

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/auth/signup` | 회원가입 → JWT 발급 |
| POST | `/api/auth/login` | 로그인 → JWT 발급 |

요청 body: `{ email, password, nickname }` (signup) / `{ email, password }` (login)
응답에 `token` 포함. 이후 API는 `Authorization: Bearer <token>` 헤더 사용.

### Order / Payment API (인증 필요)

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/orders` | 주문 생성 (트랜잭션 + 원자적 재고 차감, status=PENDING) |
| GET | `/api/orders/:id` | 본인 주문 조회 |
| POST | `/api/payments/confirm` | Mock PG 호출 → 결제 승인 → status=PAID |

**결제 플로우**:
1. `POST /api/orders` `{ items: [{ productId, quantity }] }` → `orderUid`, `totalAmount` 응답
2. (실서비스라면 클라가 PG SDK로 결제창 띄움 — 여기선 mock paymentKey 사용)
3. `POST /api/payments/confirm` `{ orderUid, paymentKey, amount }`
   - `mock_ok_*` → 승인 / `mock_fail_*` → 거절 / `mock_amount_*` → 응답 금액 불일치

### Search API (Elasticsearch)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/search/products` | 통합 검색 |

**쿼리 파라미터:**
- `keyword` — 한글 형태소 검색 (제품명 + 브랜드 + 성분명)
- `categoryId`, `brandId`, `grade` — 필터
- `includeIngredientIds` — 특정 성분 포함 제품만 (nested query)
- `excludeIngredientIds` — 특정 성분 제외 (nested must_not)
- `sort` — `relevance` / `popular` / `score` / `latest`
- `page`, `size` — 페이지네이션

**응답에 포함:**
- `meta.countByGrade` — 등급별 제품 수 (terms aggregation)

### Admin

| URL | 설명 |
|---|---|
| `http://localhost:3100/admin/queues` | Bull Board (큐 모니터링) |
| `http://localhost:5601` | Kibana (ES 인덱스 탐색, Dev Tools) |

## 비동기 잡 (BullMQ)

| 큐 | 트리거 | 동작 |
|---|---|---|
| `product-indexer` | 제품 생성/리뷰 작성 시 | MySQL에서 제품+성분 조회 → ES 색인 |
| `views-flush` | 5분마다 (repeatable) | Redis 조회수 카운터 → DB INCREMENT → ES 재색인 |
| `daily-ranking` | 매일 03:00 (cron) | views/score 기준 rank/rankDiff 재계산 → full reindex |

장애 대응: 큐 발행 실패 시 try/catch로 API 가용성 보호. 누락분은 daily reindex로 catch-up.

## 기술 결정 기록

### 카테고리: Adjacency List 선택
- 맘가이드 실제 구조(4단계 고정). 읽기 >>> 쓰기.
- Nested Set이나 Closure Table은 오버엔지니어링. 전체 조회 1회 + 메모리 트리 조립으로 충분.

### 성분 그루핑: 애플리케이션 레벨
- 성분 플래그(isFragrance, isSlsSles 등)를 boolean으로 두고 메모리에서 필터.
- DB에서 조건별 서브쿼리 N번 돌리는 것보다 단순. 성분 수가 제품당 10~30개라 메모리 부담 없음.

### ES 동기화: 이벤트 기반 (BullMQ)
- Dual-write(MySQL+ES 동시 쓰기) 대신 큐 경유. ES 실패 시 자동 retry.
- CDC(Debezium)는 인프라 복잡도 대비 이 규모에선 오버. 필요 시 전환 가능.

### 조회수: Redis INCR + 주기적 flush
- 상세 조회마다 MySQL UPDATE는 불필요한 쓰기 부하.
- Redis INCR로 누적, 5분마다 GETDEL → DB INCREMENT. eventual consistency 허용.

### 검색: nori + nested ingredients
- 한글 형태소 분석기 nori의 `decompound_mode: mixed`로 복합어(세탁비누 → 세탁+비누+세탁비누) 처리.
- 성분을 nested 타입으로 색인해서 "특정 성분 포함/제외" 필터가 정확하게 동작.

### 결제 동시성: Lock 대신 DB 제약 + 조건부 UPDATE
3가지 race를 락 없이 막음:
- **재고 차감**: `UPDATE products SET stock = stock - q WHERE id=? AND stock >= q` — affectedRows로 성공 여부 판정. 단일 row 갱신은 InnoDB row lock으로 직렬화되므로 SELECT FOR UPDATE 불필요.
- **중복 결제**: `payments.order_id` UNIQUE + `pgPaymentKey` UNIQUE — 두 번째 INSERT는 DB가 거부 → catch해서 기존 결제 멱등 반환.
- **상태 전이**: `UPDATE orders SET status='PAID' WHERE id=? AND status='PENDING'` — compare-and-swap. affectedRows=0이면 다른 요청이 이미 처리한 것.

Redis 분산락이나 SELECT FOR UPDATE는 위 3종으로 커버 안 되는 시나리오에서만 도입 (예: 외부 API 호출을 락 안에 두고 싶을 때).

### 결제 위변조 방어
- 클라이언트가 보낸 amount는 신뢰 X — 서버에서 `order.totalAmount`와 비교 후 PG 호출
- PG 응답 금액도 다시 비교 (PG 측 버그/공격 방어)
- 주문 소유자(userId) 검증으로 타인 주문 결제 차단

### PG 추상화: 인터페이스 분리
- `PgClient` 인터페이스 + `MockPgClient` 구현. `setPgClient()`로 실제 PG로 교체 가능.
- 테스트에서 mock paymentKey 규칙(`mock_ok_*` / `mock_fail_*` / `mock_amount_*`)으로 다양한 시나리오 재현.

### 큐 장애 대응: try/catch + daily catch-up
- 큐 발행 실패를 삼키고 API 가용성 우선 확보.
- 매일 03:00 full reindex로 누락분 자동 복구.
- 더 강한 보장이 필요하면 outbox 패턴으로 발전 가능.

## 실행 방법

### 요구사항
- Node.js 18+
- Docker Desktop

### 설치 & 실행

```bash
# 1. 클론
git clone https://github.com/fall031-muk/mini-momguide.git
cd mini-momguide

# 2. 의존성 설치
npm install

# 3. 환경변수
cp .env.example .env

# 4. 인프라 (MySQL + Redis + ES + Kibana)
npm run db:up

# 5. 시드 데이터
npm run db:seed

# 6. ES 초기 색인
npm run es:reindex

# 7. 개발 서버
npm run dev
```

서버: http://localhost:3100
Kibana: http://localhost:5601
Bull Board: http://localhost:3100/admin/queues

### 스크립트

| 명령어 | 설명 |
|---|---|
| `npm run dev` | 개발 서버 (tsx watch, 자동 재시작) |
| `npm run build` | TypeScript 빌드 |
| `npm start` | 프로덕션 실행 |
| `npm run typecheck` | 타입체크 |
| `npm run db:up` | 인프라 컨테이너 시작 |
| `npm run db:down` | 인프라 컨테이너 중지 |
| `npm run db:seed` | 시드 데이터 (기존 데이터 초기화) |
| `npm run es:reindex` | ES 전체 재색인 |

## 프로젝트 구조

```
mini-momguide/
├── docker-compose.yml
├── infra/elasticsearch/Dockerfile    # nori 플러그인 포함 커스텀 이미지
├── src/
│   ├── index.ts                      # 부트스트랩 + graceful shutdown
│   ├── app.ts                        # Express 앱 + 라우터 마운트
│   ├── config/
│   │   ├── env.ts                    # Zod 환경변수 검증
│   │   ├── redis.ts                  # ioredis (캐시용)
│   │   └── elasticsearch.ts          # ES 클라이언트
│   ├── db/
│   │   ├── sequelize.ts              # DB 연결
│   │   ├── associations.ts           # 모델 관계 선언
│   │   ├── seed.ts                   # 시드 데이터
│   │   └── models/                   # Brand, Category, Product, Ingredient,
│   │                                 # ProductIngredient, User, Review
│   ├── middleware/
│   │   ├── async-handler.ts          # async 에러 자동 전파
│   │   ├── auth.ts                   # requireAuth (Bearer JWT 검증)
│   │   └── error-handler.ts          # HttpError + 글로벌 핸들러
│   ├── modules/
│   │   ├── auth/       (route, service)            # JWT signup/login
│   │   ├── categories/ (route, service)
│   │   ├── products/   (route, service, dto)
│   │   ├── brands/     (route, service)
│   │   ├── reviews/    (route, service)
│   │   ├── search/     (route, service)
│   │   ├── orders/     (route, service)            # 주문 + 원자적 재고 차감
│   │   └── payments/   (route, service, pg/)       # Mock PG client + confirm
│   ├── search/
│   │   ├── product-index.ts          # ES 인덱스 매핑 (nori, nested)
│   │   └── indexer.service.ts        # bulk/단건 인덱싱
│   ├── queue/
│   │   ├── connection.ts             # BullMQ 전용 Redis 연결
│   │   ├── product-indexer.queue.ts  # 제품 색인 큐
│   │   ├── product-indexer.worker.ts
│   │   ├── views-flush.queue.ts      # 조회수 flush 큐 (5분)
│   │   ├── views-flush.worker.ts
│   │   ├── daily-ranking.queue.ts    # 일일 랭킹 큐 (cron)
│   │   ├── daily-ranking.worker.ts
│   │   └── bull-board.ts             # 관리 UI
│   ├── scripts/
│   │   └── reindex-products.ts       # CLI: npm run es:reindex
│   └── common/
│       ├── logger.ts                 # Pino
│       └── cache-keys.ts            # Redis 키 네임스페이스
└── tsconfig.json
```
