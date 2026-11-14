import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Sparkles } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/register', { name, email, password });
      login(res.data.access_token, res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 font-sans">
      {/* ── Left Branding Panel ── */}
      <div className="w-80 md:w-96 bg-slate-950 text-white flex flex-col justify-between p-10 hidden md:flex border-r border-slate-900">
        <div>
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
            <span>FPT University Enrollment</span>
          </div>

          <h2 className="text-2xl font-bold tracking-tight leading-snug text-white mb-3">
            Join AcadAI
          </h2>

          <p className="text-xs text-slate-400 leading-relaxed">
            Create your university account to access your personalised syllabus, biometric verification records, continuous gradebook, and automated AI study advisor.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 text-xs text-slate-500">
          <p className="font-medium text-slate-400">Academic Year 2025–2026</p>
        </div>
      </div>

      {/* ── Right Form Area ── */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create Account</h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter your student details to register for the portal
            </p>
          </div>

          {error && <div className="alert-strip alert-danger text-xs">{error}</div>}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="uni-label">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nguyen Van A"
                className="uni-input"
              />
            </div>

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
              <label className="uni-label">Password (min. 6 characters)</label>
              <input
                type="password"
                required
                minLength={6}
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
              <span>{loading ? 'Creating Account...' : 'Complete Registration'}</span>
              <ArrowRight size={13} strokeWidth={1.5} />
            </button>
          </form>

          <div className="text-center text-xs text-slate-500 pt-2">
            Already registered?{' '}
            <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
              Sign in to portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
