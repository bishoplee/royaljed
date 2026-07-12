# Phase 8 Plan - Tutor Assessment, Rubrics, and Timeline Feedback

Last updated: 2026-07-11
Owner: Royaljed implementation
Status: In progress

## Goal
Deliver Phase 8 end-to-end: tutors can review student submissions, score rubric criteria, leave timestamped feedback linked to media playback, and publish grades visible to students.

## Scope
In scope:
- Tutor assignment review dashboard
- Submission review detail page
- Rubric scoring and overall percentage calculation
- Timestamped feedback comments with jump-to-time behavior
- Grade persistence and submission state transition (SUBMITTED -> GRADED)
- Student-side grade and feedback visibility
- Access control and tenant isolation

Out of scope:
- Phase 9 Google Classroom sync
- PDF report generation
- New transcoding pipeline changes

## Current State Baseline (Done Before Phase 8)
- [x] Database models exist for Assignment, Submission, Grade, and TimestampedFeedback in prisma/schema.prisma
- [x] Student submission APIs exist
- [x] Assignment rubric payload is already stored as rubricJson
- [x] Tutor area route exists as placeholder page
- [ ] Tutor grading APIs not implemented
- [ ] Tutor grading UI not implemented
- [ ] Timestamped feedback workflow not implemented
- [ ] Student grade retrieval UI/API not implemented

## Workstreams and Tasks

### WS1 - Tutor Backend APIs
- [x] Create tutor submissions list endpoint
  - Path: src/app/api/ec/[schoolSlug]/tutor/submissions/route.ts
  - Must filter by tenant and tutor authorization
  - Must support filtering by assignment, class, and grading status
- [x] Create tutor submission detail endpoint
  - Path: src/app/api/ec/[schoolSlug]/tutor/submissions/[submissionId]/route.ts
  - Must include assignment rubricJson and existing grade (if any)
- [x] Create upsert grade endpoint
  - Path: src/app/api/ec/[schoolSlug]/tutor/submissions/[submissionId]/grade/route.ts
  - Input: criterion scores, feedbackText, timestamped feedback list
  - Behavior: compute percentage, validate rubric weights, set submission status to GRADED
- [x] Add API contract validation and defensive checks
  - Validate numeric score ranges and timestamp bounds
  - Reject cross-tenant and unauthorized access

### WS2 - Tutor Frontend
- [x] Replace placeholder tutor dashboard
  - Path: src/app/ec/[schoolSlug]/tutor/dashboard/page.tsx
  - Show pending and graded queues with status chips
- [x] Add tutor submission review page
  - Path: src/app/ec/[schoolSlug]/tutor/submissions/[submissionId]/page.tsx
  - Show media/text submission content and rubric scoring controls
- [x] Implement rubric scoring interaction
  - Slider or numeric inputs per criterion
  - Live percentage preview before save
- [x] Implement timeline feedback interaction
  - Capture current player time into comment draft
  - Display ordered timestamp markers
  - Click marker seeks media to timestamp

### WS3 - Student Feedback Visibility
- [x] Extend student assignment detail endpoint response with grade data when available
  - Path: src/app/api/ec/[schoolSlug]/student/assignments/[assignmentId]/route.ts
- [x] Update student assignment detail UI to show:
  - Total percentage
  - Per-criterion scores
  - Tutor written feedback
  - Timestamped comments with jump-to-time when media exists

### WS4 - Security, Audit, and Quality
- [ ] Ensure role and tenant checks on all new tutor endpoints
- [ ] Add audit log entries for grading actions
- [ ] Add rate-limits where needed for write endpoints
- [ ] Add tests for:
  - authorization boundaries
  - grading calculation correctness
  - timestamp comment persistence and ordering

## Data and Validation Rules
- Percentage calculation should be deterministic and based on rubricJson weights.
- Criteria score bounds should be validated server-side.
- Timestamped feedback must be non-negative and within media duration when duration is known.
- Grade save should be atomic with submission status update.

## Definition of Done (Phase 8)
- [ ] Tutor can open pending submissions list.
- [ ] Tutor can open a submission and score all rubric criteria.
- [ ] Tutor can add and edit timestamped comments linked to playback.
- [ ] Tutor can publish grade and submission changes to GRADED.
- [ ] Student can view grade summary and detailed feedback.
- [ ] Tenant isolation and role checks verified manually and by tests.
- [ ] Build passes and all new tests pass.

## Verification Checklist
- [ ] npm run build
- [ ] Tutor happy-path manual test
- [ ] Student visibility manual test
- [ ] Unauthorized role access test (expect 403)
- [ ] Cross-tenant access test (expect 401/404)

## Execution Order
1. WS1 Tutor Backend APIs
2. WS2 Tutor Frontend
3. WS3 Student Feedback Visibility
4. WS4 Security, audit, tests, and final verification

## Progress Log
- 2026-07-11: Created Phase 8 execution plan and baseline status snapshot.
- 2026-07-11: Implemented WS1 tutor grading APIs (list, detail, grade save), with tenant and role checks plus grade audit logging.
- 2026-07-11: Verified build passes after WS1 changes.
- 2026-07-11: Hardened grade endpoint with timestamp upper-bound validation, feedback length limits, and original-grader ownership checks for grade updates.
- 2026-07-11: Implemented WS2 tutor dashboard with pending/graded submission queue and filter controls.
- 2026-07-11: Implemented submission review UI with rubric sliders, live weighted score preview, timeline comments, and save-grade flow.
- 2026-07-11: Added secure tutor media streaming endpoint for audio/video submission playback in review workflow.
- 2026-07-11: Re-verified production build after WS2 changes.
- 2026-07-11: Implemented WS3 API payload enrichment for student-side grade visibility, including tutor identity and timestamped comments.
- 2026-07-11: Implemented student grade and feedback rendering in assignment detail page with per-attempt score breakdown.
- 2026-07-11: Added secure student submission media endpoint to support timestamp comment jump-to-time playback.
- 2026-07-11: Re-verified production build after WS3 changes.
