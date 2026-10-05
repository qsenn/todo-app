# 프로젝트 계획 — 목표 정렬형 칸반 할 일 관리

> 상태: **pending approval** · 작성일 2026-10-02 · 근거: `docs/PRD.md`
>
> **변경 이력 (2026-10-02, 리뷰 반영)**
> 1. 수정(PATCH) 시 정합성 규칙 V6 추가: 위반하면 400으로 거절하고 자동 연결 해제는 하지 않음 (§0, §2, §7, AC-14)
> 2. 1년 목표 진행률에서 할 일 0건 주간 계획 제외, 대상이 없으면 `null` (§0, §3, §4, AC-10)
> 3. 빠른 연속 드래그 처리 방식 확정: 카드별 요청 직렬화 (§0, §5, §9, E6)

## 0. 확정된 결정 사항

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 스택 | Next.js(App Router) + TypeScript + MongoDB + Next.js API Routes(Route Handlers) | 사용자 결정 |
| 사용자 범위 | ~~단일 사용자, 인증 없음~~ → **GitHub OAuth 로그인, 사용자별 데이터 분리** (2026-10-05 변경, `docs/LOGIN.md`, 상세는 `docs/GITHUB_OAUTH.md`) | 사용자 결정 |
| 상위 항목 삭제 | 삭제 확인 창에서 **연결 해제** / **하위 포함 삭제** 중 사용자가 선택 (하위 항목 개수 표시) | 사용자 결정, PRD §4 구조 연결 |
| 1년 목표 진행률 | 연결된 주간 계획 중 **할 일이 1건 이상인 계획**의 진행률 **단순 평균**. 대상이 없으면 `null`("아직 할 일 없음") | 사용자 결정, PRD §4 P1. 미리 만든 빈 계획 때문에 진행률이 떨어지는 문제 방지 |
| 연결 상태에서 수정 *(리뷰 반영)* | 수정 결과가 V2/V3를 어기면 **400으로 거절**하고 위반 내용을 안내. 자동 연결 해제는 하지 않음 | 사용자 모르게 데이터가 바뀌는 것 방지 |
| 연속 드래그 처리 *(리뷰 반영)* | **카드별 요청 직렬화**: 같은 카드의 상태 변경 요청은 앞 요청이 끝난 뒤 순서대로 전송 | 요청 취소는 서버 처리 여부가 불확실하고, 타임스탬프 비교는 구현이 복잡함 |
| 주 기준 *(기본값)* | 월요일 시작 ~ 일요일 종료, `weekEnd = weekStart + 6일` | 기본값, 변경 가능 |
| 진행률 저장 방식 *(기본값)* | DB에 저장하지 않고 **조회 시 집계**(aggregation)로 계산 → 생성/삭제/상태 변경/연결 변경 어떤 경우에도 항상 일치 | PRD §4 트리거 요구를 구조적으로 보장 |
| 날짜 저장 *(기본값)* | 날짜는 `YYYY-MM-DD` 문자열로 저장(타임존 오차 방지) | 기본값 |

### 주요 라이브러리 (제안)
- DB: `mongoose`(스키마/인덱스) + `zod`(API 입력 검증)
- 드래그 앤 드롭: `@dnd-kit/core`
- 서버 상태: `@tanstack/react-query` **v5**(낙관적 업데이트와 롤백, mutation `scope`로 카드별 직렬화. 설치 버전의 공식 문서에서 `scope` 옵션 지원 확인)
- 스타일: Tailwind CSS
- 테스트: `vitest` + `mongodb-memory-server`(단위/통합), `@playwright/test`(E2E)

---

## 1. 요구 사항 요약

- **P0**: 할 일 CRUD, 상태(todo/doing/done), 3컬럼 칸반 DnD와 즉시 저장, 주간 계획/1년 목표 CRUD, 할 일→주간(N:1)·주간→연간(N:1) 연결과 연결 변경, 삭제 규칙, 주간 진행률 자동 반영
- **P1**: 1년 목표 진행률, 일일 진행률, 계층 트리 뷰, 미연결 할 일 관리

## 2. 데이터 모델

```ts
// src/models/YearGoal.ts
YearGoal   { _id, year: number, title: string, description?: string, createdAt, updatedAt }
// src/models/WeeklyPlan.ts
WeeklyPlan { _id, title: string, weekStart: 'YYYY-MM-DD'(월), weekEnd: 'YYYY-MM-DD'(일),
             yearGoalId: ObjectId | null, createdAt, updatedAt }
// src/models/Todo.ts
Todo       { _id, title: string, date: 'YYYY-MM-DD', weeklyPlanId: ObjectId | null,
             status: 'todo' | 'doing' | 'done' (default 'todo'), createdAt, updatedAt }
```

