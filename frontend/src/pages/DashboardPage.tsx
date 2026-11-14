import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DashboardData, TestItem } from '../types';
import {
  Sparkles,
  Clock,
  MapPin,
  ArrowRight,
  ChevronRight,
  Sliders,
  Check,
} from 'lucide-react';

const DAYS = ['All', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

interface TimetableSlot {
  day: string;
  code: string;
  name: string;
  time: string;
  room: string;
  topic: string;
  status: 'present' | 'absent' | 'late' | 'upcoming' | 'unrecorded';
  lecturer: string;
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [upcomingTests, setUpcomingTests] = useState<TestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>('All');
  const [simulatedScore, setSimulatedScore] = useState<number>(8.5);

  useEffect(() => {
    Promise.all([api.get('/users/dashboard'), api.get('/tests/upcoming')])
      .then(([d, t]) => {
        setDashboard(d.data);
        setUpcomingTests(t.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // null = not recorded / not set; the UI shows "—" instead of a made-up value
  const gpa: number | null = dashboard?.gpa ?? null;
  const targetGpa: number | null = dashboard?.goal?.targetGpa ?? null;
  const targetCareer = dashboard?.goal?.targetCareer ?? 'not set';
  const enrolledCourses = dashboard?.enrollments || [];
  const enrolledCount = enrolledCourses.length;
  const totalCredits = enrolledCourses.reduce((acc, e) => acc + (e.class?.creditHours || 3), 0);
  const attendanceRate: number | null = (dashboard as any)?.attendanceRate ?? null;
  const attAtRisk = attendanceRate !== null && attendanceRate < 75;
  const risk = (dashboard as any)?.academicRisk;
  const criticalCourse = risk?.courses?.find((c: any) => c.riskLevel === 'HIGH') || risk?.courses?.find((c: any) => c.riskLevel === 'MODERATE') || risk?.courses?.[0];
  const atRiskList = risk?.courses?.filter((c: any) => c.riskLevel !== 'LOW') || [];

  const studentTimetable: TimetableSlot[] = useMemo(() => {
    const now = new Date();
    return ((dashboard as any)?.weekSchedule || []).map((l: any) => {
      const d = new Date(l.date);
      const status: TimetableSlot['status'] = l.attendance ?? (d >= now ? 'upcoming' : 'unrecorded');
      return {
        day: WEEKDAY[d.getDay()],
        code: l.subjectCode,
        name: l.className,
        time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        room: l.room || 'TBA',
        topic: l.topic,
        status,
        lecturer: l.lecturer || '',
      };
    });
  }, [dashboard]);

  const filteredSchedule = selectedDay === 'All' ? studentTimetable : studentTimetable.filter((t) => t.day === selectedDay);

  const nextExam = useMemo(() => {
    // /tests/upcoming also returns tests from the last 30 days; skip the ones already past.
    const first = upcomingTests.find((t) => (t.daysRemaining ?? -1) >= 0);
    if (first) {
      return {
        title: first.title,
        courseCode: first.class?.subjectCode ?? 'EXAM',
        courseName: first.class?.name ?? 'Course Examination',
        daysRemaining: first.daysRemaining ?? 0,
        room: first.room ?? 'TBA',
      };
    }
    return null;
  }, [upcomingTests]);

  // Projected GPA calculation
  const projectedGpa = useMemo(() => {
    const baseCredits = totalCredits > 0 ? totalCredits : 12;
    const currentTotalPoints = (gpa ?? 0) * baseCredits;
    const simulatedPoints = (simulatedScore / 10) * 4 * 3;
    const finalGpa = (currentTotalPoints + simulatedPoints) / (baseCredits + 3);
    return Math.min(4.0, Math.round(finalGpa * 100) / 100);
  }, [gpa, totalCredits, simulatedScore]);

  const gpaDelta = (projectedGpa - (gpa ?? 0)).toFixed(2);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-xs font-medium text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 font-sans text-slate-900 pb-16">
      {/* ─── 1. MINIMALIST TOP HEADER ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Academic Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, {user?.name ?? 'Alex'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            FPT University · Semester 5 · Career Target: {targetCareer}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/chat')}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-medium text-white transition-all hover:bg-black active:scale-[0.98]"
          >
            <Sparkles size={13} strokeWidth={1.5} className="text-indigo-400" />
            <span>Consult AI Advisor</span>
          </button>
        </div>
      </div>

      {/* ─── 2. MINIMALIST 4-METRIC STRIP ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GPA */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            GPA
          </span>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-indigo-600 font-mono">
              {gpa !== null ? gpa.toFixed(2) : '—'}
            </span>
            <span className="text-xs text-slate-400">/ 4.00</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Target: {targetGpa !== null ? targetGpa.toFixed(2) : 'not set'}</span>
            <span className="text-slate-400">Semester 5</span>
          </div>
        </div>

        {/* Attendance */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Attendance
          </span>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {attendanceRate !== null ? `${attendanceRate}%` : '—'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Cutoff threshold: 75%</span>
            <span className={attAtRisk ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
              {attendanceRate === null ? 'No records yet' : attAtRisk ? '⚠️ At Risk' : 'Eligible'}
            </span>
          </div>
        </div>

        {/* Enrolled Courses */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Enrolled Courses
          </span>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {enrolledCount}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{totalCredits} Credits total</span>
            <span className="text-slate-400">In progress</span>
          </div>
        </div>

        {/* Next Exam */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-sm">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
            Next Exam
          </span>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900">
              {nextExam ? `In ${nextExam.daysRemaining} days` : 'None'}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span className="truncate">{nextExam ? nextExam.title : 'No exams scheduled'}</span>
            {nextExam ? (
              <button
                type="button"
                onClick={() => navigate(`/map?room=${encodeURIComponent(nextExam.room)}`)}
                className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                title="Locate exam room on map"
              >
                <MapPin size={11} strokeWidth={1.5} />
                <span>{nextExam.room}</span>
              </button>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. MAIN SECTION: SCHEDULE & PERFORMANCE + AI SIDE PANEL ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT AREA (8 COLUMNS) ─────────────────────────────────────────── */}
        <div className="lg:col-span-8 space-y-6">
          {/* Weekly Class Schedule Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-5 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Weekly Class Schedule
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scheduled lectures and practical laboratory sessions
                </p>
              </div>

              {/* Day filter pills */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                {DAYS.map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDay(d)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      selectedDay === d
                        ? 'bg-white text-slate-900 shadow-sm font-semibold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Schedule Items */}
            <div className="mt-5 divide-y divide-slate-100">
              {filteredSchedule.length === 0 && (
                <p className="py-6 text-center text-xs text-slate-400">No class sessions scheduled for this period.</p>
              )}
              {filteredSchedule.map((slot, idx) => (
                <div
                  key={`${slot.day}-${slot.code}-${idx}`}
                  className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="w-12 text-center text-xs font-mono font-medium text-slate-400 py-1 bg-slate-50 rounded border border-slate-100">
                      {slot.day}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">
                          {slot.code}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-medium text-slate-800">
                          {slot.name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {slot.topic}
                      </p>
                      <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} strokeWidth={1.5} />
                          {slot.time}
                        </span>
                        <button
                          type="button"
                          onClick={() => navigate(`/map?room=${encodeURIComponent(slot.room)}`)}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline transition-colors font-medium cursor-pointer"
                          title="Locate room on campus map"
                        >
                          <MapPin size={11} strokeWidth={1.5} />
                          <span>{slot.room} · Locate</span>
                        </button>
                        <span>{slot.lecturer}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                        slot.status === 'present'
                          ? 'bg-slate-100 text-slate-700'
                          : 'border border-slate-200 text-slate-500'
                      }`}
                    >
                      {slot.status === 'present' && <Check size={10} strokeWidth={2} />}
                      {{ present: 'Attended', absent: 'Absent', late: 'Late', upcoming: 'Upcoming', unrecorded: 'Not recorded' }[slot.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Course Standings */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Course Standings
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Academic evaluations, midterm scores, and attendance rates
                </p>
              </div>

              <button
                onClick={() => navigate('/grades')}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                <span>Grade Book</span>
                <ArrowRight size={11} strokeWidth={1.5} />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-2">Course</th>
                    <th className="py-2.5 px-2 text-center">Credits</th>
                    <th className="py-2.5 px-2 text-center">Assignment (20%)</th>
                    <th className="py-2.5 px-2 text-center">Midterm (30%)</th>
                    <th className="py-2.5 px-2">Attendance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledCourses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        No courses enrolled yet. Go to My Classes to enroll.
                      </td>
                    </tr>
                  ) : (
                    enrolledCourses.map((e) => {
                      const g = dashboard?.grades?.find((gr) => gr.classId === e.class.id);
                      const assign = g?.assignmentAvg ?? 0;
                      const midterm = g?.midterm ?? 0;
                      const courseRate: number | null =
                        risk?.courses?.find((c: any) => c.classId === e.class.id)?.attendanceRate ?? null;
                      const courseAtRisk = courseRate !== null && courseRate < 75;
                      return (
                        <tr key={e.id || e.class.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-2">
                            <div className="font-mono font-semibold text-slate-900">{e.class.subjectCode}</div>
                            <div className="text-slate-500">{e.class.name}</div>
                          </td>

                          <td className="py-3 px-2 text-center font-mono text-slate-600">
                            {e.class.creditHours}
                          </td>

                          <td className="py-3 px-2 text-center font-mono text-slate-900 font-medium">
                            {assign > 0 ? assign.toFixed(1) : '—'}
                          </td>

                          <td className="py-3 px-2 text-center font-mono text-slate-900 font-medium">
                            {midterm > 0 ? midterm.toFixed(1) : '—'}
                          </td>

                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-medium text-slate-700 min-w-[28px]">
                                {courseRate !== null ? `${courseRate}%` : '—'}
                              </span>
                              <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${courseAtRisk ? 'bg-amber-500' : 'bg-slate-700'}`}
                                  style={{ width: `${Math.min(100, courseRate ?? 0)}%` }}
                                />
                              </div>
                              {courseAtRisk && (
                                <span className="text-[10px] text-amber-600 font-medium">
                                  (Warning)
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT AREA: MINIMALIST AI GUIDANCE & ACTIONS (4 COLUMNS) ─────── */}
        <div className="lg:col-span-4 space-y-6">
          {/* Minimalist AI Guidance Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">
                Minimalist AI Guidance
              </h2>
              <span className="text-[10px] font-mono text-slate-400">AcadAI</span>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                {criticalCourse ? (
                  <>
                    Focus on <strong>{criticalCourse.subjectCode} ({criticalCourse.className})</strong>:{' '}
                    {criticalCourse.finalNeededForTarget != null && targetGpa !== null ? (
                      <>
                        you need <strong>{criticalCourse.finalNeededForTarget > 10 ? 'more than 10' : `${criticalCourse.finalNeededForTarget}+`}</strong> on the final exam to stay on track for your {targetGpa.toFixed(2)} GPA goal.
                      </>
                    ) : criticalCourse.finalNeededToPass != null ? (
                      <>
                        you need <strong>{criticalCourse.finalNeededToPass}+</strong> on the final exam to pass.
                      </>
                    ) : (
                      <>{criticalCourse.reasons?.[0] || 'no grades recorded yet.'}</>
                    )}
                  </>
                ) : (
                  <>
                    No courses are flagged by the early-warning system.
                    {targetGpa === null && ' Set a target GPA on your Profile page to get personalised guidance.'}
                  </>
                )}
              </p>

              {/* Goal Simulation Slider (needs a real GPA to project from) */}
              {gpa !== null && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Simulate Midterm Score:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {simulatedScore.toFixed(1)} / 10
                  </span>
                </div>

                <input
                  type="range"
                  min="5.0"
                  max="10.0"
                  step="0.1"
                  value={simulatedScore}
                  onChange={(e) => setSimulatedScore(parseFloat(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-100 rounded appearance-none"
                />

                <div className="flex items-center justify-between pt-1 text-xs">
                  <span className="text-slate-400">Projected GPA:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-semibold text-slate-900">
                      {projectedGpa.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      ({parseFloat(gpaDelta) >= 0 ? `+${gpaDelta}` : gpaDelta})
                    </span>
                  </div>
                </div>
              </div>
              )}

              <button
                onClick={() => navigate('/chat')}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 text-xs font-medium text-slate-800 hover:bg-slate-100 hover:text-slate-950 transition-colors"
              >
                Open Full AI Advisor Chat
              </button>
            </div>
          </div>

          {/* Academic Notices */}
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900 pb-3 border-b border-slate-100">
              Notices &amp; Alerts
            </h2>

            <div className="mt-4 space-y-3">
              {atRiskList.length > 0 ? (
                atRiskList.map((c: any) => (
                  <div key={c.classId} className="border-l-2 border-amber-500 pl-3 py-0.5">
                    <p className="text-xs font-semibold text-slate-900">
                      {c.isBarred ? '⚠️ Cutoff Alert — ' : c.attWarning ? '⚠️ Attendance Limit — ' : 'Academic Notice — '}
                      {c.subjectCode}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {c.reasons?.[0] || `${c.absentCount}/${c.totalLessons} absences recorded.`}
                    </p>
                    <button
                      onClick={() => navigate(`/attendance?classId=${c.classId}`)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 mt-1"
                    >
                      <span>View attendance roster</span>
                      <ChevronRight size={10} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="border-l-2 border-green-500 pl-3 py-0.5">
                  <p className="text-xs font-medium text-slate-900">
                    {attendanceRate !== null ? <>Eligible &amp; Good Standing</> : 'No alerts'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {attendanceRate !== null
                      ? `Attendance rate is ${attendanceRate}%. All registered courses meet final examination criteria.`
                      : 'No attendance recorded yet.'}
                  </p>
                </div>
              )}

              {nextExam && (
                <div className="border-l-2 border-slate-300 pl-3 py-0.5">
                  <p className="text-xs font-medium text-slate-900">Upcoming Examination</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {nextExam.courseCode} · In {nextExam.daysRemaining} days · Room {nextExam.room}
                  </p>
                  <button
                    onClick={() => navigate('/tests')}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 hover:text-slate-900 mt-1"
                  >
                    <span>Exam schedule &amp; Practice</span>
                    <ChevronRight size={10} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-2">
              Quick Links
            </span>
            <div className="divide-y divide-slate-100 text-xs">
              {[
                { label: 'My Classes', path: '/classes' },
                { label: 'Grade Book', path: '/grades' },
                { label: 'Attendance', path: '/attendance' },
                { label: 'Tests & Exams', path: '/tests' },
              ].map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center justify-between py-2 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <span>{item.label}</span>
                  <ChevronRight size={12} className="text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
