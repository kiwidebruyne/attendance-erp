# Product Spec Context

## Purpose and Usage Rules

This document is a cumulative source-of-truth log for preserving raw product-spec discussion context around attendance, leave, and request management without dropping details.

- Keep this file readable by both humans and models before any follow-up product decision.
- This file does not replace narrower contract documents. Once a policy is finalized, promote it into `docs/feature-requirements.md`, `docs/ui-guidelines.md`, `docs/api-spec.md`, `docs/database-schema.md`, or another primary contract document as appropriate.
- Pre-contract defaults recorded here guide ongoing product discussion, but they must not be implemented as contract changes until the corresponding primary documents are updated in a synchronized follow-up change.
- This file is a living log, not a dated session snapshot. Append future discussion of the same kind here.
- The archive section keeps the original Korean discussion as intact as possible, while machine-specific local paths should be sanitized into repository-relative references.
- Anyone changing screen structure, workflow rules, state policy, notification UX, or approval and correction behavior should read this file first to recover the current discussion context and open questions.

## Locked Product Principles

- Treat the product as a trust product, not only a record-keeping tool.
- Employees and admins should feel like they are aligning on shared facts, not supervising one another.
- Every screen should show not only the current state, but also why that state exists and what action comes next.
- Problems must not stay buried inside tables. Today’s state, risk, and next action should be visible near the top of the screen.
- Silent inconsistency between employee and admin views for the same date or request is not acceptable.
- Every important state transition should retain `history + reason + next action`.
- Default copy tone should be collaborative and orient toward alignment rather than blame.
- Do not rely on hover-only information structures. Core information and actions must stay available on mobile and through accessible interaction patterns.

## Locked Workflow Defaults

- When an already reviewed request must change, use a follow-up request model rather than silently overwriting the original request.
- At the product-workflow level, plan for a remediation outcome labeled `보완 요청`; do not treat it as current API or schema vocabulary until the contract documents are updated in a synchronized follow-up change.
- Re-submission after rejection should start from a prefilled version of the previous input rather than an empty form.
- Notification scope is in-app first: warnings, badges, and status surfaces come before external push channels.
- Employee and admin views must stay synchronized on the same facts and statuses, with stale states cleared promptly.
- Use action-first UX so both employees and admins can see the problem and the resolution path together.

## Promoted Attendance Operating Model

- The promoted attendance operating-flow contract now lives in `docs/attendance-operating-model.md`.
- Use that document for canonical attendance fact lifecycle, derived exception timing, carry-over behavior, leave-work conflict handling, and shared employee/admin synchronization rules.
- Keep this file focused on raw discussion provenance, locked cross-screen principles, and unresolved product questions.

## Promoted Request Lifecycle Model

- The promoted request-lifecycle contract now lives in `docs/request-lifecycle-model.md`.
- Use that document for reviewed-request immutability, follow-up request chains, revision/change/cancel flows, and shared employee/admin request synchronization rules.
- Keep this file focused on raw discussion provenance, locked cross-screen principles, and unresolved product questions.

## Open Questions for Future Interviews

- How far should company-event calendars go in the first product scope, and who owns them?
- Should per-day leave-capacity policy be automatic blocking or warning-plus-manual-approval?
- What are the exact triggers, priority rules, cleanup rules, and unread model for in-app notifications?
- How much leave summary should appear directly on `/attendance`?
- What exact API and schema naming should encode the promoted request lifecycle semantics without overloading the older approval-status vocabulary?
- What is the priority order for exceptions such as previous-day missing checkout, same-day missing check-in, lateness, and revision-requested waiting states?
- What concrete writing rules should encode the desired collaborative tone and Toss-like microcopy style?
- When should SLA, company-event conflict warnings, staffing caps, and external notification channels graduate into formal contract documents?

## Raw Conversation Archive

### `<message_0>`