**인덱스**: `Todo{date:1}`, `Todo{weeklyPlanId:1,status:1}`, `WeeklyPlan{yearGoalId:1}`, `WeeklyPlan{weekStart:1}`, `YearGoal{year:1}`

**검증 규칙**
- V1. `weekStart`는 월요일이어야 하고 `weekEnd`는 서버가 `weekStart + 6일`로 계산합니다.
- V2. 할 일이 주간 계획에 연결되어 있으면 `date`가 그 주의 `weekStart`~`weekEnd` 범위 안이어야 합니다. 벗어나면 400을 반환합니다.
- V3. 주간 계획을 1년 목표에 연결하면 `weekStart` 또는 `weekEnd`의 연도가 목표 `year`와 같아야 합니다(연말·연초에 걸친 주 허용). 다르면 400을 반환합니다.
- V4. 존재하지 않는 상위 ID로 연결하면 404를 반환합니다.
- V5. `title`은 공백만으로 이루어질 수 없고 최대 200자입니다.
- V6. **수정(PATCH) 결과도 V2·V3를 만족해야 합니다.** 서버는 변경 후 상태를 기준으로 다시 검사하고, 위반하면 아무것도 저장하지 않고 400을 반환합니다. 자동 연결 해제는 하지 않습니다.
  - 할 일의 `date` 또는 `weeklyPlanId` 변경 → 연결될 주간 계획 기준으로 V2 검사
  - 주간 계획의 `weekStart` 변경 → 연결된 할 일 **전부**가 새 주 범위 안이어야 하고(V2), 연결된 목표와 V3도 다시 검사
  - 주간 계획의 `yearGoalId` 변경 → V3 검사
  - 400 응답에는 위반 규칙과 범위를 벗어나는 할 일 수를 포함합니다. 예: `{ code: 'V6_TODOS_OUT_OF_RANGE', count: 3 }`

## 3. 진행률 계산 (순수 함수 + 집계)

`src/lib/progress.ts`
- `weeklyProgress(done, total) = total === 0 ? 0 : Math.round(done / total * 100)`
- `dailyProgress(done, total)`: 위와 같은 식이며 대상은 해당 날짜의 할 일
- `goalProgress(plans: { done, total }[])`: `total > 0`인 계획만 골라 각 `weeklyProgress`의 평균을 `Math.round`로 계산합니다. 골라낸 계획이 0개면 `null`을 반환합니다.
  - 할 일이 0건인 주간 계획(아직 시작 전)은 평균에서 **제외**합니다.
  - 할 일은 있지만 하나도 끝내지 않은 계획(실제 0%)은 평균에 **포함**합니다.
  - 주간 계획 자체의 진행률은 기존과 같이 할 일 0건이면 0입니다(AC-4).

DB 집계는 `src/lib/queries/progress.ts`에서 `Todo.aggregate([{$match}, {$group: {_id: '$weeklyPlanId', total, done}}])` 한 번으로 여러 주간 계획을 한꺼번에 계산합니다(N+1 쿼리 방지).

## 4. API 설계 (`src/app/api/**/route.ts`)

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| GET/POST | `/api/goals` | `?year=` 필터, 응답에 `progress: number \| null` 포함(P1, `null`은 할 일 있는 주간 계획 없음) |
| GET/PATCH/DELETE | `/api/goals/[id]` | DELETE `?mode=unlink\|cascade` |
| GET | `/api/goals/[id]/impact` | 삭제 확인용: 연결된 주간 계획 수와 그 아래 할 일 수 |
| GET/POST | `/api/weekly-plans` | `?goalId=`, `?weekStart=` 필터, 응답에 `progress`, `doneCount`, `totalCount` 포함 |
| GET/PATCH/DELETE | `/api/weekly-plans/[id]` | DELETE `?mode=unlink\|cascade` |
| GET | `/api/weekly-plans/[id]/impact` | 연결된 할 일 수 |
| GET/POST | `/api/todos` | `?date=` / `?weeklyPlanId=` / `?unlinked=true` |
| PATCH/DELETE | `/api/todos/[id]` | DnD는 `PATCH {status}` |
| GET | `/api/progress/daily?date=` | P1 |
| GET | `/api/hierarchy?year=` | P1: 목표→주간→할 일 트리. 미연결 주간 계획과 할 일은 별도 그룹으로 반환 |

