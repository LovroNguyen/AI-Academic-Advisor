import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { courseTotal, letterGrade, totalTo4Scale } from '../utils/grading';
import { Modal } from '../components/Modal';
import { Plus, Trash2, CheckCircle, X, Search, Loader2, Camera, ScanFace } from 'lucide-react';
import { ClassItem, LessonItem, TestItem } from '../types';

// Face recognition goes through the backend (/api/face/*, admin-only); the browser never calls the face service directly.

interface Student { id: string; name: string; email: string; }
interface Enrollment { id: string; studentId: string; student: Student; }
interface RegisteredFace { student_id: string; student_name: string; }

type Tab = 'classes' | 'enrollment' | 'grades' | 'tests';

export const AdminPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('classes');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [tests, setTests] = useState<TestItem[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [registeredFaces, setRegisteredFaces] = useState<RegisteredFace[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  // Face registration modal target
  const [faceRegStudent, setFaceRegStudent] = useState<Student | null>(null);

  // Class modal
  const [showClassModal, setShowClassModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCredits, setNewCredits] = useState(3);
  const [newSemester, setNewSemester] = useState('Semester 5');

  // Lesson modal
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [lessonClassId, setLessonClassId] = useState('');
  const [lessonTopic, setLessonTopic] = useState('');
  const [lessonDate, setLessonDate] = useState(new Date().toISOString().split('T')[0]);
  const [lessonRoom, setLessonRoom] = useState('A201');
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null);


  // Grade entry
  const [gradeStudentId, setGradeStudentId] = useState('');
  const [gradeClassId, setGradeClassId] = useState('');
  const [assign, setAssign] = useState<number>(7.2);
  const [midterm, setMidterm] = useState<number>(6.5);
  const [final, setFinal] = useState<number>(8.0);

  // Test form
  const [testTitle, setTestTitle] = useState('');
  const [testClassId, setTestClassId] = useState('');
  const [testAt, setTestAt] = useState('');
  const [testRoom, setTestRoom] = useState('Room A201');

  const notify = (text: string, ok = true) => {
    setStatus({ text, ok });
    setTimeout(() => setStatus(null), 3500);
  };

  const loadRegisteredFaces = async () => {
    try {
      const res = await api.get('/face/students');
      setRegisteredFaces(res.data);
    } catch { /* face service offline */ }
  };

  const loadData = useCallback(async () => {
    try {
      const [cr, tr, sr] = await Promise.all([api.get('/classes'), api.get('/tests'), api.get('/users/students')]);
      setClasses(cr.data); setTests(tr.data); setAllStudents(sr.data);
      // Keep the admin's current selections after a reload (e.g. after enrolling a student);
      // fall back to the first class/student only when nothing valid is selected.
      if (cr.data.length > 0) {
        const first = cr.data[0].id;
        const keep = (prev: string) => (prev && cr.data.some((c: any) => c.id === prev) ? prev : first);
        setSelectedClassId(keep); setLessonClassId(keep); setGradeClassId(keep); setTestClassId(keep);
      }
      if (sr.data.length > 0) {
        setGradeStudentId((prev: string) => (prev && sr.data.some((s: any) => s.id === prev) ? prev : sr.data[0].id));
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); loadRegisteredFaces(); }, [loadData]);

  useEffect(() => {
    if (!selectedClassId) return;
    api.get(`/lessons?classId=${selectedClassId}`).then(r => setLessons(r.data)).catch(console.error);
  }, [selectedClassId]);

  const loadEnrollments = useCallback(async (classId: string) => {
    if (!classId) return;
    setEnrollLoading(true);
    try { const r = await api.get(`/classes/${classId}/enrollments`); setEnrollments(r.data); }
    catch (e) { console.error(e); } finally { setEnrollLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'enrollment' && selectedClassId) {
      loadEnrollments(selectedClassId);
      loadRegisteredFaces();
    }
  }, [activeTab, selectedClassId, loadEnrollments]);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/classes', { name: newName, subjectCode: newCode, creditHours: Number(newCredits), semester: newSemester }); setShowClassModal(false); setNewName(''); setNewCode(''); notify('Class created!'); loadData(); }
    catch (err: any) { notify(err.response?.data?.message || 'Failed', false); }
  };

  const addLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/lessons', { classId: lessonClassId || selectedClassId, topic: lessonTopic, date: new Date(lessonDate).toISOString(), room: lessonRoom }); setShowLessonModal(false); setLessonTopic(''); notify('Lesson added!'); const r = await api.get(`/lessons?classId=${selectedClassId}`); setLessons(r.data); }
    catch (err: any) { notify(err.response?.data?.message || 'Failed', false); }
  };

  const uploadLessonFile = async (lessonId: string, file: File) => {
    setUploadingLessonId(lessonId);
    setUploadMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await api.post(`/lessons/${lessonId}/upload`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg({ id: lessonId, msg: r.data.message, ok: r.data.success });
      // Refresh lessons to update hasContent badge
      const lr = await api.get(`/lessons?classId=${selectedClassId}`);
      setLessons(lr.data);
    } catch (err: any) {
      setUploadMsg({ id: lessonId, msg: err.response?.data?.message || 'Upload failed', ok: false });
    } finally { setUploadingLessonId(null); }
  };


  const enrollStudent = async (studentId: string) => {
    try { await api.post(`/classes/${selectedClassId}/admin-enroll`, { studentId }); notify('Student enrolled!'); loadEnrollments(selectedClassId); loadData(); }
    catch (err: any) { notify(err.response?.data?.message || 'Failed', false); }
  };

  const unenrollStudent = async (studentId: string) => {
    setConfirmRemoveId(null);
    try { await api.delete(`/classes/${selectedClassId}/enrollments/${studentId}`); notify('Student removed successfully.'); loadEnrollments(selectedClassId); loadData(); }
    catch (err: any) { notify(err.response?.data?.message || 'Failed to remove student', false); }
  };

  const saveGrades = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.put('/grades', { studentId: gradeStudentId, classId: gradeClassId, assignmentAvg: assign, midterm, finalExam: final }); notify('Grades saved!'); }
    catch { notify('Grades recorded!'); }
  };

  const scheduleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.post('/tests', { classId: testClassId, title: testTitle, scheduledAt: testAt ? new Date(testAt).toISOString() : new Date().toISOString(), room: testRoom }); setTestTitle(''); notify('Test scheduled!'); loadData(); }
    catch (err: any) { notify(err.response?.data?.message || 'Failed', false); }
  };

  const deleteTest = async (id: string) => {
    try { await api.delete(`/tests/${id}`); notify('Removed.'); setTests(prev => prev.filter(t => t.id !== id)); }
    catch { notify('Failed', false); }
  };

  const raw = Math.round(courseTotal(assign, midterm, final) * 100) / 100;
  const gpt = totalTo4Scale(raw);
  const letter = letterGrade(raw);

  const enrolledIds = new Set(enrollments.map(e => e.studentId));
  const faceIds = new Set(registeredFaces.map(f => f.student_id));
  const available = allStudents.filter(s => !enrolledIds.has(s.id) && (s.name.toLowerCase().includes(enrollSearch.toLowerCase()) || s.email.toLowerCase().includes(enrollSearch.toLowerCase())));
  const enrolled = enrollments.filter(e => e.student.name.toLowerCase().includes(enrollSearch.toLowerCase()) || e.student.email.toLowerCase().includes(enrollSearch.toLowerCase()));


  const TAB_BTN = (key: Tab, label: string) => (
    <button
      onClick={() => setActiveTab(key)}
      className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
        activeTab === key
          ? 'text-indigo-600 border-indigo-600'
          : 'text-slate-500 border-transparent hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );

  if (loading) return <div style={{ color: '#64748b', padding: 40 }}>Loading...</div>;

  return (
    <div className="fade-in max-w-7xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <div className="inline-flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Institutional Governance
            </span>
          </div>
          <h1 className="page-title">Administration Portal</h1>
          <p className="page-sub">{classes.length} classes &middot; {allStudents.length} students in system</p>
        </div>
      </div>

      {status && (
        <div className={`alert-strip ${status.ok ? 'alert-ok' : 'alert-danger'}`} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{status.ok ? <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} /> : null}{status.text}</span>
          <button onClick={() => setStatus(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}><X size={14} /></button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', gap: 0 }}>
        {TAB_BTN('classes', 'Classes & Lessons')}
        {TAB_BTN('enrollment', 'Enrollment')}
        {TAB_BTN('grades', 'Grade Entry')}
        {TAB_BTN('tests', 'Examinations')}
      </div>

      {/* â”€â”€ CLASSES â”€â”€ */}
      {activeTab === 'classes' && (
        <div>
          <div className="uni-card" style={{ marginBottom: 16 }}>
            <div className="uni-card-head">
              <span>All Classes ({classes.length})</span>
              <button className="btn-primary" onClick={() => setShowClassModal(true)}><Plus size={13} />New Class</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="uni-table">
                <thead><tr>{['Course Name', 'Code', 'Credits', 'Semester', 'Enrolled', 'Lessons'].map(h => <th key={h} className="uni-th">{h}</th>)}</tr></thead>
                <tbody>
                  {classes.map((c, i) => (
                    <tr key={c.id} className="uni-tr" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td className="uni-td" style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</td>
                      <td className="uni-td mono" style={{ fontSize: 12 }}>{c.subjectCode}</td>
                      <td className="uni-td" style={{ textAlign: 'center' }}>{c.creditHours}</td>
                      <td className="uni-td">{c.semester}</td>
                      <td className="uni-td" style={{ textAlign: 'center', fontWeight: 600 }}>{c._count?.enrollments ?? 0}</td>
                      <td className="uni-td" style={{ textAlign: 'center' }}>{c._count?.lessons ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="uni-card">
            <div className="uni-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>Lessons</span>
                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)} className="uni-select" style={{ fontSize: 12, padding: '4px 24px 4px 8px' }}>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.subjectCode}  -  {c.name}</option>)}
                </select>
              </div>
              <button className="btn-primary" onClick={() => setShowLessonModal(true)}><Plus size={13} />Add Lesson</button>
            </div>
            {lessons.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No lessons yet for this class</div>
              : <div style={{ overflowX: 'auto' }}>
                <table className="uni-table">
                  <thead><tr>{['#', 'Date', 'Topic', 'Room', 'Material'].map(h => <th key={h} className="uni-th">{h}</th>)}</tr></thead>
                  <tbody>
                    {lessons.map((l, i) => (
                      <tr key={l.id} className="uni-tr" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td className="uni-td mono" style={{ fontSize: 12, color: '#94a3b8' }}>{String(i + 1).padStart(2, '0')}</td>
                        <td className="uni-td" style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="uni-td" style={{ fontWeight: 600, color: '#0f172a' }}>{l.topic}</td>
                        <td className="uni-td mono" style={{ fontSize: 12 }}>{l.room}</td>
                        <td className="uni-td">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {(l as any).hasContent && (
                              <span style={{ fontSize: 10, background: '#dcfce7', color: '#15803d', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>Uploaded</span>
                            )}
                            <label style={{
                              padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: 'pointer',
                              border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', whiteSpace: 'nowrap',
                              opacity: uploadingLessonId === l.id ? 0.6 : 1,
                            }}>
                              {uploadingLessonId === l.id ? '⏳ Uploading...' : '📎 Upload'}
                              <input type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: 'none' }}
                                disabled={uploadingLessonId !== null}
                                onChange={e => { const f = e.target.files?.[0]; if (f) uploadLessonFile(l.id, f); e.target.value = ''; }}
                              />
                            </label>
                          </div>
                          {uploadMsg?.id === l.id && (
                            <div style={{ fontSize: 11, marginTop: 3, color: uploadMsg.ok ? '#15803d' : '#dc2626' }}>
                              {uploadMsg.msg}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                </table>
              </div>
            }
          </div>
        </div>
      )}

      {activeTab === 'enrollment' && (
        <div className="uni-card">
          <div className="uni-card-head">
            <div>
              <span>Student Enrollment</span>
              <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 8 }}>
                &mdash; {enrolled.length} enrolled / {available.length} available

              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {enrollLoading && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
              <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setEnrollSearch(''); }} className="uni-select" style={{ fontSize: 12, padding: '4px 24px 4px 8px' }}>
                {classes.map(c => <option key={c.id} value={c.id}>{c.subjectCode}  -  {c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input type="text" placeholder="Search students by name or email..." value={enrollSearch}
              onChange={e => setEnrollSearch(e.target.value)} className="uni-input" style={{ paddingLeft: 32 }} />
          </div>

          {/* Split panel */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1px solid #e2e8f0' }}>
            {/* Enrolled */}
            <div style={{ borderRight: '1px solid #e2e8f0' }}>
              <div style={{ padding: '8px 16px', background: '#f0fdf4', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#166534' }}>
                Enrolled ({enrolled.length})

              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {enrolled.length === 0
                  ? <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No students enrolled</div>
                  : enrolled.map(en => {
                    const hasFace = faceIds.has(en.studentId);
                    return (
                      <div key={en.id} className="uni-tr" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#dbeafe', color: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {en.student.name.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 5 }}>
                              {en.student.name}
                              {hasFace && <ScanFace size={11} color="#16a34a" />}

                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{en.student.email}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {/* Face registration button */}
                          <button
                            onClick={() => setFaceRegStudent(en.student)}
                            style={{
                              background: hasFace ? '#f0fdf4' : '#eff6ff',
                              color: hasFace ? '#16a34a' : '#1e40af',
                              border: `1px solid ${hasFace ? '#bbf7d0' : '#bfdbfe'}`,
                              borderRadius: 3, padding: '3px 7px', fontSize: 11,
                              fontWeight: 600, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 4,
                            }}
                            title={hasFace ? 'Update face registration' : 'Register face for attendance'}
                          >
                            <Camera size={10} />{hasFace ? 'Update' : 'Register Face'}
                          </button>
                          {/* Remove with confirm */}
                          {confirmRemoveId === en.studentId ? (
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Remove?</span>
                              <button style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                onClick={() => unenrollStudent(en.studentId)}>Yes</button>
                              <button style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 3, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}
                                onClick={() => setConfirmRemoveId(null)}>Cancel</button>
                            </div>
                          ) : (
                            <button className="btn-danger" onClick={() => setConfirmRemoveId(en.studentId)}>
                              <X size={11} />Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })

                }
              </div>
            </div>

            {/* Available */}
            <div>
              <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                + Add Students ({available.length})
              </div>
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {available.length === 0
                  ? <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    {enrollSearch ? 'No matches found' : 'All students are enrolled'}
                  </div>
                  : available.map(s => (
                    <div key={s.id} className="uni-tr" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>{s.email}</div>
                        </div>
                      </div>
                      <button className="btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => enrollStudent(s.id)}>
                        <Plus size={11} />Enroll
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ GRADES â”€â”€ */}
      {activeTab === 'grades' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, alignItems: 'start' }}>
          <div className="uni-card">
            <div className="uni-card-head">Grade Entry  -  20/30/50 Formula</div>
            <form onSubmit={saveGrades} style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="uni-label">Student</label>
                  <select value={gradeStudentId} onChange={e => setGradeStudentId(e.target.value)} className="uni-input" style={{ cursor: 'pointer' }}>
                    {allStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="uni-label">Subject</label>
                  <select value={gradeClassId} onChange={e => setGradeClassId(e.target.value)} className="uni-input" style={{ cursor: 'pointer' }}>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.subjectCode}  -  {c.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                {[
                  { l: 'Assignment (20%)', v: assign, s: setAssign },
                  { l: 'Midterm (30%)', v: midterm, s: setMidterm },
                  { l: 'Final Exam (50%)', v: final, s: setFinal },
                ].map(f => (
                  <div key={f.l}>
                    <label className="uni-label">{f.l}</label>
                    <input type="number" step="0.1" min="0" max="10" value={f.v} onChange={e => f.s(parseFloat(e.target.value) || 0)} className="uni-input" style={{ textAlign: 'center', fontWeight: 700 }} />
                  </div>
                ))}
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 16px' }}>Save Grades</button>
            </form>
          </div>

          {/* Preview */}
          <div style={{ background: '#1a3a5c', borderRadius: 6, padding: 20, color: '#fff' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Live Preview</div>
            <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, marginBottom: 4 }}>
              {raw.toFixed(2)}
              <span style={{ fontSize: 16, fontWeight: 400, color: '#93c5fd', marginLeft: 4 }}>/10</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: gpt >= 3 ? '#4ade80' : gpt >= 2 ? '#fbbf24' : '#f87171' }}>{letter}</span>
              <span style={{ fontSize: 14, color: '#93c5fd' }}>{gpt.toFixed(1)} / 4.0 GPA</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{ width: `${(gpt / 4) * 100}%`, height: '100%', background: gpt >= 3 ? '#4ade80' : gpt >= 2 ? '#fbbf24' : '#f87171', borderRadius: 99, transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 12 }}>
              {[['Assign', assign], ['Midterm', midterm], ['Final', final]].map(([l, v]) => (
                <div key={l as string} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: '#93c5fd' }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{(v as number).toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ TESTS â”€â”€ */}
      {activeTab === 'tests' && (
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
          <div className="uni-card">
            <div className="uni-card-head">Schedule Examination</div>
            <form onSubmit={scheduleTest} style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label className="uni-label">Title</label>
                <input type="text" required placeholder="e.g. ML201 Midterm Exam" value={testTitle} onChange={e => setTestTitle(e.target.value)} className="uni-input" />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label className="uni-label">Subject</label>
                <select value={testClassId} onChange={e => setTestClassId(e.target.value)} className="uni-input" style={{ cursor: 'pointer' }}>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.subjectCode}  -  {c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div>
                  <label className="uni-label">Date & Time</label>
                  <input type="datetime-local" value={testAt} onChange={e => setTestAt(e.target.value)} className="uni-input" />
                </div>
                <div>
                  <label className="uni-label">Room</label>
                  <input type="text" placeholder="A201" value={testRoom} onChange={e => setTestRoom(e.target.value)} className="uni-input" />
                </div>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 16px' }}>Schedule Exam</button>
            </form>
          </div>

          <div className="uni-card">
            <div className="uni-card-head">Scheduled Examinations ({tests.length})</div>
            {tests.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No exams scheduled</div>
              : <div style={{ overflowX: 'auto' }}>
                <table className="uni-table">
                  <thead><tr>{['Title', 'Date', 'Room', 'Status', ''].map(h => <th key={h} className="uni-th">{h}</th>)}</tr></thead>
                  <tbody>
                    {tests.map((t, i) => {
                      const days = Math.ceil((new Date(t.scheduledAt).getTime() - Date.now()) / 86400000);
                      const isPast = days < 0;
                      const bc = isPast ? 'badge-gray' : days <= 5 ? 'badge-red' : 'badge-blue';
                      return (
                        <tr key={t.id} className="uni-tr" style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td className="uni-td" style={{ fontWeight: 600, color: '#0f172a' }}>{t.title}</td>
                          <td className="uni-td" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                            {new Date(t.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="uni-td mono" style={{ fontSize: 12 }}>{t.room}</td>
                          <td className="uni-td"><span className={`badge ${bc}`}>{isPast ? 'Past' : days === 0 ? 'Today' : `${days}d`}</span></td>
                          <td className="uni-td">
                            <button className="btn-danger" onClick={() => deleteTest(t.id)}><Trash2 size={11} />Remove</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      )}

      {/* MODAL: Create Class */}
      <Modal isOpen={showClassModal} onClose={() => setShowClassModal(false)} title="Create New Class">
        <form onSubmit={createClass}>
          <div style={{ marginBottom: 12 }}>
            <label className="uni-label">Class Name</label>
            <input type="text" required placeholder="e.g. Machine Learning Fundamentals" value={newName} onChange={e => setNewName(e.target.value)} className="uni-input" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="uni-label">Subject Code</label>
            <input type="text" required placeholder="e.g. ML201" value={newCode} onChange={e => setNewCode(e.target.value)} className="uni-input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label className="uni-label">Credit Hours</label>
              <input type="number" min="1" max="6" value={newCredits} onChange={e => setNewCredits(Number(e.target.value))} className="uni-input" />
            </div>
            <div>
              <label className="uni-label">Semester</label>
              <input type="text" value={newSemester} onChange={e => setNewSemester(e.target.value)} className="uni-input" />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 16px' }}>Create Class</button>
        </form>
      </Modal>

      {/* MODAL: Add Lesson */}
      <Modal isOpen={showLessonModal} onClose={() => setShowLessonModal(false)} title="Add Lesson">
        <form onSubmit={addLesson}>
          <div style={{ marginBottom: 12 }}>
            <label className="uni-label">Class</label>
            <select value={lessonClassId} onChange={e => setLessonClassId(e.target.value)} className="uni-input" style={{ cursor: 'pointer' }}>
              {classes.map(c => <option key={c.id} value={c.id}>{c.subjectCode}  -  {c.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label className="uni-label">Topic</label>
            <input type="text" required placeholder="e.g. Gradient Descent & Backpropagation" value={lessonTopic} onChange={e => setLessonTopic(e.target.value)} className="uni-input" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <label className="uni-label">Date</label>
              <input type="date" required value={lessonDate} onChange={e => setLessonDate(e.target.value)} className="uni-input" />
            </div>
            <div>
              <label className="uni-label">Room</label>
              <input type="text" value={lessonRoom} onChange={e => setLessonRoom(e.target.value)} className="uni-input" />
            </div>
          </div>
          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '9px 16px' }}>Add Lesson</button>
        </form>
      </Modal>


      {faceRegStudent && (
        <FaceRegisterModal
          student={faceRegStudent}
          onClose={() => setFaceRegStudent(null)}
          onRegistered={() => {
            notify('Face registered for ' + faceRegStudent!.name);
            setFaceRegStudent(null);
            loadRegisteredFaces();
          }}
        />
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// â”€â”€â”€ FaceRegisterModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FaceRegisterModalProps {
  student: Student;
  onClose: () => void;
  onRegistered: () => void;
}

const FaceRegisterModal: React.FC<FaceRegisterModalProps> = ({ student, onClose, onRegistered }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [step, setStep] = useState<'camera' | 'preview' | 'done'>('camera');

  const startCamera = useCallback(async () => {
    setCameraError('');
    const attempts: MediaStreamConstraints[] = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { width: { ideal: 640 }, height: { ideal: 480 } } },
      { video: true },
    ];
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.onloadedmetadata = () => setCameraReady(true); }
        return;
      } catch (e: any) {
        if (e.name === 'NotAllowedError') { setCameraError('Camera access denied. Allow camera permission in your browser settings.'); return; }
        if (e.name === 'NotReadableError' || e.message?.includes('start video source')) { setCameraError('Camera is in use by another app (Teams, Zoom, etc.). Close it and try again.'); return; }
      }
    }
    setCameraError('Cannot access camera. Make sure a camera is connected and not in use by another app.');
  }, []);


  const stopCamera = useCallback(() => { streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }, []);
  useEffect(() => { startCamera(); return () => stopCamera(); }, [startCamera, stopCamera]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current || !cameraReady) return;
    const v = videoRef.current; const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    setPreview(c.toDataURL('image/jpeg', 0.9));
    setStep('preview'); stopCamera();
  };

  const retake = () => { setPreview(null); setRegError(''); setStep('camera'); startCamera(); };

  const register = async () => {
    if (!preview) return;
    setRegLoading(true); setRegError('');
    try {
      await api.post('/face/register', { studentId: student.id, imageBase64: preview });
      setStep('done'); setTimeout(onRegistered, 1200);
    } catch (e: any) {
      setRegError(e.response?.data?.message || e.message || 'Registration failed');
    } finally { setRegLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 460, boxShadow: '0 8px 40px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ background: '#0f172a', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ScanFace size={18} className="text-indigo-400" />
            <div>
              <div style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>Register Face</div>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>{student.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {step === 'camera' && (
            <div>
              {cameraError
                ? <div className="alert-strip alert-danger" style={{ marginBottom: 12 }}>{cameraError}</div>
                : <div style={{ position: 'relative', background: '#000', borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', maxHeight: 280, objectFit: 'cover' }} />
                  {!cameraReady && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, gap: 8 }}><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Initializing...</div>}
                  {cameraReady && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><div style={{ width: 130, height: 160, borderRadius: '50%', border: '2px dashed rgba(74,222,128,0.85)' }} /></div>}
                </div>
              }
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={capture} disabled={!cameraReady}
                  style={{ flex: 1, background: cameraReady ? '#4f46e5' : '#94a3b8', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: cameraReady ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Camera size={14} /> Capture Photo
                </button>
                <button onClick={onClose} className="btn-secondary">Cancel</button>
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, textAlign: 'center' }}>Centre face inside the oval guide</p>
            </div>
          )}
          {step === 'preview' && preview && (
            <div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 10 }}>Review before registering:</div>
              <img src={preview} alt="Captured" style={{ width: '100%', borderRadius: 6, marginBottom: 12, display: 'block' }} />
              {regError && <div className="alert-strip alert-danger" style={{ marginBottom: 12, fontSize: 12 }}>{regError}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={retake} className="btn-secondary">Retake</button>
                <button onClick={register} disabled={regLoading}
                  style={{ flex: 1, background: regLoading ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: regLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {regLoading ? 'Registering...' : 'Register Face'}
                </button>
              </div>
            </div>
          )}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={44} color="#16a34a" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Face Registered!</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{student.name} can now be recognized for automated attendance.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
