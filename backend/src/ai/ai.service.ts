import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatDto } from './dto/chat.dto';
import { MessageMode } from '@prisma/client';
import {
  GRADE_A_TOTAL,
  MAX_ABSENCE_RATIO,
  MIN_ATTENDANCE_RATE,
  PASS_TOTAL,
  courseTotal,
  cumulativeGpa,
  finalNeededFor,
  finalNeededToPass,
  formatNeeded,
  isAttendanceAtRisk,
  maxAllowedAbsences,
} from '../common/grading';

interface ClassAttendance {
  total: number;
  present: number;
  absent: number;
  late: number;
  /** Percentage present, or null when no attendance has been recorded. */
  rate: number | null;
}

/** True when every word of the roadmap's career name appears in the student's target career. */
function careerMatches(roadmapCareer: string, targetCareer: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/full\s*stack/g, 'fullstack').split(/[^a-z]+/).filter(Boolean);
  const target = new Set(words(targetCareer));
  const needed = words(roadmapCareer);
  return needed.length > 0 && needed.every((w) => target.has(w));
}

import { AgentIntent, classifyIntent } from './intent-classifier';
import { retrieveLessonSnippets } from './lesson-retrieval';
import { hasOpenRouterKey, isDailyLimitError, openRouterChat } from '../common/openrouter';

export type { AgentIntent };

interface CacheEntry {
  response: string;
  intent: AgentIntent;
  mode: MessageMode;
  timestamp: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly queryCache = new Map<string, CacheEntry>();

  constructor(private prisma: PrismaService) {}

  async chat(dto: ChatDto, userId: string) {
    // dto.chatHistory is ignored on purpose: history is loaded from the database
    // so a client cannot inject fake "Copilot" turns into the prompt.
    const { conversationId, message } = dto;

    // 1. Find the conversation; it must belong to this user.
    let conversation = null;
    if (conversationId && conversationId !== 'conv-default') {
      try {
        conversation = await this.prisma.conversation.findFirst({
          where: { id: conversationId, studentId: userId },
        });
      } catch {
        // Invalid UUID format or not found
      }
    }

    if (!conversation) {
      const existingConv = await this.prisma.conversation.findFirst({
        where: { studentId: userId },
        orderBy: { startedAt: 'desc' },
      });

      if (existingConv) {
        conversation = existingConv;
      } else {
        conversation = await this.prisma.conversation.create({
          data: {
            studentId: userId,
          },
        });
      }
    }

    const activeConversationId = conversation.id;

    // Last 3 turns (6 messages) of this conversation, oldest first, from the database.
    const chatHistory = (
      await this.prisma.message.findMany({
        where: { conversationId: activeConversationId },
        orderBy: { sentAt: 'desc' },
        take: 6,
        select: { sender: true, content: true },
      })
    ).reverse();

    // 2. Classify user intent first to drive targeted data synthesis
    const intent = this.classifyIntent(message);
    const dbMode: MessageMode = intent === 'GPA' ? MessageMode.gpa : MessageMode.career;

    // Check fast in-memory query cache (60s TTL for identical queries)
    const cacheKey = `${userId}:${intent}:${message.trim().toLowerCase()}`;
    const cached = this.queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      this.logger.log(`Serving query from fast in-memory cache: ${cacheKey}`);
      await this.prisma.$transaction([
        this.prisma.message.create({
          data: {
            conversationId: activeConversationId,
            sender: 'user',
            content: message,
            mode: dbMode,
          },
        }),
        this.prisma.message.create({
          data: {
            conversationId: activeConversationId,
            sender: 'ai',
            content: cached.response,
            mode: dbMode,
          },
        }),
      ]);

      return {
        conversationId: activeConversationId,
        mode: dbMode,
        intent,
        response: cached.response,
      };
    }

    // 3. Fetch academic records from database
    const [
      student,
      grades,
      attendanceRecords,
      allClasses,
      allTests,
      roadmapChunks,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          learningGoal: true,
          enrollments: {
            include: {
              class: {
                include: {
                  creator: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.grade.findMany({
        where: { studentId: userId },
        include: { class: true },
      }),
      this.prisma.attendance.findMany({
        where: { studentId: userId },
        include: {
          lesson: {
            include: { class: true },
          },
        },
        orderBy: { lesson: { date: 'asc' } },
      }),
      this.prisma.class.findMany({
        include: {
          creator: { select: { name: true, email: true } },
          _count: { select: { enrollments: true, lessons: true, tests: true } },
        },
        orderBy: { subjectCode: 'asc' },
      }),
      this.prisma.test.findMany({
        include: { class: true },
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.roadmapChunk.findMany({
        orderBy: { chunkIndex: 'asc' },
      }),
    ]);

    const enrolledClassIds = student?.enrollments?.map((e) => e.classId) || [];

    // Fetch enrolled lessons (with classroom locations/dates)
    const enrolledLessons = await this.prisma.lesson.findMany({
      where: { classId: { in: enrolledClassIds } },
      include: { class: true },
      orderBy: { date: 'asc' },
    });

    // 4. Synthesize Academic Metrics
    // A. GPA Calculation
    // Shared rule (common/grading.ts); null = no grades recorded yet (never invent a GPA)
    const gpaValue = cumulativeGpa(grades);
    const currentGpa: string | null = gpaValue !== null ? gpaValue.toFixed(2) : null;

    // B. Attendance Metrics
    const totalAtt = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
    const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
    const lateCount = attendanceRecords.filter((r) => r.status === 'late').length;
    const overallAttRate: number | null = totalAtt > 0 ? Math.round((presentCount / totalAtt) * 100) : null;
    const isOverallAtRisk = overallAttRate !== null && isAttendanceAtRisk(overallAttRate);

    // Per-class attendance breakdown
    const classAttendanceMap: Record<string, ClassAttendance> = {};
    for (const cId of enrolledClassIds) {
      const recs = attendanceRecords.filter((r) => r.lesson.classId === cId);
      const cTotal = recs.length;
      const cPres = recs.filter((r) => r.status === 'present').length;
      const cAbs = recs.filter((r) => r.status === 'absent').length;
      const cLate = recs.filter((r) => r.status === 'late').length;
      const cRate = cTotal > 0 ? Math.round((cPres / cTotal) * 100) : null;
      classAttendanceMap[cId] = { total: cTotal, present: cPres, absent: cAbs, late: cLate, rate: cRate };
    }

    // C. Classroom Locations & Schedule summary
    const classRoomsMap: Record<string, string[]> = {};
    for (const l of enrolledLessons) {
      if (!classRoomsMap[l.classId]) classRoomsMap[l.classId] = [];
      if (l.room && !classRoomsMap[l.classId].includes(l.room)) {
        classRoomsMap[l.classId].push(l.room);
      }
    }

    // D. Upcoming Tests for Enrolled Classes
    const now = Date.now();
    const enrolledTests = allTests
      .filter((t) => enrolledClassIds.includes(t.classId))
      .map((t) => {
        const diffDays = Math.ceil((new Date(t.scheduledAt).getTime() - now) / (1000 * 60 * 60 * 24));
        return {
          ...t,
          daysRemaining: diffDays,
          isUrgent: diffDays >= 0 && diffDays <= 5,
        };
      });

    // null = the student has not set a goal (never invent one)
    const targetCareer: string | null = student?.learningGoal?.targetCareer || null;
    const targetGpa: string | null = student?.learningGoal?.targetGpa ? student.learningGoal.targetGpa.toFixed(2) : null;
    const careerRoadmap = targetCareer
      ? roadmapChunks.filter((c) => careerMatches(c.career, targetCareer))
      : [];

    // Lesson material relevant to the question (only for general/explanatory questions).
    const lessonSnippets = intent === 'GENERAL' ? retrieveLessonSnippets(message, enrolledLessons) : [];

    const contextData = {
      lessonSnippets,
      currentGpa,
      targetGpa,
      targetCareer,
      enrolledClasses: student?.enrollments || [],
      enrolledLessons,
      grades,
      attendanceRecords,
      overallAttRate,
      presentCount,
      absentCount,
      lateCount,
      isOverallAtRisk,
      enrolledTests,
      classRoomsMap,
      classAttendanceMap,
      allClasses,
      roadmapChunks: careerRoadmap,
    };

    // 5. Construct targeted, lean context prompts (BLUF & Zero Fluff)
    const { systemPrompt, userPrompt } = this.buildDynamicPrompt(
      intent,
      message,
      student,
      contextData,
      chatHistory,
    );

    // 6. Call LLM with seamless fallback to deterministic Built-in Advisor
    const aiResponseText = await this.callLlm(
      systemPrompt,
      userPrompt,
      intent,
      student,
      message,
      contextData,
    );

    // Store in fast in-memory cache (60s TTL)
    this.queryCache.set(cacheKey, {
      response: aiResponseText,
      intent,
      mode: dbMode,
      timestamp: Date.now(),
    });

    // 7. Save message history
    await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: activeConversationId,
          sender: 'user',
          content: message,
          mode: dbMode,
        },
      }),
      this.prisma.message.create({
        data: {
          conversationId: activeConversationId,
          sender: 'ai',
          content: aiResponseText,
          mode: dbMode,
        },
      }),
    ]);

