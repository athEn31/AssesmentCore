import { supabase } from './supabaseClient';
import { AuthResponse, UserProfile } from '../types/auth';

export const authService = {
  // Register a new user
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Store user profile
      if (data.user) {
        const { error: profileError } = await supabase.from('user_profiles').insert([
          {
            id: data.user.id,
            email,
            full_name: name,
            created_at: new Date().toISOString(),
          },
        ]);

        if (profileError) {
          console.error('Error creating user profile:', profileError);
        }
      }

      return {
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  },

  // Login with email and password
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Login successful!',
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  },

  // Verify email with OTP
  async verifyEmail(email: string, token: string): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Email verified successfully!',
        user: data.user || undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  },

  // Resend verification email
  async resendVerificationEmail(email: string): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Verification email sent! Please check your inbox.',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resend email',
      };
    }
  },

  // Logout
  async logout(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Logged out successfully!',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
    }
  },

  // Get current user
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error) {
        return null;
      }

      return data.user;
    } catch (error) {
      return null;
    }
  },

  // Get user profile
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  },

  // Get user subscription/usage status
  async getUserUsage(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_usage')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If no usage record exists, create one
        if (error.code === 'PGRST116') {
          const { data: newUsage } = await supabase
            .from('user_usage')
            .insert([
              {
                user_id: userId,
                exports_count: 0,
              },
            ])
            .select()
            .single();
          return newUsage;
        }
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  },

  // Track QTI export
  async trackExport(userId: string): Promise<AuthResponse> {
    try {
      const usage = await this.getUserUsage(userId);

      if (!usage) {
        const { error } = await supabase.from('user_usage').insert([
          {
            user_id: userId,
            exports_count: 1,
          },
        ]);

        if (error) {
          return { success: false, error: error.message };
        }

        return {
          success: true,
          message: 'Export tracked successfully!',
        };
      }

      const { error } = await supabase
        .from('user_usage')
        .update({ exports_count: (usage.exports_count || 0) + 1 })
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return {
        success: true,
        message: 'Export tracked successfully!',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to track export',
      };
    }
  },
};
