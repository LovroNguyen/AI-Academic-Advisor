# AcadAI — Actual Features

This is what the code really does, checked against the source on 2026-11-11 and updated after the P1 fixes. Status labels:
- **Works**: implemented end-to-end.
- **Partial**: works, but with an important limitation (linked to [ISSUES.md](ISSUES.md)).
- **Stub**: UI or name exists, but the real logic does not.

## 1. Accounts and access

| Feature | Status | Where |
|---|---|---|
| Register with name, email, password (min 6 chars), passwords hashed with bcrypt | Works | `backend/src/auth/auth.service.ts`, `RegisterPage.tsx` |
| Login → JWT bearer token (stored in `localStorage`); auto-logout on 401 | Works | `auth.service.ts`, `frontend/src/services/api.ts` |
| Two roles, `student` and `admin`; admin-only endpoints protected by `RolesGuard` | Works | `auth/roles.guard.ts` |
| Self-registration always creates a **student**; admin accounts come from the seed script | Works | `RegisterPage.tsx`, `register.dto.ts` |
| Role-specific sidebar navigation | Works | `components/Sidebar.tsx` |

## 2. Student features

| Feature | Status | Where |
|---|---|---|
| **Dashboard**: GPA, credits, attendance rate, enrolled classes with per-course attendance, upcoming tests, this week's real timetable (from lessons, with attended/absent/late status) filterable by day, early-warning notices, room links to the campus map. Missing data shows "—" | Works | `users.service.getDashboard`, `DashboardPage.tsx` |
| **What-if GPA simulator**: slider for a hypothetical final score | Partial: assumes a fixed 3-credit course | `DashboardPage.tsx` |
| **Academic risk (EWS)** for the logged-in student | Works | `GET /users/academic-risk` |
| **Profile and goals**: edit name, target career, target GPA, goal type | Works | `users.service.updateProfile`, `ProfilePage.tsx` |
| **Classes**: browse all classes, self-enroll | Works | `classes.*`, `ClassesPage.tsx` |
| **Grades**: per-course assignment / midterm / final, course total and letter grade | Works | `grades.*`, `GradesPage.tsx` |
| **Attendance**: own records, rate, max allowed absences (25%), qualified/at-risk flag | Works | `attendance.service.getMyAttendance`, `AttendancePage.tsx` |
| **Tests and exams**: upcoming tests with dates and rooms | Works | `tests.service.getUpcoming`, `TestsPage.tsx` |
| **Practice quizzes**: AI-generated quiz (8 MCQ + 2 short answer) from the class's lesson topics and uploaded material, validated before use; falls back to a fixed question bank, and the UI shows which was used. Answers are revealed only after submit. Short answers are graded by the LLM (0 / 0.5 / 1 point plus feedback); if grading is unavailable they are marked "not auto-graded" and left out of the score. Score out of 10, attempt history (last 20) | Works (the free LLM models often time out, so the bank is used) | `tests.service.ts`, `tests.controller.ts`, `TestsPage.tsx` |
| **AI chat advisor**: full chat page and a floating chat bubble on every page; Markdown tables; detected room names become "show on map" buttons | Works (see §4) | `ChatPage.tsx`, `FloatingChatBubble.tsx` |
| **Conversation history**: list conversations, load messages (owner-checked) | Works | `conversations.service.ts` |
| **Campus map**: interactive Level-2 floor plan (~27 rooms and facilities), search, highlight room from a URL or chat link, shows the student's enrolled class rooms | Works (static floor plan) | `CampusMapPage.tsx`, `utils/roomDetector.ts` |

## 3. Admin features (Administration portal)