**삭제 동작**
- `mode=unlink`: 하위 항목의 연결 필드를 `null`로 바꾼 뒤 상위 항목을 삭제합니다.
- `mode=cascade`: 목표를 삭제하면 그 주간 계획과 할 일까지 모두 삭제하고, 주간 계획을 삭제하면 그 할 일까지 삭제합니다. **하위 항목부터** 지우므로 중간에 실패해도 고아 데이터가 아니라 "덜 지워진" 상태만 남고, 다시 실행하면 이어서 지울 수 있습니다(멱등).
- `mode`를 주지 않고 하위 항목이 1건 이상 있으면 409를 반환합니다(실수 방지).

공통 사항: `src/lib/db.ts`에서 연결을 캐싱합니다(HMR 대응). `src/lib/api.ts`에서 zod 오류는 400, 없는 리소스는 404, 충돌은 409 JSON 응답으로 통일합니다.

## 5. 화면 구성

| 경로 | 내용 | 우선순위 |
| --- | --- | --- |
| `/` (보드) | 날짜 선택 + 3컬럼 칸반, 할 일 추가/수정/삭제, 주간 계획 필터, 일일 진행률 바(P1) | P0 |
| `/weekly` | 주간 계획 목록(주 단위), 진행률 바, CRUD, 연결 목표 변경, 할 일 목록 펼치기 | P0 |
| `/goals` | 연도별 1년 목표 목록, CRUD, 진행률(P1), 연결된 주간 계획 목록 | P0 (진행률은 P1) |
| `/hierarchy` | 목표→주간→할 일 트리 | P1 |
| `/unlinked` | 미연결 항목: 주간 계획에 연결되지 않은 할 일 + 1년 목표에 연결되지 않은 주간 계획, 각각 연결 선택기 | P1 |
| `/login` | GitHub로 로그인. 로그인하지 않으면 위 화면들은 모두 여기로 이동 | 인증 |

**DnD 동작**: 드롭하면 React Query 캐시를 낙관적으로 갱신하고 `PATCH /api/todos/[id]`를 호출합니다. 실패하면 원래 컬럼으로 되돌리고 토스트를 띄웁니다. 성공하면 `weekly-plans`, `goals`, `progress` 쿼리를 무효화해 진행률을 다시 불러옵니다. 키보드 DnD는 dnd-kit의 `KeyboardSensor`로 지원합니다.

**연속 드래그 직렬화**: 상태 변경 mutation에 ``scope: { id: `todo-${id}` }``를 지정해 **같은 카드의 요청은 순서대로 하나씩** 보냅니다. 다른 카드끼리는 병렬로 보냅니다. 화면은 드롭할 때마다 즉시 바뀌고, 서버에는 마지막으로 놓은 상태가 최종 저장됩니다. `onMutate`에서 `cancelQueries`로 진행 중인 조회를 멈춰 오래된 응답이 화면을 덮어쓰지 않게 하고, 해당 카드의 대기 요청이 모두 끝난 뒤 서버 값으로 다시 동기화합니다.

**수정 거절 안내**: 할 일·주간 계획 폼에서 V6 위반 400을 받으면 원인과 해결 방법을 표시합니다. 예: "이 주에 연결된 할 일 3개가 새 날짜 범위를 벗어납니다. 먼저 연결을 해제하세요."

**목표 진행률 표시**: `progress`가 `null`이면 진행률 바 대신 "아직 할 일 없음"을 표시합니다(`/goals`, `/hierarchy`).

**삭제 확인 창**(`src/components/DeleteParentDialog.tsx`): `/impact`에서 받은 개수를 보여 주고 [연결만 해제] / [하위 항목까지 삭제] / [취소] 중 고르게 합니다. 하위 항목이 0건이면 일반 확인 창을 띄웁니다.

## 6. 디렉터리 구조 (예정)

```
src/
  app/
    layout.tsx, page.tsx(보드), weekly/page.tsx, goals/page.tsx,
    hierarchy/page.tsx, unlinked/page.tsx
    api/goals/..., api/weekly-plans/..., api/todos/..., api/progress/daily/route.ts, api/hierarchy/route.ts
  models/ YearGoal.ts, WeeklyPlan.ts, Todo.ts
  lib/ db.ts, api.ts, dates.ts, progress.ts, schemas.ts, queries/*.ts, services/*.ts
  components/ KanbanBoard.tsx, KanbanColumn.tsx, TodoCard.tsx, TodoForm.tsx,
              WeeklyPlanForm.tsx, GoalForm.tsx, ProgressBar.tsx, DeleteParentDialog.tsx
  hooks/ useTodos.ts, useWeeklyPlans.ts, useGoals.ts
tests/ unit/, integration/, e2e/
```

