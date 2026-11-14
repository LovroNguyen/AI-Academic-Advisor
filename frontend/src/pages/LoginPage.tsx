import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Sparkles } from 'lucide-react';

export const LoginPage: React.FC = () => {
  // Demo accounts (from prisma/seed.ts) are only offered in development builds (`npm run dev`);
  // production builds never contain these credentials.
  const [email, setEmail] = useState(import.meta.env.DEV ? 'nva@fpt.edu.vn' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.access_token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fill = (e: string, p: string) => {
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* ── Left Branding Panel (20% structural obsidian) ── */}
      <div className="w-80 md:w-96 bg-slate-950 text-white flex flex-col justify-between p-10 hidden md:flex border-r border-slate-900">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="w-9 h-9 rounded-xl bg-white text-slate-950 flex items-center justify-center font-bold text-sm font-mono shadow-xs">
              A
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white leading-tight">AcadAI</div>
              <div className="text-[10px] text-indigo-400 font-semibold tracking-wider uppercase">Academic Portal</div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 bg-white/5 border border-white/10 text-indigo-300 text-xs font-medium mb-4">
            <Sparkles size={12} className="text-indigo-400" />
            <span>Dual-Mode AI Intelligence</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight leading-snug text-white mb-3">
            Student Information &amp; Advisory System
          </h2>

          <p className="text-xs text-slate-400 leading-relaxed">
            Consolidated academic records, lecture timetable tracking, biometric attendance, and proactive GPA trajectory forecasting.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">FPT University · Academic Year 2025–2026</p>
          <p className="text-[11px] text-slate-600">Enterprise AI Portal Build 2.4.0</p>
        </div>
      </div>

      {/* ── Right Form Area (70% dominant porcelain white) ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign In</h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter your credentials to access the academic portal
            </p>
          </div>

          {error && <div className="alert-strip alert-danger text-xs">{error}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="uni-label">University Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@fpt.edu.vn"
                className="uni-input"
              />
            </div>

            <div>
              <label className="uni-label">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="uni-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-semibold text-white shadow-xs hover:bg-black transition-all active:scale-[0.99] disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In to Portal'}</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </form>

          {/* Quick Demo Credentials (development builds only) */}
          {import.meta.env.DEV && (
          <div className="pt-4 border-t border-slate-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Quick Demo Accounts
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fill('nva@fpt.edu.vn', 'password')}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors text-center"
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => fill('admin@fpt.edu.vn', 'admin123')}
                className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50/50 py-1.5 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors text-center"
              >
                Administrator
              </button>
            </div>
          </div>
          )}

          <div className="text-center text-xs text-slate-500">
            New student?{' '}
            <Link to="/register" className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Create student account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
