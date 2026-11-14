# AcadAI — Known Flaws and Work Backlog

Found by reviewing the source on 2026-11-11. Ordered by priority within each group. Tick items off as they are fixed. Anything left unfixed should go into the report's "Limitations" section.

Priority: **P1** fix before the report/demo · **P2** should fix · **P3** nice to have / future work

**Status:** all P1 code fixes are done, and most P2 items too (see the "Fix log" at the bottom). The only open P1 action is #4: rotating the leaked keys, which only the owner can do.

**Still open at P2:** #14 (missing roadmap content for 4 careers), #22 (deep-learning face model), #25 (real face accuracy evaluation). #24 (liveness) is documented as a limitation, not implemented.

## A. Security and privacy

- [x] **#1 (P1) Anyone can register as admin.** *Fixed:* `role` was removed from `RegisterDto` and the Register page. Public sign-up always creates a `student`, and admins come from the seed only. Verified live: registering with `role: "admin"` returns a student, and admin endpoints return 403.
- [x] **#2 (P1) TLS verification was disabled globally.** *Fixed:* removed `NODE_TLS_REJECT_UNAUTHORIZED = '0'` from `main.ts`. OpenRouter calls verified working over normal TLS.
- [x] **#3 (P1) Quiz answers were sent before the student answered.** *Fixed:* `POST /tests/:id/generate` strips `answer` and `explanation`, which are returned only by `/submit`. Submitting after the server-side quiz session expired now returns 400 instead of silently grading against different questions. Verified live.
- [ ] **#4 (P1, owner action) Secrets in the export.** `backend/.env` contains a real DB password, JWT secret, and OpenRouter key. **Still to do by the owner:** rotate the OpenRouter key and JWT secret, and never ship `.env` (use `.env.example`). *Code part fixed:* the JWT secret no longer falls back to `'secret'`; the server refuses to start if `JWT_SECRET` is missing or shorter than 16 characters (`auth/jwt-secret.ts`).
- [x] **#5 (P2) Face service had no authentication and CORS `*`.** *Fixed:* the browser no longer calls the face service. New admin-only backend endpoints `/api/face/{students,register,recognize}` and `DELETE /api/face/students/:id` proxy to it (`backend/src/face/`). The student name for registration now comes from the database, not the client. The face service requires a shared `X-API-Key` (in `backend/.env` and `face-service/.env`), binds to `127.0.0.1`, and has no CORS by default. Verified: admin 200, student 403, anonymous 401, wrong or missing key 401, browser preflight rejected, 2.9 MB image accepted (body limit raised to 16 MB).
- [x] **#6 (P2) Chat could write into another user's conversation.** *Fixed:* the conversation is loaded with `findFirst({ id, studentId })`, so another user's ID falls back to the caller's own conversation.
- [x] **#7 (P2) Chat history came from the client.** *Fixed:* the request's `chatHistory` is ignored, and the last 3 turns are loaded from the database.
- [x] **#8 (P2) Biometric data handling.** *Documented:* `face-service/README.md` → "Biometric data and privacy" covers storage, admin-only access, consent with a manual fallback, and retention/deletion rules. Access is enforced by #5. *Not implemented:* encryption at rest, a recognition audit log, and student self-service deletion. Mention these in the report.
- [ ] **#9 (P3) Minor:** `PATCH /users/profile` body has no DTO validation (e.g. `targetGpa` range). The JWT is stored in `localStorage`.

## B. Correctness and fake / hard-coded data

