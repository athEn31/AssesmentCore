import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, FileCode, Zap, FileJson, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/workspace');
    }
  }, [isAuthenticated, navigate]);

  const validateForm = () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const response = await login(email, password);

    if (response.success) {
      // Navigate immediately on successful login to avoid stale delayed redirects.
      navigate('/workspace', { replace: true });
    } else {
      setError(response.error || 'Login failed. Please try again.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC]">
      {/* Navbar */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] flex items-center px-6 shrink-0">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#0F6CBD] rounded-lg flex items-center justify-center">
            <FileCode className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[#1F2937] text-lg">AssessmentCore</span>
        </Link>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="text-[#64748B]">Don't have an account?</span>
          <Link to="/auth/register">
            <Button variant="outline" size="sm" className="border-[#0F6CBD] text-[#0F6CBD] hover:bg-[#F0F9FF]">
              Register Free
            </Button>
          </Link>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left brand panel ── */}
        <div className="hidden lg:flex flex-col justify-between w-1/2 bg-gradient-to-br from-[#0F6CBD] via-[#1a7ed4] to-[#0d4a94] p-12 text-white">
          <div>
            <h2 className="text-4xl font-bold leading-tight mb-4">
              Transform Questions<br />into <span className="text-[#BAE6FD]">QTI & JSON</span>
            </h2>
            <p className="text-[#BFDBFE] text-lg leading-relaxed">
              Empower your EdTech platform with seamless batch conversion of assessment questions. Built for speed and reliability.
            </p>
          </div>

          <div className="space-y-5">
            {[
              { icon: Zap,         text: 'Process thousands of questions in minutes' },
              { icon: FileJson,    text: 'Export to QTI 1.2, 2.1, 3.0 or JSON formats' },
              { icon: RefreshCw,   text: 'Batch convert entire question banks in one click' },
              { icon: CheckCircle2, text: 'AI-powered validation for unlimited plan users' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-[#DBEAFE] text-sm leading-relaxed pt-1.5">{text}</p>
              </div>
            ))}
          </div>

          <p className="text-[#93C5FD] text-xs">© 2026 AssessmentCore. All rights reserved.</p>
        </div>

        {/* ── Right login panel ── */}
        <div className="flex flex-1 items-center justify-center px-6 py-12 bg-[#F8FAFC]">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-[#111827]">Welcome Back</h1>
              <p className="text-[#64748B] mt-1">Sign in to your AssessmentCore account</p>
            </div>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-medium text-[#374151]">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-[#94A3B8]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    className="pl-9 bg-white border-[#E2E8F0] focus:border-[#0F6CBD]"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-[#374151]">
                    Password
                  </label>
                  <Link to="/auth/forgot-password" className="text-xs text-[#0F6CBD] hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-[#94A3B8]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2 border border-[#E2E8F0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] text-sm"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#475569]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#0F6CBD] hover:bg-[#0d4a94] text-white font-semibold h-11 rounded-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-[#64748B] mt-6">
              Don't have an account?{' '}
              <Link to="/auth/register" className="text-[#0F6CBD] hover:underline font-medium">
                Create one free
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
