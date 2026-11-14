const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing Early Warning System (EWS) logic...');

  const student = await prisma.user.findFirst({
    where: { email: 'nva@fpt.edu.vn' },
  });
  if (!student) return console.error('Student not found');

  // Fetch student risk
  const enrollments = await prisma.enrollment.findMany({
    where: { studentId: student.id },
    include: {
      class: {
        include: {
          lessons: true,
          grades: { where: { studentId: student.id } },
        },
      },
    },
  });

  const attendance = await prisma.attendance.findMany({
    where: { studentId: student.id },
    include: { lesson: true },
  });

  console.log(`Evaluated ${enrollments.length} enrolled courses for ${student.name}:`);
  enrollments.forEach((e) => {
    const cls = e.class;
    const classAtt = attendance.filter((a) => a.lesson.classId === cls.id);
    const absences = classAtt.filter((a) => a.status === 'absent').length;
    const maxAllowed = Math.max(1, Math.floor((cls.lessons.length || 10) * 0.25));
    const grade = cls.grades[0];
    const assign = grade?.assignmentAvg || 7.0;
    const midterm = grade?.midterm || 6.5;
    const currentPts = assign * 0.2 + midterm * 0.3;
    const finalNeeded = Math.max(0, parseFloat(((4.0 - currentPts) / 0.5).toFixed(1)));

    console.log(`- Course: ${cls.subjectCode} (${cls.name})`);
    console.log(`  Absences: ${absences}/${cls.lessons.length} (Max allowed: ${maxAllowed})`);
    console.log(`  Midterm: ${midterm}/10 | Final needed to pass: ${finalNeeded}/10`);
    console.log(`  Status: ${absences >= maxAllowed ? '⚠️ CRITICAL WARNING' : '✓ OK'}`);
  });
}

main().finally(() => prisma.$disconnect());