- [x] **#10 (P1) Hard-coded facts in chat fallback answers.** *Fixed:* `generateBuiltinResponse` was rewritten. Every date, room, exam, and course list is now computed from the student's records, and missing data is reported as "not recorded" or "TBA". Month questions work for any month, not just November. Checked with 36 sample answers (full and empty data): none contain invented values or `undefined`/`NaN`.
- [x] **#11 (P1) Fake default values.** *Fixed everywhere found:*
  - Chat: GPA `'3.12'`, career "AI / ML Engineer", target GPA 3.50, and "100% attendance" when nothing was recorded.
  - Risk engine: assumed assignment 7.0, midterm 6.5, and target 3.5 when missing.
  - Dashboard: a hard-coded timetable with invented lecturers, target GPA 3.5, "AI Software Engineer", "6.0+" and "7.5+" advice, and one overall attendance rate shown for every course.
  - Profile and Classes pages: 100% attendance and GPA 0 when no data.

  All of these now show "—", "not set" or "no records yet". The dashboard timetable now comes from this week's real lessons (new `weekSchedule` field) and shows the real attendance status. The chat's example answers were also replaced with placeholder templates after live testing showed the LLM copying the example's numbers into real replies.
- [x] **#12 (P1) Inconsistent pass threshold.** *Fixed:* new `backend/src/common/grading.ts` is the single source of truth (weights, pass total ≥ 4.0, grade A ≥ 8.5, 75% attendance, 25% absence limit). 4.0 was chosen because it is what the GPA calculation already used (total < 4.0 = F). The chat, risk engine and grades service all use it now. **If FPT's official rule is different (e.g. total ≥ 5.0, or a minimum final-exam score), change it in that one file.**
- [x] **#13 (P2) Inconsistent attendance rules.** *Fixed:* one rule everywhere, `attendanceRate()` in `common/grading.ts` (backend) and `utils/grading.ts` (frontend). The rate is present ÷ recorded sessions; future or unrecorded lessons don't count, it is null when nothing is recorded, and "late" counts as not present. At risk means < 75%. Applied to the attendance, classes, users/profile, dashboard, risk-engine and chat services, and to the Attendance, Grades and Admin pages. The risk engine now also flags a course whose *rate* is below 75%, not only by absence count (e.g. a 70% course was LOW before).
- [~] **#14 (P2) Roadmap content bug.** *Mostly fixed:* the prompt now uses `section` (not the non-existent `title`), and chunks are filtered to the student's target career (e.g. "AI / ML Engineer" matches the "AI Engineer" roadmap). *Remaining:* careers without seeded roadmaps (Data Scientist, DevOps, Mobile, Architect) get "no roadmap available".
- [x] **#15 (P2) Intent classifier was regex-only and order-dependent.** *Fixed:* a new weighted-scoring classifier (`ai/intent-classifier.ts`). All rules are scored, the highest total wins, and word boundaries are Unicode-aware (JS `\b` breaks on Vietnamese letters). On a 30-query EN/VI labelled set: **original 22/30 (73%) → new 30/30**. Caveat: the set was written while tuning, so treat it as a regression test (`test/unit/intent-classifier.test.ts`), not an independent benchmark. An LLM/embedding classifier is still future work.
- [ ] **#16 (P3) What-if GPA simulator** on the Dashboard is labelled "Simulate Midterm Score" but actually adds a hypothetical 3-credit course.
- [ ] **#17 (P3) Cache key ignores conversation context.** The same question within 60 s returns the cached answer even if grades changed. The cache is in-memory only.

## C. Features that are stubs or not wired up

- [x] **#18 (P1) "AI quiz generation" was not AI.** *Fixed:* `generateQuiz` now asks the LLM for 8 MCQ + 2 short-answer questions based on the class's lesson topics and **uploaded lesson material**. The output is strictly validated (4 options, one A–D answer, at least 5 valid MCQs) before it is used. If no API key or lessons exist, or the LLM output is invalid or times out (25 s), it falls back to the fixed question bank. The response includes `source: 'ai' | 'bank'`, and the quiz screen shows which one was used. The dead `callOpenRouter` code was removed. *Note from live test:* the free OpenRouter model timed out once, and the bank fallback worked as designed. Expect the bank often on free models.
- [x] **#19 (P2) Short-answer questions were never graded.** *Fixed:* the LLM grades each short answer against the model answer (0, 0.5 or 1 point, plus one sentence of feedback), and blank answers get 0 without an LLM call. If grading is unavailable, the question is shown as "Not auto-graded" and excluded from the score instead of counting as 0. The score covers MCQs plus graded short answers. *Not verified live:* the free model timed out during quiz tests, so LLM grading was only exercised through the fallback path.
- [x] **#20 (P2) Uploaded lesson material was never used.** *Fixed:* it feeds quiz generation (#18) and the chat. For general questions, keyword retrieval (`ai/lesson-retrieval.ts`) finds up to 2 matching passages from the student's enrolled lessons and adds them to the prompt. The no-LLM fallback quotes the best passage. *Not verified live:* the database has no uploaded material yet, so it is covered by unit tests only. Embedding-based search would work better on large material.
- [ ] **#21 (P3) Quiz question cache** is an in-memory `Map` in the controller. It's lost on restart and not shared across instances.

