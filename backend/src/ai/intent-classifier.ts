/**
 * Rule-based intent classifier for the AI advisor (English + Vietnamese).
 *
 * Every intent has weighted phrase rules. All rules are checked and the intent with the
 * highest total score wins, so the order of the rules no longer decides the result.
 * "Which room is my exam in" scores EXAM (exam 3) over LOCATOR (room 1).
 * Ties are broken by TIE_BREAK order. With no match the intent is GENERAL.
 *
 * Word boundaries use Unicode-aware lookarounds instead of \b, because in JavaScript
 * \b treats Vietnamese letters such as "đ" or "ể" as non-word characters.
 */

export type AgentIntent = 'LOCATOR' | 'ATTENDANCE' | 'GPA' | 'EXAM' | 'CAREER' | 'GENERAL';

interface Rule {
  re: RegExp;
  weight: number;
}

/** Builds a case-insensitive, Unicode word-bounded regex from phrase alternatives. */
function phrases(weight: number, ...alternatives: string[]): Rule {
  return {
    re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'iu'),
    weight,
  };
}

const RULES: Record<Exclude<AgentIntent, 'GENERAL'>, Rule[]> = {
  LOCATOR: [
    // Specific rooms and landmarks: strong signal
    phrases(3, '20[1-9]', '21[0-5]', '[a-c]\\d{3}', 'lab\\s*\\d'),
    phrases(3, 'thang máy', 'elevators?', 'lifts?', 'shaft', 'wc', 'toilets?', 'restrooms?', 'nhà vệ sinh', 'vệ sinh'),
    phrases(3, 'skylights?', 'giếng trời', 'multipurpose', 'đa năng', 'booths?', 'gian hàng'),
    phrases(3, 'innovation lab', 'art studio', 'gym', 'meditation', 'sơ đồ', 'bản đồ', 'campus map', 'floor plan'),
    // Schedule questions
    phrases(3, 'lịch học', 'thời khóa biểu', 'tiết học', 'buổi học', 'timetable', 'next class(?:es)?', 'upcoming class(?:es)?',
      'classes this week', 'how many class(?:es)?', 'schedule this week', "today'?s class(?:es)?", "tomorrow'?s class(?:es)?",
      'học gì', 'last class', 'end of (?:the )?semester', 'semester end', 'kết thúc'),
    // Generic location words: weak signal (lose against exam/attendance words)
    phrases(1, 'where', 'room', 'location', 'classroom', 'building', 'ở đâu', 'phòng', 'vị trí', 'địa điểm', 'tòa'),
  ],
  ATTENDANCE: [
    phrases(3, 'attendance', 'điểm danh', 'chuyên cần', 'absen(?:t|ces?)', 'vắng', 'nghỉ học', 'cúp học', 'late', 'đi trễ', 'muộn'),
    // "At risk" in this app means the early-warning status, which is driven mostly by attendance.
    phrases(2, 'at risk', 'risks?', 'nguy cơ', 'cảnh báo', 'warnings?'),
    phrases(3, 'disqualif\\w*', 'cấm thi', 'bị cấm', 'cut[\\s-]?off', 'eligib\\w*', 'đủ điều kiện', 'hạn mức vắng', 'barred'),
  ],
  EXAM: [
    phrases(3, 'exams?', 'examinations?', 'tests?', 'midterms?', 'finals?', 'lịch thi', 'ngày thi', 'giờ thi', 'phòng thi',
      'khi nào thi', 'kiểm tra giữa kỳ', 'thi cuối kỳ', 'thi'),
  ],
  GPA: [
    // "điểm" (grade) must not fire on "điểm danh" (attendance)
    { re: /(?<![\p{L}\p{N}])điểm(?!\s+danh)(?![\p{L}\p{N}])/iu, weight: 2 },
    phrases(3, 'gpa', 'grades?', 'scores?', 'marks?', 'transcript', 'bảng điểm', 'tính điểm', 'cần bao nhiêu điểm',
      'điểm cuối kỳ', 'điểm bài tập', 'pass', 'fail', 'đậu môn', 'rớt môn', 'qua môn'),
    // "score needed on the final" is a grade question even though it mentions the final exam
    phrases(2, 'need on (?:the |my )?(?:[a-z]{2,4}\\d{3} )?finals?', 'what scores?', 'scores? (?:do )?i need', 'to pass', 'cần bao nhiêu', 'grade a'),
  ],
  CAREER: [
    phrases(3, 'careers?', 'roadmap', 'lộ trình', 'nghề', 'định hướng', 'kỹ năng', 'skills?', 'prerequisites?', 'tiên quyết',
      'frontend', 'backend', 'full\\s*stack', 'data scien\\w*', 'ai engineer', 'machine learning engineer',
      'môn học', 'đăng ký môn', 'course catalog', 'curriculum', 'danh sách môn', 'job', 'internship'),
  ],
};

/** Used only when two intents have the same score. */
const TIE_BREAK: AgentIntent[] = ['ATTENDANCE', 'EXAM', 'GPA', 'LOCATOR', 'CAREER'];

export function scoreIntents(message: string): Record<AgentIntent, number> {
  const text = (message || '').trim();
  const scores: Record<AgentIntent, number> = { LOCATOR: 0, ATTENDANCE: 0, GPA: 0, EXAM: 0, CAREER: 0, GENERAL: 0 };
  for (const [intent, rules] of Object.entries(RULES) as [AgentIntent, Rule[]][]) {
    for (const rule of rules) {
      if (rule.re.test(text)) scores[intent] += rule.weight;
    }
  }
  return scores;
}

export function classifyIntent(message: string): AgentIntent {
  const scores = scoreIntents(message);
  let best: AgentIntent = 'GENERAL';
  let bestScore = 0;
  for (const intent of TIE_BREAK) {
    if (scores[intent] > bestScore) {
      best = intent;
      bestScore = scores[intent];
    }
  }
  return best;
}
