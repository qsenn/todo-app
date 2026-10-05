# GitHub OAuth 로그인 설정

이 앱은 GitHub 계정으로만 로그인합니다. 로그인한 사용자는 자신이 만든 할 일, 주간 계획, 1년 목표만 보고 수정할 수 있습니다.

## 1. GitHub OAuth App 만들기

1. GitHub에서 **Settings → Developer settings → OAuth Apps → New OAuth App**으로 이동합니다. (https://github.com/settings/developers)
2. 다음 값을 입력합니다.

   | 항목 | 값 (로컬 개발 예) |
   | --- | --- |
   | Application name | 할 일 앱 (자유롭게) |
   | Homepage URL | `http://localhost:3000` |
   | Authorization callback URL | `http://localhost:3000/auth/github/callback` |

   배포할 때는 두 URL의 `http://localhost:3000` 부분을 실제 주소로 바꿉니다. 콜백 URL은 반드시 `<APP_URL>/auth/github/callback` 형태여야 합니다.
3. **Register application**을 누르면 **Client ID**가 나옵니다.
4. **Generate a new client secret**을 눌러 **Client secret**을 만듭니다. 이 값은 이때 한 번만 보이므로 바로 복사해 둡니다.

## 2. 환경 변수 설정

`.env.local.example`을 `.env.local`(또는 `.env`)로 복사하고 값을 채웁니다.

```bash
cp .env.local.example .env.local
```

| 변수 | 설명 |
| --- | --- |
| `MONGODB_URI` | MongoDB 접속 주소 |
| `GITHUB_CLIENT_ID` | OAuth App의 Client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App의 Client secret. **절대 커밋하지 마세요.** `.env*` 파일은 `.gitignore`로 제외됩니다(예시 파일만 예외) |
| `APP_URL` | 이 앱의 공개 주소(예: `http://localhost:3000`). OAuth App에 등록한 콜백 URL과 맞아야 합니다. **운영 환경(`NODE_ENV=production`)에서는 필수**이며, 없으면 로그인·로그아웃이 설정 안내와 함께 500을 반환합니다. 개발 중에 비우면 요청이 들어온 주소를 씁니다 |

두 GitHub 값 중 하나라도 없으면 `/auth/github`가 설정 안내 메시지와 함께 500을 반환합니다. client secret은 코드에 넣지 않고 환경 변수로만 읽습니다.

## 3. 기존 데이터 마이그레이션 (로그인 도입 전 데이터가 있을 때)

로그인을 도입하기 전에 만든 데이터에는 소유자(`userId`)가 없어서 어느 계정에도 속하지 않습니다. 결정에 따라 이 데이터는 삭제합니다.

```bash
npm run migrate:user-id                         # 미리 보기: 대상과 삭제될 건수만 출력하고 아무것도 지우지 않음
npm run migrate:user-id -- --confirm=<DB 이름>  # 실제 삭제 (되돌릴 수 없음)
```

- 대상은 `todos`, `weeklyplans`, `yeargoals` 컬렉션에서 `userId`가 없거나 `null`인 문서뿐입니다. 사용자, 세션, 소유자가 있는 데이터는 건드리지 않습니다.
- `.env`와 `.env.local`의 `MONGODB_URI`를 사용합니다. 출력 첫 줄에 대상 호스트와 DB 이름이 나옵니다(비밀번호는 표시하지 않음). 실제 삭제는 `--confirm=` 뒤에 그 DB 이름을 정확히 적어야만 실행되므로, 다른 DB를 실수로 지우지 않습니다. 이름이 다르면 아무것도 지우지 않고 종료합니다.
- 여러 번 실행해도 안전합니다(두 번째부터는 0건).

## 4. 동작 방식

| 경로 | 동작 |
| --- | --- |
| `GET /auth/github` | 무작위 `state`를 httpOnly 쿠키에 저장하고 GitHub 인증 화면으로 보냅니다 (scope: `read:user`) |
| `GET /auth/github/callback` | `state`를 확인하고 `code`를 토큰으로 교환한 뒤, GitHub 사용자(`login`, `avatar_url`)를 DB에 저장(재로그인 시 갱신)하고 세션을 시작합니다. 이 브라우저에 이전 세션이 있으면 지우고 새로 만듭니다. GitHub access token은 저장하지 않습니다 |
| `POST /auth/logout` | DB의 세션 문서를 삭제하고 쿠키를 만료시킨 뒤 `/login`으로 보냅니다. 다른 사이트에서 보낸 요청(`Origin`이 `APP_URL`과 다름)은 403. 그래서 `APP_URL`과 다른 주소(예: `localhost` 대신 `127.0.0.1`)로 접속하면 로그아웃이 거부되니 `APP_URL`과 같은 주소로 접속하세요 |
| `GET /api/me` | 로그인한 사용자의 `username`, `avatarUrl` |

- **세션**: 쿠키(`kgt_session`, httpOnly, SameSite=Lax, 운영 환경에서는 Secure)에는 무작위 토큰이 들어가고, DB에는 그 토큰의 SHA-256 해시만 저장합니다. 유효 기간은 30일이며, 만료된 세션은 MongoDB TTL 인덱스가 자동으로 지웁니다.
- **접근 제어**: 로그인하지 않으면 모든 `/api/*`는 401을 반환하고, 화면(`/`, `/weekly`, `/goals`, `/hierarchy`, `/unlinked`)은 `/login`으로 이동합니다.
- **사용자별 데이터**: 할 일, 주간 계획, 1년 목표에는 `userId`가 있습니다. 요청은 로그인한 사용자 컨텍스트에서 실행되고, Mongoose 플러그인(`src/lib/tenant.ts`)이 모든 조회, 집계, 수정, 삭제에 그 사용자 조건을 자동으로 붙입니다. 다른 사람의 항목은 없는 것처럼 404가 됩니다. 사용자 컨텍스트 없이 이 모델을 쓰면 오류가 나므로(fail closed) 실수로 전체 데이터가 노출되지 않습니다. 사용자 조건을 붙일 수 없는 작업(`bulkWrite`, `estimatedDocumentCount`, 다른 컬렉션을 읽는 `$lookup`·`$unionWith`·`$graphLookup`)과 수정으로 `userId`를 바꾸는 것(`$rename`, 파이프라인 업데이트 포함)은 거부됩니다.

## 5. 테스트

`npm run test:e2e`는 실제 GitHub 대신 `scripts/fake-github.mjs`(가짜 OAuth 서버)를 띄우고, 메모리 MongoDB를 씁니다. `.env`의 실제 GitHub 값과 DB는 테스트에서 사용되지 않습니다.
