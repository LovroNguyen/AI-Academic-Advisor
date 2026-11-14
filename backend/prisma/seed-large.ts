import { PrismaClient, Role, AttendanceStatus } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CLASS_DATA = [
  { name: "Machine Learning",           code: "ML201",    credits: 3, semester: "Semester 5" },
  { name: "Mobile Development",         code: "MOB301",   credits: 3, semester: "Semester 5" },
  { name: "Software Engineering",       code: "SE301",    credits: 3, semester: "Semester 5" },
  { name: "Web Development",            code: "WEB201",   credits: 3, semester: "Semester 5" },
  { name: "Database Systems",           code: "DB301",    credits: 3, semester: "Semester 5" },
  { name: "Computer Networks",          code: "NET201",   credits: 3, semester: "Semester 5" },
  { name: "Operating Systems",          code: "OS201",    credits: 3, semester: "Semester 5" },
  { name: "Data Structures Algorithms", code: "DSA202",   credits: 3, semester: "Semester 5" },
  { name: "Deep Learning",              code: "DL401",    credits: 3, semester: "Semester 6" },
  { name: "Cloud Computing",            code: "CLOUD401", credits: 3, semester: "Semester 6" },
  { name: "Cybersecurity Fundamentals", code: "SEC401",   credits: 3, semester: "Semester 6" },
  { name: "DevOps and CI/CD",           code: "DEVOPS401",credits: 3, semester: "Semester 6" },
  { name: "Microservices Architecture", code: "MSA401",   credits: 3, semester: "Semester 6" },
  { name: "React Native Development",   code: "RN401",    credits: 3, semester: "Semester 6" },
  { name: "Data Science Analytics",     code: "DS401",    credits: 3, semester: "Semester 6" },
  { name: "UI UX Design Principles",    code: "UX301",    credits: 2, semester: "Semester 6" },
  { name: "Capstone Project I",         code: "CAP501",   credits: 4, semester: "Semester 7" },
  { name: "Natural Language Processing",code: "NLP501",   credits: 3, semester: "Semester 7" },
  { name: "Blockchain Technology",      code: "BC501",    credits: 3, semester: "Semester 7" },
  { name: "Advanced Database Design",   code: "ADB501",   credits: 3, semester: "Semester 7" },
];

const LESSONS_BY_CODE: Record<string, { topics: string[]; room: string }> = {
  ML201:    { room:"A201", topics:["Intro to ML","Linear Regression","Logistic Regression","Decision Trees","Random Forests","SVM","Neural Networks","Backpropagation","CNNs","RNNs and LSTM"] },
  MOB301:   { room:"B105", topics:["Kotlin Basics","Android Layouts","Jetpack Compose","State ViewModel","Navigation","Networking Retrofit","Room DB","WorkManager","Testing","Deployment"] },
  SE301:    { room:"C202", topics:["SDLC Agile","Requirements Engineering","Architecture Patterns","Clean Code","Git Flow","TDD","CI CD","API Design","Security OWASP","DevOps Docker"] },
  WEB201:   { room:"A103", topics:["HTML5 Semantic","CSS3 Flexbox Grid","JavaScript ES6","React Fundamentals","Hooks","TailwindCSS","State Management","Routing","REST APIs","Performance"] },
  DB301:    { room:"D101", topics:["Relational Model","SQL Basics","Joins Subqueries","Normalization","Indexes","Transactions","Stored Procedures","NoSQL","MongoDB","Redis Caching"] },
  NET201:   { room:"D205", topics:["OSI Model","TCP IP Stack","Routing Switching","DNS DHCP","HTTP HTTPS","Firewalls","VPNs","Network Security","Load Balancing","SDN"] },
  OS201:    { room:"A301", topics:["Processes Threads","CPU Scheduling","Memory Management","Virtual Memory","File Systems","IO Systems","Deadlocks","Synchronization","Shell Scripting","Virtualization"] },
  DSA202:   { room:"B201", topics:["Arrays Linked Lists","Stacks Queues","Trees BST","Heaps","Graphs BFS DFS","Dynamic Programming","Greedy Algorithms","Sorting","Hashing","Complexity Analysis"] },
  DL401:    { room:"Lab1", topics:["Deep Learning Fundamentals","Optimization Techniques","Regularization","CNNs Advanced","Transfer Learning","GANs","Autoencoders","Attention Mechanisms","Transformers","Model Deployment"] },
  CLOUD401: { room:"D301", topics:["Cloud Models","AWS Basics","Azure Fundamentals","GCP Overview","Serverless Functions","Kubernetes","Helm Charts","Cloud Storage","IAM Security","Cost Optimization"] },
  SEC401:   { room:"C301", topics:["Threat Modeling","Cryptography","Authentication","Authorization OAuth","Web App Security","SQL Injection","XSS CSRF","Penetration Testing","Incident Response","Compliance"] },
  DEVOPS401:{ room:"Lab2", topics:["Linux Admin","Docker Basics","Docker Compose","Kubernetes Pods","Helm","Jenkins CI","GitHub Actions","Ansible","Monitoring Prometheus","Logging ELK"] },
  MSA401:   { room:"B301", topics:["Monolith vs Microservices","API Gateway","Service Discovery","Inter Service Comms","Event Sourcing","CQRS","Saga Pattern","Distributed Tracing","Circuit Breaker","Deployment"] },
  RN401:    { room:"B105", topics:["React Native Setup","Navigation","State Redux","Animations","Camera Media","Push Notifications","Offline Storage","Native Modules","Testing","App Store"] },
  DS401:    { room:"D202", topics:["Data Collection","Data Cleaning","EDA","Pandas NumPy","Visualization","Statistical Inference","Regression Models","Classification","Clustering","Dashboard"] },
  UX301:    { room:"C105", topics:["UX Research","Personas Journeys","Wireframing","Figma Basics","Prototyping","Usability Testing","Accessibility WCAG","Design Systems","AB Testing","Handoff Dev"] },
  CAP501:   { room:"Lab3", topics:["Project Scoping","Architecture Design","Sprint 1","Sprint 2","API Development","Frontend Integration","Testing Phase","Code Review","Demo","Retrospective"] },
  NLP501:   { room:"A301", topics:["Text Preprocessing","Bag of Words","TF IDF","Word Embeddings","RNN for NLP","BERT Transformers","Named Entity Recognition","Sentiment Analysis","Machine Translation","LLM"] },
  BC501:    { room:"D401", topics:["Blockchain Fundamentals","Cryptographic Hashing","Consensus Mechanisms","Ethereum Solidity","Smart Contracts","DeFi Concepts","NFTs","Web3 Integration","Security Auditing","Enterprise"] },
  ADB501:   { room:"D101", topics:["Advanced SQL","Query Optimization","Partitioning","Replication","Sharding","Graph Databases","Time Series DB","Columnar Storage","Data Warehousing","Migration"] },
};

