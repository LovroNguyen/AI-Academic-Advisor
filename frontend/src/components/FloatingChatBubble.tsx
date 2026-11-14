import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  Maximize2,
  Bot,
  User,
  MapPin,
  Calendar,
  Award,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { extractCampusRooms } from '../utils/roomDetector';

interface BubbleMessage {
  sender: 'user' | 'ai';
  content: string;
}

export const FloatingChatBubble: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<BubbleMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState<string>('bubble-conv');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // If already on the main /chat page, hide the floating bubble to avoid redundancy
  const isChatPage = location.pathname === '/chat';

  useEffect(() => {
    // Initial welcome message
    if (messages.length === 0) {
      setMessages([
        {
          sender: 'ai',
          content: `Hi **${user?.name || 'there'}**! 🎓 How can I help you? Ask about classroom locations, attendance, schedule, or grades.`,
        },
      ]);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (customText?: string) => {
    const textToSend = (customText || input).trim();
    if (!textToSend || loading) return;

    setMessages((prev) => [...prev, { sender: 'user', content: textToSend }]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ sender: m.sender, content: m.content }));
      const res = await api.post('/ai/chat', {
        conversationId,
        message: textToSend,
        chatHistory: history,
      });

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          content: res.data?.response || 'I have retrieved your campus data.',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          content: 'Sorry, I encountered a temporary connection issue. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    { label: 'Next Class Room', icon: MapPin, query: 'Where is my next class and which room is it in?' },
    { label: 'Attendance %', icon: Calendar, query: 'What is my current attendance rate and am I at risk of being barred?' },
    { label: 'My GPA & Grades', icon: Award, query: 'Can you summarize my academic grades and current GPA?' },
  ];

  if (isChatPage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end select-none">
      {/* ─── CHAT POPUP WINDOW ────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="w-[380px] sm:w-[400px] h-[520px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-5 duration-200"
          style={{ boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.05)' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 px-4 flex items-center justify-between border-b border-indigo-900/50">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Bot className="w-4 h-4 text-indigo-300" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white tracking-wide">AcadAI Assistant</span>
                  <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 bg-indigo-500/30 text-indigo-200 rounded">
                    AI Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 leading-none mt-0.5">Campus Intelligence & Advisor</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  navigate('/chat');
                }}
                title="Expand to Full Chat"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'ai' && (
                  <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-slate-900 text-white rounded-br-none shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none shadow-sm whitespace-pre-line'
                  }`}
                >
                  <div>{m.content}</div>

                  {/* Room Location Quick Buttons */}
                  {m.sender === 'ai' && (() => {
                    const rooms = extractCampusRooms(m.content);
                    if (rooms.length === 0) return null;
                    return (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                        {rooms.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setIsOpen(false);
                              navigate(`/map?room=${encodeURIComponent(r)}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold transition-all cursor-pointer shadow-xs"
                          >
                            <MapPin className="w-3 h-3 text-amber-600 animate-bounce" />
                            <span>
                              Locate {r.startsWith('Multipurpose') || r.includes('Studio') || r.includes('Lab') || r.includes('Gym') || r === 'WC' || r === 'skylights' || r === 'Elevator Shaft' ? r : `Room ${r}`} on Map ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                {m.sender === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-slate-800 text-white flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-semibold">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-slate-500">
                <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <div className="bg-white border border-slate-200/80 px-3.5 py-2 rounded-2xl rounded-bl-none text-xs flex items-center gap-2 text-slate-600 shadow-sm">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                  <span>Checking campus records...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {QUICK_PROMPTS.map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(q.query)}
                className="flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/80 rounded-full px-2.5 py-1 whitespace-nowrap transition-colors"
              >
                <q.icon className="w-3 h-3 text-slate-400" />
                <span>{q.label}</span>
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-white border-t border-slate-200/80 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about campus..."
              className="flex-1 text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-indigo-600 disabled:opacity-40 text-white flex items-center justify-center transition-colors shadow-sm flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}

      {/* ─── FLOATING TRIGGER BUTTON (FAB) ───────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group relative flex items-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white p-3.5 rounded-full shadow-xl hover:shadow-indigo-500/25 transition-all duration-300 transform hover:scale-105 active:scale-95 border-2 border-white/20"
        title="Chat with AcadAI Assistant"
      >
        <div className="relative">
          <Sparkles className="w-5 h-5 text-indigo-300 group-hover:rotate-12 transition-transform duration-300" />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
        </div>

        {!isOpen && (
          <span className="hidden sm:inline-block text-xs font-semibold pr-1.5 tracking-tight">
            Ask AcadAI
          </span>
        )}
      </button>
    </div>
  );
};