## D. Face recognition quality

- [ ] **#22 (P2) Weak recognition method.** Haar cascade plus intensity histograms is sensitive to lighting, pose, and glasses, and has never been evaluated on real data. → Switch to a deep embedding model (e.g. OpenCV's YuNet + SFace ONNX, which needs no TensorFlow), and evaluate on a real labelled photo set (TAR/FAR).
- [x] **#23 (P2) Silent fallback box.** *Fixed:* when no face is detected the service returns `face_count: 0`, and the Attendance page says "No face detected" instead of matching the middle of the picture.
- [~] **#24 (P2) No liveness / anti-spoofing.** *Documented* as a limitation in `face-service/README.md` (an admin must supervise face attendance and review the selection before saving). Not implemented.
- [ ] **#25 (P2) Benchmark is not an accuracy test.** Self-distance is always 0 by definition, separation is measured only between the 3 enrolled templates (closest different-student pair 0.431 vs the 0.40 threshold, a very thin margin), and the multi-face and latency tests use synthetic images. The latency test now measures detection only. → Collect a small consented photo set and add a real evaluation script (TAR/FAR at the chosen threshold). Needs real photos, so the owner must provide them.
- [ ] **#26 (P3) One template per student.** Registering again overwrites it. → Store several images per student and average or match the best.

## E. Code quality, testing, and repo hygiene

