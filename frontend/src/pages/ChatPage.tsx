import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Send, Loader2, Sparkles, Database, CheckCircle2, MapPin } from 'lucide-react';
import { MessageItem } from '../types';
import { extractCampusRooms } from '../utils/roomDetector';

export const ChatPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initials = (name = '') => {
    const p = name.trim().split(' ');
    return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/conversations');
        if (res.data?.length > 0) {
          const conv = res.data[0];
          setConversationId(conv.id);
          const m = await api.get(`/conversations/${conv.id}/messages`);
          if (m.data?.length > 0) {
            setMessages(m.data);
          } else {
            setDefault();
          }
        } else {
          const nc = await api.post('/conversations');
          setConversationId(nc.data.id);
          setDefault();
        }
      } catch {
        setDefault();
      }
    };

    const setDefault = () =>
      setMessages([
        {
          sender: 'ai',
          content: `Hello **${user?.name || 'there'}**! I am **AcadAI** — your comprehensive Campus Intelligence & Academic Advisor.\n\nI am connected directly to your real-time academic records across the university portal. You can ask me anything about:\n\n🏫 **Course & Enrollment Info:** Details on your enrolled courses, credit hours, instructors, and the university course catalog.\n📍 **Classroom Locations & Schedule:** Find room locations for any course, specific lecture dates, or exam venues.\n📋 **Attendance & Exam Eligibility:** Check your attendance rates, absent/late records, and qualification thresholds (≥75% rule).\n📊 **Grades & GPA Trajectory:** View assignment, midterm, and final scores, cumulative GPA, and score targets needed.\n📝 **Exam Schedules:** Upcoming midterms/finals, scheduled dates & times, test rooms, and countdowns.\n\nHow can I support your academic journey today?`,
          mode: 'career',
        },
      ]);

    init();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setMessages((prev) => [...prev, { sender: 'user', content: msg, mode: 'career' }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ sender: m.sender, content: m.content }));
      const res = await api.post('/ai/chat', {
        conversationId: conversationId || 'conv-default',
        message: msg,
        chatHistory: history,
      });

      setMessages((prev) => [...prev, { sender: 'ai', content: res.data.response, mode: res.data.mode || 'career' }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          content: 'The AI assistant is temporarily unreachable. Please check your network connection or try again shortly.',
          mode: 'career',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((p, pi) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return (
          <strong key={pi} className="font-semibold text-slate-900">
            {p.slice(2, -2)}
          </strong>
        );
      }
      return p;
    });
  };

  const formatMsg = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let tableBuffer: string[] = [];

    const flushTable = (keyPrefix: number) => {
      if (tableBuffer.length < 2) {
        tableBuffer.forEach((tblLine, idx) => {
          elements.push(
            <div key={`${keyPrefix}-raw-${idx}`} className="leading-relaxed">
              {renderInline(tblLine)}
            </div>,
          );
        });
        tableBuffer = [];
        return;
      }

      const headerLine = tableBuffer[0];
      const dataLines = tableBuffer.slice(1).filter((l) => !/^\|[\s\-:|]+\|$/.test(l.trim()));

      const parseRow = (line: string) =>
        line
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());

      const headers = parseRow(headerLine);

      elements.push(
        <div key={`${keyPrefix}-tbl`} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs">
          <table className="w-full text-left text-[11px] border-collapse bg-white">
            <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2 border-r border-slate-200/50 last:border-r-0">
                    {renderInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {dataLines.map((rowLine, ri) => {
                const cells = parseRow(rowLine);
                return (
                  <tr key={ri} className="hover:bg-indigo-50/30 transition-colors">
                    {cells.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 border-r border-slate-100 last:border-r-0 font-normal">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>,
      );
      tableBuffer = [];
    };

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        tableBuffer.push(trimmed);
      } else {
        if (tableBuffer.length > 0) {
          flushTable(i);
        }

        if (trimmed.startsWith('### ') || trimmed.startsWith('## ')) {
          const titleText = trimmed.replace(/^#{2,3}\s+/, '');
          elements.push(
            <div key={i} className="font-bold text-slate-900 mt-2.5 mb-1 text-[13px]">
              {titleText}
            </div>,
          );
        } else if (trimmed === '') {
          elements.push(<div key={i} className="h-1.5" />);
        } else {
          const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
          elements.push(
            <div key={i} className={`leading-relaxed ${isBullet ? 'pl-2 my-0.5' : 'my-0.5'}`}>
              {renderInline(line)}
            </div>,
          );
        }
      }
    });

    if (tableBuffer.length > 0) {
      flushTable(lines.length);
    }

    return elements;
  };

  return (
    <div className="fade-in max-w-5xl mx-auto flex flex-col h-[calc(100vh-64px)] pb-4 space-y-3">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
              Campus Intelligence Copilot
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Academic Advisor</h1>
          <p className="text-xs text-slate-500">
            Real-time campus intelligence: Enrolled courses, classroom locations, attendance, grades & exam schedules
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-medium self-start sm:self-auto shadow-xs">
          <Database size={13} className="text-emerald-600 animate-pulse" />
          <span>Live Campus Database Connected</span>
        </div>
      </div>

      {/* ── Main Chat Layout (Full Width, No Right Buttons) ──────── */}
      <div className="flex-1 w-full flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden min-h-0">
        {/* Chat Header Bar */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              <Sparkles size={15} strokeWidth={2} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                AcadAI Campus Assistant
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              </div>
              <div className="text-[11px] text-slate-500">
                Courses · Classroom Locations · Attendance Records · Academic Transcript · Exam Schedule
              </div>
            </div>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
            <CheckCircle2 size={12} className="text-emerald-600" />
            <span>All Systems Active</span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/30 space-y-4">
          {messages.map((msg, idx) => {
            const isAi = msg.sender === 'ai';
            return (
              <div
                key={idx}
                className={`flex gap-3 ${isAi ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 shadow-2xs ${
                    isAi
                      ? 'bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white'
                      : 'bg-slate-900 text-white'
                  }`}
                >
                  {isAi ? 'AI' : initials(user?.name)}
                </div>

                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs ${
                    isAi
                      ? 'bg-white text-slate-800 border border-slate-200/80'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  <div>{formatMsg(msg.content)}</div>

                  {/* Room Location Quick Buttons */}
                  {isAi && (() => {
                    const rooms = extractCampusRooms(msg.content);
                    if (rooms.length === 0) return null;
                    return (
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-slate-500 font-medium">📍 Classroom Location:</span>
                        {rooms.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => navigate(`/map?room=${encodeURIComponent(r)}`)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                          >
                            <MapPin size={12} className="text-amber-600 animate-bounce" />
                            <span>
                              Locate {r.startsWith('Multipurpose') || r.includes('Studio') || r.includes('Lab') || r.includes('Gym') || r === 'WC' || r === 'skylights' || r === 'Elevator Shaft' ? r : `Room ${r}`} on Map ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-700 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs">
                AI
              </div>
              <div className="rounded-2xl px-4 py-3 text-xs bg-white border border-slate-200 text-slate-500 flex items-center gap-2 shadow-xs">
                <Loader2 size={14} className="animate-spin text-indigo-600" />
                <span>Accessing campus records and synthesizing guidance...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3.5 border-t border-slate-100 bg-white flex items-center gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask about classroom locations, attendance status, course details, grades, exams..."
            className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/10 resize-none min-h-[42px] max-h-[120px]"
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <span>Send</span>
            <Send size={13} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
