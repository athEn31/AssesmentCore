import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

export function VerifyEmailPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { verifyEmail, resendVerificationEmail } = useAuth();

  const email = (location.state as any)?.email || '';

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!email) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0F6CBD] via-[#1a7ed4] to-[#0d4a94] flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Email not provided. Please register first.
              </AlertDescription>
            </Alert>
            <Button className="w-full mt-4" onClick={() => navigate('/auth/register')}>
              Back to Register
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);

    const response = await verifyEmail(email, code);

    if (response.success) {
      setSuccess(true);
      // Redirect to workspace after 2 seconds
      setTimeout(() => {
        navigate('/workspace');
      }, 2000);
    } else {
      setError(response.error || 'Verification failed. Please try again.');
    }

    setLoading(false);
  };

  const handleResend = async () => {
    setError('');
    setResendSuccess(false);
    setResendLoading(true);

    const response = await resendVerificationEmail(email);

    if (response.success) {
      setResendSuccess(true);
      setResendCooldown(60); // 60 second cooldown
    } else {
      setError(response.error || 'Failed to resend code. Please try again.');
    }

    setResendLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F6CBD] via-[#1a7ed4] to-[#0d4a94] flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle className="text-2xl">Verify Email</CardTitle>
          <CardDescription>
            We've sent a verification code to <span className="font-semibold text-[#1F2937]">{email}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Email verified successfully! Redirecting...
              </AlertDescription>
            </Alert>
          )}

          {resendSuccess && (
            <Alert className="bg-blue-50 border-blue-200">
              <Mail className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Verification code sent! Check your inbox.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            {/* OTP Input */}
            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium text-[#1F2937]">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                placeholder="000000"
                className="w-full px-4 py-3 border border-[#E2E8F0] rounded-lg text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-[#0F6CBD] font-mono"
              />
              <p className="text-xs text-[#64748B]">Enter the 6-digit code from your email</p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-[#0F6CBD] hover:bg-[#0d4a94] text-white font-medium"
              disabled={loading || code.length !== 6}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </Button>
          </form>

          {/* Resend Link */}
          <div className="text-center">
            <p className="text-sm text-[#64748B] mb-2">Didn't receive the code?</p>
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0}
              className="text-[#0F6CBD]"
            >
              {resendLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : resendCooldown > 0 ? (
                `Resend in ${resendCooldown}s`
              ) : (
                'Resend Code'
              )}
            </Button>
          </div>

          {/* Back Link */}
          <Button
            variant="ghost"
            onClick={() => navigate('/auth/register')}
            className="w-full text-[#0F6CBD]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Register
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
