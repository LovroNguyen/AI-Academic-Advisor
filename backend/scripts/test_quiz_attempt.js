const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Testing QuizAttempt persistence in PostgreSQL...');

  // 1. Find test student Nguyen Van A
  const student = await prisma.user.findFirst({
    where: { email: 'nva@fpt.edu.vn' },
  });
  if (!student) {
    console.error('Student nva@fpt.edu.vn not found!');
    return;
  }
  console.log(`Found student: ${student.name} (${student.id})`);

  // 2. Find any test
  const test = await prisma.test.findFirst();

  // 3. Create a test QuizAttempt
  const attempt = await prisma.quizAttempt.create({
    data: {
      studentId: student.id,
      testId: test ? test.id : null,
      score: 8.5,
      maxScore: 10,
      mcqCorrect: 6,
      mcqTotal: 7,
      submittedAnswers: [
        { questionId: 1, studentAnswer: 'B', correct: true },
        { questionId: 2, studentAnswer: 'C', correct: true },
        { questionId: 3, studentAnswer: 'A', correct: true },
        { questionId: 4, studentAnswer: 'B', correct: true },
        { questionId: 5, studentAnswer: 'C', correct: true },
        { questionId: 6, studentAnswer: 'B', correct: true },
        { questionId: 7, studentAnswer: 'A', correct: false },
      ],
    },
    include: {
      student: { select: { name: true, email: true } },
      test: { select: { title: true, room: true } },
    },
  });

  console.log('✓ Successfully created QuizAttempt in database:');
  console.log({
    id: attempt.id,
    student: attempt.student.name,
    score: attempt.score,
    testTitle: attempt.test?.title,
    createdAt: attempt.createdAt,
  });

  // 4. Retrieve attempts for student
  const attempts = await prisma.quizAttempt.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log(`✓ Retrieved ${attempts.length} attempts for ${student.name}. Latest score: ${attempts[0].score}/10`);
}

main()
  .catch((e) => {
    console.error('Error during test:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

