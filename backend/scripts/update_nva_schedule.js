const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Updating schedule for student nva@fpt.edu.vn ---');

  const student = await prisma.user.findUnique({
    where: { email: 'nva@fpt.edu.vn' },
    include: {
      enrollments: {
        include: {
          class: {
            include: {
              lessons: { orderBy: { date: 'asc' } },
              tests: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
    console.error('Student nva@fpt.edu.vn not found!');
    process.exit(1);
  }

  console.log(`Found student: ${student.name} (${student.email})`);
  console.log(`Enrolled classes: ${student.enrollments.length}`);

  // Base calendar schedule:
  // Today is Sunday, Oct 25, 2026.
  // Week 6 (Current week) starts Monday, Oct 26, 2026.
  // Week 1 was 5 weeks ago: Monday, Sep 21, 2026.
  // Week 10 is Monday, Nov 23 to Thursday, Nov 26, 2026.
  
  // Weekly Day Offsets (0 = Monday, 1 = Tuesday, 2 = Wednesday, 3 = Thursday):
  // SE301:  Monday (offset 0)
  // DSA202: Tuesday (offset 1)
  // WEB201: Wednesday (offset 2)
  // DL401:  Thursday (offset 3)

  const dayOffsets = {
    SE301: { offset: 0, room: 'C202', time: '07:30' },
    DSA202: { offset: 1, room: 'B201', time: '07:30' },
    WEB201: { offset: 2, room: 'A103', time: '07:30' },
    DL401: { offset: 3, room: 'Lab1', time: '07:30' },
  };

  // Base Monday for Week 1: 2026-09-21T07:30:00+07:00 (UTC 2026-09-21T00:30:00Z)
  const baseWeek1MondayUtc = new Date(Date.UTC(2026, 8, 21, 0, 30, 0)); // Sep is month 8 (0-indexed)

  for (const enrollment of student.enrollments) {
    const cls = enrollment.class;
    const config = dayOffsets[cls.subjectCode] || { offset: 0, room: 'Room 201', time: '07:30' };
    console.log(`\nUpdating lessons for class: ${cls.subjectCode} - ${cls.name}`);

    // Sort lessons by date currently
    const sortedLessons = [...cls.lessons].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (let i = 0; i < sortedLessons.length; i++) {
      const lesson = sortedLessons[i];
      // Week index: i (0 to 9) -> Week 1 to Week 10
      // Week 0: Sep 21
      // Week 5 (index 5): Oct 26 (Current week)
      // Week 6 (index 6): Nov 02
      // Week 7 (index 7): Nov 09
      // Week 8 (index 8): Nov 16
      // Week 9 (index 9): Nov 23
      const lessonDate = new Date(baseWeek1MondayUtc.getTime() + (i * 7 + config.offset) * 24 * 60 * 60 * 1000);

      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          date: lessonDate,
          room: config.room,
        },
      });

      console.log(`  Updated Lesson ${i + 1} (${lesson.topic}): ${lessonDate.toISOString()} | Room: ${config.room}`);
    }

    // Now update or configure tests for this class
    // Clear old tests and recreate standard Midterm (late Oct / early Nov) and Final (late Nov / early Dec)
    await prisma.test.deleteMany({
      where: { classId: cls.id },
    });

    // Schedule Midterm and Final
    let midtermDate, finalDate;
    if (cls.subjectCode === 'DSA202') {
      midtermDate = new Date(Date.UTC(2026, 9, 30, 1, 0, 0)); // Fri Oct 30, 08:00 AM VN
      finalDate = new Date(Date.UTC(2026, 10, 27, 1, 0, 0));  // Fri Nov 27, 08:00 AM VN
    } else if (cls.subjectCode === 'SE301') {
      midtermDate = new Date(Date.UTC(2026, 10, 6, 1, 0, 0));  // Fri Nov 6, 08:00 AM VN
      finalDate = new Date(Date.UTC(2026, 10, 30, 1, 0, 0));  // Mon Nov 30, 08:00 AM VN
    } else if (cls.subjectCode === 'WEB201') {
      midtermDate = new Date(Date.UTC(2026, 10, 13, 1, 0, 0)); // Fri Nov 13, 08:00 AM VN
      finalDate = new Date(Date.UTC(2026, 11, 4, 1, 0, 0));   // Fri Dec 4, 08:00 AM VN
    } else { // DL401
      midtermDate = new Date(Date.UTC(2026, 10, 20, 1, 0, 0)); // Fri Nov 20, 08:00 AM VN
      finalDate = new Date(Date.UTC(2026, 11, 2, 1, 0, 0));   // Wed Dec 2, 08:00 AM VN
    }

    await prisma.test.create({
      data: {
        classId: cls.id,
        title: `${cls.name} — Midterm Exam`,
        scheduledAt: midtermDate,
        room: config.room,
      },
    });

    await prisma.test.create({
      data: {
        classId: cls.id,
        title: `${cls.name} — Final Examination`,
        scheduledAt: finalDate,
        room: config.room,
      },
    });

    console.log(`  Created Midterm Exam on ${midtermDate.toISOString()} at ${config.room}`);
    console.log(`  Created Final Exam on ${finalDate.toISOString()} at ${config.room}`);
  }

  console.log('\n--- Schedule update completed successfully! ---');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
