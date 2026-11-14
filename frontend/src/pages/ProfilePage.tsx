import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  User as UserIcon,
  Mail,
  GraduationCap,
  Award,
  Target,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Save,
  Loader2,
  Sparkles,
  ShieldCheck,
  Compass,
} from 'lucide-react';

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  currentGpa: number | null;
  attendanceRate: number | null;
  enrolledClassesCount: number;
  totalCredits: number;
  learningGoal?: {
    targetCareer?: string;
    targetGpa?: number;
    goalType?: string;
  };
  enrolledClasses: Array<{
    id: string;
    name: string;
    subjectCode: string;
    creditHours: number;
    semester: string;
    attendanceRate: number | null;
    studentGrade?: {
      gpaContribution: number;
    } | null;
  }>;
}

const CAREER_OPTIONS = [
  'AI / ML Engineer',
  'Full Stack Developer',
  'Backend Developer',
  'Frontend Developer',
  'Cloud & DevOps Engineer',
  'Data Scientist',
  'Mobile Application Engineer',
  'Software Architect',
];

export const ProfilePage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [targetCareer, setTargetCareer] = useState('AI / ML Engineer');
  const [targetGpa, setTargetGpa] = useState<number>(3.5);
  const [goalType, setGoalType] = useState('career');

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/profile');
      setProfile(res.data);
      setName(res.data.name || '');
      if (res.data.learningGoal) {
        if (res.data.learningGoal.targetCareer) setTargetCareer(res.data.learningGoal.targetCareer);
        if (res.data.learningGoal.targetGpa) setTargetGpa(res.data.learningGoal.targetGpa);
        if (res.data.learningGoal.goalType) setGoalType(res.data.learningGoal.goalType);
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      const res = await api.patch('/users/profile', {
        name,
        targetCareer,
        targetGpa: Number(targetGpa),
        goalType,
      });
      setProfile(res.data);
      if (refreshUser) refreshUser();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to update profile', err);
      alert('Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const initials = (str = '') => {
    const p = str.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : str.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-xs font-medium text-slate-400">Loading student profile...</p>
      </div>
    );
  }

  // null = nothing recorded yet; shown as "—" rather than a made-up value
  const currentGpa = profile?.currentGpa ?? null;
  const attRate = profile?.attendanceRate ?? null;
  const attAtRisk = attRate !== null && attRate < 75;
  const studentCode = profile?.id ? `SE${profile.id.replace(/-/g, '').slice(0, 6).toUpperCase()}` : 'SE170001';

  return (
    <div className="fade-in max-w-6xl mx-auto space-y-6 pb-12">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="inline-flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Student Records &amp; Trajectory
            </span>
          </div>
          <h1 className="page-title">Student Profile</h1>
          <p className="page-sub">
            Academic identity, curriculum enrollment, and professional learning targets
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium shadow-xs">
          <ShieldCheck size={13} className="text-emerald-600" />
          <span>FPT University Verified Student</span>
        </div>
      </div>

      {/* ── Profile Hero Card ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center text-xl font-bold font-mono shadow-md flex-shrink-0">
              {initials(profile?.name || user?.name)}
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900">
                  {profile?.name || user?.name}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/50">
                  {studentCode}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} className="text-slate-400" />
                  {profile?.email}
                </span>
                <span className="inline-flex items-center gap-1">
                  <GraduationCap size={12} className="text-slate-400" />
                  Software Engineering (Bachelor)
                </span>
                <span className="inline-flex items-center gap-1">
                  <Sparkles size={12} className="text-indigo-500" />
                  Semester 5 · FPT Campus
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
            <div className="text-center px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Current GPA
              </span>
              <span className="text-2xl font-bold font-mono text-indigo-600">
                {currentGpa !== null ? currentGpa.toFixed(2) : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block">/ 4.00</span>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div className="text-center px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Attendance
              </span>
              <span className={`text-2xl font-bold font-mono ${attAtRisk ? 'text-amber-600' : 'text-slate-900'}`}>
                {attRate !== null ? `${attRate}%` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block">{attRate === null ? 'No records yet' : attAtRisk ? 'At Risk' : 'Eligible'}</span>
            </div>

            <div className="h-8 w-px bg-slate-200" />

            <div className="text-center px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Credits
              </span>
              <span className="text-2xl font-bold font-mono text-slate-900">
                {profile?.totalCredits ?? 12}
              </span>
              <span className="text-[10px] text-slate-400 block">{profile?.enrolledClassesCount ?? 0} Courses</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Area: Edit Academic Targets Form (7 Cols) ─────── */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Target size={15} className="text-indigo-600" />
                  Career Target &amp; Academic Goals
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your professional milestones and target GPA for AI advisory alignment
                </p>
              </div>

              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 animate-fade-in">
                  <CheckCircle2 size={13} />
                  Saved
                </span>
              )}
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon size={14} className="absolute left-3.5 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target Career Path
                  </label>
                  <div className="relative">
                    <Compass size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <select
                      value={targetCareer}
                      onChange={(e) => setTargetCareer(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10"
                    >
                      {CAREER_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Target GPA (0.00 – 4.00)
                  </label>
                  <div className="relative">
                    <Award size={14} className="absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="number"
                      step="0.05"
                      min="1.0"
                      max="4.0"
                      value={targetGpa}
                      onChange={(e) => setTargetGpa(parseFloat(e.target.value))}
                      required
                      className="w-full border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Academic Focus Description
                </label>
                <textarea
                  rows={3}
                  value={goalType}
                  onChange={(e) => setGoalType(e.target.value)}
                  placeholder="e.g. Preparing for AI Engineer internship and maintaining Good standing on final exams."
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 shadow-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      <span>Save Profile Goals</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Right Area: Enrolled Courses & Standing (5 Cols) ─────── */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen size={15} className="text-indigo-600" />
                Current Enrolled Courses
              </h3>
              <span className="text-[11px] font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {profile?.enrolledClasses?.length || 0} enrolled
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {profile?.enrolledClasses && profile.enrolledClasses.length > 0 ? (
                profile.enrolledClasses.map((cls) => {
                  const att = cls.attendanceRate ?? null;
                  return (
                    <div key={cls.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-indigo-600">
                            {cls.subjectCode}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-xs font-medium text-slate-800 truncate max-w-[170px]">
                            {cls.name}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {cls.creditHours} credits · {cls.semester}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-mono font-semibold ${att !== null && att < 75 ? 'text-amber-600' : 'text-slate-900'}`}>
                          {att !== null ? `${att}%` : '—'}
                        </span>
                        <div className="text-[10px] text-slate-400">attendance</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No courses enrolled currently.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
