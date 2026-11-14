import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Sparkles, BookOpen } from 'lucide-react';
import { GradeItem } from '../types';
import { courseTotal, letterGrade } from '../utils/grading';

export const GradesPage: React.FC = () => {
  const [grades, setGrades] = useState<GradeItem[]>([]);
  // null = not recorded / not set (shown as "—")
  const [currentGpa, setCurrentGpa] = useState<number | null>(null);
  const [targetGpa, setTargetGpa] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get('/grades/me'), api.get('/users/profile')])
      .then(([gr, pr]) => {
        setGrades(gr.data.grades || []);
        setCurrentGpa(gr.data.currentGpa ?? pr.data?.currentGpa ?? null);
        if (pr.data?.learningGoal?.targetGpa) {
          setTargetGpa(pr.data.learningGoal.targetGpa);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const scores = grades.map((g) => courseTotal(g.assignmentAvg, g.midterm, g.finalExam));

  const best = scores.length > 0 ? Math.max(...scores) : null;
  const worst = scores.length > 0 ? Math.min(...scores) : null;
  const delta = currentGpa !== null && targetGpa !== null ? (targetGpa - currentGpa).toFixed(2) : null;
  const fmt = (n: number | null, digits: number) => (n !== null ? n.toFixed(digits) : '—');

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-xs font-medium text-slate-400">Loading grade transcript...</p>
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
              Academic Performance
            </span>
          </div>
          <h1 className="page-title">Grades &amp; Assessments</h1>
          <p className="page-sub">
            Semester 5 · Current GPA: <strong className="text-slate-900 font-mono">{fmt(currentGpa, 2)}</strong> / 4.00
          </p>
        </div>

        <button className="btn-primary" onClick={() => navigate('/chat')}>
          <Sparkles size={13} strokeWidth={1.5} className="text-indigo-400" />
          <span>Consult AI Advisor</span>
        </button>
      </div>

      {/* ── 4-Stat Strip ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">Cumulative GPA</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-indigo-600 font-mono">
              {fmt(currentGpa, 2)}
            </span>
            <span className="text-xs text-slate-400">/ 4.00</span>
          </div>
          <p className="stat-sub">{currentGpa === null ? 'No grades yet' : currentGpa >= 3.2 ? 'Good standing' : 'Academic attention'}</p>
        </div>

        <div className="stat-card">
          <span className="stat-label">Highest Score</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 font-mono">
              {fmt(best, 1)}
            </span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <p className="stat-sub">Top evaluation</p>
        </div>

        <div className="stat-card">
          <span className="stat-label">Lowest Score</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 font-mono">
              {fmt(worst, 1)}
            </span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <p className="stat-sub">Focus area for final</p>
        </div>

        <div className="stat-card">
          <span className="stat-label">Target GPA</span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 font-mono">
              {targetGpa !== null ? targetGpa.toFixed(2) : '—'}
            </span>
          </div>
          <p className="stat-sub">
            {targetGpa === null ? 'Not set (Profile page)' : delta === null ? '—' : Number(delta) <= 0 ? 'Achieved!' : `-${delta} pts`}
          </p>
        </div>
      </div>

      {/* ── Grade Breakdown Table ─────────────────────────── */}
      <div className="uni-card">
        <div className="uni-card-head">
          <span>Continuous Assessment Breakdown</span>
          <span className="text-xs text-slate-400 font-normal">Weight: 20% Assign · 30% Midterm · 50% Final</span>
        </div>

        {grades.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No grades on record yet</p>
            <p className="text-xs text-slate-400 mt-1">
              You are not enrolled in any graded courses yet, or assessments have not been submitted by instructors.
            </p>
            <button
              onClick={() => navigate('/classes')}
              className="btn-primary mt-4 inline-flex items-center gap-2"
            >
              <BookOpen size={14} />
              <span>View Enrolled Classes</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="uni-table">
              <thead>
                <tr>
                  {['Course', 'Code', 'Credits', 'Assignment 20%', 'Midterm 30%', 'Final 50%', 'Current Score', 'Standing'].map(
                    (h) => (
                      <th key={h} className="uni-th text-center first:text-left">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {grades.map((g) => {
                  const n = courseTotal(g.assignmentAvg, g.midterm, g.finalExam);
                  const overall = n.toFixed(1);
                  const badgeLabel = letterGrade(n);

                  return (
                    <tr key={g.id} className="uni-tr">
                      <td className="uni-td font-semibold text-slate-900">
                        {g.class?.name}
                        {g.isEnrolled === false && (
                          <span className="ml-2 text-[10px] font-normal text-slate-400">(not enrolled; counts toward GPA)</span>
                        )}
                      </td>
                      <td className="uni-td text-center font-mono font-semibold text-indigo-600">
                        {g.class?.subjectCode}
                      </td>
                      <td className="uni-td text-center font-mono text-slate-600">
                        {g.class?.creditHours || 3}
                      </td>
                      <td className="uni-td text-center font-mono text-slate-700">
                        {g.assignmentAvg.toFixed(1)}
                      </td>
                      <td className="uni-td text-center font-mono text-slate-700">
                        {g.midterm.toFixed(1)}
                      </td>
                      <td className="uni-td text-center font-mono text-slate-400">
                        {g.finalExam > 0 ? g.finalExam.toFixed(1) : '—'}
                      </td>
                      <td className="uni-td text-center font-mono font-bold text-slate-900">
                        {overall}
                      </td>
                      <td className="uni-td text-center">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800">
                          {badgeLabel} · {g.gpaContribution.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GradesPage;
