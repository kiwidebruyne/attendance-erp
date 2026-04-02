# BestSleep Attendance ERP Frontend

이 저장소는 BestSleep 사내 ERP에 들어갈 BLE 비콘 기반 출퇴근 관리 모듈 프론트엔드 과제를 위해 만든 Next.js 16 App Router 애플리케이션입니다.

저는 이 프로젝트를 단순한 출결 기록 화면으로 보지 않았습니다.
이 프로젝트의 본질적 목표는 `기록 저장` 자체보다, 직원과 관리자가 오늘 무엇이 정상이고 무엇이 문제인지 즉시 이해하고 바로 행동할 수 있게 만드는 것이라고 판단했습니다.
그래서 이 저장소는 출결 기록기보다는 `오류를 예방하고`, `문제를 조용히 묻어두지 않고`, `빠르게 맞춰 가는 협업형 운영 도구`에 더 가깝게 설계했습니다.

이 README는 원문 과제 요약이 아니라, 현재 저장소에 실제로 반영한 구현, 그 배경이 된 판단, 의도적으로 제한한 범위, 아직 남겨둔 과제를 함께 설명하는 한국어 문서입니다.
세부 계약 문서는 [docs/api-spec.md](docs/api-spec.md), [docs/database-schema.md](docs/database-schema.md), [docs/feature-requirements.md](docs/feature-requirements.md) 등 `docs/` 아래 문서를 기준으로 봐 주세요.

## 1. 프로젝트 한눈에 보기

- 제품 목표: BLE 비콘 검증 기반 출퇴근 관리와 수동 정정, 휴가 요청, 관리자 검토 워크플로우를 한 ERP 안에서 다루기
- 현재 범위: 웹 UI + Next.js Route Handlers 기반 mock REST API
- 제외 범위: 실제 BLE 하드웨어 연동, 실서비스 백엔드, 인증/권한, 외부 알림 채널
- 주요 사용자:
  - 직원: `/attendance`, `/attendance/leave`
  - 관리자: `/admin/attendance`, `/admin/attendance/requests`
- 데이터 전략: Asia/Seoul 기준 deterministic seed world, 직원 12명, 약 1개월치 근태/휴가/요청 이력
- 제품 해석: `감시 도구`가 아니라 `같은 사실을 맞춰 가는 도구`

## 2. 실행 방법

### 요구 사항

- Node.js `24` ([.nvmrc](.nvmrc))
- `pnpm`

### 설치 및 개발 서버 실행

```bash
pnpm install
pnpm dev
```

- 개발 서버를 실행하면 기본 진입점 `/`는 `/attendance`로 리다이렉트됩니다.
- `pnpm install` 시 커밋된 Lefthook 설정도 함께 설치됩니다.

