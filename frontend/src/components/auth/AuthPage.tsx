import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type AuthView = 'login' | 'signup' | 'forgot_password' | 'reset_password';

interface AuthPageProps {
  initialView?: AuthView;
  onSuccess?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialView = 'login', onSuccess }) => {
  const { signIn, signUp, resetPassword, updatePassword } = useAuth();

  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check URL hash for Supabase recovery access_token
  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setView('reset_password');
    }
  }, []);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);
    const res = await signIn(email, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to sign in. Please verify your credentials.');
    } else {
      if (onSuccess) onSuccess();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const res = await signUp(email, password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to create account.');
    } else if (res.confirmationRequired) {
      setSuccessMessage('Account created! A confirmation link has been sent to your email.');
    } else {
      setSuccessMessage('Account created and signed in successfully!');
      if (onSuccess) onSuccess();
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!validateEmail(email)) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setIsLoading(true);
    const res = await resetPassword(email);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Unable to send password reset email.');
    } else {
      setSuccessMessage('Password reset link sent! Check your inbox to set a new password.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (password.length < 6) {
      setErrorMessage('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    const res = await updatePassword(password);
    setIsLoading(false);

    if (!res.success) {
      setErrorMessage(res.error || 'Failed to update password.');
    } else {
      setSuccessMessage('Password updated successfully! You can now sign in.');
      setTimeout(() => {
        setView('login');
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7] flex flex-col justify-center items-center px-4 py-12">
      {/* Brand Header */}
      <div className="mb-8 text-center flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E85D2C] to-[#C7491C] flex items-center justify-center shadow-lg shadow-[#E85D2C]/20 mb-3">
          <span className="text-white font-black text-lg font-mono tracking-tighter">DL</span>
        </div>
        <h1 className="text-2xl font-extrabold text-[#1A1D29] tracking-tight font-display">DevLens AI</h1>
        <p className="text-xs text-[#71717A] mt-1 font-mono uppercase tracking-wider">Codebase Intelligence & Architecture Visualizer</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#E5E1DA] shadow-xl p-8 relative overflow-hidden">
        {/* Subtle decorative gradient top */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#E85D2C] via-[#FF8A65] to-[#E85D2C]" />

        {/* View Titles */}
        <div className="mb-6">
          {view === 'login' && (
            <>
              <h2 className="text-xl font-bold text-[#1A1D29]">Welcome Back</h2>
              <p className="text-xs text-[#71717A] mt-1">Sign in to access your codebase workspace and AI models</p>
            </>
          )}
          {view === 'signup' && (
            <>
              <h2 className="text-xl font-bold text-[#1A1D29]">Create Your Account</h2>
              <p className="text-xs text-[#71717A] mt-1">Start analyzing, understanding, and navigating complex codebases</p>
            </>
          )}
          {view === 'forgot_password' && (
            <>
              <h2 className="text-xl font-bold text-[#1A1D29]">Reset Your Password</h2>
              <p className="text-xs text-[#71717A] mt-1">Enter your email and we'll send you recovery instructions</p>
            </>
          )}
          {view === 'reset_password' && (
            <>
              <h2 className="text-xl font-bold text-[#1A1D29]">Set New Password</h2>
              <p className="text-xs text-[#71717A] mt-1">Choose a secure password with at least 6 characters</p>
            </>
          )}
        </div>

        {/* Alerts */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-start gap-2.5 animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 flex items-start gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#1A1D29] font-mono">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    clearMessages();
                    setView('forgot_password');
                  }}
                  className="text-[11px] text-[#E85D2C] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#A1A1AA] hover:text-[#1A1D29] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-[#E85D2C] hover:bg-[#D44E1F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E85D2C]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="pt-4 text-center border-t border-[#F0EFEA]">
              <span className="text-xs text-[#71717A]">Don't have an account? </span>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView('signup');
                }}
                className="text-xs font-bold text-[#E85D2C] hover:underline cursor-pointer"
              >
                Sign Up
              </button>
            </div>
          </form>
        )}

        {/* SIGNUP FORM */}
        {view === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">Password (min. 6 characters)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#A1A1AA] hover:text-[#1A1D29] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-[#A1A1AA] hover:text-[#1A1D29] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-[#E85D2C] hover:bg-[#D44E1F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E85D2C]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <span>Creating Account...</span>
              ) : (
                <>
                  <span>Create Account</span>
                  <Sparkles className="w-3.5 h-3.5" />
                </>
              )}
            </button>

            <div className="pt-4 text-center border-t border-[#F0EFEA]">
              <span className="text-xs text-[#71717A]">Already have an account? </span>
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView('login');
                }}
                className="text-xs font-bold text-[#E85D2C] hover:underline cursor-pointer"
              >
                Sign In
              </button>
            </div>
          </form>
        )}

        {/* FORGOT PASSWORD FORM */}
        {view === 'forgot_password' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">Registered Email</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Mail className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-[#E85D2C] hover:bg-[#D44E1F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E85D2C]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? <span>Sending Link...</span> : <span>Send Recovery Link</span>}
            </button>

            <div className="pt-4 text-center border-t border-[#F0EFEA]">
              <button
                type="button"
                onClick={() => {
                  clearMessages();
                  setView('login');
                }}
                className="text-xs font-semibold text-[#71717A] hover:text-[#1A1D29] cursor-pointer"
              >
                Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* RESET PASSWORD FORM */}
        {view === 'reset_password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">New Password (min. 6 characters)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-[#A1A1AA] hover:text-[#1A1D29] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1A1D29] mb-1.5 font-mono">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2.5 text-xs bg-[#FAFAF7] border border-[#E5E1DA] rounded-xl focus:outline-none focus:border-[#E85D2C] focus:bg-white text-[#1A1D29] transition-all"
                  required
                />
                <Lock className="w-4 h-4 text-[#A1A1AA] absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-[#A1A1AA] hover:text-[#1A1D29] cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-[#E85D2C] hover:bg-[#D44E1F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E85D2C]/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? <span>Updating Password...</span> : <span>Update Password</span>}
            </button>
          </form>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-[11px] text-[#A1A1AA]">
        <span>DevLens AI Bring Your Own Key (BYOK) Architecture. Powered by Supabase Auth.</span>
      </div>
    </div>
  );
};

