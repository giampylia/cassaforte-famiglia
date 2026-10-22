import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AccessibilityTopBar } from './components/AccessibilityTopBar';
import { LoginView } from './components/LoginView';
import { MemberView } from './components/MemberView';
import { AdminDashboard } from './components/AdminDashboard';

const MainRouter: React.FC = () => {
  const { currentUser } = useApp();

  return (
    <div className="min-h-screen flex flex-col">
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
