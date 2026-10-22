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
    }, 850);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center select-none"
        style={{ backgroundColor: '#132a21' }}
      >
        <img
          src="/q3-icon.jpeg"
          alt="Q3"
          className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl object-cover shadow-2xl border border-amber-400/30 animate-success-in"
        />
        <h1
          className="mt-5 text-2xl sm:text-3xl font-medium tracking-wide"
          style={{ color: '#f5d77f' }}
        >
          Q3
        </h1>
        <p className="mt-1.5 text-sm sm:text-base font-normal text-emerald-200/90">
          Università della Terza Età · Quartu Sant'Elena
        </p>
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