```text
가정은 이렇게 두겠습니다.
비콘은 “항상 자동 감지”가 아니라, 사용자가 출근/퇴근 버튼을 눌렀을 때 그 시점에 비콘 범위 안인지 검증하는 장치입니다. 이 해석이면 중간에 잠깐 밖에 나갔다 오는 것은 그 자체로 상태 이벤트가 아닙니다.

1. 출근 전을 새 상태로 둘지, 레코드 없음으로 둘지

제 권장은 레코드 없음 + UI에서 출근 전 표시입니다. 이유는 명확합니다.

출근 전은 출결 “사실(fact)”이라기보다, 현재 시각과 오늘 스케줄을 보고 계산한 일시적 표현값입니다.
이걸 저장 상태로 만들면 매일 00:00이나 09:00에 모든 직원의 placeholder row를 생성해야 해서, 데이터가 이벤트 중심이 아니라 배치 중심으로 바뀝니다.
현재 관리자 API도 이미 status와 별개로 notCheckedInCount를 둡니다. 즉 “아직 출근 안 함”은 원래도 집계/표시용 파생 개념에 가깝습니다. 참고: api-spec.md
반대로 “출근 전”을 추가하고 싶다면, 기존 status에 섞기보다는 별도 축인 workPhase로 두는 편이 낫습니다. 지금 database-schema.md의 working/normal/late/...는 진행 상태와 판정 결과가 섞여 있어서, 여기에 출근 전까지 넣으면 더 혼잡해집니다.
즉, “새 상태 추가 자체가 나쁘다”가 아니라, 추가한다면 attendance status가 아니라 work phase로 넣는 게 맞다는 판단입니다.

2. 상태를 분리하자는 제안에 대해

여기는 저도 동의합니다. 지금 복잡한 이유는 말씀하신 대로 근무 진행 상태와 출결 판정 결과를 한 필드에 몰아넣으려 하기 때문입니다.

다만 저는 정상/비정상 + 비고보다는 아래처럼 나누는 쪽을 더 권장합니다.

workPhase: before_check_in / working / checked_out
anomalies 또는 flags: late, early_leave, absent
verification: clockInVerified, clockOutVerified, manualRequestStatus
leave: 승인된 연차/반차/시간차 정보는 별도 입력값으로 유지
이 구성이 더 나은 이유는:

late와 early_leave가 같은 날 동시에 발생할 수 있습니다. 정상/비정상 + 단일 비고는 이 조합을 잘 못 담습니다.
on_leave는 “비정상”이 아닙니다. 그래서 정상/비정상 축은 휴가와 잘 안 맞습니다.
manual request pending은 출결 결과라기보다 검증/보정 상태에 가깝습니다.
관리자 요약 카드에서 필요한 수치가 서로 다른 축을 봅니다. 근무중 몇 명, 지각 몇 명, 휴가 몇 명은 한 enum으로 묶으면 매번 예외가 생깁니다.
그래서 제 추천은:

내부 모델은 phase + anomalies + verification + leave input
UI/API가 꼭 필요하면 여기서 displayStatus를 파생해서 working / normal / late / early_leave / absent / on_leave로 보여주기
이렇게 하면 현재 문서의 단일 status도 유지할 수 있고, 나중에 룰이 늘어나도 덜 깨집니다.

3. 비콘과 수동 신청 해석

이 해석이 더 자연스럽습니다.

기본 흐름: 사용자가 비콘 범위 안에서 출근/퇴근 버튼을 누른다.
실패 흐름: 비콘 오류, 앱 오류, 버튼 미누름, 실수 등으로 기록이 빠졌을 때 수동 신청을 한다.
따라서 beacon missing은 하루 종일 유지되는 출결 상태가 아니라, 특정 출근/퇴근 이벤트가 검증 실패했다는 사실로 다루는 게 맞습니다.
중간 외출은 버튼을 누르지 않는 한 상태 변화가 아닙니다. 그렇지 않으면 점심 외출만으로 퇴근/재출근 이벤트가 난립합니다.
그래서 1.1도 이렇게 보완하는 게 좋습니다.

09:00 이전 체크인 성공 → workPhase=working, anomaly 없음
09:00 이후 첫 체크인 성공 → workPhase=working, late 플래그 추가
18:00 이전 체크아웃 성공 → checked_out, early_leave 플래그 추가
18:00 이후 체크아웃 성공이고 anomaly 없음 → 최종 normal
지금 가장 먼저 고정해야 할 질문은 이것입니다.
하루에 late와 early_leave가 동시에 붙을 수 있다고 볼까요? 저는 실무적으로는 “가능”으로 두는 게 맞다고 봅니다.
```

### `<message_1>`