const STUDENT_NAMES = [
  "Nguyen Van A","Tran Thi B","Le Van C","Pham Thi D","Hoang Van E",
  "Nguyen Thi F","Tran Van G","Le Thi H","Pham Van I","Hoang Thi J",
  "Vu Van K","Do Thi L","Bui Van M","Dang Thi N","Nguyen Van O",
  "Tran Thi P","Le Van Q","Pham Thi R","Hoang Van S","Nguyen Thi T",
  "Tran Van U","Le Thi V","Pham Van W","Bui Thi X","Vu Van Y",
  "Do Van Z","Dang Thi AA","Ly Van AB","Ngo Thi AC","Cao Van AD",
  "Dinh Thi AE","Tang Van AF","Luong Thi AG","Lam Van AH","Trinh Thi AI",
  "Truong Van AJ","Nguyen Thi AK","Phan Van AL","Vo Thi AM","Ha Van AN",
  "Mai Thi AO","Ngo Van AP","Tran Thi AQ","Le Van AR","Pham Thi AS",
  "Hoang Van AT","Bui Thi AU","Vu Van AV","Do Thi AW","Dang Van AX",
  "Nguyen Thi AY","Tran Van AZ","Le Thi BA","Pham Van BB","Hoang Thi BC",
  "Ly Van BD","Ngo Thi BE","Cao Van BF","Tang Thi BG","Luong Van BH",
];

const CAREERS = ["AI Engineer","Backend Developer","Frontend Developer","Full Stack Developer","Mobile Developer","DevOps Engineer","Data Scientist","Cybersecurity Analyst"];

function pick(arr: any[], count: number): any[] {
  const copy = [...arr];
  const result: any[] = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}

