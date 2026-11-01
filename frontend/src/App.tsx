import React from 'react';
import Home from './pages/Home';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { Loader2 } from 'lucide-react';

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAF7] flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E85D2C] to-[#C7491C] flex items-center justify-center shadow-lg shadow-[#E85D2C]/20 mb-3 animate-pulse">
          <span className="text-white font-black text-sm font-mono tracking-tight">DL</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[#71717A]">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E85D2C]" />
          <span>Initializing DevLens AI...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <Home />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}