```text
응 가능으로 두자.

중요한 건, 결국 우리가 고려해야되는 건 데이터 구조가 아니라, 유저 화면과 관리자 화면에 나타나야 할 스펙 및 사용성이잖아. 유저 사용성에 맞춰야 하잖아. 이게 가장 중요해.

이거부터 먼저 생각해보자.

1. 화면 1: 내 출퇴근 현황(/attendance)
직원들이 자신의 출퇴근 현황을 볼 수 있게 하는 이유는 뭐지?
- 자신의 이번주 근무시간 및 출퇴근 현황, 근태가 정확하게 트래킹되고 있는지 한눈에 파악할 수 있어야 함.
- 자신의 연차/반차 신청이 잘 신청, 수락되었는지, 자신의 연차/반차가 언제인지 한눈에 파악할 수 있어야 함.
- 근태가 잘못 트래킹되고 있는 부분을 눈에 띄게, 매우 쉽고 무조건 파악할 수 있게 해서 오류가 있을 경우 최대한 빠르게 수동 출퇴근 신청을 하도록 유도해야 함.
- 애초에 출퇴근 찍는 걸 까먹는 경우가 없도록 ui 또는 notification 등의 기능을 두는 게 베스트임. 애초에 오류가 발생하지 않게 하는 것.
- 그럼에도 오류가 발생했을 경우, 오류가 발생했다는 것을 매우 쉽고 직관적이고 한눈에 알 수 있게 해서 바로 고칠 수 있게 해야 함.
- [raw-assignment.md](docs/raw-assignment.md) 의 화면 1, 고려할 점에 적힌 '비콘 범위 밖에서 앱을 열면?'이라는 질문은 뭐지?

이외에도 더 중요한 것들, 관점들 및 사용성, 고려해야될 점들에는 뭐가 있지?

2. 화면 2: 연차/반차 신청 (/attendance/leave)
- 연차/반차/시간차 등 사용에 오류가 없도록 하고, 개인의 일정은 항상 변동될 가능성이 있기 때문에 수정 및 취소가 매우 용이해야 함.
- 자신의 신청이 반려되었으면, 이걸 즉시 직관적으로 바로 알 수 있게 해야 함. 자신의 연차/반차를 신청하면서 그날의 계획을 세울 텐데, 반려된 걸 모르고 있다가 나중에 알게 되면 사용자 입장에서 매우 불쾌하고 불편한 경험이 됨.
- 내 생각에는 신청 폼을 두는 것도 좋은데, 여러 개를 신청할 때 사용성이 편리하려면, 캘린더에서 특정 날짜를 클릭하면, 신청이 가능하도록 해야 함. 이것이 날짜를 입력하는데 굉장히 직관적이고, 유저 사용성 면에서 굉장히 편리하기 때문임. '신청 버튼 클릭 -> 날짜 입력 또는 날짜 입력을 누르면 캘린더가 나와서 선택할 수 있게 하기'. 이것보다 내 연차/반차 계획 및 현황 자체를 캘린더에서 보여주는 게 굉장히 직관적이고, '캘린더에서 연차/반차 신청하고 싶은 날짜 클릭 -> 유형(연차/오전반차/오후반차/시간차) 선택. 이떄 유형별로 잔여 개수를 보여주면 좋음 -> 그때 모달 띄워주고 선택된 날짜, 유형, 사유 입력칸 보여주고, 사유 입력 유도하고 최종 신청/취소 버튼 포함' 방식이 훨씬 사용성 좋은 거 같은데 어떻게 생각해.
- 또한 상사가 승인하기 전에 신청 자체를 취소하는 것과, 이미 승인된 것을 취소하는 경우도 고려해야될 것 같아.
- 신청 폼으로 전부 다 시작해서 입력하게 하는 것도 가능하게 할까?
- 즉 캘린더와 신청내역리스트(대시보드)가 둘 다 필요하다고 봄.

이외에도 더 중요한 것들, 관점들 및 사용성, 고려해야될 점들에는 뭐가 있지?

3. 화면 3: 팀 출퇴근 대시보드(/admin/attendance)
관리자가 팀원 전체의 출퇴근 현황을 한눈에 볼 수 있게 해야 해. 왜 한눈에 볼 수 있게 해야하지? 왜냐하면 팀원들을 오류 없이 관리하는 것이 관리자의 책임이고, 회사 입장에서 제대로 관리되지 않는 팀원이 있으면 크나큰 손실이고, 업무에 차질이 생길 수도 있기 때문임.
- 팀원 중 근태에 문제가 생긴 인원들을 한눈에 파악할 수 있게 해야하고, 트래킹에서 빠지는 인원이 절대 없도록 해야 함. 그리고 만약 출퇴근을 찍지 않은 팀원이 발생하면 해당 직원뿐만 아니라 팀장에게도 알림이 가도록 하는 것이 좋을 수도 있음.
- 출퇴근하는 팀원이 생길 때마다 알림이 뜨게 할지 말지 선택적으로 알림설정도 할 수 있으면 좋을 것 같음.
- 내 생각에는 두 가지 ui가 필요함. 하나는 현재 실시간으로 팀원들의 상태를 한눈에 볼 수 있게 하는 ui. 다른 하나는 월별/주별/선택기간별 선택된 팀원 1명 또는 여러명의 근태 및 현황을 파악할 수 있는 ui. 월별/주별 캘린더에 팀원들의 연차/반차/시간차 일정들도 표시해주는 ui도 필요함.

이외에도 더 중요한 것들, 관점들 및 사용성, 고려해야될 점들에는 뭐가 있지?

4. 화면 4: 신청 관리(/admin/attendance/requests)
- 캘린더로 직원들의 확정된 연차/반차/시간차 일정들을 한눈에 볼 수 있게 하고, 또 신청된 일정들도 같은 캘린더에 띄워줘서 마찬가지로 캘린더 내에 클릭을 통해 승인/반려를 해줄 수 있으면 좋음. 왜냐하면 날짜별로 몇명 이상이 연차를 쓰면 안될 수도 있으니까.
- 미리 입력된 회사의 주요 일정들도 같은 캘린더에 넣어서 주요 일정들을 연차/반차/시간차를 승인/반려할 때 잊지 않고 꼭 고려할 수 있게 하면 좋음.
- 캘린더에는 연차/반차/시간차와 이름만 일단 ui로 보여주고, 커서를 hover하면 사유를 띄워주면 좋을 것 같음.
- 중요 일정이나 미팅 등이 있는데도 연차/반차/시간차를 모르고 승인해주는 실수가 발생하지 않도록 해야 함.
- 물론 신청목록 테이블 및 대시보드도 마찬가지로 필요함.

이외에도 더 중요한 것들, 관점들 및 사용성, 고려해야될 점들에는 뭐가 있지?

각 항목별로 보장해야 할 주요 사용성이나 기능, 또는 고려해야 할 점들에 더 어떤 것들이 있는지 너만의 관점으로 새로운 생각들을 해서 브레인스토밍해줘. 내가 분명히 놓친 것들이 있을 거야. 그걸 너가 다 찾아줘야 돼. 각 항목별로 반드시 시스템적으로 보장해야 할 것, 시스템적으로 절대 발생해서는 안될 오류나 제약사항들과, 그것을 시스템적, ui ux적으로 절대 발생하지 않도록 설계해야 해.
```