- [x] **#27 (P2) No real automated tests.** *Fixed:* `npm run test:unit` runs unit tests (52 as of the final check) with Node's built-in test runner and the existing `ts-node`, so no new dependencies and no database are needed. They cover grading rules, the intent classifier, quiz validation and scoring, lesson retrieval, built-in chat answers (no `undefined`/`NaN`/invented values with full and empty data), and the JWT secret guard. *Remaining:* CI, and integration tests against a separate test database (`test-runner.ts` still writes to the real DB).
- [x] **#28 (P2) Duplicated business logic.** *Fixed:* all backend services use `common/grading.ts`, and all frontend pages use `utils/grading.ts`. The frontend file is a deliberate mirror (no shared package), and both say to keep them in sync.
- [~] **#29 (P3) `ai.service.ts` is about 1,300 lines.** *Started:* the classifier and lesson retrieval are now separate modules. The context builder, LLM client and fallback are still in the one file.
- [~] **#30 (P3) Hard-coded URLs.** *Partly fixed:* the face service URL is now `FACE_SERVICE_URL` in `backend/.env`, and the frontend no longer contains it. *Remaining:* the CORS origin in `main.ts` and the OpenRouter `HTTP-Referer` still use `localhost:5173`. → Move them to env.
- [ ] **#31 (P3) Leftovers.** `frontend/fix_admin.py` (one-off patch script), `academic_advisor_prototype.html`, the unused `components/GpaChart.tsx` (draws four invented past-semester GPAs), committed `dist/` folders, an unused `deepface`/TensorFlow install in `face-service/venv`, and a root `.venv`. → Delete or move to an `archive/` folder; add `.gitignore`.
- [ ] **#32 (P3) Use of `any`.** For example, `(lesson as any).content` in the lessons service, even though the field exists in the schema. → Regenerate the Prisma client and remove the casts.
- [ ] **#34 (P3, found in browser check) Hard-coded profile labels.** "Semester 5" appears on 8 pages and in the sidebar for every student, and the Profile page shows a fixed programme "Software Engineering (Bachelor)". The schema has no semester or programme field per student. → Add those fields, or derive the semester from the enrolled classes.
- [x] **#35 (found in browser check, fixed) Dashboard "Next Exam: In -12 days".** `/tests/upcoming` also returns tests from the last 30 days, and the dashboard showed the first one. It now skips past exams.
- [~] **#36 (P2, found in live AI test) Free OpenRouter models were unreliable.**
  - *Root cause:* most free models are "reasoning" models. With the old token limits they spent the whole budget thinking and returned an empty answer (`finish_reason: length`). That is why quiz generation always fell back to the question bank and short-answer grading silently returned nothing.
  - *Fixed:* a shared helper, `common/openrouter.ts`, used by the chat, quiz generation and grading. It asks with reasoning disabled, and retries with reasoning on and a bigger budget when a model says reasoning is mandatory. The chat cascade has a 25 s overall time budget. The free router gets two tries. Empty or unusable replies are now logged.
  - *Result (live, real key):* chat answered by the LLM 2 of 3 times (the third used the built-in answer correctly), quiz generation produced 10 AI questions from the lesson topics, and short answers were graded with feedback.
  - *Remaining: the free tier's daily request cap.* The key is free-tier (`is_free_tier: true`, no credits), and live testing hit `Rate limit exceeded: free-models-per-day`. After that every AI feature falls back (built-in answers, question bank, "not auto-graded"), which works, but the AI is effectively off until the quota resets. OpenRouter's error says that adding 10 credits raises the cap to 1,000 free requests a day. One chat message can use up to 4 requests (model cascade) and a quiz up to 2 plus 1 per short answer, so the free cap is too small for a class demo. → Add credits before the demo or presentation, or use a paid model.
  - *Mitigated:* the backend now rotates through up to 9 keys (`OPENROUTER_API_KEY`, `_2` … `_9`, see `common/openrouter.ts`). A key that hits the daily limit is skipped until 00:00 UTC; invalid keys are skipped for 1 hour. The three configured free-account keys roughly triple the daily capacity. Covered by 5 unit tests with a fake API, and checked live (simulated limit on key #1 → real answer from key #2).
- [x] **#37 (found in live AI evaluation, fixed) LLM answer errors.**
  - Round 1 found three errors: a small free model gave the wrong "next class", reported a course rate as the overall attendance, and "What score do I need on the DSA202 final?" was routed to EXAM.
  - *Fixed:* the prompt states the next class and the at-risk courses explicitly, there is a new classifier rule, and the built-in answer is now logged when used.
  - Rounds 2–3: 24/24 answered by the LLM, 24/24 correct intent, 24/24 correct facts, 0 invented course codes.
  - Details in [AI_EVALUATION.md](AI_EVALUATION.md); repeatable with `npm run test:ai-live`.
- [x] **#38 (final check, fixed) Demo admin password shipped in the frontend.** The login page had one-click "Student" / "Administrator" buttons that filled in the seeded admin email and password, and the old prebuilt `frontend/dist` contained them, which gave admin access to anyone. *Fixed:* the buttons and prefilled values exist only in development builds (`import.meta.env.DEV`). `frontend/dist` was rebuilt from the current code, and the production bundle was verified to contain no credentials. **Also change the seeded admin password (`admin123`) on any shared or deployed database.**
- [x] **#39 (final check, fixed) `npm start` (production) could not start.** It ran `node dist/main`, but the build writes `dist/src/main.js`. *Fixed:* the start script points to `dist/src/main`; production start verified.
- [x] **#40 (final check, fixed) The integration test changed real data and tested a copy of the code.** Test 3 overwrote 3 real attendance records with "present" on every run, and test 4 checked a private copy of an old risk formula instead of the app's code. *Fixed:* test 3 snapshots and restores everything it touches (a fingerprint of the database was identical before and after), and test 4 now runs the real risk engine on 15 real students and checks the results are consistent. 5/5 pass.
- [x] **#41 (final check, fixed) Two different GPA numbers.** The Grades page showed 2.75 for the demo student while the dashboard and chat showed 2.20: one averaged only current enrollments, the other all recorded grades (the student has a failed DevOps grade from a course they are no longer enrolled in). *Fixed:* one shared `cumulativeGpa()` in `common/grading.ts` (all recorded grades, so a failed course cannot disappear by unenrolling), used by the profile, dashboard, chat and grades services. The Grades page lists such courses marked "not enrolled; counts toward GPA". If the university counts only current enrollments, change that one function.
- [x] **#33 (new, fixed) Backend never loaded `.env` itself.** It relied on Prisma loading it as a side effect. *Fixed:* `src/env.ts` loads it explicitly as the first import in `main.ts`.

## Fix log

**Pass 1: documentation**
- Rewrote `face-service/README.md` to describe the actual OpenCV method (it previously claimed deepface/dlib).
- Fixed `face-service/requirements.txt`: removed the unused `deepface`/`tf-keras`/`python-multipart` and added the missing `opencv-python`, pinned to the installed versions that are verified to import.
- Added a root `README.md`, `backend/.env.example`, `FEATURES.md`, and this file.

**Pass 2: P1 fixes** (#1, #2, #3, #4 code part, #10, #11, #12, #18, plus #33 and parts of #14, #15, #20, #28)
- Verification:
  - Backend and frontend `tsc --noEmit` both pass.
  - 16 unit checks pass (grading math, quiz validation, career matching, JWT secret guard), and 7 intent-classifier checks pass.
  - 36 chat fallback answers were checked against full and empty sample data.
  - Live smoke test against the real database: register, RBAC, dashboard, risk, quiz generate/submit, chat for a new and a seeded student.
  - Test accounts were deleted afterwards.
- Frontend pages: see pass 3.

**Pass 3: browser check** (in-app browser, real dev servers on :3000/:5173)
- Checked: Register (no role picker), plus Dashboard, Profile, Classes, and Tests/quiz (take and submit) as the seeded demo student, and the same pages as a brand-new empty student. No console errors.
- Fixed during the check:
  - #35, the negative "next exam" countdown.
  - The quiz header said "AI-Generated" even for bank quizzes; it now follows `source`.
  - The GPA simulator is hidden when there is no GPA (it showed 0.68 from nothing).
  - "Eligible & Good Standing" now reads "No alerts" when there is no attendance data.
- Logged: #34.
- The test account and the one test quiz attempt were deleted afterwards.
- Added `.claude/launch.json` so both dev servers can be started from the app.

**Pass 4: P2 fixes** (#5, #6, #7, #8, #13, #15, #19, #20, #23, #27, #28, plus docs for #24 and part of #29)
- Verification:
  - Backend and frontend `tsc --noEmit` pass (sources and tests).
  - `npm run test:unit`: 43/43 pass.
  - Face service checked live (auth, CORS, empty-frame response), plus the backend proxy (roles, validation, 2.9 MB upload); face benchmark 6/6.
- New setup step: `FACE_SERVICE_API_KEY` must be set in both `backend/.env` and `face-service/.env` (a random value was generated and written to both).
- Not verified in a live run:
  - LLM short-answer grading (the free model timed out).
  - Lesson retrieval against real uploaded material (none in the database).
  - The Admin and Attendance face screens in the browser.

**Pass 5: final overview** (#38, #39, #40, #41)
- Static checks:
  - Type-checks (backend and frontend): pass.
  - Production builds (backend and frontend): pass.
  - Unit tests: 52/52.
- Integration tests: 5/5, with the database fingerprint unchanged.
- Face benchmark: 6/6.
- API smoke test: 19 endpoints × student / admin / anonymous, all returning the expected status codes, plus 6 bad-input checks with no server errors.
- Browser walkthrough with no rendering errors:
  - every student page;
  - every admin page and tab.
- Code scan clean: no leftover fake defaults, duplicated formulas, direct face-service URLs or debug logging.
- Production start verified.
- Still open: see the unticked items above. The main ones are #4 (rotate keys), #22/#25 (face model and real accuracy test), #14 (missing roadmaps), #34 (hard-coded "Semester 5"), and the P3 cleanup.

