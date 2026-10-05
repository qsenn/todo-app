## 참고 문서
- PRD: docs/RPD.md
- 구현 계획: docs/PLAN.md

작업 전 반드시 위 문서를 읽고 시작할 것.

기능에 변경사항이 있다면 docs폴더 내 문서에 각각 업데이트 할 것.

## 실행

```bash
cp .env.local.example .env.local   # MONGODB_URI, GITHUB_CLIENT_ID/SECRET, APP_URL 설정 (docs/GITHUB_OAUTH.md)
npm install
npm run dev                         # http://localhost:3000
```

| 명령 | 내용 |
| --- | --- |
| `npm run lint` | ESLint |
| `npm run build` | 프로덕션 빌드 (타입 검사 포함) |
| `npm test` | vitest 단위·통합 테스트. MongoDB 불필요 (`mongodb-memory-server`가 메모리 레플리카셋을 띄움) |
| `npm run test:e2e` | Playwright E2E. `scripts/e2e-server.mjs`가 메모리 Mongo(포트 27999), 가짜 GitHub(`scripts/fake-github.mjs`, 포트 3199), `next dev`(포트 3100, `distDir=.next-e2e`)를 띄움. `auth.setup.ts`가 한 번 로그인해 세션을 공유 |
| `npm run migrate:user-id` | `userId` 없는 기존 데이터 미리 보기. `-- --confirm=<DB 이름>`이면 삭제(되돌릴 수 없음) |

E2E를 처음 실행할 때는 `npx playwright install chromium`이 필요합니다.

## 구조

```
src/
  app/                 (app)/ 로그인 필요한 화면, login/, auth/ OAuth 라우트, api/**/route.ts. Route Handler는 얇게 유지
  lib/
    dates.ts           YYYY-MM-DD 문자열 날짜 계산 (UTC 기준, 주는 월~일)
    progress.ts        진행률 순수 함수 (weekly/daily/goal)
    schemas.ts         zod 입력 스키마 (.strict: 모르는 필드는 400)
    services/*.ts      비즈니스 규칙 (V1~V6, 삭제 모드, 진행률 집계)
    api.ts, errors.ts  handle(request, fn): 세션 확인(401) → runAsUser → 오류를 JSON { error: { code, message, ...details } }로
    auth.ts            DB 세션(토큰 해시), GitHub 사용자 저장
    githubOAuth.ts     GitHub OAuth 설정·state·토큰 교환 (secret은 환경 변수로만)
    tenant.ts          AsyncLocalStorage 사용자 컨텍스트 + 소유자 범위 Mongoose 플러그인
    client.ts          브라우저 fetch 래퍼 (ApiClientError)
  models/              Mongoose 모델 (models.X || model() 패턴)
  hooks/               react-query 훅. 변경 후 invalidateTree()로 관련 쿼리 전부 갱신
  components/          화면 컴포넌트
tests/unit, tests/integration, tests/e2e
```

## 규칙

- **진행률은 저장하지 않는다.** 조회 시 `Todo.aggregate` `$group` 한 번으로 계산하므로 생성·삭제·상태 변경·연결 변경 어느 경우에도 항상 일치한다.
  - 주간·일일: `done / total × 100` 반올림, 0건이면 0
  - 1년 목표: 할 일이 1건 이상인 주간 계획 진행률의 평균, 대상이 없으면 `null`
- **검증 규칙** (`src/lib/services/*`)
  - V1: `weekStart`는 월요일, `weekEnd`는 서버가 `+6일`로 계산
  - V2: 연결된 할 일의 날짜는 그 주간 계획의 주 안
  - V3: 주간 계획의 시작일 또는 종료일 연도가 목표 연도와 같음(연말·연초 걸친 주 허용)
  - V4: 없는 상위 ID로 연결하면 404
  - V5: 제목은 공백 불가, 최대 200자
  - V6: 수정 결과도 V2·V3를 만족해야 하며, 위반 시 400으로 거절하고 아무것도 바꾸지 않는다. 자동 연결 해제는 하지 않는다.
- V2·V3·V6 검사와 저장은 트랜잭션이 아니다(검사 후 쓰기). 데이터가 사용자별로 분리되어 있고 한 사용자의 동시 수정이 드물어 의도적으로 단순하게 두었다.
- **인증과 데이터 분리**: `/api/*`는 `handle(request, fn)`이 세션을 확인하고 `runAsUser`로 감싼다. 할 일·주간 계획·1년 목표 모델은 `ownedByUser` 플러그인이 모든 쿼리·집계·저장에 `userId`를 붙이므로 서비스 코드는 사용자를 몰라도 된다. 사용자 컨텍스트 없이 이 모델을 쓰면 오류(fail closed). 컨텍스트 안에서 쿼리를 반환만 해도 `runAsUser`가 안에서 기다리므로 안전하다. 유지보수 스크립트만 `runUnscoped`를 쓴다. 사용자 컨텍스트 안에서는 `bulkWrite`, `estimatedDocumentCount`, `$lookup`/`$unionWith`/`$graphLookup` 집계, `userId`를 바꾸는 수정이 오류로 거부되므로 서비스에서 쓰지 않는다. 운영에서는 `APP_URL`이 필수다.
- 화면은 `src/app/(app)/layout.tsx`가 세션이 없으면 `/login`으로 보낸다. 클라이언트는 API 401을 받으면 `Providers`의 전역 onError가 `/login`으로 이동시킨다.
- **삭제**: 하위 항목이 있으면 `?mode=unlink|cascade`가 필요하다(없으면 409). 하위 항목부터 지우므로 중간 실패 후 다시 실행하면 이어서 완료된다.
- **드래그 상태 변경**: 카드마다 `useMoveTodo(id)`(mutation `scope: todo-<id>`)를 쓴다. 같은 카드의 요청은 순서대로 전송되고 화면은 즉시 바뀐다. 실패하면 롤백과 토스트를 띄우고, 진행 중인 상태 변경이 모두 끝나면 서버 값으로 다시 맞춘다.
- **날짜**: `Date` 객체 대신 `YYYY-MM-DD` 문자열을 쓴다. "오늘"은 브라우저 시간대 기준이며 `ClientDate`로 하이드레이션 이후에 정한다.
- Next.js 16이다. API를 쓰기 전에 `node_modules/next/dist/docs/`를 확인한다(Route Handler `params`는 Promise).
- Mongoose 9: `findByIdAndUpdate`에는 `returnDocument: "after"`를 쓴다(`new: true`는 deprecated).