### `<message_2>`

```text
좋다. 방향을 조금 더 선명하게 잡자.
지금 이 제품에서 가장 중요한 건 “출결 데이터를 저장하는 것”이 아니라, **직원과 관리자가 오늘 무엇이 정상이고 무엇이 문제인지 즉시 알고 바로 행동할 수 있게 만드는 것**이다. 즉 핵심은 `정확한 기록`보다 한 단계 앞선 `오류 예방`, `문제 즉시 발견`, `즉시 수정 가능성`이다.

**먼저 전체 제품에 공통으로 깔아야 할 기준**
- `보장:` 오늘 상태와 다음 행동이 첫 화면 상단에서 바로 보여야 한다. 사용자가 테이블을 읽어서 해석하면 이미 실패다.
- `보장:` 문제는 “발생 사실”보다 “해결 행동”과 같이 보여야 한다. 예: `퇴근 누락 가능성`과 동시에 `수동 신청` 또는 `확인 필요` CTA.
- `보장:` 승인/반려/대기/보정 요청 같은 중간 상태가 절대 숨어 있으면 안 된다.
- `금지:` 같은 날짜가 직원 화면에서는 정상인데 관리자 화면에서는 결근처럼 보이는 불일치.
- `금지:` 비콘 실패, 버튼 미입력, 승인 대기 같은 서로 다른 원인이 하나의 애매한 경고로 뭉개지는 것.
- `금지:` hover에만 의존하는 정보 구조. 모바일과 접근성에서 바로 무너진다.

**1. 화면 1 `/attendance`**
- 이 화면의 진짜 역할은 “내 기록 조회”보다 **오늘 내가 안전한지, 지금 무엇을 해야 하는지 확인하는 개인 운영 패널**이다.
- `보장:` 직원은 3초 안에 `오늘 정상인지`, `다음 행동이 출근인지 퇴근인지`, `수정이 필요한지` 알아야 한다.
- `보장:` 오류나 애매함은 히스토리 테이블 안이 아니라 상단의 고정 경고 영역에서 가장 먼저 보여야 한다.
- `보장:` 연차/반차도 이 화면에서 요약 노출되어야 한다. 승인된 휴가가 있는 날은 출결 오류 경고보다 휴가 상태가 우선해서 보여야 한다.
- `추가로 중요:` 전날 퇴근 누락이 오늘 아침까지 끌고 와서 첫 화면에 떠야 한다. 이런 건 사용자가 제일 놓치기 쉽다.
- `추가로 중요:` 수동 신청이 `대기중`인지 `반려됨`인지, 반려 사유가 뭔지 이 화면에서 바로 보여야 한다. leave 페이지까지 가서 확인하게 하면 늦다.
- `추가로 중요:` “비콘 범위 밖에서 앱을 열면?”이라는 [raw-assignment.md](raw-assignment.md) 질문의 본질은, 앱이 **잘못된 확신**을 주지 않게 하라는 뜻이다. 밖에서 앱을 열었다고 출근 실패가 확정되는 것도 아니고, 반대로 정상 출근 가능 상태처럼 보여도 안 된다. 즉 이 경우는 `지금 비콘을 감지하지 못해 출근/퇴근 처리가 불가함`을 명확히 보여주고, 기록 조회와 보정 경로는 계속 열어둬야 한다.
- `금지:` 출퇴근 누락이 주간/월간 기록표 안에만 숨어 있는 것.
- `금지:` 승인된 휴가일에 “미출근” 경고가 뜨는 것.
- `금지:` 중복 수동 신청을 해도 왜 안 되는지 설명이 없는 것.
- `UX 관점에서 추가:` 푸시/알림은 이상적이지만, 과제 범위에선 최소한 `인앱 리마인더`와 `고정 CTA`는 필요하다. 외부 푸시는 별도 시스템 범위다.

**2. 화면 2 `/attendance/leave`**
- 여기는 단순 폼이 아니라 **개인의 휴가 계획 캘린더 + 신청/변경/취소 허브**로 보는 게 맞다.
- 네 제안처럼 `캘린더 + 신청 내역 리스트`의 조합이 가장 낫다. 캘린더는 계획성과 직관성을 주고, 리스트는 상태 추적성과 감사성을 준다.
- `보장:` 사용자는 신청 전에 해당 날짜가 `비어 있는지`, `이미 대기중인지`, `승인됐는지`, `반려됐는지` 먼저 알아야 한다.
- `보장:` 반려 사실과 반려 사유는 즉시 눈에 띄어야 한다. 이건 감정적으로도 가장 민감한 경험이다.
- `보장:` 취소는 최소 두 갈래로 나뉘어야 한다. `승인 전 취소`와 `승인 후 취소 요청`은 성격이 다르다.
- `추가로 중요:` 시간차는 입력 오류가 가장 많다. 날짜만이 아니라 `시간대`가 명확해야 하고, 잔여 사용량에 어떤 영향을 주는지 즉시 보여야 한다.
- `추가로 중요:` 같은 날 중복 신청, 반차와 시간차 중복, 승인된 휴가 위에 또 신청 같은 충돌은 제출 전에 막아야 한다.
- `추가로 중요:` 주말/공휴일/회사 휴무일 처리를 어떻게 보여줄지 미리 정해야 한다. 신청 불가라면 캘린더 셀 자체에서 이유를 알려줘야 한다.
- `금지:` 캘린더에는 승인 표시가 없고 리스트에만 있는 것.
- `금지:` 수정/취소가 특정 상태에서만 숨겨져 있어서 사용자가 왜 안 되는지 모르는 것.
- `금지:` 반려 사유를 상세 화면 깊숙이 넣는 것.

**3. 화면 3 `/admin/attendance`**
- 이 화면의 역할은 “팀 전체를 보는 대시보드”가 아니라 **예외를 놓치지 않는 운영 콘솔**이다.
- 네가 말한 두 UI, 즉 `오늘의 실시간 운영 화면`과 `주/월/기간 분석 화면`은 분리하는 게 맞다. 한 화면에 억지로 합치면 둘 다 흐려진다. 최소한 탭이나 뷰 전환은 필요하다.
- `보장:` 관리자에게 중요한 건 전체 정상 인원보다 `지금 개입이 필요한 사람`이다. 오늘 화면은 요약 카드보다 예외 큐가 더 중요하다.
- `보장:` 출근 안 한 사람도 반드시 리스트에 보여야 한다. 레코드가 없다는 이유로 표에서 사라지면 안 된다.
- `보장:` 휴가 승인자와 출결 예외자가 교차 검증되어야 한다. 승인된 휴가자를 결근 후보로 보여주면 신뢰가 무너진다.
- `추가로 중요:` `오늘 미출근`, `지각`, `전날 퇴근 누락`, `수동 신청 대기`, `비콘 실패 빈발` 같은 운영 우선순위가 필요하다. 단순 날짜순 정렬만으로는 관리가 안 된다.
- `추가로 중요:` 필터는 많아질 수 있지만 기본값이 매우 중요하다. 첫 진입은 항상 `오늘`, `예외 우선`, `내 팀 전체`가 가장 실무적이다.
- `추가로 중요:` 알림은 유용하지만 양날의 검이다. 전원 출근/퇴근 알림은 금방 소음이 된다. 예외 기반 알림이 우선이다.
- `금지:` 카드 숫자와 테이블 행이 안 맞는 것.
- `금지:` 필터나 날짜 전환할 때 관리자 컨텍스트가 자꾸 초기화되는 것.
- `금지:` 모든 직원이 동일한 시각적 무게로 보여서 문제 인원이 묻히는 것.

**4. 화면 4 `/admin/attendance/requests`**
- 여기는 승인 버튼 모음이 아니라 **결정 지원 시스템**이어야 한다.
- 네 제안대로 `캘린더 + 요청 큐`를 같이 보는 방향이 맞다. 큐는 처리 흐름에 좋고, 캘린더는 조직 운영 충돌을 보기에 좋다.
- `보장:` 승인 전에 관리자는 최소한 `누가`, `언제`, `무슨 유형`, `왜`, `겹치는 일정이 있는지`, `팀 인원에 영향이 있는지`를 봐야 한다.
- `보장:` 반려 사유 입력은 강제여야 하고, 직원 화면까지 즉시 반영되어야 한다.
- `보장:` 승인된 일정, 대기중 일정, 회사 주요 일정이 같은 시간축 위에서 보여야 실수가 줄어든다.
- `추가로 중요:` hover로 사유를 보여주는 건 보조수단으로는 좋지만, 주 수단으로는 위험하다. 모바일과 키보드 접근성 때문에 상세 패널/모달도 반드시 있어야 한다.
- `추가로 중요:` 인원 제한 정책이 있다면 자동 차단인지, 경고 후 수동 승인인지 결정해야 한다. 이건 관리자 권한 UX에 큰 차이를 만든다.
- `추가로 중요:` 수동 출퇴근 요청도 같은 큐에 있다면, 휴가 요청과는 다른 정보가 필요하다. 요청 유형별 상세 컨텍스트가 달라야 한다.
- `금지:` 승인 후 직원 화면이나 팀 캘린더에 반영이 지연되는 것.
- `금지:` 요청이 처리되었는데 이유나 이력이 남지 않는 것.
- `금지:` 관리자가 충돌 정보를 못 본 채 승인하는 것.

**네가 특히 잘 짚었고, 내가 더 추가하고 싶은 핵심 관점**
- 이 제품은 “기록 제품”이 아니라 **신뢰 제품**이다. 사용자가 시스템을 믿지 못하면 매일 확인 스트레스가 생긴다.
- 따라서 모든 화면은 “현재 상태”보다 **시스템이 왜 그렇게 판단했는지**를 설명할 수 있어야 한다.
- 직원 화면은 `내가 손해 보지 않게 해주는 화면`, 관리자 화면은 `팀 운영 리스크를 줄여주는 화면`이어야 한다.
- 가장 위험한 오류는 기술적 오류보다 **조용한 오류**다. 누락됐는데 아무도 모르는 상황이 최악이다.
- 그래서 전 화면 공통으로 `이상 탐지 → 즉시 노출 → 즉시 수정 경로 → 처리 상태 추적`의 닫힌 루프가 필요하다.

여기서 다음 플래닝에 바로 영향을 주는 질문 하나만 고르자.
이번 과제의 MVP를 **원문 과제 범위에 맞춘 화면/흐름 중심**으로 잡을지, 아니면 네가 제안한 **알림, 회사 일정 캘린더, 승인 후 취소, 관리자 알림 설정**까지 포함한 확장 제품 범위로 잡을지 먼저 정하자. 이 결정이 있어야 각 화면의 필수 요소와 API 범위를 고정할 수 있다.
```

