import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { authService } from '../services/authService';
import { supabase } from '../services/supabaseClient';
import { AuthContextType, AuthResponse, UserProfile, UserUsage } from '../types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userUsage, setUserUsage] = useState<UserUsage | null>(null);

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);

        if (currentUser) {
          // Fetch user profile
          const profile = await authService.getUserProfile(currentUser.id);
          setUserProfile(profile);

          // Fetch user usage
          const usage = await authService.getUserUsage(currentUser.id);
          setUserUsage(usage);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);

      if (session?.user) {
        const profile = await authService.getUserProfile(session.user.id);
        setUserProfile(profile);

        const usage = await authService.getUserUsage(session.user.id);
        setUserUsage(usage);
      } else {
        setUserProfile(null);
        setUserUsage(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await authService.login(email, password);

    if (response.success && response.user) {
      setUser(response.user);
      const profile = await authService.getUserProfile(response.user.id);
      setUserProfile(profile);

      const usage = await authService.getUserUsage(response.user.id);
      setUserUsage(usage);
    }

    return response;
  };

  const register = async (email: string, password: string, name: string): Promise<AuthResponse> => {
    const response = await authService.register(email, password, name);

    if (response.success && response.user) {
      setUser(response.user);
      const profile = await authService.getUserProfile(response.user.id);
      setUserProfile(profile);
    }

    return response;
  };

  const logout = async (): Promise<AuthResponse> => {
    const response = await authService.logout();

    if (response.success) {
      setUser(null);
      setUserProfile(null);
      setUserUsage(null);
    }

    return response;
  };

  const verifyEmail = async (email: string, token: string): Promise<AuthResponse> => {
    const response = await authService.verifyEmail(email, token);

    if (response.success && response.user) {
      setUser(response.user);
    }

    return response;
  };

  const resendVerificationEmail = (email: string): Promise<AuthResponse> => {
    return authService.resendVerificationEmail(email);
  };

  const trackExport = async () => {
    if (user) {
      await authService.trackExport(user.id);
      const usage = await authService.getUserUsage(user.id);
      setUserUsage(usage);
    }
  };

  const refreshUsage = async () => {
    if (user) {
      const usage = await authService.getUserUsage(user.id);
      setUserUsage(usage);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    userProfile,
    userUsage,
    login,
    register,
    logout,
    verifyEmail,
    resendVerificationEmail,
    trackExport,
    refreshUsage,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
