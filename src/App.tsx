import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AccessibilityTopBar } from './components/AccessibilityTopBar';
import { LoginView } from './components/LoginView';
import { MemberView } from './components/MemberView';
import { AdminDashboard } from './components/AdminDashboard';

const MainRouter: React.FC = () => {
  const { currentUser } = useApp();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center select-none"
        style={{ backgroundColor: '#112825' }}
      >
        <img
          src="/q3-icon-512.png?v=5"
          alt="Q3"
          className="w-48 h-48 object-contain animate-success-in"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AccessibilityTopBar />
      {!currentUser ? (
        <LoginView />
      ) : currentUser.role === 'admin' ? (
        <AdminDashboard />
      ) : (
        <MemberView />
      )}
    </div>
  );
};

export function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}

export default App;
