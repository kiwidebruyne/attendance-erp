# UX Writing Guidelines

## Purpose

This document is the primary source of truth for in-product copy in the BestSleep attendance ERP.
It adapts the relevant parts of Toss UX Writing guidance into a local contract for this repository.

Use this document when writing page headers, status text, warnings, CTA labels, dialogs, helper text, and empty or error states.
Do not treat the external Toss page as the live contract for this repository after this document is updated.

## Source and Scope

- Source reference reviewed on 2026-04-01: [Toss UX Writing](https://developers-apps-in-toss.toss.im/design/ux-writing.html)
- This document is an adapted contract, not a verbatim mirror of the external reference.
- `docs/ui-guidelines.md` owns layout and surface behavior. This document owns wording rules and copy patterns.

## Core Rules

- Write product copy in Korean `haeyoche`.
- Prefer active voice over passive voice unless passive wording makes the user impact clearer or calmer.
- Prefer positive phrasing over negative phrasing when both are honest and equally clear.
- Avoid overly formal honorific phrasing such as `-시겠어요?`, `-시나요?`, or person-elevating business phrasing.
- Prefer verb-led CTA labels over noun-only button labels.
- CTA labels should describe the user's action, not ask a vague question.
- Keep the current state, the reason, and the next action visible together when a warning or review state matters operationally.
- If the product is certain about a fact, lead with the fact instead of a speculative question.
- Use question-form copy only when the product genuinely needs the user to judge an unknown situation.
- Avoid blame-oriented wording. State the issue precisely, then show the recovery path.

## CTA Rules

- Default to action-led CTA labels such as `어제 퇴근 시간 정정 요청`, `사유 확인`, or `다시 제출`.
- Do not use generic CTA labels such as `요청`, `처리`, or `확인` when a more specific verb phrase fits.
- Do not use top-level CTA buttons that are only speculative questions such as `혹시 퇴근하셨나요?`.
- When the product knows the factual problem, use a fact-led headline and place any user-judgment question inside the follow-up flow if still needed.
- Secondary dialog dismissal should use wording equivalent to `닫기` rather than `취소` when the intent is only to leave the dialog.

## Attendance-Specific Patterns

### Fact-Led Warning Headlines

- Prefer `어제 퇴근 기록이 아직 없어요.` over speculative question-led headlines.
- Prefer `오늘 출근 기록이 아직 없어요.` over generic missing-record language.
- Prefer `퇴근 시도가 확인되지 않았어요.` over vague error-only summaries.

### Carry-Over Correction Copy

- The top carry-over surface should lead with the factual state first.
- Use a supportive follow-up explanation such as `이미 퇴근했다면 퇴근 시간을 정정 요청할 수 있어요.`
- The primary headline can be `어제 퇴근 기록이 아직 없어요.` when the product knows the carry-over problem exists.
- The default primary CTA should describe the recovery action directly, for example `어제 퇴근 시간 정정 요청`.
- If the user already has a pending request for the same carry-over problem, replace the duplicate-request CTA with status language such as `상태 확인`.
- If the user already has a `rejected` or `revision_requested` request for the same carry-over problem, replace the duplicate-request CTA with review or resubmission language such as `사유 확인` or `다시 제출`.
- Keep speculative questions such as `이미 퇴근하셨나요?` inside the follow-up flow only. Do not use them as the top headline or the primary CTA on the carry-over surface.

### Request-State Copy

- Use copy that keeps the review reason and the next action together.
- Prefer `조정이 필요해요. 사유를 확인하고 수정해서 다시 제출할 수 있어요.` over a bare `반려됨`.
- Keep request status language aligned between employee and admin surfaces so both sides describe the same current state.
- For a pending carry-over correction, prefer copy such as `어제 퇴근 시간 정정 요청을 검토하고 있어요. 진행 상태를 확인할 수 있어요.`
- For a rejected or `revision_requested` carry-over correction, prefer copy such as `조정이 필요해요. 사유를 확인하고 수정해서 다시 제출할 수 있어요.`
- For reviewed non-approved leave top-surface suppression, prefer CTA copy such as `상단에서 숨기기` and restore copy such as `다시 상단에 표시`.
- Do not label leave top-surface suppression as `삭제`, `해결`, `알림 끄기`, or a temporary close such as `닫기`.
- When a reviewed non-approved leave request has been hidden from top auto-surfacing, keep history or request-context copy explicit that the record, review reason, and resubmission path still remain available.

## Question-Form Exceptions

Question-form copy is allowed only when the product cannot determine the answer itself and needs a user judgment.

Good uses in this product:

- a confirmation question inside a prefilled carry-over correction flow
- a user-input prompt where the product genuinely does not know whether the user already completed an action, such as an in-flow confirmation like `이미 퇴근하셨나요?`

Question-form copy should not be the default for:

- known missing-record states
- top-level warning headlines
- primary CTA labels

## Relationship to Other Docs

- Update `docs/ui-guidelines.md` when copy rules affect surface structure or CTA placement.
- Update `docs/feature-requirements.md` when copy rules affect user-visible workflow expectations.
- Keep raw discussion provenance in `docs/product-spec-context.md` when a new writing rule is first debated before it is promoted here.
