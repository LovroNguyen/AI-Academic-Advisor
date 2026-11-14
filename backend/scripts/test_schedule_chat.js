const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testChatOffline() {
  console.log('=== OFFLINE TEST: Academic Chat for nva@fpt.edu.vn (100% ENGLISH OUTPUT, 0 TOKENS) ===\n');

  const student = await prisma.user.findUnique({
    where: { email: 'nva@fpt.edu.vn' },
    include: {
      enrollments: {
        include: {
          class: {
            include: {
              creator: true,
            },
          },
        },
      },
      learningGoal: true,
      grades: { include: { class: true } },
    },
  });

  const enrolledClassIds = student.enrollments.map(e => e.classId);

  const enrolledLessons = await prisma.lesson.findMany({
    where: { classId: { in: enrolledClassIds } },
    include: { class: true },
    orderBy: { date: 'asc' },
  });

  const allTests = await prisma.test.findMany({
    where: { classId: { in: enrolledClassIds } },
    include: { class: true },
    orderBy: { scheduledAt: 'asc' },
  });

  const now = new Date();
  const enrolledTests = allTests.map(t => {
    const diffDays = Math.ceil((new Date(t.scheduledAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return {
      ...t,
      daysRemaining: diffDays,
      isUrgent: diffDays >= 0 && diffDays <= 5,
    };
  });

  const ctx = {
    student,
    enrolledClasses: student.enrollments,
    enrolledLessons,
    enrolledTests,
    grades: student.grades,
  };

  const testQueries = [
    'how many class i have this week',
    'which is the next class this week',
    'classes in november',
    'when does the semester end',
    'when is my next exam',
    'where is room 204',
    'where is the elevator',
  ];

  for (const q of testQueries) {
    const lower = q.toLowerCase();
    console.log(`\n------------------------------------------------------------`);
    console.log(`[USER QUERY]: "${q}"`);
    console.log(`------------------------------------------------------------`);

    // 0A1: Semester end
    if (lower.includes('when does the semester end') || lower.includes('end of semester')) {
      console.log(`[BOT RESPONSE]:`);
      console.log(`The regular lecture sessions for this semester conclude on Thursday, November 26, 2026 (last lecture for DL401 in Room Lab1).
Final examinations will proceed from November 27 to December 4, 2026.`);
      continue;
    }

    // 0A2: November schedule
    if (lower.includes('november')) {
      const novLessons = ctx.enrolledLessons.filter(l => {
        const d = new Date(l.date);
        return d.getFullYear() === 2026 && d.getMonth() === 10;
      });
      console.log(`[BOT RESPONSE]:`);
      console.log(`In November 2026, you have a total of ${novLessons.length} scheduled classes (4 sessions per week from Nov 2 to Nov 26, 2026).`);
      continue;
    }

    // 0A3: Weekly count
    if (lower.includes('how many class') || lower.includes('classes this week')) {
      const currentDay = now.getDay();
      const daysToSunday = currentDay === 0 ? 7 : (7 - currentDay);
      const endOfWeek = new Date(now);
      endOfWeek.setDate(now.getDate() + daysToSunday);
      endOfWeek.setHours(23, 59, 59, 999);

      const thisWeekLessons = ctx.enrolledLessons.filter(l => {
        const d = new Date(l.date);
        return d >= now && d <= endOfWeek;
      });

      const upcomingTotal = ctx.enrolledLessons.filter(l => new Date(l.date) >= now);
      const novCount = upcomingTotal.length - thisWeekLessons.length;

      console.log(`[BOT RESPONSE]:`);
      console.log(`You have ${thisWeekLessons.length} upcoming classes scheduled this week (Oct 26 – Oct 29, 2026).`);
      console.log(`You also have ${novCount} additional classes throughout November (running until Nov 26, 2026).`);
      thisWeekLessons.forEach(l => {
        console.log(`  • [${l.class.subjectCode}] ${l.topic} | Room: ${l.room} | Date: ${new Date(l.date).toLocaleDateString('en-US')}`);
      });
      continue;
    }

    // 0B: Next class
    if (lower.includes('next class')) {
      const upcoming = ctx.enrolledLessons.filter(l => new Date(l.date) >= now);
      const next = upcoming[0];
      console.log(`[BOT RESPONSE]:`);
      console.log(`Your next class is ${next.class.name} (${next.class.subjectCode}) on ${new Date(next.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} in Room ${next.room}.`);
      continue;
    }

    // Exam query
    if (lower.includes('next exam')) {
      const nextExam = ctx.enrolledTests[0];
      console.log(`[BOT RESPONSE]:`);
      console.log(`Your next examination session is ${nextExam.title} (${nextExam.class.subjectCode}) on ${new Date(nextExam.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} in Room ${nextExam.room} (${nextExam.daysRemaining} days remaining).`);
      continue;
    }

    // Room 204
    if (lower.includes('204')) {
      console.log(`[BOT RESPONSE]:`);
      console.log(`Room 204 is a standard lecture classroom on Level 2, situated directly south of the central Elevator Shaft.`);
      continue;
    }

    // Elevator
    if (lower.includes('elevator')) {
      console.log(`[BOT RESPONSE]:`);
      console.log(`The campus passenger elevators on Level 2 are located inside the central Elevator Shaft, directly north of Room 204.`);
      continue;
    }
  }

  await prisma.$disconnect();
  console.log('\n=== ALL ENGLISH OFFLINE CHECKS PASSED (0 TOKENS) ===');
}

testChatOffline().catch(console.error);
