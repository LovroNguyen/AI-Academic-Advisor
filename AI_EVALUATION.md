# AcadAI — Live AI Evaluation (2026-11-11)

Results of testing the AI features with the seeded demo student (`nva@fpt.edu.vn`). Rounds 1–3 used the real OpenRouter API (free tier, `openrouter/free` model router); rounds 4–6 (2026-11-25) used Claude Haiku 5.5, the current main provider. Reproduce with `cd backend && npm run test:ai-live` (uses about 15–30 API requests per run).

## Method

- **Chat:** 12 questions covering every intent (GPA, attendance, exam, schedule/location, career, general), 10 in English and 2 in Vietnamese. Each answer is checked for:
  - **Source:** answered by the LLM, or by the built-in rule-based fallback.
  - **Intent:** whether the question was routed to the expected type.
  - **Facts:** required facts from the database, i.e. GPA 2.20, target 3.80, gap 1.60, DSA202 at 60% and SE301 at 70% attendance, next exam WEB201 on Nov 13 in A103, next class DL401 "Attention Mechanisms" in Lab1, and the career "AI Engineer".
  - **Invented course codes:** any course code in the answer that the student is not enrolled in.
- **Quiz:** generate a quiz for the next exam from the class's lesson topics, then submit it with all MCQs correct, one short answer equal to the model answer, and one unrelated wrong short answer.
- **Runs:** round 1 is before the fixes below; rounds 2 and 3 are after them. The free model router picks a different model per request, so results vary between runs.

## Results

| | Round 1 (before fixes) | Round 2 | Round 3 |
|---|---|---|---|
| Answered by the LLM | 12/12* | 12/12 | 12/12 |
| Correct intent | 11/12 | 12/12 | 12/12 |
| All required facts present and correct | 10/12 | 12/12† | 12/12 |
| Answers with invented course codes | 0 | 0 | 0 |
| Median / max chat response time | 3.9 s / 22.1 s | 3.9 s / 8.8 s | 2.7 s / 21.4 s |
| Quiz generation | AI, 30.0 s | AI, 10.6 s | AI, 9.6 s |
| Short-answer grading (correct / wrong answer) | 1 / 0 | 1 / 0 | n/a (the model wrote only MCQs) |

\* Two of them succeeded only on the second model in the cascade after the first returned an empty answer.
† The automatic check first flagged one answer; manual review showed it was correct ("overall 75% … DSA202 (60%)"). The check was then fixed.

**Errors found in round 1, fixed before rounds 2–3:**
1. **"What is my next class?"** The answer was DSA202 on Nov 17; correct is DL401 on Nov 12. The data sent to the model was correct and in date order, but a small free model picked the wrong line. *Fix:* the prompt now states the next class explicitly at the top.
2. **"Am I at risk in any course?"** The answer gave the overall attendance as 60% (that is DSA202's rate; overall is 75%). *Fix:* the prompt now lists the at-risk courses separately and says not to report a course rate as the overall rate.
3. **"What score do I need on the DSA202 final?"** It was routed to EXAM instead of GPA, so the model said the data was unavailable. *Fix:* new classifier rule, plus a unit test.

## Findings for the report

- **Grounding works:** across 36 answers, no course codes, grades, or dates were invented that are not in the student's data. This supports the design of computing facts in code and letting the LLM only phrase them.
- **Small free models make reading mistakes,** such as picking the wrong line from a list or mixing up overall and per-course numbers. Putting the key fact explicitly in the prompt ("NEXT CLASS: …") fixed both observed cases. This is prompt engineering against model weakness, not a guarantee.
- **Free "reasoning" models** returned empty answers until reasoning was disabled per request; some models refuse that and need a retry with reasoning on (`backend/src/common/openrouter.ts`).
- **Latency** is usually 1–8 s, with occasional outliers of about 20 s when the first model in the cascade fails.
- **Free-tier limits:** the daily free-request cap was hit during testing. The backend now rotates across 3 account keys and falls back to built-in answers when all are used up.

## Rounds 4–6: Claude Haiku 5.5 as the main provider (2026-11-25)

The free models were too unreliable for a live demo: they were often busy, and quizzes then fell back to the question bank (ISSUES #49). So Claude Haiku 5.5, through the paid Anthropic API, became the main provider, with OpenRouter kept as the backup. The same 12 questions and quiz check were run three more times. Two changes were made to the script:
- **Date facts:** the expected next exam and next class are now read from the database at run time. The original values (next exam on Nov 13) were in the past by then.
- **Provider:** the script now records which provider answered each question.

| | Round 4 | Round 5 | Round 6 |
|---|---|---|---|
| Answered by Claude (no fallback) | 12/12 | 12/12 | 12/12 |
| Correct intent | 12/12 | 12/12 | 12/12 |
| All required facts present and correct | 12/12‡ | 12/12‡ | 12/12 |
| Answers with invented course codes | 0 | 0 | 0 |
| Median / max chat response time | 1.5 s / 2.9 s | 1.8 s / 2.6 s | 1.6 s / 3.6 s |
| Quiz generation | AI, 7.2 s | AI, 7.3 s | AI, 6.4 s |
| Short-answer grading (correct / wrong answer) | 1 / 0 | 1 / 0 | 1 / 0 |

‡ The automatic check flagged "What is my next class?" in rounds 4–5. Manual review showed Claude was right: the expected value was that morning's class, which was already over. The check was fixed to use the first class that has not started yet, and round 6 passed.

**Findings:**
- **Reliable:** all 36 answers came from Claude, with no fallback, no wrong facts and no invented course codes.
- **Faster:** median chat time fell from about 3–4 s to under 2 s, and the worst case from about 22 s to under 4 s.
- **Quiz features now work every time:** quizzes were written from the lessons every time, and grading separated the correct from the wrong short answer in every round. With the free models, one round produced no short questions at all.
- **Cost:** about 2 cents for all three rounds.

## Limitations of this evaluation

- **Small sample:** 12 questions, 6 runs, one student. Not statistically strong.
- **Non-deterministic:** the free router picks different models, so results vary between runs. Claude runs were more consistent, but language models are still not deterministic.
- **Lenient fact checks:** answers are matched against expected values with regular expressions, which can miss wrong statements that still contain the right numbers (one false alarm was found by manual review). Phrasing quality was not scored.
- **No uploaded lesson material:** none exists in the database, so lesson-material answers (retrieval) were not evaluated live, only by unit tests.