Route Handler는 얇게 유지하고, 비즈니스 규칙(검증 V1~V5, 삭제 모드, 진행률)은 `src/lib/services/*`에 둡니다. 통합 테스트는 서비스 계층을 직접 호출합니다.

---

## 7. 구현 단계

### Phase 0 — 프로젝트 셋업
1. `create-next-app`(TS, App Router, Tailwind, ESLint, `src/`)으로 시작합니다.
2. 의존성을 설치합니다: mongoose, zod, @dnd-kit/core, @tanstack/react-query, vitest, mongodb-memory-server, @playwright/test.
3. `.env.local.example`(`MONGODB_URI`)과 `src/lib/db.ts`(전역 캐시 연결)를 만듭니다.
4. `npm run dev / build / lint / test / test:e2e` 스크립트를 등록하고, `docs/CLAUDE.md`에 실행 방법과 규칙을 적습니다.
- **완료 기준**: `npm run build`와 `npm test`(샘플 테스트 1개)가 통과합니다.

### Phase 1 — 도메인 계층
1. `lib/dates.ts`: `toWeekStart(date)`, `weekEnd(weekStart)`, `isMonday`, `isWithinWeek`
2. `lib/progress.ts`: §3의 순수 함수
3. `lib/schemas.ts`: zod 스키마(생성/수정 각각)
4. `models/*`: Mongoose 스키마와 인덱스
- **완료 기준**: dates와 progress 단위 테스트가 통과합니다(0건, 전부 done, 반올림 33.3→33 / 66.7→67, 연말·연초에 걸친 주, 윤년 2월 포함).

### Phase 2 — P0 API
1. 서비스: `goalService`, `weeklyPlanService`, `todoService`(CRUD, V1~V6, 삭제 모드, impact)
2. Route Handler를 연결하고 오류 응답 형식을 통일합니다(V6 위반 코드와 개수 포함).
3. 주간 계획 목록 응답에 진행률 집계를 포함합니다.
- **완료 기준**: `mongodb-memory-server` 통합 테스트로 §8의 AC-1~AC-9, AC-14가 통과합니다.

### Phase 3 — P0 UI
1. 레이아웃과 내비게이션, React Query Provider
2. 보드: 날짜 선택, 3컬럼, TodoCard, TodoForm(주간 계획 선택 드롭다운은 해당 날짜가 속한 주의 계획만 표시)
3. DnD: 낙관적 업데이트, 롤백, 관련 쿼리 무효화, **카드별 요청 직렬화(`scope`)**
4. `/weekly`: 목록, 폼, 진행률 바, 목표 연결, V6 거절 안내 메시지
5. `/goals`: 목록, 폼, 연결된 주간 계획 목록
6. DeleteParentDialog
- **완료 기준**: E2E 테스트 E1~E4, E6가 통과합니다.

### Phase 4 — P1
1. 목표 진행률(API 응답과 `/goals` 표시, 할 일 0건 계획 제외, `null`이면 "아직 할 일 없음")
2. 일일 진행률(`/api/progress/daily`와 보드 상단 바)
3. `/hierarchy` 트리(접기/펼치기, 각 노드에 진행률)
4. `/unlinked` 목록과 연결 동작(연결 시 V2 검증 실패 메시지 표시)
- **완료 기준**: AC-10~AC-13과 E5가 통과합니다.

### Phase 5 — 마무리 검증
- 전체 테스트, `npm run build`, `npm run lint`를 실행하고 빈 상태와 오류 상태 UI를 점검합니다. `docs/CLAUDE.md`를 최신 내용으로 갱신합니다.

---

## 8. 수용 기준 (테스트 가능)

