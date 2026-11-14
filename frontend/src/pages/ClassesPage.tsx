import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ClassItem } from '../types';
import { ArrowRight, ShieldCheck, AlertTriangle, PlusCircle, CheckCircle } from 'lucide-react';

export const ClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [activeTab, setActiveTab] = useState<'enrolled' | 'catalog'>('enrolled');
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchClasses = () => {
    api
      .get('/classes')
      .then((r) => setClasses(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleEnroll = async (classId: string) => {
    setEnrollingId(classId);
    try {
      await api.post(`/classes/${classId}/enroll`);
      fetchClasses();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to enroll in course');
    } finally {
      setEnrollingId(null);
    }
  };

  const enrolledClasses = classes.filter((c) => c.isEnrolled);
  const catalogClasses = classes.filter((c) => !c.isEnrolled);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-xs font-medium text-slate-400">Loading courses...</p>
      </div>
    );
  }

  return (
    <div className="fade-in max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Academic Curriculum
            </span>
          </div>
          <h1 className="page-title">My Classes</h1>
          <p className="page-sub">Semester 5 · {enrolledClasses.length} Enrolled Courses</p>
        </div>

        {/* Tab pills */}
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            onClick={() => setActiveTab('enrolled')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'enrolled'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Enrolled Courses ({enrolledClasses.length})
          </button>
          <button
            onClick={() => setActiveTab('catalog')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'catalog'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Course Catalog ({catalogClasses.length})
          </button>
        </div>
      </div>

      {/* ── Enrolled Courses Tab ────────────────────────────── */}
      {activeTab === 'enrolled' ? (
        <div className="uni-card">
          {enrolledClasses.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No courses enrolled yet</p>
              <p className="text-xs text-slate-400 mt-1">
                You have not registered for any courses this semester.
              </p>
              <button
                onClick={() => setActiveTab('catalog')}
                className="btn-primary mt-4 inline-flex items-center gap-2"
              >
                <PlusCircle size={14} />
                <span>Browse Course Catalog</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="uni-table">
                <thead>
                  <tr>
                    {['Course', 'Code', 'Credits', 'Semester', 'Attendance', 'Grade / GPA', 'Status', ''].map(
                      (h) => (
                        <th key={h} className="uni-th">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledClasses.map((cls) => {
                    const att: number | null = cls.attendanceRate ?? null; // null = no lessons recorded yet
                    const gradeScore = cls.studentGrade
                      ? cls.studentGrade.gpaContribution.toFixed(1)
                      : null;
                    const atRisk = att !== null && att < 75;

                    return (
                      <tr key={cls.id} className="uni-tr">
                        <td className="uni-td">
                          <div className="font-semibold text-slate-900">{cls.name}</div>
                          <div className="text-[11px] text-slate-400">{cls.semester}</div>
                        </td>
                        <td className="uni-td font-mono text-xs font-semibold text-indigo-600">
                          {cls.subjectCode}
                        </td>
                        <td className="uni-td text-center font-mono text-slate-600">
                          {cls.creditHours}
                        </td>
                        <td className="uni-td text-xs text-slate-600 whitespace-nowrap">
                          {cls.semester}
                        </td>
                        <td className="uni-td">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-semibold ${atRisk ? 'text-amber-600' : 'text-slate-900'}`}>
                              {att !== null ? `${att}%` : '—'}
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  atRisk ? 'bg-amber-500' : 'bg-indigo-600'
                                }`}
                                style={{ width: `${Math.min(100, att ?? 0)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="uni-td font-mono text-xs font-medium text-slate-900">
                          {gradeScore ? (
                            <span className="font-semibold text-indigo-600 font-mono">
                              {gradeScore} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">In progress</span>
                          )}
                        </td>
                        <td className="uni-td">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded ${
                              atRisk
                                ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-500/20'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {atRisk ? (
                              <>
                                <AlertTriangle size={10} className="text-amber-600" />
                                At Risk (&lt;75%)
                              </>
                            ) : (
                              <>
                                <ShieldCheck size={10} className="text-slate-500" />
                                Good Standing
                              </>
                            )}
                          </span>
                        </td>
                        <td className="uni-td text-right">
                          <button
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                            onClick={() => navigate(`/attendance?classId=${cls.id}`)}
                          >
                            <span>Attendance</span>
                            <ArrowRight size={11} strokeWidth={1.5} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ── Course Catalog Tab ───────────────────────────────── */
        <div className="uni-card">
          <div className="overflow-x-auto">
            <table className="uni-table">
              <thead>
                <tr>
                  {['Course Name', 'Subject Code', 'Credits', 'Semester', 'Enrolled Students', 'Action'].map(
                    (h) => (
                      <th key={h} className="uni-th">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalogClasses.map((cls) => (
                  <tr key={cls.id} className="uni-tr">
                    <td className="uni-td">
                      <div className="font-semibold text-slate-900">{cls.name}</div>
                      <div className="text-[11px] text-slate-400">Available Curriculum</div>
                    </td>
                    <td className="uni-td font-mono text-xs font-semibold text-indigo-600">
                      {cls.subjectCode}
                    </td>
                    <td className="uni-td text-center font-mono text-slate-600">
                      {cls.creditHours}
                    </td>
                    <td className="uni-td text-xs text-slate-600 whitespace-nowrap">
                      {cls.semester}
                    </td>
                    <td className="uni-td text-xs text-slate-500 font-mono">
                      {cls._count?.enrollments ?? 0} students
                    </td>
                    <td className="uni-td">
                      <button
                        onClick={() => handleEnroll(cls.id)}
                        disabled={enrollingId === cls.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors text-xs font-semibold disabled:opacity-50"
                      >
                        <PlusCircle size={12} />
                        <span>{enrollingId === cls.id ? 'Enrolling...' : 'Enroll Course'}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassesPage;
