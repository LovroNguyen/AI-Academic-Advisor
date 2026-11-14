import { PrismaClient, Role, AttendanceStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database for AcadAI');

  // 1. Clean existing data
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.grade.deleteMany({});
  await prisma.test.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.learningGoal.deleteMany({});
  await prisma.class.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.roadmapChunk.deleteMany({});

  // 2. Passwords
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const studentPasswordHash = await bcrypt.hash('password', 10);

  // 3. Create Admin
  const admin = await prisma.user.create({
    data: {
      name: 'Academic Admin',
      email: 'admin@fpt.edu.vn',
      passwordHash: adminPasswordHash,
      role: Role.admin,
    },
  });

  // 4. Create Students
  const student1 = await prisma.user.create({
    data: {
      name: 'Nguyen Van A',
      email: 'nva@fpt.edu.vn',
      passwordHash: studentPasswordHash,
      role: Role.student,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      name: 'Tran Thi B',
      email: 'ttb@fpt.edu.vn',
      passwordHash: studentPasswordHash,
      role: Role.student,
    },
  });

  // 5. Learning Goals
  await prisma.learningGoal.create({
    data: {
      studentId: student1.id,
      goalType: 'career_and_gpa',
      targetCareer: 'AI / ML Engineer',
      targetGpa: 3.50,
    },
  });

  await prisma.learningGoal.create({
    data: {
      studentId: student2.id,
      goalType: 'career_and_gpa',
      targetCareer: 'Frontend Developer',
      targetGpa: 3.60,
    },
  });

  // 6. Classes
  const classML = await prisma.class.create({
    data: {
      name: 'Machine Learning',
      subjectCode: 'ML201',
      creditHours: 3,
      semester: 'Semester 5',
      createdBy: admin.id,
    },
  });

  const classMOB = await prisma.class.create({
    data: {
      name: 'Mobile Development',
      subjectCode: 'MOB301',
      creditHours: 3,
      semester: 'Semester 5',
      createdBy: admin.id,
    },
  });

  const classSE = await prisma.class.create({
    data: {
      name: 'Software Engineering',
      subjectCode: 'SE301',
      creditHours: 3,
      semester: 'Semester 5',
      createdBy: admin.id,
    },
  });

  const classWEB = await prisma.class.create({
    data: {
      name: 'Web Development',
      subjectCode: 'WEB201',
      creditHours: 3,
      semester: 'Semester 5',
      createdBy: admin.id,
    },
  });

  const classes = [classML, classMOB, classSE, classWEB];

  // 7. Enroll Students
  for (const c of classes) {
    await prisma.enrollment.create({
      data: { studentId: student1.id, classId: c.id },
    });
    await prisma.enrollment.create({
      data: { studentId: student2.id, classId: c.id },
    });
  }

  // 8. Lessons (10 per class) & Attendance
  const mlTopics = [
    'Introduction to ML & Python Data Stack',
    'Linear Regression & Cost Functions',
    'Logistic Regression & Binary Classification',
    'Decision Trees & Entropy',
    'Random Forests & Ensemble Methods',
    'Support Vector Machines (SVM)',
    'Neural Networks & Perceptrons',
    'Backpropagation & Optimization',
    'Convolutional Neural Networks (CNN Basics)',
    'Recurrent Neural Networks (RNN & LSTM)',
  ];

  const mobTopics = [
    'Mobile App Architecture & Kotlin Basics',
    'Android Layouts & UI Components',
    'Jetpack Compose Declarative UI',
    'State Management & ViewModel',
    'Navigation & Deep Linking',
    'Networking with Retrofit & Coroutines',
    'Local Persistence with Room DB',
    'Background Workers & Push Notifications',
    'App Testing & Mocking',
    'Release & Play Store Deployment',
  ];

  const seTopics = [
    'Software Development Life Cycle & Agile',
    'Requirements Engineering & User Stories',
    'Software Architecture & Design Patterns',
    'Clean Code & Refactoring Strategies',
    'Git Flow & Version Control Workflows',
    'Unit Testing & Test-Driven Development (TDD)',
    'CI/CD Pipelines with GitHub Actions',
    'API Design & RESTful Best Practices',
    'Security & OWASP Top 10',
    'DevOps, Docker & Cloud Deployment',
  ];

  const webTopics = [
    'HTML5 Semantic Markup & Accessibility',
    'Modern CSS3, Flexbox & Grid Systems',
    'JavaScript ES6+ Deep Dive & Async/Await',
    'React Fundamentals: Props & State',
    'Hooks & Custom Hook Design',
    'TailwindCSS & Component Libraries',
    'State Management with Context & Zustand',
    'Client-Side Routing & Protected Routes',
    'Full-Stack Integration with REST APIs',
    'Performance Optimization & Lighthouse 100',
  ];

  const classLessonsData = [
    { classId: classML.id, topics: mlTopics, room: 'A201' },
    { classId: classMOB.id, topics: mobTopics, room: 'B105' },
    { classId: classSE.id, topics: seTopics, room: 'C202' },
    { classId: classWEB.id, topics: webTopics, room: 'A103' },
  ];

  const mlAttendanceStatuses: AttendanceStatus[] = [
    AttendanceStatus.present,
    AttendanceStatus.present,
    AttendanceStatus.absent,
    AttendanceStatus.present,
    AttendanceStatus.late,
    AttendanceStatus.present,
    AttendanceStatus.present,
    AttendanceStatus.absent,
    AttendanceStatus.present,
    AttendanceStatus.absent,
  ];

  for (const cData of classLessonsData) {
    for (let i = 0; i < cData.topics.length; i++) {
      const lessonDate = new Date(Date.now() - (10 - i) * 3 * 24 * 60 * 60 * 1000);
      const lesson = await prisma.lesson.create({
        data: {
          classId: cData.classId,
          topic: cData.topics[i],
          date: lessonDate,
          room: cData.room,
        },
      });

      // Attendance for Student 1
      let s1Status: AttendanceStatus = AttendanceStatus.present;
      if (cData.classId === classML.id) {
        s1Status = mlAttendanceStatuses[i];
      } else if (i === 4) {
        s1Status = AttendanceStatus.late;
      } else if (i === 8) {
        s1Status = AttendanceStatus.absent;
      }

      await prisma.attendance.create({
        data: {
          studentId: student1.id,
          lessonId: lesson.id,
          status: s1Status,
        },
      });

      // Attendance for Student 2
      await prisma.attendance.create({
        data: {
          studentId: student2.id,
          lessonId: lesson.id,
          status: i % 5 === 0 ? AttendanceStatus.late : AttendanceStatus.present,
        },
      });
    }
  }

  // 9. Grades
  // Student 1 grades
  await prisma.grade.create({
    data: {
      studentId: student1.id,
      classId: classML.id,
      assignmentAvg: 7.2,
      midterm: 6.5,
      finalExam: 0,
      gpaContribution: 2.0, // expected grade point
    },
  });

  await prisma.grade.create({
    data: {
      studentId: student1.id,
      classId: classMOB.id,
      assignmentAvg: 8.1,
      midterm: 8.0,
      finalExam: 0,
      gpaContribution: 3.5,
    },
  });

  await prisma.grade.create({
    data: {
      studentId: student1.id,
      classId: classSE.id,
      assignmentAvg: 7.8,
      midterm: 7.5,
      finalExam: 0,
      gpaContribution: 3.0,
    },
  });

  await prisma.grade.create({
    data: {
      studentId: student1.id,
      classId: classWEB.id,
      assignmentAvg: 6.9,
      midterm: 7.0,
      finalExam: 0,
      gpaContribution: 3.0,
    },
  });

  // Student 2 grades
  await prisma.grade.create({
    data: {
      studentId: student2.id,
      classId: classWEB.id,
      assignmentAvg: 9.0,
      midterm: 8.5,
      finalExam: 0,
      gpaContribution: 3.5,
    },
  });

  // 10. Upcoming Tests
  const now = new Date();
  const test1Date = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days left
  const test2Date = new Date(now.getTime() + 11 * 24 * 60 * 60 * 1000); // 11 days left
  const test3Date = new Date(now.getTime() + 26 * 24 * 60 * 60 * 1000); // 26 days left

  await prisma.test.create({
    data: {
      classId: classML.id,
      title: 'Machine Learning — Midterm Exam',
      scheduledAt: test1Date,
      room: 'Room A201',
    },
  });

  await prisma.test.create({
    data: {
      classId: classWEB.id,
      title: 'Web Development — Quiz 2',
      scheduledAt: test2Date,
      room: 'Room B105',
    },
  });

  await prisma.test.create({
    data: {
      classId: classSE.id,
      title: 'Software Engineering — Final Exam',
      scheduledAt: test3Date,
      room: 'Room A101',
    },
  });

  // 11. Roadmap Chunks (from roadmap.sh for AI Engineer, Backend, Frontend, Full Stack)
  const { roadmapData } = await import('./seed-roadmaps');
  for (const chunk of roadmapData) {
    await prisma.roadmapChunk.create({
      data: chunk,
    });
  }

  // 12. Create a default initial conversation for Nguyen Van A
  const conv = await prisma.conversation.create({
    data: {
      studentId: student1.id,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        conversationId: conv.id,
        sender: 'ai',
        content: `Hi Nguyen Van A! I'm your AI academic advisor. I can help you with two things:

🎯 **Career planning** — I'll use industry roadmaps to guide your learning path
📊 **GPA improvement** — I'll analyze your grades and suggest how to improve

What would you like to talk about today?`,
        mode: 'career',
      },
    ],
  });

  console.log('✅ Database seeded successfully!');
  console.log('Admin: admin@fpt.edu.vn / admin123');
  console.log('Student 1: nva@fpt.edu.vn / password');
  console.log('Student 2: ttb@fpt.edu.vn / password');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