**P0 — 통합 테스트**
- AC-1. 상태 없이 할 일을 생성하면 `status === 'todo'`입니다. 허용되지 않은 상태값은 400입니다.
- AC-2. `GET /api/todos?date=2026-10-05`는 해당 날짜의 할 일만 반환합니다. `?weeklyPlanId=X`는 X에 연결된 할 일만 반환합니다.
- AC-3. 할 일 4건 중 1건이 done인 주간 계획의 `progress`는 25입니다. 1건을 더 done으로 바꾸면 50, done 1건을 삭제하면 33, 할 일 1건을 다른 계획으로 옮기면 두 계획 모두 다시 계산된 값을 반환합니다.
- AC-4. 할 일이 0건인 주간 계획의 `progress`는 0입니다(0으로 나누기 오류 없음).
- AC-5. 월요일이 아닌 `weekStart`는 400입니다. 응답의 `weekEnd`는 `weekStart + 6일`입니다.
- AC-6. 주 범위를 벗어난 날짜의 할 일을 그 주간 계획에 연결하면 400입니다(V2).
- AC-7. 연도가 맞지 않는 목표에 주간 계획을 연결하면 400입니다. 2026-12-28 주는 2026년 목표와 2027년 목표 모두에 연결할 수 있습니다(V3).
- AC-8. 주간 계획을 `mode=unlink`로 삭제하면 할 일은 남고 `weeklyPlanId === null`이 됩니다. `mode=cascade`로 삭제하면 할 일도 삭제됩니다. 하위 항목이 있는데 mode가 없으면 409입니다.
- AC-9. 목표를 `mode=cascade`로 삭제하면 그 주간 계획과 하위 할 일이 모두 삭제되고, `mode=unlink`로 삭제하면 주간 계획의 `yearGoalId`가 null이 됩니다. `/impact`는 정확한 개수를 반환합니다.
- AC-14. 수정 정합성(V6): (a) 주간 계획에 연결된 할 일의 `date`를 주 밖으로 바꾸면 400이고 값은 그대로입니다. (b) 할 일이 연결된 주간 계획의 `weekStart`를 그 할 일이 범위 밖이 되도록 바꾸면 400이고 응답의 `count`가 범위를 벗어나는 할 일 수와 같으며, 주간 계획과 할 일 모두 변경되지 않습니다. 모든 할 일이 새 범위 안이면 성공합니다. (c) 목표에 연결된 주간 계획을 연도가 맞지 않는 목표로 옮기거나 `weekStart`를 다른 연도로 바꾸면 400입니다. (d) 400 이후 할 일의 `weeklyPlanId`는 바뀌지 않습니다(자동 해제 없음).

**P1 — 통합 테스트**
- AC-10. 할 일이 있는 주간 계획의 진행률이 [100, 50, 0]인 목표의 진행률은 50입니다(0%인 계획은 할 일이 있지만 done이 없는 계획). 여기에 할 일 0건인 주간 계획을 추가해도 50으로 유지됩니다. 주간 계획이 없거나 모두 할 일 0건이면 `progress === null`입니다.
- AC-11. 일일 진행률: 해당 날짜 할 일 3건 중 done 2건이면 67, 0건이면 0입니다.
- AC-12. `/api/hierarchy?year=2026`은 목표→주간→할 일 중첩 구조와 미연결 그룹을 반환합니다.
- AC-13. `?unlinked=true`는 `weeklyPlanId === null`인 할 일만 반환합니다.

**E2E (Playwright, 테스트 DB 사용)**
- E1. 목표 생성 → 주간 계획 생성 후 연결 → 할 일 생성 후 연결 → 보드의 todo 컬럼에 표시됩니다.
- E2. 카드를 todo에서 done으로 드래그한 뒤 새로고침해도 done 컬럼에 있고, `/weekly` 진행률이 바뀐 값으로 표시됩니다.
- E3. API 실패를 모킹하고 드래그하면 카드가 원래 컬럼으로 돌아가고 오류 토스트가 표시됩니다.
- E4. 하위 항목이 있는 주간 계획을 삭제하면 확인 창에 개수가 표시되고, "연결만 해제"를 고르면 할 일이 미연결 상태로 남습니다.
- E5. `/unlinked`에서 할 일을 주간 계획에 연결하면 목록에서 사라지고 그 계획의 진행률 분모가 1 늘어납니다.
- E6. 첫 번째 PATCH 응답을 인위적으로 지연시킨 상태에서 같은 카드를 todo→doing→done으로 빠르게 옮기면, 화면은 즉시 done 컬럼으로 바뀌고, 두 번째 요청은 첫 요청이 끝난 뒤에 전송되며, 새로고침 후에도 done 컬럼에 있고 DB 값도 `done`입니다.

## 9. 리스크와 대응

