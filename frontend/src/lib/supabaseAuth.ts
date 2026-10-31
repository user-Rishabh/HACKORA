// Supabase Auth Client for HACKORA using standard REST endpoints
// Requires no external npm packages, works natively in browser

export interface SupabaseUser {
  id: string;
  email: string;
  created_at?: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
}

export interface SupabaseSession {
  access_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: SupabaseUser;
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const SESSION_STORAGE_KEY = 'hackora_auth_session';

class SupabaseAuthClient {
  private currentSession: SupabaseSession | null = null;
  private listeners: ((session: SupabaseSession | null) => void)[] = [];

  constructor() {
    this.restoreSession();
  }

  private restoreSession() {
    try {
      const stored = sessionStorage.getItem(SESSION_STORAGE_KEY) || localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const parsed: SupabaseSession = JSON.parse(stored);
        if (parsed.expires_at && parsed.expires_at > Date.now()) {
          this.currentSession = parsed;
        } else {
          this.clearSession();
        }
      }
    } catch {
      this.clearSession();
    }
  }

  private persistSession(session: SupabaseSession) {
    this.currentSession = session;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable
    }
    this.notifyListeners();
  }

  private clearSession() {
    this.currentSession = null;
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // Storage unavailable
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach((cb) => {
      try {
        cb(this.currentSession);
      } catch (err) {
        console.error('Auth state listener error:', err);
      }
    });
  }

  public onAuthStateChange(callback: (session: SupabaseSession | null) => void): () => void {
    this.listeners.push(callback);
    callback(this.currentSession);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public getSession(): SupabaseSession | null {
    if (this.currentSession && this.currentSession.expires_at > Date.now()) {
      return this.currentSession;
    }
    return null;
  }

  public getUser(): SupabaseUser | null {
    const s = this.getSession();
    return s ? s.user : null;
  }

  public getAccessToken(): string | null {
    const s = this.getSession();
    return s ? s.access_token : null;
  }

  public async signUp(email: string, password: string): Promise<{ user: SupabaseUser | null; error: string | null; confirmationRequired: boolean }> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { user: null, error: 'Email and password are required.', confirmationRequired: false };
    }
    if (password.length < 6) {
      return { user: null, error: 'Password must be at least 6 characters.', confirmationRequired: false };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-project-id')) {
      // Mock dev user when Supabase is unconfigured
      const mockUser: SupabaseUser = { id: `dev_${Date.now()}`, email: cleanEmail };
      const mockSession: SupabaseSession = {
        access_token: `mock_jwt_${Date.now()}`,
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Date.now() + 86400 * 1000,
        refresh_token: 'mock_refresh',
        user: mockUser,
      };
      this.persistSession(mockSession);
      return { user: mockUser, error: null, confirmationRequired: false };
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { user: null, error: data.msg || data.error_description || data.error || 'Signup failed.', confirmationRequired: false };
      }

      if (data.access_token && data.user) {
        const session: SupabaseSession = {
          access_token: data.access_token,
          token_type: data.token_type || 'bearer',
          expires_in: data.expires_in || 3600,
          expires_at: Date.now() + (data.expires_in || 3600) * 1000,
          refresh_token: data.refresh_token || '',
          user: data.user,
        };
        this.persistSession(session);
        return { user: data.user, error: null, confirmationRequired: false };
      }

      // Email confirmation required by Supabase project settings
      return { user: data.user || null, error: null, confirmationRequired: true };
    } catch (err: any) {
      return { user: null, error: err.message || 'Network error during signup.', confirmationRequired: false };
    }
  }

  public async signIn(email: string, password: string): Promise<{ session: SupabaseSession | null; error: string | null }> {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      return { session: null, error: 'Email and password are required.' };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-project-id')) {
      const mockUser: SupabaseUser = { id: `dev_${Date.now()}`, email: cleanEmail };
      const mockSession: SupabaseSession = {
        access_token: `mock_jwt_${Date.now()}`,
        token_type: 'bearer',
        expires_in: 86400,
        expires_at: Date.now() + 86400 * 1000,
        refresh_token: 'mock_refresh',
        user: mockUser,
      };
      this.persistSession(mockSession);
      return { session: mockSession, error: null };
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        return { session: null, error: data.error_description || data.msg || data.error || 'Invalid email or password.' };
      }

      const session: SupabaseSession = {
        access_token: data.access_token,
        token_type: data.token_type || 'bearer',
        expires_in: data.expires_in || 3600,
        expires_at: Date.now() + (data.expires_in || 3600) * 1000,
        refresh_token: data.refresh_token || '',
        user: data.user,
      };
      this.persistSession(session);
      return { session, error: null };
    } catch (err: any) {
      return { session: null, error: err.message || 'Network error during login.' };
    }
  }

  public async resetPasswordForEmail(email: string): Promise<{ success: boolean; error: string | null }> {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      return { success: false, error: 'Please enter your account email.' };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-project-id')) {
      return { success: true, error: null };
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: cleanEmail }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.msg || data.error_description || 'Password reset request failed.' };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error during password recovery.' };
    }
  }

  public async updatePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
    if (newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters.' };
    }

    const token = this.getAccessToken();
    if (!token) {
      return { success: false, error: 'You must be authenticated to change password.' };
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('your-project-id')) {
      return { success: true, error: null };
    }

    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password: newPassword }),
      });

      if (!res.ok) {
        const data = await res.json();
        return { success: false, error: data.msg || data.error_description || 'Password update failed.' };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating password.' };
    }
  }

  public async signOut(): Promise<void> {
    const token = this.getAccessToken();
    this.clearSession();

    if (token && SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('your-project-id')) {
      try {
        fetch(`${SUPABASE_URL}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      } catch {
        // Ignore logout errors
      }
    }
  }
}

export const supabaseAuth = new SupabaseAuthClient();