| Feature | Status | Where |
|---|---|---|
| Create classes (name, code, credits, semester) | Works | `classes.service`, `AdminPage.tsx` |
| Enroll or unenroll students in a class; list enrollments; student search | Works | `classes.controller` |
| Create lessons (topic, date, room) | Works | `lessons.service` |
| Upload lesson material (PDF / DOCX / TXT, ≤ 20 MB) → text extracted and stored (first 8,000 chars) | Works: used by quiz generation and by the chat (keyword retrieval) | `lessons.service.uploadMaterial` |
| Mark attendance per student, or in batch for a lesson | Works | `lessons.controller` |
| Enter or update grades (assignment, midterm, final → GPA contribution) | Works | `grades.service` |
| Create, delete, and set the result of tests | Works | `tests.controller` |
| View all grades, all students, and **at-risk students** list | Works | `users.service.getAtRiskStudents` |
| **Face registration**: webcam capture → register a student's face (name taken from the database) | Works: admin-only via `/api/face/register` | `AdminPage.tsx` → `face.controller` → face service |
| **Face attendance**: webcam or uploaded class photo → detect and recognize faces → review boxes and select students → mark present; says "No face detected" when there is none | Partial: low recognition quality, no liveness check ([ISSUES #22, #24](ISSUES.md)) | `AttendancePage.tsx` → `/api/face/recognize` → `POST /attendance/face-mark` |

## 4. AI chat advisor (how it works)

Endpoint `POST /api/ai/chat` (`backend/src/ai/ai.service.ts`).

1. **Intent detection**: weighted keyword scoring in English and Vietnamese (`ai/intent-classifier.ts`); the highest-scoring intent wins. Six intents: `LOCATOR` (rooms, map, schedule), `ATTENDANCE`, `EXAM`, `GPA`, `CAREER`, `GENERAL`. 30/30 on the labelled regression set (the original classifier scored 22/30).
2. **Data gathering**: the student's enrollments, grades, attendance, lessons, tests, and career roadmap chunks, fetched in parallel. For general questions, up to 2 matching passages from uploaded lesson material are retrieved (`ai/lesson-retrieval.ts`). Conversation history (last 3 turns) is loaded from the database and must belong to the user.
3. **Metrics**: weighted GPA, attendance rate (overall and per class), absence buffer, final score needed to pass or reach grade A, exam countdowns.
4. **Prompt**: a short system prompt (BLUF, no filler, "use only the given data", "say when data is missing") plus only the data for the detected intent, a format template with placeholders (no example numbers the model could copy), and the last 3 chat turns. CAREER questions get the roadmap for the student's own target career.
5. **LLM call**: OpenRouter, trying the configured model and then free models in turn (Gemma 4 31B, Nemotron 3.5, `openrouter/free`), within a 25 s total budget. Reasoning is switched off where the model allows it (otherwise free reasoning models return empty answers). Up to 9 API keys are rotated: when one hits the free daily limit, the next key is used.
6. **Cleanup**: removes "thinking" text, code fences, greetings and sign-offs; rejects answers that are too short or look like refusals.
7. **Fallback**: if every model fails, a built-in rule-based answer is generated for each intent, computed entirely from the student's records (schedule this week or in any month, semester end, next class, room, attendance, final-exam score needed, exams, roadmap). Missing data is stated as missing.
8. **Cache and storage**: identical questions within 60 s are answered from memory; every question and answer is saved to the conversation.

## 5. Early Warning System (risk score)

`users.service.computeStudentRisk`. Per enrolled course:

| Signal | Points |
|---|---|
| Barred from exam (absences > 25% of lessons) | +50 |
| At the absence limit | +35 |
| Any absence | +15 |
| Midterm < 5.0 | +35 |
| Midterm < 7.0 | +15 |
| Practice quiz average < 6.0 | +15 |

Risk level is **HIGH** at ≥ 50, **MODERATE** at ≥ 25, otherwise **LOW**. The overall status is CRITICAL, MONITORING, or GOOD_STANDING. It also reports the final-exam score needed to pass (course total ≥ 4.0) and to reach the target GPA (only if the student set one), and a list of plain-language reasons. Courses without grades get no grade-based risk.

## 6. Face recognition service

See [face-service/README.md](face-service/README.md). Reached only through the admin-only backend proxy (`/api/face/*`), which authenticates with a shared key; the service listens on localhost only. Haar-cascade detection → 400-d histogram features → cosine match (threshold 0.40). Supports multiple faces per photo, EXIF rotation, NMS, and an eye check for unknown faces. Templates are stored in a JSON file.

## 7. Grading rules

One shared module, `backend/src/common/grading.ts`: course total = 20% assignment + 30% midterm + 50% final; pass ≥ 4.0; grade A ≥ 8.5; 4.0-scale mapping A/B/C/D = 8.5/7.0/5.5/4.0; minimum 75% attendance; at most 25% absences. Attendance rate = present ÷ recorded sessions (null if none recorded), used identically everywhere. The frontend mirror is `frontend/src/utils/grading.ts`.

## 8. Data model (PostgreSQL via Prisma)

User, Class, Enrollment, Lesson, Attendance, Grade, Test, QuizAttempt, Conversation, Message, LearningGoal, RoadmapChunk. Grade weighting is assignment 20%, midterm 30%, final 50%.

## 9. Tooling

- Seed scripts: `seed.ts` (demo accounts and data), `seed-large.ts`, `seed-roadmaps.ts`.
- Unit tests: `backend/test/unit/*.test.ts` (`npm run test:unit`, 52 tests, no DB).
- Integration test script: `backend/test/test-runner.ts` (`npm test`).
- Face benchmark: `face-service/benchmark.py`.
- Ad-hoc scripts: `backend/scripts/*.js`.
- Static early UI prototype: `frontend/src/academic_advisor_prototype.html` (not used by the app).