| 리스크 | 대응 |
| --- | --- |
| 단독 실행 MongoDB는 트랜잭션을 지원하지 않아 cascade 삭제가 원자적이지 않음 | 하위 항목부터 지워 재시도해도 안전하게 함(§4). 원자성이 꼭 필요해지면 replica set 또는 Atlas로 전환해 `session.withTransaction` 적용 |
| 드래그를 빠르게 연속하면 요청 순서가 꼬일 수 있음 | **카드별 요청 직렬화**(react-query mutation `scope`)로 도착 순서를 보장하고, 대기 요청이 끝난 뒤 서버 값으로 재동기화(§5, E6) |
| 연결된 항목을 수정하면 V2/V3 정합성이 깨질 수 있음 | V6로 변경 후 상태를 다시 검사해 400으로 거절하고, 화면에서 원인과 해결 방법 안내(AC-14) |
| 타임존 때문에 날짜가 하루 밀림 | 날짜를 문자열로 저장하고 클라이언트 로컬 날짜 기준으로 생성. `Date` 객체 직렬화 금지 |
| Next.js 개발 서버 HMR로 Mongo 연결이 계속 늘어남 | `globalThis` 캐시 패턴(`lib/db.ts`) |
| Mongoose 모델 중복 등록 오류(HMR) | `models.X \|\| model('X', schema)` 패턴 |
| 진행률을 조회 시 계산하면 데이터가 많을 때 느려짐 | 인덱스 `{weeklyPlanId, status}`와 한 번의 `$group` 집계 사용. 단일 사용자 규모(수천 건)에서는 문제 없음. 느려지면 캐시 필드 추가 검토 |

## 10. 검증 절차

1. `npm run lint && npm run build`가 오류 없이 끝나야 합니다.
2. `npm test`: 단위와 통합 테스트(AC-1~AC-14) 전부 통과
3. `npm run test:e2e`: E1~E6 전부 통과
4. 직접 확인: 키보드만으로 카드 상태 변경, 빈 상태 화면, 연말·연초에 걸친 주 생성
5. 변경된 파일에서 TODO, `test.skip`, `.only`, 구현되지 않은 분기가 없는지 확인

## 11. 범위 밖 / 열린 항목

- 범위 밖: 컬럼 안 카드 순서 변경, 반복 할 일, 알림, 모바일 앱 (인증과 다중 사용자는 2026-10-05에 추가됨 — §12)
- 열린 항목(기본값으로 진행하되 변경 가능): 주 시작 요일(월), 같은 주에 주간 계획 여러 개 허용(허용)
- 확정됨(리뷰 반영): 목표 진행률에서 할 일 0건 주간 계획 제외(§3)

## 12. 변경: GitHub OAuth 로그인 (2026-10-05)

요구 사항은 `docs/LOGIN.md`, 설정과 동작은 `docs/GITHUB_OAUTH.md`를 따릅니다.

- **로그인**: `/auth/github` → GitHub → `/auth/github/callback`. GitHub `login`과 `avatar_url`을 `User`에 저장하고(재로그인 시 갱신), DB 세션(`Session`, 토큰 해시만 저장, 30일 TTL)을 쿠키로 연결합니다. `POST /auth/logout`은 세션 문서를 삭제하고 쿠키를 만료시킵니다.
- **접근 제어**: 모든 `/api/*`는 세션이 없거나 만료되면 401 `UNAUTHENTICATED`. 화면은 `(app)` 라우트 그룹의 서버 레이아웃이 세션을 확인해 `/login`으로 보냅니다.
- **데이터 분리**: `Todo`, `WeeklyPlan`, `YearGoal`에 필수 `userId`. 서비스 계층(CRUD와 V1~V6 규칙)은 바꾸지 않고, `src/lib/tenant.ts`의 Mongoose 플러그인이 요청 사용자의 조건을 모든 쿼리·집계·저장에 붙입니다. 다른 사용자의 항목은 404이고, 사용자 컨텍스트 없이 쓰면 오류입니다(fail closed). 기존 인덱스는 `userId`를 앞에 둔 복합 인덱스로 바뀌었습니다.
- **마이그레이션**: 로그인 도입 전 데이터(`userId` 없음)는 사용자 결정에 따라 삭제합니다. `npm run migrate:user-id`는 미리 보기, `-- --confirm=<DB 이름>`이 실제 삭제입니다(DB 이름이 맞아야 실행).
- **수용 기준 추가**: 인증·격리·OAuth·로그아웃 통합 테스트(`tests/integration/{tenant,auth-api,oauth,migrate-user-id}.test.ts`)와 E2E(`tests/e2e/auth.spec.ts`, 가짜 GitHub 서버 `scripts/fake-github.mjs`).