### 주요 스크립트

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm format
pnpm format:check
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:coverage
```

### 로컬 Git Hook

이 저장소는 Husky가 아니라 [lefthook.yml](lefthook.yml)을 사용합니다.

- `pre-commit`
  - staged Markdown/TS/CSS/JSON 등에 Prettier 적용
  - staged JS/TS 계열에 ESLint `--fix` 적용
- `pre-push`
  - `pnpm lint`
  - `pnpm format:check`
  - `pnpm test`
  - `pnpm build`

즉, 문서만 바꿔도 커밋 직전 최소 포맷 검증 흐름은 유지되고, 푸시 직전에는 애플리케이션 전체 품질 게이트를 통과해야 합니다.

## 3. 현재 구현 범위

### 화면

- `/attendance`
  - 오늘 상태 브리핑
  - 주간/월간 근태 이력
  - 수동 출퇴근 정정 흐름
  - carry-over 퇴근 누락 인지와 정정 유도
- `/attendance/leave`
  - 잔여 연차/상태 요약
  - 휴가 계획/신청 워크스페이스
  - 반려/보완 요청 재진입 흐름
  - 승인 후 변경/취소 follow-up 흐름
- `/admin/attendance`
  - 오늘 기준 예외 우선 운영 콘솔
  - 요약 카드
  - 팀 ledger
  - 기간 기반 이력 조회
- `/admin/attendance/requests`
  - 수동 출퇴근 요청과 휴가 요청을 같은 route 안에서 검토
  - `needs_review`, `completed`, `all` 뷰
  - 승인 / 반려 / 보완 요청(review revision) 처리

### Mock API

원문 과제의 최소 endpoint 개수에만 맞춘 것이 아니라, 현재 저장소에 반영된 워크플로우를 기준으로 다음 범주의 Route Handlers를 구현했습니다.

- `/api/attendance/**`
- `/api/leave/**`
- `/api/admin/attendance/**`
- `/api/admin/requests/**`

정확한 요청/응답 계약은 [docs/api-spec.md](docs/api-spec.md)를 기준으로 확인해 주세요.

### Deterministic seed world

[docs/seed-world-contract.md](docs/seed-world-contract.md)를 기준으로 다음과 같이 고정된 mock 세계를 사용합니다.

- 시간대: `Asia/Seoul`
- 기준 시각: `2026-04-13T12:00:00+09:00`
- 기준 날짜: `2026-04-13`
- 캘린더 윈도우: `2026-03-23` ~ `2026-04-20`
- 직원 수: 12명
- 반드시 포함하는 시나리오:
  - 전날 퇴근 누락 carry-over
  - next-day checkout
  - 실패한 출퇴근 시도
  - 연차와 실제 출근이 충돌하는 leave-work conflict
  - 회사 주요 일정과 겹치는 휴가
  - staffing-sensitive leave
  - 수동 출퇴근 요청 재신청 체인
  - 휴가 change / resubmission 체인

제가 seed world를 deterministic하게 만든 이유는, 화면과 API와 테스트가 서로 다른 세계를 말하면 신뢰성이 무너진다고 봤기 때문입니다.
이 프로젝트는 특히 `직원 화면과 관리자 화면이 같은 사실을 말해야 하는가`가 핵심이라서, mock 데이터도 재현 가능하고 시나리오가 고정돼 있어야 했습니다.

## 4. 폴더 구조

```txt
.
├─ app/
│  ├─ (erp)/
│  │  ├─ (employee)/
│  │  ├─ (admin)/
│  │  └─ providers.tsx
│  ├─ api/
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
├─ components/
│  ├─ shell/
│  └─ ui/
├─ docs/
├─ hooks/
├─ lib/
│  ├─ api/
│  ├─ attendance/
│  ├─ contracts/
│  ├─ leave/
│  ├─ query/
│  ├─ repositories/
│  ├─ seed/
│  └─ server/
├─ public/
├─ tests/
│  ├─ fixtures/
│  ├─ integration/
│  └─ unit/
├─ AGENTS.md
├─ DESIGN.md
├─ components.json
├─ lefthook.yml
├─ package.json
└─ vitest.config.mts
```

### 왜 이렇게 나눴는가

- `app/`
  - Next.js App Router 진입점입니다.
  - `(erp)` route group 아래에서 직원/관리자 화면을 같은 ERP shell에 태우되, URL 구조는 그대로 유지합니다.
  - `api/`는 mock REST API의 public boundary입니다.
- `components/shell`
  - ERP 공통 사이드바, 프레임, shell chrome을 둡니다.
  - 화면별 구현과 shell 레이아웃 책임을 분리하기 위해 따로 뒀습니다.
- `components/ui`
  - shadcn/Radix 기반 reusable primitives를 둡니다.
  - 단발성 페이지 마크업보다 재사용 가능한 UI 조합이 이 과제에서 더 효율적이라고 판단했습니다.
- `lib/contracts`
  - Zod 스키마와 공용 타입을 둡니다.
  - UI, Route Handler, 테스트가 같은 계약을 공유하게 하려는 목적입니다.
- `lib/repositories`
  - seed world를 읽고 도메인 단위로 projection을 만드는 곳입니다.
  - 페이지나 Route Handler 안에서 필터링 로직을 흩뿌리지 않으려고 분리했습니다.
- `lib/seed`
  - deterministic mock data와 기준 시각, 시나리오 앵커를 둡니다.
  - 테스트 재현성과 직원/관리자 화면 동기화를 위해 핵심인 영역입니다.
- `lib/query`
  - React Query client를 둡니다.
  - 서버 상태 캐싱과 재조회 정책을 UI 밖으로 빼기 위해 분리했습니다.
- `lib/server`
  - 서버용 공통 유틸과 structured logger를 둡니다.
- `tests/unit`, `tests/integration`
  - 순수 로직과 브라우저 상호작용 테스트를 분리했습니다.
  - `async` Server Component는 현재 Vitest 대상이 아니므로 문서와 테스트 경계를 분리해 두었습니다.
- `docs/`
  - 이 프로젝트의 실제 계약 문서 모음입니다.
  - README는 사람용 입구 문서이고, 세부 계약은 `docs/`가 맡습니다.

## 5. 기술 선택 이유

### Next.js 16 App Router

- 과제에서 필수 요구 사항이기도 했고, route group, Route Handler, server/client boundary 분리가 이 프로젝트와 잘 맞았습니다.
- 직원/관리자 화면과 mock API를 한 저장소 안에서 함께 관리하기 좋았습니다.
- `typedRoutes`를 켜서 route 문자열 오타를 줄이려는 방향도 취했습니다.

### React 19

- 화면 대부분이 상호작용 중심이고, 필터/탭/폼/상세 패널처럼 client behavior가 중요했습니다.
- 동시에 route entry는 server-first로 유지하고, 실제 상호작용만 client component로 내리는 구조가 적합했습니다.

### Tailwind CSS v4

- ERP 스타일은 화려한 커스텀 CSS보다 일관된 spacing, 색, surface 조합이 더 중요했습니다.
- 빠르게 UI를 조립하되, 토큰 중심으로 통일감을 유지하기 쉬웠습니다.

### shadcn UI + Radix primitives

- 이 프로젝트는 테이블, 시트, 탭, 팝오버, 배지, 다이얼로그가 많습니다.
- 이런 primitives를 매번 손으로 구현하기보다 접근성과 조합성이 검증된 기반을 재사용하는 편이 낫다고 봤습니다.
- 동시에 완성형 디자인 시스템을 그대로 가져오기보다, ERP 톤에 맞게 shell과 page composition은 별도로 조정할 수 있었습니다.

### React Query

- 이 프로젝트는 전역 client state보다 `서버 상태를 어떻게 읽고 갱신하느냐`가 더 중요했습니다.
- 직원 화면과 관리자 화면 모두 Route Handler를 경계로 데이터를 읽기 때문에 React Query가 적절했습니다.
- 반대로 Zustand 같은 전역 스토어는 현재 범위에서는 과하다고 판단했습니다.

### Zod

- UI, API, seed repository, 테스트가 같은 계약을 바라보게 하려면 런타임 검증이 필요했습니다.
- 특히 request lifecycle과 attendance projection은 상태 조합이 많아서, 단순 TypeScript 타입만으로는 drift를 막기 어렵다고 봤습니다.

### Next.js Route Handlers

- 실제 백엔드가 없는 과제에서 mock REST API를 가장 자연스럽게 붙일 수 있는 방법이었습니다.
- 프론트엔드와 계약을 같은 저장소에서 함께 발전시키기 좋았습니다.
- 추후 실제 백엔드가 생기더라도, 현재 단계에서는 UI와 계약 실험에 집중할 수 있었습니다.

### Pino

- 이 프로젝트는 `문제가 왜 생겼는지 빠르게 추적 가능한가`가 중요합니다.
- 출퇴근 실패, 요청 충돌, 검토 흐름 같은 문제는 로그 품질이 낮으면 디버깅 비용이 커집니다.
- 그래서 ad-hoc `console.log`보다 structured logging을 선택했습니다.

### Vitest + React Testing Library

- 단순 helper와 projection 로직은 빠른 unit test가 필요했고,
- 사용자 상호작용은 JSDOM 기반 integration test가 필요했습니다.
- 이 둘을 분리하면 `도메인 규칙`과 `UI 동작`을 각각 빠르게 검증할 수 있습니다.

### pnpm

- 현재는 single-project 앱이지만, 앞으로 admin 화면을 별도 패키지나 모노레포 단위로 분리하게 될 가능성을 고려했습니다.
- 그런 방향성까지 생각하면 `pnpm`이 현재도 무난하고, 이후 확장에도 유리하다고 판단했습니다.

### Lefthook

- 문서든 코드든 저장소에 들어오는 순간 최소한의 품질 게이트는 자동으로 걸려야 한다고 봤습니다.
- 특히 이 프로젝트는 계약 문서와 구현이 함께 움직이기 때문에, 포맷/린트/테스트가 커밋 흐름에 붙어 있는 편이 안전합니다.

## 6. 제가 이 프로젝트에서 가장 중요하게 본 것

### 1. 이 시스템이 직원에게 감시처럼 느껴지면 안 된다고 봤습니다

출결 ERP는 잘못 만들면 곧바로 `감시`, `통제`, `낙인`처럼 느껴집니다.
저는 이 프로젝트가 관리자와 직원이 서로를 의심하게 만드는 도구가 아니라, 같은 사실을 보고 빠르게 정렬하는 도구가 되어야 한다고 생각했습니다.

그래서 다음 원칙을 중요하게 봤습니다.

- 사람 중심 낙인보다 사건 중심 표현을 쓰기
- 상태만 보여주지 말고 이유와 다음 행동을 같이 보여주기
- 관리자 화면도 `문제 직원`이 아니라 `확인 필요한 근태`처럼 읽히게 만들기
- hover에 숨기지 말고, 모바일과 접근성에서도 핵심 정보가 보이게 하기

이 방향은 [docs/ux-writing-guidelines.md](docs/ux-writing-guidelines.md)와 [docs/ui-guidelines.md](docs/ui-guidelines.md)에 반영해 두었습니다.

### 2. 가장 위험한 오류는 조용한 오류라고 봤습니다

출근 누락, 퇴근 누락, 비콘 실패, 승인 대기, 반려 후 미인지 같은 문제는 `발생` 자체보다 `아무도 못 보고 지나가는 것`이 더 위험합니다.

그래서 저는 이 프로젝트를 `이상 탐지 → 바로 노출 → 바로 수정 경로 제공 → 처리 상태 추적`의 닫힌 루프로 해석했습니다.

즉, 기록표 안에만 오류가 숨어 있으면 실패라고 봤습니다.

### 3. 직원 화면과 관리자 화면이 같은 사실을 말해야 한다고 봤습니다

직원 화면에서는 정상인데 관리자 화면에서는 결근처럼 보이거나,
관리자는 승인했는데 직원 화면에는 여전히 대기처럼 보이는 식의 불일치는 이 제품에서 치명적입니다.

그래서 attendance projection, request lifecycle, leave conflict 정책을 각각 별도 문서와 shared contract로 분리하고,
Route Handler와 UI가 같은 vocabulary를 공유하도록 구성했습니다.

### 4. 상태보다 `현재 상태 + 이유 + 다음 행동`이 중요하다고 봤습니다

단순히 `반려됨`, `지각`, `누락`만 던지면 제품이 차갑고 무책임해집니다.
그래서 이 프로젝트에서는 가능한 한 다음 세 가지를 같이 보여주려 했습니다.

- 지금 무엇이 문제인지
- 왜 그렇게 판단했는지
- 이제 사용자가 무엇을 해야 하는지

## 7. 과제를 해석하면서 고민했고, 이렇게 결정했습니다

### 출근만 찍고 퇴근을 안 찍은 경우

이 경우는 늘 발생할 수 있지만, 오래 방치되면 안 된다고 봤습니다.

제가 세운 판단은 이렇습니다.

- 가장 좋은 것은 애초에 발생을 줄이는 것
- 그다음은 발생했을 때 누구나 빨리 알아차리게 만드는 것
- 그다음은 정정 경로를 해석 없이 바로 열어 주는 것

실제로는 알림/리마인더까지 구현하지는 못했습니다.
대신 현재 구현에서는 다음 장치들로 `즉시까지는 아니어도 반복적이고 빠르게 인식하고 해결을 유도하는 구조`를 만들었습니다.

- employee `/attendance` 상단 carry-over correction surface
- 전날 열린 근무일이 오늘까지 넘어오는 경우의 명시적 노출
- duplicate submission 대신 현재 요청 상태 / 검토 사유 / 재제출 경로 우선 노출
- admin `/admin/attendance` 예외 우선 테이블에서 carry-over 문제를 상단 위험군으로 취급

즉, 완전한 예방은 아직 못 했지만, `조용히 묻히는 상태`는 최대한 줄이려 했습니다.

### 비콘 범위 밖에서 앱을 여는 경우

이 질문은 단순히 `밖에서 앱을 열면 실패인가?`의 문제가 아니라고 봤습니다.
본질은 `앱이 잘못된 확신을 줘서는 안 된다`는 점입니다.

제가 채택한 해석은 다음과 같습니다.

- 앱을 열었다는 사실만으로 출퇴근 사실을 만들면 안 된다
- 앱을 열었다는 사실만으로 실패를 확정해도 안 된다
- 실패는 출근/퇴근 버튼을 눌렀을 때의 `attendanceAttempt`로 남겨야 한다
- 즉, `앱 오픈`과 `출퇴근 사실`을 분리해야 한다

그래서 attendance model은 fact-first로 설계했고, open app 자체는 attendance fact를 만들지 않도록 정리했습니다.

### 과거 날짜 연차 신청과 같은 날 중복 신청

이 부분은 시스템 차원에서 미리 막아야 한다고 판단했습니다.

- 과거 날짜 연차 신청은 불가능하게 했습니다
- 같은 날짜 혹은 겹치는 leave interval에 대한 중복 신청도 막았습니다
- 특히 중복 방지는 단순히 type label이 아니라 `interval overlap` 기준으로 보는 방향을 택했습니다

이렇게 한 이유는, 사용자가 제출하고 나서 뒤늦게 충돌을 발견하는 UX보다 제출 전에 명확히 막는 것이 훨씬 덜 불쾌하다고 봤기 때문입니다.

### 관리자 승인 후 되돌리기

저는 이 프로젝트에서 승인 후 관리자 단독 되돌리기를 허용하지 않았습니다.

이유는 분명합니다.

- 승인은 직원과 관리자 사이의 상호작용 결과인데
- 관리자가 뒤에서 조용히 되돌리면
- 양쪽 화면 sync가 깨질 수 있고
- 신뢰가 크게 무너집니다

그래서 현재 방향은 다음과 같습니다.

- 이미 reviewed 된 요청은 immutable하게 다룬다
- 비승인 결과를 바꾸고 싶어도 같은 record를 덮어쓰지 않는다
- 승인된 leave를 바꾸려면 employee follow-up `change` 또는 `cancel` 요청으로 간다
- approved manual attendance rollback은 현재 scope 밖으로 둔다

즉, `되돌리기`보다 `후속 요청 체인`을 택했습니다.

### 일괄 승인

일괄 승인은 관리자 입장에서 편해 보이지만, 이 과제 범위에서는 오류를 크게 키울 수 있는 기능이라고 판단했습니다.

- 요청마다 봐야 하는 문맥이 다릅니다
- 휴가 요청은 company event, staffing risk, 기존 승인 일정까지 같이 봐야 합니다
- 수동 출퇴근 요청은 대상일, 정정 종류, 기존 출결 사실과 비교해야 합니다

그래서 v1에서는 일괄 승인을 의도적으로 제외했습니다.

대신 다음을 더 중요하게 봤습니다.

- 요청별 문맥을 충분히 보여 주기
- 반려/보완 요청 시 review comment를 강제하기
- 충돌 경고가 있는 leave 승인에는 추가 confirmation을 두기

### 반려 후 재신청을 어렵게 만들면 안 된다고 봤습니다

반려된 요청을 처음부터 다시 쓰게 만드는 것은 UX적으로 좋지 않다고 생각했습니다.
특히 직원 입장에서는 억울함과 피로가 커지고, 관리자 입장에서도 같은 정보가 반복 제출됩니다.

그래서 request lifecycle은 다음 방향으로 정했습니다.

- reviewed request는 그대로 보존
- 반려 또는 보완 요청 후에는 prefilled resubmission을 제공
- 기존 요청과 새 요청의 관계는 chain으로 유지
- 이전 review comment는 새로운 follow-up 옆에서도 맥락으로 남김

즉, `삭제 후 새로 쓰기`가 아니라 `맥락을 보존한 채 다시 맞추기`를 택했습니다.

### 관리자 페이지는 대시보드가 아니라 운영 콘솔이어야 한다고 봤습니다

관리자에게 중요한 것은 전체 숫자 자체보다 `지금 개입이 필요한 예외`입니다.
그래서 `/admin/attendance`는 summary card보다 exception-first 구조를 우선시했습니다.

제가 중요하게 본 포인트는 이렇습니다.

- no-record 직원도 필요한 순간에는 표에 보여야 한다
- 단순 정상 인원보다 carry-over, failed attempt, pending request 같은 예외가 먼저 보여야 한다
- 카드 숫자와 ledger 행이 같은 사실에서 파생되어야 한다
- `오늘 운영 화면`과 `기간 이력 조회`는 한 route 안에서 구분된 모드로 읽혀야 한다

### 신청 관리 화면은 승인 버튼 목록이 아니라 결정 지원 시스템이어야 한다고 봤습니다

`누가`, `언제`, `무슨 유형`, `왜`, `지금 무엇과 충돌하는지`를 충분히 보여 주지 않으면 잘못된 승인 가능성이 커집니다.
그래서 request review 화면은 다음 방향으로 해석했습니다.

- manual attendance와 leave는 같은 route 안에서 보되 같은 표로 뭉개지지 않게 분리
- 큐 row만으로 끝내지 않고 오른쪽 detail/review workspace를 둔다
- review가 끝난 non-approved request는 active queue가 아니라 completed review history로 본다
- employee-facing resubmit CTA를 admin completed history에 그대로 끌고 오지 않는다

### 휴가 UX는 단순 입력 폼보다 계획 도구에 가까워야 한다고 봤습니다

저는 휴가 신청을 `날짜 입력 폼`만으로 다루는 것보다, 일정과 상태를 함께 보여 주는 planning workspace가 낫다고 봤습니다.

현재 구현과 문서 방향에는 이런 판단이 들어 있습니다.

- leave balance와 상태 요약은 상단에 고정
- reviewed non-approved request는 history와 top correction tier에서 회복 가능하게 유지
- selected date context와 inline composer를 같은 planning row에 두어, 날짜 맥락과 입력을 분리하지 않음
- 승인 후 변경과 취소도 같은 chain 안에서 follow-up으로 처리

## 8. 화면별로 제가 중요하게 본 사용성

### `/attendance`

이 화면은 `근태 조회 화면`보다 `내 하루 운영 패널`에 가깝게 만들고 싶었습니다.

- 3초 안에 오늘 정상인지 알아야 한다
- 테이블을 해석하기 전에 예외가 먼저 보여야 한다
- 전날 퇴근 누락은 오늘 화면 상단에서 바로 보여야 한다
- 승인된 휴가가 있는 날은 일반 미출근 경고보다 leave context가 우선해야 한다
- 수동 정정 요청이 이미 있으면 새 요청보다 현재 상태와 다음 행동이 먼저 보여야 한다

### `/attendance/leave`

이 화면은 `휴가 신청 폼`이 아니라 `개인 일정 계획 + 신청/수정/취소 허브`로 봤습니다.

- 잔여 연차와 현재 상태를 같이 봐야 한다
- 반려/보완 요청은 깊은 상세 화면에 숨기면 안 된다
- pending, approved, rejected, revision_requested가 어디서나 같은 의미로 읽혀야 한다
- approved leave 위에 pending follow-up이 생겨도, 현재 유효한 승인 상태를 숨기면 안 된다

### `/admin/attendance`

- 전체 정상 인원보다 예외가 먼저 보여야 한다
- 레코드가 없다는 이유로 관리 대상이 사라지면 안 된다
- `오늘`과 `히스토리`는 쓰임이 달라서 같은 route 안에서도 읽는 방식이 달라야 한다
- summary와 ledger는 같은 fact set에서 파생되어야 한다

### `/admin/attendance/requests`

- 관리자에게 필요한 것은 빠른 버튼 클릭보다 안전한 판단입니다
- leave 승인 전에는 company event, staffing risk, effective leave, pending context를 같이 보여야 합니다
- 반려/보완 요청은 반드시 이유를 남기게 해야 한다고 봤습니다
- 검토가 끝난 비승인 요청은 큐에 계속 남겨 두기보다, history/context로 읽히게 하는 편이 맞다고 판단했습니다

## 9. Mock 데이터와 계약 문서를 왜 이렇게 중요하게 다뤘는가

이 프로젝트는 단순히 화면만 예쁘게 만들어서는 안 된다고 봤습니다.
출결, 휴가, 요청 검토는 상태 전이가 많고, 조금만 어긋나도 직원과 관리자 화면이 다른 얘기를 하기 쉽습니다.

그래서 문서를 아래처럼 쪼개서 관리했습니다.

- [docs/attendance-operating-model.md](docs/attendance-operating-model.md)
  - 출결 사실과 파생 상태를 어떻게 해석하는지
- [docs/request-lifecycle-model.md](docs/request-lifecycle-model.md)
  - 재신청, 변경, 취소, reviewed immutability를 어떻게 다루는지
- [docs/leave-conflict-policy.md](docs/leave-conflict-policy.md)
  - 회사 일정/인원 제한 경고를 어떻게 보여 줄지
- [docs/feature-requirements.md](docs/feature-requirements.md)
  - 사용자에게 최종적으로 무엇이 보여야 하는지
- [docs/ui-guidelines.md](docs/ui-guidelines.md)
  - ERP 톤과 정보 우선순위를 어떻게 구현할지
- [docs/ux-writing-guidelines.md](docs/ux-writing-guidelines.md)
  - 감시가 아니라 협업처럼 읽히게 하는 말투를 어떻게 유지할지

즉, 저는 이 프로젝트를 `문서와 구현이 같이 움직이는 프론트엔드 과제`로 접근했습니다.

## 10. 아직 구현하지 못했거나 의도적으로 남겨둔 것

### 아직 구현하지 못한 것

- 퇴근 누락, 미출근, 검토 지연 등을 더 빨리 예방하기 위한 알림/리마인더
- 관리자 테이블 페이지네이션
- 더 강한 캘린더 중심 운영 화면
  - 팀 일정과 요청을 한 달 view에서 더 입체적으로 조정하는 경험
- 실제 BLE 감지와 디바이스 상태 연동
- 실제 백엔드 및 영속 저장
- E2E 테스트 계층

### 의도적으로 제외한 것

- 관리자 단독 승인 되돌리기
- 요청 일괄 승인/일괄 반려
- reviewed request same-record overwrite
- employee/private context를 노출하는 과도한 관리자 편의 기능

이 항목들은 단순히 시간이 부족해서만 제외한 것이 아니라, 현재 제품 철학과 신뢰 모델을 망가뜨릴 수 있다고 판단한 부분도 포함합니다.

## 11. 이 프로젝트를 통해 만들고 싶었던 경험

제가 만들고 싶었던 것은 `직원에게는 억울함을 줄여 주고`, `관리자에게는 운영 리스크를 줄여 주는` 출결 시스템이었습니다.

그래서 이 프로젝트는 다음과 같은 경험을 목표로 했습니다.

- 직원이 손해 보기 전에 먼저 이상을 알아차릴 수 있는 경험
- 관리자가 사람을 감시하는 느낌보다 예외를 정리하는 느낌을 받는 경험
- 상태가 바뀔 때마다 왜 바뀌었는지 이해할 수 있는 경험
- 반려되거나 꼬인 요청도 처음부터 다시 쓰지 않고 이어서 바로잡을 수 있는 경험

이 README는 그 목표와 실제 구현을 연결해서 설명하기 위한 문서입니다.

실제 세부 계약과 구현 규칙은 아래 문서를 함께 봐 주세요.

- [AGENTS.md](AGENTS.md)
- [DESIGN.md](DESIGN.md)
- [docs/AGENTS.md](docs/AGENTS.md)
- [docs/feature-requirements.md](docs/feature-requirements.md)
- [docs/ui-guidelines.md](docs/ui-guidelines.md)
- [docs/app-architecture.md](docs/app-architecture.md)
- [docs/api-spec.md](docs/api-spec.md)
- [docs/database-schema.md](docs/database-schema.md)
