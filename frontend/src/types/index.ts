export type Role = 'student' | 'admin';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type MessageSender = 'user' | 'ai';
export type MessageMode = 'career' | 'gpa';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt?: string;
}

export interface LearningGoal {
  id: string;
  studentId: string;
  goalType?: string;
  targetCareer?: string;
  targetGpa?: number;
}

export interface ClassItem {
  id: string;
  name: string;
  subjectCode: string;
  creditHours: number;
  semester: string;
  createdBy?: string;
  _count?: {
    enrollments?: number;
    lessons?: number;
    tests?: number;
  };
  isEnrolled?: boolean;
  attendanceRate?: number | null;
  studentGrade?: GradeItem;
}

export interface LessonItem {
  id: string;
  classId: string;
  topic: string;
  date: string;
  room: string;
  class?: ClassItem;
  attendance?: AttendanceItem[];
  myAttendance?: AttendanceItem;
}

export interface AttendanceItem {
  id: string;
  studentId: string;
  lessonId: string;
  status: AttendanceStatus;
  lesson?: LessonItem;
  student?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface GradeItem {
  id: string;
  /** false = graded course the student is no longer enrolled in (still counts toward GPA) */
  isEnrolled?: boolean;
  studentId: string;
  classId: string;
  assignmentAvg: number;
  midterm: number;
  finalExam: number;
  gpaContribution: number;
  rawScore?: number;
  class?: ClassItem;
  student?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface TestItem {
  id: string;
  classId: string;
  title: string;
  scheduledAt: string;
  room: string;
  result?: number;
  class?: ClassItem;
  daysRemaining?: number;
  isUrgent?: boolean;
}

export interface ConversationItem {
  id: string;
  studentId: string;
  startedAt: string;
  messages?: MessageItem[];
  _count?: {
    messages: number;
  };
}

export interface MessageItem {
  id?: string;
  conversationId?: string;
  sender: MessageSender;
  content: string;
  mode: MessageMode;
  sentAt?: string;
}

export interface DashboardData {
  gpa: number;
  grades: GradeItem[];
  enrollments: { id: string; class: ClassItem }[];
  goal: LearningGoal | null;
  conversationsCount: number;
}