    return {
      conversationId: activeConversationId,
      mode: dbMode,
      intent,
      response: aiResponseText,
    };
  }

  /**
   * Language Detector Helper
   */
  isVietnamese(text: string): boolean {
    if (!text) return false;
    return (
      /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(text) ||
      /\b(ở đâu|thế nào|không|môn|học|phòng|điểm|vắng|trễ|thi|lịch|bao nhiêu|cần|lộ trình|chào|bạn|tôi)\b/i.test(text)
    );
  }

  /** Delegates to the scoring classifier in intent-classifier.ts. */
  classifyIntent(message: string): AgentIntent {
    return classifyIntent(message);
  }

  /**
   * Dynamic Prompt Builder: Constructs intent-specific lean prompts (300-600 tokens)
   * Enforces BLUF (Bottom Line Up Front), Zero-Fluff constraints, and concrete Few-Shot Examples.
   */
  private buildDynamicPrompt(
    intent: AgentIntent,
    message: string,
    student: any,
    ctx: any,
    chatHistory: any[],
  ) {
    const now = new Date();
    const currentDateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const systemPrompt = `You are AcadAI, an elite, highly concise Academic Copilot at FPT University.
Current System Date: ${currentDateStr}
Skill Domain: ${intent}
Language Instruction: Respond strictly in concise, authoritative academic English with standardized room tags (e.g. "Room 204", "Elevator Shaft", "Room 201", "WC", "skylights") so the campus map highlight engine works.

CORE OPERATIONAL RULES:
1. BLUF (Bottom Line Up Front): Deliver the direct answer or key metric in the very first sentence. Never bury the lead.
2. ZERO FLUFF: NEVER include conversational pleasantries, opening greetings, or closing chit-chat.
   - FORBIDDEN: "Hello [Name]", "Hope you are doing well", "As an AI campus advisor...", "Here is what I found for you", "I hope this helps", "Feel free to ask if you have more questions".
   - Start immediately with the factual answer or metric.
3. DATA FIDELITY: Rely strictly on the real-time student records provided below. Never invent course codes, room numbers, test dates, or grades.
4. STRUCTURE: Use clean Markdown tables or concise bullet points with bold metrics.
5. CONCISENESS: Keep the response under 150 words whenever possible.
6. CAMPUS ROOMS: Write room names cleanly (e.g. "Room 204", "Elevator Shaft", "WC", "Room 201", "Innovation Lab") to enable interactive map navigation.
7. MISSING DATA: If a value is not in the data (e.g. no grades, no target GPA, no attendance), say it is not available yet. Never fill gaps with example or typical values.`;

    // Format templates only. Values are <placeholders> so the model cannot copy
    // example numbers into a real answer (it did so with concrete examples).
    const fewShotExamples: Record<AgentIntent, string> = {
      LOCATOR: `[FORMAT TEMPLATE — replace every <placeholder> with values from the data above; omit rows you have no data for]
Student: "Where is <room or course>?"
Copilot:
**<Room / facility>** is located <location from CAMPUS LAYOUT FACTS>.

• **Your sessions there:** <course code> — <topic> on <date> (only if listed in the schedule data)`,

      ATTENDANCE: `[FORMAT TEMPLATE — replace every <placeholder> with values from the data above]
Student: "Am I at risk of exam disqualification?"
Copilot:
Your overall attendance rate is **<rate>%** (<present>/<recorded> sessions) — **<Eligible / AT RISK>**.

| Course | Present / Recorded | Rate | Absence Buffer | Exam Status |
| :--- | :---: | :---: | :---: | :--- |
| **<code>** | <present> / <recorded> | **<rate>%** | <buffer> | <status> |

• **Policy:** <policy from data>`,

      GPA: `[FORMAT TEMPLATE — replace every <placeholder> with values from the data above]
Student: "What score do I need on the final exam?"
Copilot:
Your current cumulative GPA is **<gpa or "not available">**<, gap to target if both exist>.

| Course | Assignment (20%) | Midterm (30%) | Final (50%) | Final Needed to Pass | Final Needed for A |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **<code>** | <assignment> | <midterm> | <final or Pending> | <needed> | <needed> |`,

      EXAM: `[FORMAT TEMPLATE — replace every <placeholder> with values from the data above]
Student: "When is my next exam?"
Copilot:
Your next exam is **<title>** (<code>) on **<date>** in **<room>** — <N> days remaining.

| Exam | Course | Date & Time | Room | Countdown |
| :--- | :--- | :--- | :--- | :--- |
| **<title>** | <code> - <name> | <date> | **<room>** | <countdown> |`,

      CAREER: `[FORMAT TEMPLATE — replace every <placeholder> with values from the data above]
Student: "Show my career roadmap"
Copilot:
Roadmap for your target career **<target career>**:

| Phase | Focus |
| :--- | :--- |
| **<section>** | <one-line summary of that roadmap section> |

• **Next step:** <one concrete action based on the enrolled courses and the roadmap>`,

      GENERAL: `[FORMAT TEMPLATE — replace every <placeholder> with values from the data above; say "not available" when a value is missing]
Student: "Hello"
Copilot:
Academic status overview:

• **GPA:** <gpa> (target: <target>) | **Attendance:** <rate> (<status>)
• **Enrolled courses:** <count> | **Next exam:** <exam or "none scheduled">

You can ask about room locations, attendance, final-exam scores, or exam dates.`,
    };

    let targetedData = '';

    switch (intent) {
      case 'LOCATOR': {
        const enrolledSummary = (ctx.enrolledClasses || [])
          .map((e: any) => {
            const rooms = ctx.classRoomsMap[e.classId]?.join(', ') || 'TBA';
            return `• ${e.class.subjectCode} - ${e.class.name}: Room [${rooms}] (Semester: ${e.class.semester})`;
          })
          .join('\n');

        const upcomingLessons = (ctx.enrolledLessons || []).filter((l: any) => new Date(l.date) >= now);
        const pastLessons = (ctx.enrolledLessons || []).filter((l: any) => new Date(l.date) < now);

        const lessonDisplay = upcomingLessons.length > 0
          ? upcomingLessons.slice(0, 8).map((l: any) => {
              const d = new Date(l.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
              return `• [${l.class.subjectCode}] ${l.topic} | Upcoming Date: ${d} | Room: ${l.room || 'TBA'}`;
            }).join('\n')
          : pastLessons.length > 0
            ? `No upcoming lecture sessions. All ${pastLessons.length} recorded sessions are in the past (last one on ${new Date(pastLessons[pastLessons.length - 1].date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).`
            : 'No lecture sessions are recorded for the enrolled courses.';

        targetedData = `CAMPUS LEVEL 2 LAYOUT FACTS:
- Room 204: Standard lecture classroom on Level 2, situated directly south of the Elevator Shaft.
- Elevator Shaft: Dual passenger elevators directly north of Room 204 (vertical circulation core, non-classroom).
- Restrooms (WC): Located in the central corridor between Room 201 and Room 205.
- Central Skylights: Open lightwell with North and South Multipurpose zones for study tables and event booths.
- Other Classrooms: Rooms 201 to 215. Facilities: Innovation Lab, Art Studio, Gym, Meditation Room, Office.

CURRENT CALENDAR STATUS:
Today is ${currentDateStr}.

STUDENT COURSE ROOMS:
${enrolledSummary || 'No courses enrolled.'}

NEXT CLASS (earliest upcoming session; use this for "next class" questions):
${upcomingLessons[0]
  ? `[${upcomingLessons[0].class.subjectCode}] ${upcomingLessons[0].class.name} — ${upcomingLessons[0].topic} | ${new Date(upcomingLessons[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} | Room: ${upcomingLessons[0].room || 'TBA'}`
  : 'None scheduled'}

ACTIVE / UPCOMING SCHEDULE (sorted by date, earliest first):
${lessonDisplay}`;
        break;
      }

      case 'ATTENDANCE': {
        const classTable = (ctx.enrolledClasses || [])
          .map((e: any) => {
            const att: ClassAttendance = ctx.classAttendanceMap[e.classId] || { total: 0, present: 0, absent: 0, late: 0, rate: null };
            if (att.total === 0) {
              return `• ${e.class.subjectCode} (${e.class.name}): No attendance recorded yet`;
            }
            const maxAllowed = maxAllowedAbsences(att.total);
            const buffer = att.absent > maxAllowed ? 'DISQUALIFIED' : `${maxAllowed - att.absent} absence(s) remaining`;
            return `• ${e.class.subjectCode} (${e.class.name}): Rate ${att.rate}% | Present: ${att.present}/${att.total} | Absences: ${att.absent} | Late: ${att.late} | Buffer: ${buffer} | Status: ${isAttendanceAtRisk(att.rate) ? 'AT RISK' : 'Eligible'}`;
          })
          .join('\n');

        const recentAbsences = (ctx.attendanceRecords || [])
          .filter((r: any) => r.status === 'absent' || r.status === 'late')
          .slice(-5)
          .reverse()
          .map((r: any) => {
            const d = new Date(r.lesson.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `• ${d} | ${r.lesson.class.subjectCode} | Room ${r.lesson.room || 'TBA'}: ${r.status.toUpperCase()}`;
          })
          .join('\n');

        const overall = ctx.overallAttRate === null
          ? 'No attendance has been recorded yet.'
          : `Overall Rate: ${ctx.overallAttRate}% (${ctx.presentCount} present, ${ctx.absentCount} absent, ${ctx.lateCount} late out of ${ctx.attendanceRecords.length} recorded sessions).
Overall Status: ${ctx.isOverallAtRisk ? `AT RISK (< ${MIN_ATTENDANCE_RATE}%)` : `Eligible (>= ${MIN_ATTENDANCE_RATE}%)`}.`;

        const riskCourses = (ctx.enrolledClasses || [])
          .map((e: any) => ({ code: e.class.subjectCode, att: ctx.classAttendanceMap[e.classId] as ClassAttendance | undefined }))
          .filter((x: any) => x.att && x.att.rate !== null && isAttendanceAtRisk(x.att.rate))
          .map((x: any) => `${x.code} (${x.att.rate}%)`);

        targetedData = `ATTENDANCE OVERVIEW:
${overall}
Courses below ${MIN_ATTENDANCE_RATE}% (at risk): ${riskCourses.length ? riskCourses.join(', ') : 'none'}
(The overall rate covers all courses together; do not report a single course's rate as the overall rate.)
Regulation: Minimum ${MIN_ATTENDANCE_RATE}% attendance required. Missing more than ${MAX_ABSENCE_RATIO * 100}% of sessions leads to final exam disqualification.

PER-COURSE ATTENDANCE:
${classTable || 'No courses enrolled.'}

MOST RECENT ABSENCES / LATE ARRIVALS:
${recentAbsences || 'None recorded.'}`;
        break;
      }

      case 'GPA': {
        const gradeRows = (ctx.grades || [])
          .map((g: any) => {
            const finalTaken = g.finalExam > 0;
            const total = courseTotal(g.assignmentAvg, g.midterm, finalTaken ? g.finalExam : 0).toFixed(1);
            const neededPass = finalTaken ? 'Completed' : formatNeeded(finalNeededToPass(g.assignmentAvg, g.midterm));
            const neededA = finalTaken ? 'Completed' : formatNeeded(finalNeededFor(GRADE_A_TOTAL, g.assignmentAvg, g.midterm));
            return `• ${g.class.subjectCode} (${g.class.name}): Assignment(20%)=${g.assignmentAvg.toFixed(1)} | Midterm(30%)=${g.midterm.toFixed(1)} | Final(50%)=${finalTaken ? g.finalExam.toFixed(1) : 'Pending'} | Current Total=${total} | Final Needed to Pass=${neededPass} | Final Needed for Grade A=${neededA}`;
          })
          .join('\n');

        const gap = ctx.currentGpa && ctx.targetGpa
          ? ` (Gap: ${Math.max(0, parseFloat(ctx.targetGpa) - parseFloat(ctx.currentGpa)).toFixed(2)} pts)`
          : '';

        targetedData = `GPA SUMMARY:
Current Cumulative GPA: ${ctx.currentGpa ? `${ctx.currentGpa} / 4.00` : 'No grades recorded yet'}
Target GPA: ${ctx.targetGpa ? `${ctx.targetGpa} / 4.00${gap}` : 'Not set by the student'}
Weighting: Assignment (20%), Midterm (30%), Final Exam (50%). Pass: course total >= ${PASS_TOTAL.toFixed(1)}. Grade A: course total >= ${GRADE_A_TOTAL.toFixed(1)}.

COURSE TRANSCRIPT & FINAL EXAM SCORE REQUIREMENTS:
${gradeRows || 'No grade records found.'}`;
        break;
      }

      case 'EXAM': {
        const testRows = (ctx.enrolledTests || [])
          .map((t: any) => {
            const d = new Date(t.scheduledAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            const remaining = t.daysRemaining >= 0 ? `${t.daysRemaining} days remaining` : 'Completed';
            return `• ${t.title} | Course: ${t.class.subjectCode} - ${t.class.name} | Date: ${d} | Room: ${t.room || 'TBA'} | Countdown: ${remaining} | Urgent: ${t.isUrgent ? 'YES' : 'NO'}`;
          })
          .join('\n');

        targetedData = `SCHEDULED EXAMINATIONS FOR ENROLLED COURSES:
${testRows || 'No exams scheduled.'}`;
        break;
      }

      case 'CAREER': {
        const enrolledCodes = (ctx.enrolledClasses || [])
          .map((e: any) => e.class.subjectCode)
          .join(', ');
        const roadmapSummary = (ctx.roadmapChunks || [])
          .slice(0, 6)
          .map((c: any) => `• ${c.section}: ${c.content.slice(0, 200)}...`)
          .join('\n');

        targetedData = `CAREER GOAL & CURRICULUM:
Target Career: ${ctx.targetCareer || 'Not set by the student (suggest setting it on the Profile page)'}
Target GPA: ${ctx.targetGpa ? `${ctx.targetGpa} / 4.00` : 'Not set'} (Current: ${ctx.currentGpa ? `${ctx.currentGpa} / 4.00` : 'no grades yet'})
Currently Enrolled Courses: ${enrolledCodes || 'None'}

ROADMAP FOR TARGET CAREER:
${roadmapSummary || 'No roadmap content available for this career. Do not invent course codes.'}`;
        break;
      }

      case 'GENERAL':
      default: {
        const nextTest = (ctx.enrolledTests || []).find((t: any) => t.daysRemaining >= 0);
        const nextTestInfo = nextTest
          ? `${nextTest.title} (${nextTest.class.subjectCode}) on ${new Date(nextTest.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} in Room ${nextTest.room || 'TBA'}`
          : 'None scheduled';

        targetedData = `ACADEMIC SNAPSHOT:
Student: ${student?.name || 'Student'}
Enrolled Courses: ${ctx.enrolledClasses?.length || 0}
Cumulative GPA: ${ctx.currentGpa ? `${ctx.currentGpa} / 4.00` : 'No grades recorded yet'} (Target: ${ctx.targetGpa || 'not set'})
Attendance Rate: ${ctx.overallAttRate === null ? 'No records yet' : `${ctx.overallAttRate}% (${ctx.isOverallAtRisk ? 'At Risk' : 'Eligible'})`}
Next Scheduled Exam: ${nextTestInfo}`;

        if (ctx.lessonSnippets?.length) {
          targetedData += `

LESSON MATERIAL RELEVANT TO THE QUESTION (uploaded by the lecturer; answer from this text and name the course and lesson):
${ctx.lessonSnippets.map((sn: any) => `[${sn.subjectCode} — ${sn.topic}]\n${sn.text}`).join('\n\n')}`;
        }
        break;
      }
    }

    const recentHistory = chatHistory
      .slice(-6)
      .map((h) => `${h.sender === 'user' ? 'Student' : 'Copilot'}: ${h.content}`)
      .join('\n');

    const userPrompt = `=== REAL-TIME DATA CONTEXT (${intent}) ===
${targetedData}

${fewShotExamples[intent]}

${recentHistory ? `=== CONVERSATION CONTEXT ===\n${recentHistory}\n` : ''}
=== STUDENT QUERY ===
${message}

Respond following BLUF and Zero-Fluff rules. Answer directly in sentence 1.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Sanitizes model output by stripping reasoning blocks, conversational fluff, and markdown code fences.
   */
  sanitizeAndCleanOutput(content: string): string {
    if (!content) return '';

    let clean = content;

    // 1. Strip <think>...</think> blocks (including unclosed <think> before paragraph breaks)
    clean = clean.replace(/<think>[\s\S]*?(?:<\/think>|\n\n|\n(?=[#*|A-Z\u00C0-\u1EF9]|\*\*)|$)/gi, '').trim();

    // 2. Strip "Thought: ... \n\n" or "Thinking Process: ..." or "Reasoning: ..." blocks
    clean = clean.replace(
      /(?:^|\n)(?:Thought|Thinking Process|Reasoning):\s*[\s\S]*?(?=\n\n|\n[#*|A-Z\u00C0-\u1EF9]|\n\*\*|$)/gi,
      '',
    ).trim();

    // 3. Strip outer ```markdown ... ``` or ``` ... ``` wrappers if the entire response was wrapped
    const codeFenceMatch = clean.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
    if (codeFenceMatch) {
      clean = codeFenceMatch[1].trim();
    }

    // 4. Repeatedly strip residual conversational intros (English & Vietnamese)
    let prev = '';
    const introRegex =
      /^(?:Sure|Certainly|Of course|Okay|Alright|Here is the information(?: you requested)?|Here is what I found|Based on the campus records|According to your records|Dưới đây là(?: thông tin)?|Theo dữ liệu|Theo hồ sơ học vụ|Thông tin chi tiết|Xin chào|Chào bạn)[!?,.:\s-]*/i;

    while (prev !== clean) {
      prev = clean;
      clean = clean.replace(introRegex, '').trim();
    }

    // 5. Strip residual conversational sign-offs (English & Vietnamese)
    const outroPatterns = [
      /(?:\n|^)(?:I hope this helps|Hope this helps|Feel free to ask|Let me know if you need anything else)[\s\S]*$/i,
      /(?:\n|^)(?:Hy vọng thông tin này giúp ích|Nếu bạn có thắc mắc gì thêm cứ hỏi)[\s\S]*$/i,
    ];
    for (const pat of outroPatterns) {
      clean = clean.replace(pat, '').trim();
    }

    return clean;
  }

  /**
   * OpenRouter LLM Caller with Zero-Fluff Fallback & Model Router Cascade
   */
  private async callLlm(
    systemPrompt: string,
    userPrompt: string,
    intent: AgentIntent,
    student: any,
    rawMessage: string,
    contextData: any,
  ): Promise<string> {
    if (hasOpenRouterKey()) {
      const configuredModel = process.env.OPENROUTER_MODEL || 'openrouter/free';
      const candidateModels = Array.from(
        new Set([
          configuredModel,
          'google/gemma-4-31b-it:free',
          'nvidia/nemotron-3.5-lightning:free',
          'openrouter/free',
        ]),
      );

      // Overall time budget for the whole cascade, so a slow free model cannot block the chat.
      const deadline = Date.now() + 25000;

      for (const m of candidateModels) {
        const remaining = deadline - Date.now();
        if (remaining < 2000) {
          this.logger.warn('OpenRouter time budget used up; using the built-in answer.');
          break;
        }
        try {
          const result = await openRouterChat(
            {
              model: m,
              models: candidateModels,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
              ],
              maxTokens: 1024,
              temperature: 0.15,
              timeoutMs: Math.min(12000, remaining),
              title: 'AcadAI',
            },
          );

          if (result.ok) {
            if (result.content) {
              const cleanContent = this.sanitizeAndCleanOutput(result.content);
              const isInvalidOrGuardrail =
                cleanContent.length < 25 ||
                /^(user safety|safe|unsafe|refusal|ok)/i.test(cleanContent) ||
                cleanContent.toLowerCase().includes('user safety:') ||
                /\b(không có dữ liệu|hiện chưa được cung cấp|chưa có thông tin|chưa có phân tích|không tìm thấy thông tin|không được đề cập|i do not have access|not found in the provided data)\b/i.test(cleanContent);

              if (!isInvalidOrGuardrail) {
                return cleanContent;
              }
              this.logger.warn(`OpenRouter call (${result.servedBy || m}) returned an unusable answer; trying next model.`);
            } else {
              this.logger.warn(`OpenRouter call (${result.servedBy || m}) returned no text (finish_reason: ${result.finishReason}); trying next model.`);
            }
          } else {
            const errText = JSON.stringify(result.body);
            this.logger.warn(`OpenRouter call (${m}) failed status ${result.status}: ${errText.slice(0, 300)}`);
            // openRouterChat already switched keys; a daily-limit error here means every key is used up.
            if (isDailyLimitError(result.status, result.body)) {
              this.logger.warn(`All OpenRouter keys reached the free daily limit. Using the built-in answer.`);
              break;
            }
          }
        } catch (err: any) {
          if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            this.logger.warn(`OpenRouter call timed out on model (${m}), failing over...`);
          } else {
            this.logger.warn(`OpenRouter call error (${m}): ${err.message}`);
          }
        }
      }
    }

    // Deterministic High-Precision Built-in Response (BLUF & Zero Fluff)
    this.logger.warn('No usable LLM answer; using the built-in answer.');
    return this.generateBuiltinResponse(intent, student, rawMessage, contextData);
  }

  // ── Helpers for the built-in (no-LLM) responses ────────────────────────────────

  private fmtDate(
    d: Date | string,
    opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' },
  ): string {
    return new Date(d).toLocaleDateString('en-US', opts);
  }

  private roomOf(room?: string | null): string {
    return room && room.trim() ? room.trim() : 'TBA';
  }

  private gpaText(ctx: any): string {
    return ctx.currentGpa ? `**${ctx.currentGpa} / 4.00**` : '**no grades recorded yet**';
  }

  private targetGpaText(ctx: any): string {
    return ctx.targetGpa ? `${ctx.targetGpa} / 4.00` : 'not set (you can set it on your Profile page)';
  }

  private attOf(ctx: any, classId: string): ClassAttendance {
    return ctx.classAttendanceMap?.[classId] ?? { total: 0, present: 0, absent: 0, late: 0, rate: null };
  }

  private attStatus(att: ClassAttendance): string {
    if (att.rate === null) return 'No records yet';
    return isAttendanceAtRisk(att.rate) ? '⚠️ AT RISK' : '✅ Eligible';
  }

  private attBuffer(att: ClassAttendance): string {
    if (att.total === 0) return 'N/A';
    const max = maxAllowedAbsences(att.total);
    return att.absent > max ? 'DISQUALIFIED' : `${max - att.absent} absence(s) remaining`;
  }

  private matchEnrolledClass(ctx: any, lower: string): any | null {
    return (
      (ctx.enrolledClasses || []).find((e: any) => {
        const code = (e.class?.subjectCode || '').toLowerCase();
        const name = (e.class?.name || '').toLowerCase();
        return (code && lower.includes(code)) || (name && lower.includes(name));
      }) || null
    );
  }

  /** Returns 0-based month index if the message names a month (English or "tháng N"). */
  private detectMonth(lower: string): number | null {
    const viNum = lower.match(/tháng\s*(\d{1,2})\b/);
    if (viNum) {
      const m = parseInt(viNum[1], 10);
      if (m >= 1 && m <= 12) return m - 1;
    }
    if (lower.includes('tháng mười một')) return 10;
    if (lower.includes('tháng mười hai')) return 11;
    const names = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (let i = 0; i < names.length; i++) {
      // "may" is also a common verb, so only accept it as "in may".
      const pattern = names[i] === 'may' ? /\bin may\b/ : new RegExp(`\\b${names[i]}\\b`);
      if (pattern.test(lower)) return i;
    }
    return null;
  }

  /**
   * Deterministic built-in fallback, used when no LLM is available.
   * Every fact comes from the student's records in the database; when data is
   * missing the answer says so instead of inventing values.
   */
  generateBuiltinResponse(
    intent: AgentIntent,
    student: any,
    message: string,
    ctx: any,
  ): string {
    const lower = message.toLowerCase();
    const now = new Date();
    const enrolled: any[] = ctx.enrolledClasses || [];
    const allTests: any[] = ctx.enrolledTests || [];
    const upcomingTests = allTests.filter((t: any) => t.daysRemaining >= 0);

    // ── 1. LOCATOR & SCHEDULE INTENT ─────────────────────────────────────────────────
    if (intent === 'LOCATOR') {
      const lessons: any[] = ctx.enrolledLessons || [];
      const upcoming = lessons.filter((l: any) => new Date(l.date) >= now);

      const lessonTable = (rows: any[]) =>
        `| Course Code | Topic | Classroom | Date |
| :--- | :--- | :--- | :--- |
${rows.map((l: any) => `| **${l.class.subjectCode}** | ${l.topic} | **${this.roomOf(l.room)}** | ${this.fmtDate(l.date)} |`).join('\n')}`;

      const noMoreLessons = () => {
        const last = lessons[lessons.length - 1];
        const nextTest = upcomingTests[0];
        const lead = last
          ? `No further lecture sessions are scheduled for your enrolled courses. Your last recorded session was on **${this.fmtDate(last.date)}** (${last.class.subjectCode}).`
          : 'No lecture sessions are recorded for your enrolled courses.';
        const exam = nextTest
          ? `• Next examination: **${nextTest.title}** (${nextTest.class.subjectCode}) on ${this.fmtDate(nextTest.scheduledAt)} in Room **${this.roomOf(nextTest.room)}**.`
          : '• No upcoming examinations are scheduled.';
        return `${lead}\n\n${exam}`;
      };

      // A. Semester end / last class
      if (/(khi nào kết thúc|khi nào hết học kỳ|khi nào hết môn|khi nào nghỉ hè|khi nào nghỉ kỳ|when does the semester end|end of (the )?semester|last day of class|last class|buổi học cuối cùng)/i.test(lower)) {
        if (lessons.length === 0) {
          return 'No lecture sessions are recorded for your enrolled courses, so the end of your semester cannot be determined yet.';
        }
        const last = lessons[lessons.length - 1];
        const rows = enrolled
          .map((e: any) => {
            const classLessons = lessons.filter((l: any) => l.classId === e.classId);
            const lastLesson = classLessons[classLessons.length - 1];
            const tests = allTests.filter((t: any) => t.classId === e.classId);
            const finalTest = tests.find((t: any) => /final/i.test(t.title)) || tests[tests.length - 1];
            return `| **${e.class.subjectCode}** | ${lastLesson ? this.fmtDate(lastLesson.date) : '–'} | ${finalTest ? `${finalTest.title}: ${this.fmtDate(finalTest.scheduledAt)}` : 'Not scheduled'} | ${finalTest ? `**${this.roomOf(finalTest.room)}**` : '–'} |`;
          })
          .join('\n');

        return `Your last recorded lecture session this semester is on **${this.fmtDate(last.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}** (${last.class.subjectCode}, Room ${this.roomOf(last.room)}).

| Course Code | Final Lecture Session | Final / Last Examination | Exam Room |
| :--- | :--- | :--- | :--- |
${rows}`;
      }

      // B. Classes in a given month ("classes in november", "lịch học tháng 11")
      const monthIdx = this.detectMonth(lower);
      if (monthIdx !== null) {
        const year = now.getFullYear();
        const monthLessons = lessons.filter((l: any) => {
          const d = new Date(l.date);
          return d.getMonth() === monthIdx && d.getFullYear() === year;
        });
        const monthName = new Date(year, monthIdx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (monthLessons.length === 0) {
          return `You have no class sessions recorded in **${monthName}**.`;
        }
        return `In **${monthName}** you have **${monthLessons.length} class session(s)**:

${lessonTable(monthLessons)}

• Click any room button below to view it on the campus map.`;
      }

      // C. Classes this week
      if (/(how many class|bao nhiêu buổi học|bao nhiêu lớp|classes this week|schedule this week|lịch học tuần này|lịch học tuần)/i.test(lower)) {
        const daysToSunday = now.getDay() === 0 ? 0 : 7 - now.getDay();
        const endOfWeek = new Date(now);
        endOfWeek.setDate(now.getDate() + daysToSunday);
        endOfWeek.setHours(23, 59, 59, 999);

        const thisWeek = upcoming.filter((l: any) => new Date(l.date) <= endOfWeek);
        const weekTests = upcomingTests.filter((t: any) => new Date(t.scheduledAt) <= endOfWeek);
        const examLine = weekTests.length
          ? `\n• Exams this week: ${weekTests.map((t: any) => `**${t.title}** (${t.class.subjectCode}) on ${this.fmtDate(t.scheduledAt)} in Room **${this.roomOf(t.room)}**`).join('; ')}.`
          : '';

        if (thisWeek.length > 0) {
          return `You have **${thisWeek.length} class session(s)** for the rest of this week (${this.fmtDate(now, { month: 'short', day: 'numeric' })} – ${this.fmtDate(endOfWeek, { month: 'short', day: 'numeric' })}), and **${upcoming.length - thisWeek.length}** more after that.

${lessonTable(thisWeek)}
${examLine}
• Click any room button below to view it on the campus map.`;
        }
        if (upcoming.length > 0) {
          return `You have no more class sessions this week. Your next ${Math.min(6, upcoming.length)} of ${upcoming.length} upcoming sessions:

${lessonTable(upcoming.slice(0, 6))}
${examLine}`;
        }
        return noMoreLessons();
      }

      // D. Next class
      if (/(next class|upcoming class|lớp tiếp theo|lớp học tiếp theo|tiết tiếp theo|tiết học tiếp theo|buổi học tiếp theo)/i.test(lower)) {
        if (upcoming.length === 0) return noMoreLessons();
        const next = upcoming[0];
        const enrollment = enrolled.find((e: any) => e.classId === next.classId);
        const room = this.roomOf(next.room);
        const when = this.fmtDate(next.date, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

        return `Your next class is **${next.class.name} (${next.class.subjectCode})** on **${when}** in Room **${room}**.

| Attribute | Details |
| :--- | :--- |
| Course | **${next.class.subjectCode} - ${next.class.name}** |
| Session Topic | ${next.topic} |
| Date | ${when} |
| Classroom | **${room}** |
| Instructor | ${enrollment?.class?.creator?.name || 'Not recorded'} |

• Click the map button below to locate Room **${room}**.`;
      }

      // E. Campus landmarks (static Level 2 layout, same data as the campus map)
      if (/(thang máy|elevator|lift|shaft)/i.test(lower)) {
        return `The campus passenger elevators on Level 2 are located inside the central **Elevator Shaft**, directly north of **Room 204**.

• **Corridor Landmark:** Central circulation core between **Room 201**/**Room 205** and **Room 204**.
• Click the map button below to locate the Elevator Shaft on the floor plan.`;
      }

      if (/(wc|toilet|restroom|vệ sinh)/i.test(lower)) {
        return `The restrooms (**WC**) on Level 2 are in the central corridor between **Room 201** and **Room 205**.

• **Landmark:** Opposite the central skylights, next to the northern multipurpose zone.`;
      }

      if (/(skylight|giếng trời|đa năng|multipurpose|booth)/i.test(lower)) {
        return `The central **skylights** lightwell is surrounded by the North and South **Multipurpose Zones**, used for study tables and event booths.

• **Location:** Centre of Level 2, between Room 201, Room 205, and the main corridor.`;
      }

      // F. Specific room (Room 201–215)
      const roomMatch = message.match(/\b(?:room\s*|phòng\s*)?(20[1-9]|21[0-5])\b/i);
      if (roomMatch) {
        const roomNum = roomMatch[1];
        const layout: Record<string, string> = {
          '201': 'on the north corridor of Level 2, next to the WC and facing the central skylights',
          '202': 'in the south-west corridor of Level 2, next to **Room 204**',
          '203': 'in the south-west corridor of Level 2, next to **Room 204**',
          '204': 'on Level 2, directly south of the central **Elevator Shaft**',
          '205': 'in the north corridor of Level 2, opposite Room 201 and next to the WC',
        };
        const location = layout[roomNum] || 'on **Level 2**';
        const sameRoom = (r?: string | null) => new RegExp(`^(room\\s*)?${roomNum}$`, 'i').test((r || '').trim());
        const sessions = upcoming.filter((l: any) => sameRoom(l.room));
        const exams = upcomingTests.filter((t: any) => sameRoom(t.room));

        const scheduleText = sessions.length || exams.length
          ? [
              ...sessions.slice(0, 5).map((l: any) => `• Class: **${l.class.subjectCode}** — ${l.topic} on ${this.fmtDate(l.date)}`),
              ...exams.slice(0, 3).map((t: any) => `• Exam: **${t.title}** (${t.class.subjectCode}) on ${this.fmtDate(t.scheduledAt)}`),
            ].join('\n')
          : '• None of your upcoming classes or exams are scheduled in this room.';

        return `**Room ${roomNum}** is located ${location}.

${scheduleText}

• Click the map button below to locate Room ${roomNum} on the floor plan.`;
      }

      // G. Room for a specific enrolled course
      const matched = this.matchEnrolledClass(ctx, lower);
      if (matched) {
        const c = matched.class;
        const rooms: string[] = ctx.classRoomsMap[c.id] || [];
        const roomStr = rooms.length ? rooms.join(', ') : 'TBA';
        const nextLessons = upcoming
          .filter((l: any) => l.classId === c.id)
          .slice(0, 3)
          .map((l: any) => `• **${l.topic}**: ${this.fmtDate(l.date)} in **${this.roomOf(l.room)}**`)
          .join('\n');

        return `**${c.name} (${c.subjectCode})** is held in **${roomStr}**.

| Course | Classroom(s) | Instructor | Semester |
| :--- | :--- | :--- | :--- |
| **${c.subjectCode} - ${c.name}** | **${roomStr}** | ${c.creator?.name || 'Not recorded'} | ${c.semester} |

**Upcoming sessions:**
${nextLessons || '• No upcoming sessions scheduled.'}`;
      }

      // H. All enrolled course rooms
      if (enrolled.length === 0) {
        return 'You are not enrolled in any courses yet, so there are no classrooms to show. You can enroll on the **Classes** page.';
      }
      const rows = enrolled
        .map((e: any) => {
          const rooms: string[] = ctx.classRoomsMap[e.classId] || [];
          return `| **${e.class.subjectCode}** | ${e.class.name} | **${rooms.length ? rooms.join(', ') : 'TBA'}** | ${e.class.semester} |`;
        })
        .join('\n');

      return `Classroom locations for your enrolled courses:

| Course Code | Course Name | Classroom(s) | Semester |
| :--- | :--- | :--- | :--- |
${rows}

• Select any room tag below to view it on the campus map.`;
    }

    // ── 2. ATTENDANCE INTENT ──────────────────────────────────────────────────────────
    if (intent === 'ATTENDANCE') {
      const policy = `• **Policy:** Minimum **${MIN_ATTENDANCE_RATE}%** attendance per course. Missing more than **${MAX_ABSENCE_RATIO * 100}%** of sessions leads to final exam disqualification.`;

      if (!ctx.attendanceRecords?.length) {
        return `No attendance records have been recorded for you yet (${enrolled.length} enrolled course(s)).

${policy}`;
      }

      const table = `| Course | Attended / Recorded | Attendance Rate | Absence Buffer | Exam Status |
| :--- | :---: | :---: | :---: | :--- |
${enrolled
  .map((e: any) => {
    const att = this.attOf(ctx, e.classId);
    return `| **${e.class.subjectCode} - ${e.class.name}** | ${att.present} / ${att.total} | ${att.rate === null ? '–' : `**${att.rate}%**`} | ${this.attBuffer(att)} | ${this.attStatus(att)} |`;
  })
  .join('\n')}`;

      // A. Lowest attendance
      if (/(thấp nhất|kém nhất|lowest|worst)/i.test(lower)) {
        const ranked = enrolled
          .map((e: any) => ({ e, att: this.attOf(ctx, e.classId) }))
          .filter((x) => x.att.rate !== null)
          .sort((a, b) => a.att.rate - b.att.rate);
        if (ranked.length) {
          const { e, att } = ranked[0];
          return `Your course with the lowest attendance rate is **${e.class.name} (${e.class.subjectCode})** at **${att.rate}%** (${att.present}/${att.total} present, ${att.absent} absence(s)) — ${this.attStatus(att)}.

${policy}`;
        }
      }

      // B. Disqualification
      if (/(cấm thi|disqualif|bị cấm)/i.test(lower)) {
        const barred = enrolled.filter((e: any) => {
          const att = this.attOf(ctx, e.classId);
          return att.total > 0 && att.absent > maxAllowedAbsences(att.total);
        });
        const atRisk = enrolled.filter((e: any) => {
          const att = this.attOf(ctx, e.classId);
          return att.rate !== null && isAttendanceAtRisk(att.rate);
        });
        const lead = barred.length
          ? `**${barred.length} course(s)** have exceeded the absence limit: ${barred.map((e: any) => `**${e.class.subjectCode}**`).join(', ')}.`
          : atRisk.length
            ? `You are **not disqualified** from any exam, but **${atRisk.length} course(s)** are below ${MIN_ATTENDANCE_RATE}% and at risk:`
            : `You are **not disqualified** from any final examination. All courses with records meet the ${MIN_ATTENDANCE_RATE}% threshold.`;
        return `${lead}

${table}

${policy}`;
      }

      // C. Specific course
      const matched = this.matchEnrolledClass(ctx, lower);
      if (matched) {
        const c = matched.class;
        const att = this.attOf(ctx, c.id);
        if (att.total === 0) {
          return `No attendance has been recorded yet for **${c.name} (${c.subjectCode})**.

${policy}`;
        }
        return `Your attendance rate for **${c.name} (${c.subjectCode})** is **${att.rate}%** (${att.present}/${att.total} present, ${att.absent} absence(s), ${att.late} late) — ${this.attStatus(att)}.

• Absence buffer: ${this.attBuffer(att)}.
${policy}`;
      }

      // D. Overview
      const missed = (ctx.attendanceRecords || [])
        .filter((r: any) => r.status === 'absent' || r.status === 'late')
        .slice(-4)
        .reverse()
        .map((r: any) => `• ${this.fmtDate(r.lesson.date, { month: 'short', day: 'numeric' })} | **${r.lesson.class.subjectCode}** | Room ${this.roomOf(r.lesson.room)}: ${r.status === 'absent' ? '❌ Absent' : '⏰ Late'}`)
        .join('\n');

      return `Your cumulative attendance rate is **${ctx.overallAttRate}%** (${ctx.presentCount}/${ctx.attendanceRecords.length} recorded sessions present) — **${ctx.isOverallAtRisk ? '⚠️ AT RISK OF EXAM DISQUALIFICATION' : 'Eligible for Final Examinations'}**.

${table}

${policy}
${missed ? `\n**Most recent absences / late arrivals:**\n${missed}` : '\n• No absences or late arrivals recorded.'}`;
    }

    // ── 3. GPA & GRADES INTENT ────────────────────────────────────────────────────────
    if (intent === 'GPA') {
      const policy = `• **Grading policy:** Course total = Assignment (20%) + Midterm (30%) + Final Exam (50%). Pass: total ≥ **${PASS_TOTAL.toFixed(1)}**. Grade A: total ≥ **${GRADE_A_TOTAL.toFixed(1)}**.`;
      const grades: any[] = ctx.grades || [];

      if (grades.length === 0) {
        return `No grades have been recorded for you yet, so your GPA and final-exam requirements cannot be calculated.

${policy}`;
      }

      const header = `| Course | Assignment (20%) | Midterm (30%) | Final (50%) | Current Total | Final Needed to Pass | Final Needed for A |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |`;
      const row = (g: any) => {
        const finalTaken = g.finalExam > 0;
        const total = courseTotal(g.assignmentAvg, g.midterm, finalTaken ? g.finalExam : 0).toFixed(1);
        const needPass = finalTaken ? 'Completed' : formatNeeded(finalNeededToPass(g.assignmentAvg, g.midterm));
        const needA = finalTaken ? 'Completed' : formatNeeded(finalNeededFor(GRADE_A_TOTAL, g.assignmentAvg, g.midterm));
        return `| **${g.class.subjectCode}** | ${g.assignmentAvg.toFixed(1)} | ${g.midterm.toFixed(1)} | ${finalTaken ? g.finalExam.toFixed(1) : 'Pending'} | **${total}** | ${needPass} | ${needA} |`;
      };

      const matchedGrade = grades.find((g: any) => {
        const code = (g.class?.subjectCode || '').toLowerCase();
        const name = (g.class?.name || '').toLowerCase();
        return (code && lower.includes(code)) || (name && lower.includes(name));
      });
      if (matchedGrade) {
        const g = matchedGrade;
        const lead = g.finalExam > 0
          ? `Your final exam for **${g.class.name} (${g.class.subjectCode})** is already recorded; your course total is **${courseTotal(g.assignmentAvg, g.midterm, g.finalExam).toFixed(1)} / 10**.`
          : `To pass **${g.class.name} (${g.class.subjectCode})** you need at least **${formatNeeded(finalNeededToPass(g.assignmentAvg, g.midterm))}** on the final exam.`;
        return `${lead}

${header}
${row(g)}

${policy}`;
      }

      let lead = `Your current cumulative GPA is ${this.gpaText(ctx)}`;
      if (ctx.currentGpa && ctx.targetGpa) {
        const gap = Math.max(0, parseFloat(ctx.targetGpa) - parseFloat(ctx.currentGpa)).toFixed(2);
        lead += `, a **${gap} point gap** to your target GPA of **${ctx.targetGpa} / 4.00**.`;
      } else {
        lead += `. Target GPA: ${this.targetGpaText(ctx)}.`;
      }

      return `${lead}

${header}
${grades.map(row).join('\n')}

${policy}`;
    }

    // ── 4. EXAM INTENT ────────────────────────────────────────────────────────────────
    if (intent === 'EXAM') {
      if (upcomingTests.length === 0) {
        return 'There are no upcoming examinations scheduled for your enrolled courses.';
      }

      const rows = upcomingTests
        .map((t: any) => {
          const d = new Date(t.scheduledAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          const urgency = t.isUrgent ? ' 🔥 (URGENT)' : '';
          return `| **${t.title}** | ${t.class.subjectCode} - ${t.class.name} | ${d} | **${this.roomOf(t.room)}** | **${t.daysRemaining} day(s) remaining**${urgency} |`;
        })
        .join('\n');

      return `You have **${upcomingTests.length} upcoming examination(s)**:

| Examination | Course | Date & Time | Room | Countdown |
| :--- | :--- | :--- | :--- | :--- |
${rows}

• Arrive 15 minutes before the start time with your student ID card.`;
    }

    // ── 5. CAREER INTENT ──────────────────────────────────────────────────────────────
    if (intent === 'CAREER') {
      const enrolledCodes = enrolled.map((e: any) => e.class.subjectCode).join(', ') || 'none';

      if (!ctx.targetCareer) {
        return `You have not set a target career yet. Set one on your **Profile** page and AcadAI will show the matching roadmap.

• Currently enrolled courses: ${enrolledCodes}.`;
      }

      const chunks: any[] = ctx.roadmapChunks || [];
      if (chunks.length === 0) {
        return `No roadmap content is available yet for **${ctx.targetCareer}**.

• Currently enrolled courses: ${enrolledCodes}.`;
      }

      const phases = chunks
        .slice(0, 6)
        .map((c: any) => `**${c.section}**\n${c.content.length > 220 ? `${c.content.slice(0, 220).trim()}…` : c.content}`)
        .join('\n\n');

      return `Roadmap for your target career **${ctx.targetCareer}**:

${phases}

• Currently enrolled courses: ${enrolledCodes}.
• Current GPA: ${this.gpaText(ctx)} (target: ${this.targetGpaText(ctx)}).`;
    }

    // ── 6. GENERAL INTENT ─────────────────────────────────────────────────────────────
    if (ctx.lessonSnippets?.length) {
      const top = ctx.lessonSnippets[0];
      return `From your lesson material (**${top.subjectCode} — ${top.topic}**):

> ${top.text.replace(/\n+/g, ' ')}

• This is a direct excerpt; the AI advisor is offline, so no summary is available right now.`;
    }

    const nextTest = upcomingTests[0];
    const nextTestInfo = nextTest
      ? `**${nextTest.title}** (${nextTest.class.subjectCode}) on ${this.fmtDate(nextTest.scheduledAt, { month: 'short', day: 'numeric' })} in **${this.roomOf(nextTest.room)}**`
      : 'none scheduled';
    const attendanceInfo = ctx.overallAttRate === null
      ? 'no records yet'
      : `**${ctx.overallAttRate}%** (${ctx.isOverallAtRisk ? '⚠️ At Risk' : 'Eligible'})`;

    return `AcadAI academic status overview:

• **Academic Standing:** GPA ${this.gpaText(ctx)} (target: ${ctx.targetGpa || 'not set'}) | Attendance: ${attendanceInfo}
• **This Semester:** Enrolled in **${enrolled.length} course(s)** | Next exam: ${nextTestInfo}

**You can ask:**
1. *"Where is Room 204?"* — campus map navigation
2. *"Check my attendance"* — absences and exam eligibility
3. *"What score do I need on my final exams?"* — grade calculator
4. *"When is my next exam?"* — exam dates and rooms`;
  }
}
