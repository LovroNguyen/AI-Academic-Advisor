import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ChatPage } from './pages/ChatPage';
import { ClassesPage } from './pages/ClassesPage';
import { GradesPage } from './pages/GradesPage';
import { AttendancePage } from './pages/AttendancePage';
import { TestsPage } from './pages/TestsPage';
import { AdminPage } from './pages/AdminPage';
import { ProfilePage } from './pages/ProfilePage';
import { CampusMapPage } from './pages/CampusMapPage';
import { FloatingChatBubble } from './components/FloatingChatBubble';
import { Loader2 } from 'lucide-react';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh', padding: '28px 32px', maxWidth: 'calc(100vw - 220px)' }}>
        {children}
      </main>
      <FloatingChatBubble />
    </div>
  );
};

// Only admin users can access this route — students are redirected to dashboard
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedLayout>
                <DashboardPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedLayout>
                <ChatPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/classes"
            element={
              <ProtectedLayout>
                <ClassesPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/grades"
            element={
              <ProtectedLayout>
                <GradesPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedLayout>
                <AttendancePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/tests"
            element={
              <ProtectedLayout>
                <TestsPage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedLayout>
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              </ProtectedLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedLayout>
                <ProfilePage />
              </ProtectedLayout>
            }
          />
          <Route
            path="/map"
            element={
              <ProtectedLayout>
                <CampusMapPage />
              </ProtectedLayout>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
