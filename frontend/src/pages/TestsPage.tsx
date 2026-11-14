import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MapPin, Award, CheckCircle, Clock, BookOpen, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { TestItem } from '../types';


// ── Types ──────────────────────────────────────────────────────────────────────
interface QuizQuestion {
  id: number;
  type: 'mcq' | 'short';
  question: string;
  options?: string[];
}

// Answers and explanations are only returned after submission.
interface GradedQuestion extends QuizQuestion {
  answer: string;
  explanation?: string;
  studentAnswer: string;
  correct: boolean | null;
  /** 0–1 points; null = short answer that could not be auto-graded */
  points?: number | null;
  feedback?: string;
}

type QuizState = 'idle' | 'loading' | 'active' | 'submitting' | 'result';

// ── Quiz Modal ─────────────────────────────────────────────────────────────────
const QuizModal: React.FC<{
  test: TestItem;
  onClose: () => void;
}> = ({ test, onClose }) => {
  const [quizState, setQuizState] = useState<QuizState>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(20 * 60); // 20 min
  const [error, setError] = useState('');
  const [quizSource, setQuizSource] = useState<{ source: 'ai' | 'bank'; basedOn: string } | null>(null);

  // Generate quiz on mount
  useEffect(() => {
    api.post(`/tests/${test.id}/generate`)
      .then(r => {
        setQuestions(r.data.questions);
        if (r.data.source) setQuizSource({ source: r.data.source, basedOn: r.data.basedOn });
        setQuizState('active');
      })
      .catch(e => {
        setError(e.response?.data?.message || 'Failed to generate quiz. Please try again.');
        setQuizState('idle');
      });
  }, [test.id]);

  // Timer
  useEffect(() => {
    if (quizState !== 'active') return;
    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [quizState]);

  const handleAnswer = (qId: number, val: string) =>
    setAnswers(prev => ({ ...prev, [qId]: val }));

  const handleSubmit = useCallback(async () => {
    if (quizState !== 'active') return;
    setQuizState('submitting');
    const answerList = Object.entries(answers).map(([id, answer]) => ({
      questionId: parseInt(id), answer,
    }));
    try {
      const r = await api.post(`/tests/${test.id}/submit`, { answers: answerList });
      setResult(r.data);
      setQuizState('result');
    } catch (e: any) {
      setError(e.response?.data?.message || 'Submission failed. Please try again.');
      setQuizState('active');
    }
  }, [quizState, answers, test.id]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const answered = Object.keys(answers).length;
  const q = questions[current];

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>

        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0f172a', borderRadius: '12px 12px 0 0',
        }}>
          <div>
            <div style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              {quizSource?.source === 'bank' ? 'Practice Assessment' : 'AI-Generated Practice Assessment'}
            </div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginTop: 2 }}>{test.title}</div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 2 }}>{test.class?.name} · {test.class?.subjectCode}</div>
          </div>
          {quizState === 'active' && (
            <div style={{
              background: timeLeft < 300 ? '#ef4444' : '#4f46e5',
              color: '#fff', padding: '8px 16px', borderRadius: 8,
              fontFamily: 'monospace', fontWeight: 700, fontSize: 18,
            }}>
              ⏱ {fmt(timeLeft)}
            </div>
          )}
        </div>

        {/* Loading */}
        {quizState === 'loading' && (
          <div style={{ padding: 60, textAlign: 'center' }}>

            <div style={{ fontWeight: 600, color: '#1e40af', fontSize: 16 }}>Preparing your quiz…</div>
            <div style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>Writing questions from your lesson topics and materials</div>
            <div style={{ marginTop: 24 }}>
              <div style={{ height: 4, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: '#3b82f6', borderRadius: 4,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  width: '60%',
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {quizState === 'idle' && error && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>
            <button onClick={onClose} style={{
              marginTop: 20, padding: '8px 20px', background: '#64748b',
              color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
            }}>Close</button>
          </div>
        )}

        {/* Active Quiz */}
        {quizState === 'active' && q && (
          <div style={{ padding: 24 }}>
            {/* Progress bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#3b82f6', borderRadius: 3, width: `${(answered / questions.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{answered}/{questions.length} answered</span>
            </div>
            {quizSource && (
              <div style={{ fontSize: 11, color: '#64748b', marginTop: -12, marginBottom: 16 }}>
                {quizSource.source === 'ai' ? '✨ AI-generated from ' : '📚 '}
                {quizSource.basedOn}
              </div>
            )}

            {/* Question navigation */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {questions.map((qq, i) => (
                <button key={qq.id} onClick={() => setCurrent(i)} style={{
                  width: 32, height: 32, borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: current === i ? '#1e40af' : answers[qq.id] ? '#22c55e' : '#e2e8f0',
                  color: current === i || answers[qq.id] ? '#fff' : '#475569',
                }}>
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Question card */}
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 20, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <span style={{
                  background: q.type === 'mcq' ? '#eff6ff' : '#fef3c7',
                  color: q.type === 'mcq' ? '#1e40af' : '#92400e',
                  fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4, textTransform: 'uppercase',
                  whiteSpace: 'nowrap', marginTop: 2,
                }}>
                  {q.type === 'mcq' ? 'Multiple Choice' : 'Short Answer'}
                </span>
                <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Q{current + 1} of {questions.length}</span>
              </div>
              <p style={{ fontWeight: 600, color: '#0f172a', fontSize: 15, lineHeight: 1.6, margin: '0 0 20px' }}>
                {q.question}
              </p>

              {/* MCQ options */}
              {q.type === 'mcq' && q.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {q.options.map((opt) => {
                    const letter = opt.charAt(0);
                    const isSelected = answers[q.id] === letter;
                    return (
                      <label key={opt} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        background: isSelected ? '#eff6ff' : '#fff', borderRadius: 8, cursor: 'pointer',
                        border: isSelected ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                        transition: 'all 0.15s',
                      }}>
                        <input type="radio" name={`q${q.id}`} value={letter} checked={isSelected}
                          onChange={() => handleAnswer(q.id, letter)} style={{ display: 'none' }} />
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isSelected ? '#3b82f6' : '#e2e8f0', color: isSelected ? '#fff' : '#475569',
                          fontWeight: 700, fontSize: 13, flexShrink: 0,
                        }}>{letter}</div>
                        <span style={{ fontSize: 14, color: '#0f172a' }}>{opt.slice(3)}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {/* Short answer */}
              {q.type === 'short' && (
                <textarea
                  value={answers[q.id] || ''}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  placeholder="Type your answer here…"
                  rows={4}
                  style={{
                    width: '100%', padding: '12px 14px', borderRadius: 8, border: '2px solid #e2e8f0',
                    fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>

            {/* Navigation buttons */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'space-between' }}>
              <button onClick={() => setCurrent(Math.max(0, current - 1))} disabled={current === 0} style={{
                padding: '8px 18px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff',
                color: '#475569', cursor: current === 0 ? 'not-allowed' : 'pointer', opacity: current === 0 ? 0.5 : 1,
              }}>← Previous</button>

              <div style={{ display: 'flex', gap: 10 }}>
                {current < questions.length - 1 && (
                  <button onClick={() => setCurrent(current + 1)} style={{
                    padding: '8px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
                    background: '#f8fafc', color: '#0f172a', cursor: 'pointer', fontWeight: 600,
                  }}>Next →</button>
                )}
                <button onClick={handleSubmit} style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: '#4f46e5', color: '#fff', cursor: 'pointer', fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}>
                  Submit Quiz ({answered}/{questions.length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Submitting */}
        {quizState === 'submitting' && (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 600, color: '#4f46e5' }}>Grading your answers…</div>
          </div>
        )}

        {/* Result screen */}
        {quizState === 'result' && result && (
          <div style={{ padding: 24 }}>
            {/* Score banner */}
            <div style={{
              background: result.score >= 7 ? '#f0fdf4' : result.score >= 5 ? '#fffbeb' : '#fef2f2',
              border: `2px solid ${result.score >= 7 ? '#86efac' : result.score >= 5 ? '#fcd34d' : '#fca5a5'}`,
              borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 24,
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>
                {result.score >= 7 ? '🎉' : result.score >= 5 ? '👍' : '📚'}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: '#0f172a' }}>
                {result.score.toFixed(1)} <span style={{ fontSize: 18, color: '#64748b' }}>/ 10</span>
              </div>
              <div style={{ color: '#64748b', marginTop: 4, fontSize: 14 }}>{result.scoreDisplay}</div>
              {result.attemptId && (
                <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#16a34a', background: '#dcfce7', padding: '4px 12px', borderRadius: 99, fontWeight: 600 }}>
                  <CheckCircle size={13} />
                  <span>Recorded in Academic Learning History</span>
                </div>
              )}
            </div>

            {/* Per-question review */}
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Question Review</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(result.graded as GradedQuestion[]).map((q, i) => (
                <div key={q.id} style={{
                  background: q.correct === true ? '#f0fdf4' : q.correct === false ? '#fef2f2' : '#f8fafc',
                  border: `1px solid ${q.correct === true ? '#86efac' : q.correct === false ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: 8, padding: 16,
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {q.correct === true ? '✅' : q.correct === false ? '❌' : '📝'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a', marginBottom: 6 }}>
                        Q{i + 1}. {q.question}
                      </div>
                      {q.type === 'mcq' && (
                        <div style={{ fontSize: 12, color: '#475569' }}>
                          Your answer: <strong>{q.studentAnswer || '(no answer)'}</strong>
                          {q.correct === false && <> · Correct: <strong style={{ color: '#16a34a' }}>{q.answer}</strong></>}
                        </div>
                      )}
                      {q.type === 'short' && (
                        <div style={{ fontSize: 12, color: '#475569' }}>
                          <div>Your answer: <em>{q.studentAnswer || '(no answer)'}</em></div>
                          <div style={{ marginTop: 4, color: '#64748b' }}>Model answer: <em>{q.answer}</em></div>
                          <div style={{ marginTop: 4 }}>
                            {q.points != null ? (
                              <>AI grade: <strong>{q.points} / 1</strong>{q.feedback ? ` — ${q.feedback}` : ''}</>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>Not auto-graded (not counted in the score)</span>
                            )}
                          </div>
                        </div>
                      )}
                      {q.explanation && (
                        <div style={{
                          marginTop: 8, padding: '6px 10px', background: '#fff',
                          borderRadius: 6, fontSize: 12, color: '#64748b',
                          borderLeft: '3px solid #93c5fd',
                        }}>
                          💡 {q.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={onClose} style={{
              marginTop: 20, width: '100%', padding: '12px', background: '#0f172a',
              color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 600, fontSize: 14,
            }}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  , document.body);
};


// ── Main TestsPage ─────────────────────────────────────────────────────────────
export const TestsPage: React.FC = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestItem[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [activeQuiz, setActiveQuiz] = useState<TestItem | null>(null);

  const fetchAttempts = useCallback(() => {
    api.get('/tests/attempts')
      .then(r => setAttempts(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/tests/upcoming').then(r => setTests(r.data)),
      api.get('/tests/attempts').then(r => setAttempts(r.data)).catch(() => []),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const display = tests;

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Loading...</div>;

  return (
    <div className="fade-in">
      {activeQuiz && (
        <QuizModal
          test={activeQuiz}
          onClose={() => {
            setActiveQuiz(null);
            fetchAttempts();
          }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Exam Milestones &amp; Practice Studio
            </span>
          </div>
          <h1 className="page-title">Tests &amp; Examinations</h1>
          <p className="page-sub">Semester 5 · Continuous Academic Evaluation</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {(['upcoming', 'past'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tab === 'upcoming' ? `Upcoming Exams (${display.length})` : `Practice History (${attempts.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* AI feature notice */}
      <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/50 p-3.5 mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-xs">
            AI
          </span>
          <div>
            <span className="font-semibold text-slate-900 text-xs">AI Practice Simulations Available</span>
            <p className="text-[11px] text-slate-500">
              Click &quot;Practice&quot; on any upcoming exam to synthesize practice questions based on syllabus topics.
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'upcoming' ? (
        <div className="uni-card">
          {display.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 font-medium">
              No upcoming tests or examinations scheduled for your enrolled courses.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="uni-table">
                <thead>
                  <tr>
                    {['Title', 'Subject', 'Date', 'Room', 'Weight', 'Status', 'Practice'].map(h =>
                      <th key={h} className="uni-th">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {display.map((t, i) => {
                    const days = t.daysRemaining ?? Math.ceil((new Date(t.scheduledAt).getTime() - Date.now()) / 86400000);
                    const isPast = days < 0;
                    const isUrgent = !isPast && days <= 5;
                    const isModerate = !isPast && !isUrgent && days <= 14;
                    const weight = t.title.toLowerCase().includes('midterm') ? '30%' : t.title.toLowerCase().includes('quiz') ? '10%' : '50%';
                    const badgeCls = isPast ? 'badge-gray' : isUrgent ? 'badge-red' : isModerate ? 'badge-yellow' : 'badge-blue';
                    const badgeTxt = isPast ? 'Past' : isUrgent ? `${days}d — Urgent` : `${days}d`;

                    return (
                      <tr key={t.id} className="uni-tr" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td className="uni-td" style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</td>
                        <td className="uni-td mono" style={{ fontSize: 12 }}>{t.class?.subjectCode || 'N/A'}</td>
                        <td className="uni-td" style={{ whiteSpace: 'nowrap' }}>
                          {new Date(t.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="uni-td mono" style={{ fontSize: 12 }}>
                          <button
                            type="button"
                            onClick={() => navigate(`/map?room=${encodeURIComponent(t.room)}`)}
                            className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors cursor-pointer"
                            title={`Locate ${t.room} on campus map`}
                          >
                            <MapPin size={11} strokeWidth={1.5} />
                            <span>{t.room}</span>
                          </button>
                        </td>
                        <td className="uni-td" style={{ textAlign: 'center', fontWeight: 600 }}>{weight}</td>
                        <td className="uni-td"><span className={`badge ${badgeCls}`}>{badgeTxt}</span></td>
                        <td className="uni-td">
                          <button
                            onClick={() => setActiveQuiz(t)}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500/20 hover:bg-indigo-100 transition-colors"
                          >
                            Practice
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
        /* ── Past Practice History Tab ── */
        <div className="uni-card">
          {attempts.length === 0 ? (
            <div className="p-12 text-center">
              <Award size={32} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No practice attempts recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Take a practice assessment on any upcoming exam to record your scores and identify knowledge gaps.
              </p>
              <button
                onClick={() => setActiveTab('upcoming')}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
              >
                Go to Upcoming Exams
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="uni-table">
                <thead>
                  <tr>
                    {['#', 'Assessment Target', 'Course', 'Submitted At', 'Score', 'Accuracy', 'Evaluation'].map(h =>
                      <th key={h} className="uni-th">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((att, i) => {
                    const score = att.score ?? 0;
                    const isHigh = score >= 8.0;
                    const isMid = score >= 5.0 && score < 8.0;
                    const evalLabel = isHigh ? 'Mastered' : isMid ? 'Competent' : 'Needs Review';
                    const evalCls = isHigh ? 'badge-green' : isMid ? 'badge-blue' : 'badge-red';

                    return (
                      <tr key={att.id} className="uni-tr" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td className="uni-td mono" style={{ fontSize: 12, color: '#94a3b8' }}>{i + 1}</td>
                        <td className="uni-td" style={{ fontWeight: 600, color: '#0f172a' }}>
                          {att.test?.title || att.lesson?.topic || 'Curriculum Quiz Drill'}
                        </td>
                        <td className="uni-td mono" style={{ fontSize: 12 }}>
                          {att.test?.class?.subjectCode || att.lesson?.class?.subjectCode || 'ACAD'}
                        </td>
                        <td className="uni-td" style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#64748b' }}>
                          {new Date(att.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="uni-td mono font-bold" style={{ fontSize: 13, color: isHigh ? '#16a34a' : isMid ? '#4f46e5' : '#dc2626' }}>
                          {score.toFixed(1)} / 10
                        </td>
                        <td className="uni-td text-xs text-slate-600 font-mono">
                          {att.mcqCorrect} / {att.mcqTotal} correct
                        </td>
                        <td className="uni-td">
                          <span className={`badge ${evalCls}`}>{evalLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
