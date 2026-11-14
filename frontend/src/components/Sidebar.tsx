import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  BarChart3,
  CalendarCheck,
  FileSpreadsheet,
  Settings,
  LogOut,
  User,
  MapPin,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const STUDENT_NAV = [
  { section: 'Overview' },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'AI Advisor', path: '/chat', icon: MessageSquare },
  { section: 'Academic' },
  { name: 'My Classes', path: '/classes', icon: BookOpen },
  { name: 'Campus Map', path: '/map', icon: MapPin },
  { name: 'Grades', path: '/grades', icon: BarChart3 },
  { name: 'Attendance', path: '/attendance', icon: CalendarCheck },
  { name: 'Tests & Exams', path: '/tests', icon: FileSpreadsheet },
  { section: 'Account' },
  { name: 'Profile', path: '/profile', icon: User },
];

const ADMIN_NAV = [
  ...STUDENT_NAV,
  { section: 'Administration' },
  { name: 'Manage Data', path: '/admin', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = (name = '') => {
    const p = name.trim().split(' ');
    return p.length >= 2
      ? (p[0][0] + p[p.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  return (
    <aside
      style={{
        width: 220,
        minHeight: '100vh',
        background: '#ffffff',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 20,
      }}
      className="font-sans select-none"
    >
      {/* ─── 1. Brand Header ────────────────────────────────────── */}
      <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs font-mono shadow-sm">
            A
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 tracking-tight leading-none">
              AcadAI
            </div>
            <div className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">
              Academic Platform
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. User Info Sub-strip ─────────────────────────────── */}
      <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          Account
        </div>
        <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
          {user?.name || 'Student'}
        </div>
        <div className="text-[11px] text-slate-500 truncate">
          {user?.role === 'admin' ? 'Administrator' : 'Semester 5 · Student'}
        </div>
      </div>

      {/* ─── 3. Navigation Links ────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {(user?.role === 'admin' ? ADMIN_NAV : STUDENT_NAV).map((item, i) => {
          if ('section' in item && item.section) {
            return (
              <div
                key={i}
                className="text-[10px] font-semibold tracking-wider text-slate-400 px-3 pt-3.5 pb-1 uppercase"
              >
                {item.section}
              </div>
            );
          }
          if ('path' in item && item.path && item.icon) {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors duration-150 ${
                    isActive
                      ? 'bg-slate-100/90 text-slate-950 font-semibold border-l-2 border-indigo-600 pl-2.5'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50 font-medium'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={14}
                      strokeWidth={1.5}
                      className={isActive ? 'text-indigo-600' : 'text-slate-400'}
                    />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            );
          }
          return null;
        })}
      </nav>

      {/* ─── 4. User Footer & Sign Out ─────────────────────────── */}
      <div className="p-3 border-t border-slate-100 flex items-center justify-between bg-white">
        <div
          onClick={() => navigate('/profile')}
          className="flex items-center gap-2.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
          title="View Student Profile"
        >
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200/60 text-slate-700 flex items-center justify-center font-semibold text-[10px] flex-shrink-0">
            {initials(user?.name)}
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-semibold text-slate-900 truncate">
              {user?.name || 'Student'}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {user?.email}
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          title="Sign out"
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
        >
          <LogOut size={14} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