### `<message_3>`

```text
확장 제품 범위로 잡자.

1. 또 팀원의 경우 어떤 신청이 반려되었으면, 재신청이 수월하게 되어야 한다. 재신청의 경우 기존 신청과 모든 입력을 동일하게 선입력된 창을 띄워주어 특정 부분만 바꾸어 편하게 신청할 수 있어야 한다. 팀장의 경우에는 혹시나 이미 승인/반려한 신청을 수정할 수 있게 할지의 여부도 토의해보아야 한다. 즉 팀원의 사유로 수정하고 싶을 때와, 관리자의 사유로 수정하고 싶을 때 workflow가 용이하되 서로 간에 항상 sync된 상태가 유지되도록 해야 한다.

2. **매우 중요**: 이와 같은 ERP 및 관리 시스템은, 자칫하면 관리자와 직원 간의 불화나 서로 간의 불편한 분위기를 조장할 수 있다. 이 erp 시스템이 모두 근본적으로 서로를 위한 것이라는 직관을 주어야 하며, 각자의 ui에 표시되는 텍스트 말투 등 매우 사소한 디테일 하나하나도 매우 중요하다. 예시로 '토스(Toss)' 서비스는 항상 사용자들에게 편안한 말투를 제공한다. 관리자와 직원이 협력한다는 느낌을 주어야 한다.
```

