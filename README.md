# 할 일 앱

할 일 → 주간 계획 → 1년 목표를 잇는 칸반 보드입니다. 카드를 끌어 상태(할 일 / 진행 중 / 완료)를 바꾸면 주간·연간 진행률이 자동으로 반영됩니다.

- **보드** (`/`): 날짜별 칸반, 드래그 앤 드롭(키보드 지원), 일일 진행률
- **주간 계획** (`/weekly`): 주 단위 계획, 진행률, 1년 목표 연결
- **1년 목표** (`/goals`): 연도별 목표와 진행률
- **계층 보기** (`/hierarchy`): 목표 → 주간 계획 → 할 일 트리
- **미연결 항목** (`/unlinked`): 주간 계획에 연결되지 않은 할 일, 1년 목표에 연결되지 않은 주간 계획 정리

## 시작하기

```bash
cp .env.local.example .env.local   # MONGODB_URI, GitHub OAuth 값 설정
npm install
npm run dev
```

GitHub 계정으로 로그인해야 쓸 수 있고, 각자 자기 데이터만 보입니다. GitHub OAuth App 만들기와 환경 변수, 기존 데이터 마이그레이션은 [`docs/GITHUB_OAUTH.md`](docs/GITHUB_OAUTH.md)를 보세요.

테스트: `npm test`(단위·통합), `npm run test:e2e`(핵심 E2E만, 빠름), `npm run test:e2e:full`(전체 E2E, 커밋·배포 전). E2E는 처음에 `npx playwright install chromium`이 필요합니다. 두 테스트 모두 메모리 MongoDB를 쓰므로 DB를 따로 띄울 필요가 없습니다.

개발 규칙과 구조는 [`docs/CLAUDE.md`](docs/CLAUDE.md), 요구 사항은 [`docs/PRD.md`](docs/PRD.md), 설계는 [`docs/PLAN.md`](docs/PLAN.md)를 보세요.
