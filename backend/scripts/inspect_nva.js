const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const u = await prisma.user.findUnique({
    where: { email: 'nva@fpt.edu.vn' },
    include: {
      enrollments: {
        include: {
          class: {
            include: {
              lessons: { orderBy: { date: 'asc' } },
              tests: { orderBy: { scheduledAt: 'asc' } }
            }
          }
        }
      }
    }
  });

  if (!u) {
    console.log('User nva@fpt.edu.vn not found!');
    return;
  }

  console.log('User:', u.id, u.name, u.email);
  console.log('Enrolled classes count:', u.enrollments.length);
  u.enrollments.forEach(e => {
    console.log(`Class: ${e.class.subjectCode} - ${e.class.name} (ID: ${e.class.id})`);
    console.log(`  Lessons count: ${e.class.lessons.length}`);
    e.class.lessons.forEach((l, idx) => {
      console.log(`    Lesson ${idx + 1}: ${l.date.toISOString()} | ${l.topic} | Room: ${l.room}`);
    });
    console.log(`  Tests count: ${e.class.tests.length}`);
    e.class.tests.forEach((t, idx) => {
      console.log(`    Test ${idx + 1}: ${t.scheduledAt.toISOString()} | ${t.title} | Room: ${t.room}`);
    });
  });

  await prisma.$disconnect();
}

check().catch(console.error);