function rand(min: number, max: number, dec = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function gpa(score: number): number {
  if (score >= 8.5) return 4.0;
  if (score >= 7.0) return 3.0;
  if (score >= 5.5) return 2.0;
  if (score >= 4.0) return 1.0;
  return 0.0;
}

async function main() {
  console.log("Seeding database...");

  // Clean
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
  console.log("Cleared data");

  const adminHash   = await bcrypt.hash("admin123", 10);
  const studentHash = await bcrypt.hash("password", 10);

  const admin = await prisma.user.create({
    data: { name: "Academic Admin", email: "admin@fpt.edu.vn", passwordHash: adminHash, role: Role.admin },
  });

  // 60 students
  const students: { id: string; name: string }[] = [];
  for (let i = 0; i < 60; i++) {
    const name  = STUDENT_NAMES[i];
    const slug  = name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "").slice(0, 6);
    const email = i === 0 ? "nva@fpt.edu.vn" : i === 1 ? "ttb@fpt.edu.vn" : `${slug}${i}@fpt.edu.vn`;
    const s = await prisma.user.create({
      data: { name, email, passwordHash: studentHash, role: Role.student },
    });
    students.push({ id: s.id, name: s.name });
    await prisma.learningGoal.create({
      data: { studentId: s.id, goalType: "career_and_gpa", targetCareer: CAREERS[i % CAREERS.length], targetGpa: rand(3.2, 3.8, 2) },
    });
  }
  console.log(`Created ${students.length} students`);

  // 20 classes
  const classes: { id: string; code: string; semester: string }[] = [];
  for (const c of CLASS_DATA) {
    const cls = await prisma.class.create({
      data: { name: c.name, subjectCode: c.code, creditHours: c.credits, semester: c.semester, createdBy: admin.id },
    });
    classes.push({ id: cls.id, code: c.code, semester: c.semester });
  }
  console.log(`Created ${classes.length} classes`);

  // Lessons
  const lessonMap: Record<string, string[]> = {};
  for (const cls of classes) {
    const ld = LESSONS_BY_CODE[cls.code];
    if (!ld) continue;
    lessonMap[cls.id] = [];
    for (let i = 0; i < ld.topics.length; i++) {
      const date = new Date(Date.now() - (ld.topics.length - i) * 7 * 86400000);
      const lesson = await prisma.lesson.create({
        data: { classId: cls.id, topic: ld.topics[i], date, room: ld.room },
      });
      lessonMap[cls.id].push(lesson.id);
    }
  }
  console.log("Created lessons");

  // Enrollment pools
  const s5 = classes.filter(c => c.semester === "Semester 5");
  const s6 = classes.filter(c => c.semester === "Semester 6");
  const s7 = classes.filter(c => c.semester === "Semester 7");

  for (let si = 0; si < students.length; si++) {
    const student      = students[si];
    const enrollCount  = si % 2 === 0 ? 4 : 3;
    let pool: typeof classes;
    if (si < 20)      pool = [...s5, ...s6.slice(0, 4)];
    else if (si < 40) pool = [...s6, ...s5.slice(0, 4)];
    else              pool = [...s7, ...s6.slice(0, 4)];

    const chosen = pick(pool, Math.min(enrollCount, pool.length));

    for (const cls of chosen) {
      await prisma.enrollment.create({ data: { studentId: student.id, classId: cls.id } });

      const lessonIds = lessonMap[cls.id] || [];
      for (let li = 0; li < lessonIds.length; li++) {
        const r = Math.random();
        const status = r < 0.10 ? AttendanceStatus.absent : r < 0.20 ? AttendanceStatus.late : AttendanceStatus.present;
        await prisma.attendance.create({
          data: { studentId: student.id, lessonId: lessonIds[li], status },
        });
      }

      const a = rand(5.5, 9.5), m = rand(5.0, 9.8), f = rand(5.5, 10.0);
      await prisma.grade.create({
        data: { studentId: student.id, classId: cls.id, assignmentAvg: a, midterm: m, finalExam: f, gpaContribution: gpa(a*0.2+m*0.3+f*0.5) },
      });
    }
  }
  console.log("Created enrollments, attendance, grades");

  // Tests
  const now = new Date();
  for (const cls of classes) {
    const info = CLASS_DATA.find(c => c.code === cls.code);
    if (!info) continue;
    const ld = LESSONS_BY_CODE[cls.code];
    await prisma.test.create({
      data: { classId: cls.id, title: `${info.name} - Midterm Exam`, scheduledAt: new Date(now.getTime() + (5 + Math.floor(Math.random()*25))*86400000), room: ld?.room || "A201" },
    });
    if (Math.random() > 0.4) {
      await prisma.test.create({
        data: { classId: cls.id, title: `${info.name} - Final Exam`, scheduledAt: new Date(now.getTime() + (40 + Math.floor(Math.random()*30))*86400000), room: ld?.room || "A201" },
      });
    }
  }
  console.log("Created tests");

  // Roadmap
  const { roadmapData } = await import("./seed-roadmaps");
  for (const chunk of roadmapData) {
    await prisma.roadmapChunk.create({ data: chunk });
  }
  console.log("Inserted roadmap chunks");

  // Default conversation
  const conv = await prisma.conversation.create({ data: { studentId: students[0].id } });
  await prisma.message.create({
    data: { conversationId: conv.id, sender: "ai", content: "Hi Nguyen Van A! I am your AI academic advisor. How can I help you today?", mode: "career" },
  });

  console.log("\nSeed complete!");
  console.log("Admin:     admin@fpt.edu.vn / admin123");
  console.log("Student 1: nva@fpt.edu.vn  / password");
  console.log("Student 2: ttb@fpt.edu.vn  / password");
  console.log(`Classes:   20  |  Students: 60`);
}

main()
  .catch(e => { console.error("Seed error:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
