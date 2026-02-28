import type { User } from '@supabase/supabase-js';

export interface AuthResponse {
  success: boolean;
  error?: string;
  message?: string;
  user?: User;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  updated_at?: string;
}

export interface UserUsage {
  user_id: string;
  exports_count: number;
  created_at: string;
  updated_at?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  userProfile: UserProfile | null;
  userUsage: UserUsage | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (email: string, password: string, name: string) => Promise<AuthResponse>;
  logout: () => Promise<AuthResponse>;
  verifyEmail: (email: string, token: string) => Promise<AuthResponse>;
  resendVerificationEmail: (email: string) => Promise<AuthResponse>;
  trackExport: () => Promise<void>;
  refreshUsage: () => Promise<void>;
}