### `<message_4>`

```text
확장 범위로 가면 이 제품은 단순한 출결 기록기가 아니라, **오류를 빨리 발견하고 서로 불편하지 않게 조정하는 협업 시스템**이 됩니다.
그래서 지금 추가하신 두 포인트는 기능 추가가 아니라, 제품 철학을 결정하는 핵심입니다.

**핵심 원칙**
- 직원과 관리자는 서로를 감시하는 관계가 아니라, 같은 사실을 보고 같은 기록을 맞추는 관계로 느껴져야 합니다.
- 모든 신청/승인/반려/수정은 `누가`, `왜`, `언제`, `다음에 무엇을 해야 하는지`가 양쪽 화면에서 동일하게 보여야 합니다.
- 가장 위험한 것은 오류 자체보다 `조용히 바뀌는 것`, `왜 바뀌었는지 모르는 것`, `내가 뭘 해야 하는지 모르는 것`입니다.
- 그래서 이 제품은 `상태`보다 `히스토리 + 사유 + 다음 액션`이 더 중요합니다.

**1. 재신청과 수정 워크플로우**
- 직원의 `반려 후 재신청`은 반드시 쉬워야 합니다. 이건 편의 기능이 아니라 필수입니다.
- 재신청은 새 빈 폼이 아니라 `기존 신청값이 모두 선입력된 상태`로 열리고, 반려 사유와 수정 권장 포인트가 상단에 고정 노출되어야 합니다.
- `다시 신청`보다 `수정해서 다시 제출` 경험이 중요합니다. 사용자는 처음부터 다시 쓰는 순간 억울함과 피로를 느낍니다.
- 승인 전 직원은 `수정` 또는 `취소`가 가능해야 합니다.
- 승인 후 직원은 기존 요청을 직접 덮어쓰는 것이 아니라 `변경 요청` 또는 `취소 요청`으로 들어가는 편이 안전합니다.
- 관리자는 이미 승인/반려한 항목을 **직접 원본 수정**할 수 있게 하기보다, `재검토`, `정정`, `결정 변경`처럼 히스토리가 남는 액션으로 처리하는 것을 권장합니다.
- 이유는 간단합니다. 관리자가 직원의 원본 신청 내용을 조용히 바꾸기 시작하면, 신뢰와 감사 추적이 무너집니다.
- 즉 추천 모델은 `원본 요청은 보존`, `후속 결정이 그것을 supersede`, `양쪽 화면엔 최신 결과와 변경 이력 모두 표시`입니다.
- 더 나아가면 `반려`만으로는 거칠 수 있습니다. 실무적으로는 `보완 요청` 상태가 있으면 훨씬 부드럽고 협업적입니다.

**2. 시스템적으로 반드시 보장해야 할 것**
- 동일한 요청에 대해 직원 화면과 관리자 화면의 현재 상태가 절대 다르게 보이면 안 됩니다.
- 이미 반려된 요청을 재신청했을 때, 이전 요청과 새 요청의 관계가 끊기면 안 됩니다. `이전 요청에서 이어진 재신청`이라는 맥락이 남아야 합니다.
- 승인/반려/취소/변경 이후에는 이전 알림과 경고가 즉시 정리되어야 합니다. stale 상태가 남으면 혼란이 생깁니다.
- 사용자가 액션을 눌렀는데 처리 결과가 늦게 반영되거나, 같은 요청이 중복 생성되면 안 됩니다.
- 관리자가 결정을 바꿨다면 직원은 즉시 그 사실과 이유를 알아야 하고, 직원이 변경 요청을 냈다면 관리자는 기존 승인 맥락까지 함께 봐야 합니다.
- 모든 중요한 상태 변화에는 항상 `다음 액션`이 붙어야 합니다. 예: `반려됨`만 보여주지 말고 `사유 확인 후 다시 신청할 수 있어요`.

**3. 관계를 나쁘게 만들지 않는 UX 원칙**
- 문구는 `감시`가 아니라 `정렬`의 톤이어야 합니다.
- 직원 화면에서 `지각`, `누락`, `반려` 같은 단어는 필요하지만, 비난처럼 느껴지지 않게 이유와 해결 경로를 같이 보여줘야 합니다.
- 관리자 화면도 `문제 직원`처럼 사람을 낙인찍는 구조보다 `확인 필요한 항목`, `조정 필요한 신청`, `검토 대기`처럼 사건 중심으로 표현하는 것이 낫습니다.
- 단, 너무 부드럽게만 써서 의미가 흐려지면 안 됩니다. `정확하지만 공격적이지 않은 톤`이 핵심입니다.
- Toss식 장점은 친절함보다 `다음 행동이 매우 분명한 문장`에 있습니다. 그 점을 가져와야 합니다.

**4. 추천 마이크로카피 방향**
- 직원: `기록이 비어 있어요`보다 `오늘 출근 기록이 아직 없어요. 지금 바로 확인하거나 수동 신청할 수 있어요.`
- 직원: `반려됨`보다 `조정이 필요해요. 사유를 확인하고 수정해서 다시 신청할 수 있어요.`
- 관리자: `지각자 3명`보다 `오늘 확인이 필요한 근태 3건`
- 관리자: `반려`만 두기보다 `보완 요청`, `승인`, `반려`의 3단 구조가 협업적으로 더 좋습니다.

**5. 네가 놓치기 쉬운 추가 포인트**
- `결정 SLA`: 신청 후 언제까지 검토되는지 기대치가 보여야 합니다.
- `우선순위`: 오늘 당장 처리해야 하는 근태 누락과 다음 주 연차 신청은 같은 무게로 보이면 안 됩니다.
- `이력 가시성`: 누가 어떤 이유로 바꿨는지 양측 모두 확인 가능해야 합니다.
- `알림 피로`: 모든 이벤트 알림은 과합니다. 중요한 예외와 결정 변화 위주여야 합니다.
- `권한 경계`: 관리자는 결정은 바꿀 수 있어도 직원의 원문 사유를 몰래 바꾸면 안 됩니다.
- `동기화 신뢰`: 캘린더, 리스트, 요약 카드, 알림 배지가 서로 다른 상태를 보이면 제품 전체 신뢰가 무너집니다.

지금 단계에서 제일 중요한 다음 결정은 이것입니다.
`승인 / 반려`만 두지 말고, **`보완 요청`을 별도 상태로 넣을지**를 정해야 합니다. 제 추천은 `넣는 것`입니다. 이 한 가지가 직원-관리자 관계 톤, 재신청 UX, 수정 워크플로우를 전부 훨씬 자연스럽게 만듭니다.
```
