import { useState } from 'react';
import { Link } from 'react-router';
import { Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';

export function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const { resetPasswordForEmail } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !email.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);

        const response = await resetPasswordForEmail(email);

        if (response.success) {
            setSuccess(true);
        } else {
            setError(response.error || 'Failed to send reset email. Please try again.');
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0F6CBD] via-[#1a7ed4] to-[#0d4a94] flex items-center justify-center px-4">
            <Card className="w-full max-w-md shadow-xl">
                <CardHeader>
                    <CardTitle className="text-2xl">Reset Password</CardTitle>
                    <CardDescription>
                        Enter your email address and we'll send you a link to reset your password
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {success ? (
                        <div className="space-y-4">
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-800">
                                    Password reset email sent! Please check your inbox and click the link to reset your password.
                                </AlertDescription>
                            </Alert>

                            <p className="text-sm text-[#64748B] text-center">
                                Didn't receive the email? Check your spam folder or try again.
                            </p>

                            <Button
                                variant="outline"
                                onClick={() => setSuccess(false)}
                                className="w-full text-[#0F6CBD]"
                            >
                                Try Again
                            </Button>

                            <Link to="/auth/login">
                                <Button variant="ghost" className="w-full text-[#0F6CBD]">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Login
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-[#1F2937]">
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
                                            className="pl-9"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full bg-[#0F6CBD] hover:bg-[#0d4a94] text-white font-medium"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Sending...
                                        </>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </Button>
                            </form>

                            <div className="text-center">
                                <Link to="/auth/login" className="text-sm text-[#0F6CBD] hover:underline font-medium">
                                    <ArrowLeft className="inline mr-1 h-3 w-3" />
                                    Back to Login
                                </Link>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
