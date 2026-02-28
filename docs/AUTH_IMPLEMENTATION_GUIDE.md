# Authentication & Feature-Gating Implementation Guide

## Overview

This implementation adds a complete authentication and feature-gating system to your AssessmentCore application using Supabase. Here's what's included:

### Features Implemented:

1. **User Authentication**
   - Email/Password Registration
   - Email Verification via OTP
   - Login/Logout functionality
   - Persistent session management

2. **Batch Creator Protection**
   - Unauthenticated users see a registration prompt
   - Free users get 1 QTI export per month
   - After first export, users are redirected to pricing page
   - Authenticated users with quota can use batch creator

3. **Usage Tracking**
   - Tracks number of QTI exports per user
   - Stores export history in database
   - Prevents quota abuse

4. **Pricing Page**
   - Displays pricing tiers
   - Shows upgrade options
   - FAQ section included

---

## Setup Instructions

### 1. Create Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com)
2. Sign up or login
3. Click "New Project"
4. Choose your organization, project name, and region
5. Set a strong database password
6. Wait for the project to be created

### 2. Set Up Database

1. In Supabase dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy and paste the entire contents of `docs/DATABASE_SETUP.sql`
4. Click "Run"
5. This creates:
   - `user_profiles` table - stores user information
   - `user_usage` table - tracks QTI exports per user
   - Row Level Security policies - ensures users can only access their own data

### 3. Configure Environment Variables

1. Go to project **Settings > API**
2. Copy your **URL** and **anon public key**
3. Create a `.env.local` file in your project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

4. Replace the values with your actual Supabase credentials

### 4. Set Up Email Configuration (Optional but Recommended)

For email verification to work:

1. In Supabase dashboard, go to **Authentication > Email Templates**
2. Customize the verification email template (optional)
3. Go to **Authentication > Providers > Email**
4. Ensure "Confirm email" is enabled

### 5. Test the Implementation

1. Start your development server: `npm run dev`
2. Navigate to the workspace and click "Batch QTI Creator"
3. You should see a registration prompt
4. Complete registration and email verification
5. Login and try uploading a file
6. After successful export, you'll be redirected to pricing page

---

## File Structure

```
src/
├── services/
│   ├── supabaseClient.ts        # Supabase client configuration
│   └── authService.ts            # Authentication API calls
├── contexts/
│   └── AuthContext.tsx           # Auth context & provider
├── types/
│   └── auth.ts                   # TypeScript interfaces
└── pages/
    ├── auth/
    │   ├── RegisterPage.tsx       # Registration page
    │   ├── LoginPage.tsx          # Login page
    │   └── VerifyEmailPage.tsx    # Email verification
    └── PricingPage.tsx            # Pricing/upgrade page
```

## API Endpoints Used

### Authentication
- `signUp()` - Register new user
- `signInWithPassword()` - Login user
- `verifyOtp()` - Verify email with code
- `signOut()` - Logout user
- `getUser()` - Get current user
- `resend()` - Resend verification email

### Database
- `user_profiles` - User information
- `user_usage` - Export tracking

---

## Key Functions

### useAuth Hook

Use this hook in any component to access auth state and functions:

```tsx
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { 
    user,                      // Current user object
    isAuthenticated,           // Boolean
    loading,                   // Loading state
    userProfile,              // User profile data
    userUsage,                // Usage statistics
    login,                    // Function to login
    register,                 // Function to register
    logout,                   // Function to logout
    verifyEmail,              // Function to verify email
    trackExport,              // Function to track QTI export
    refreshUsage              // Function to refresh usage data
  } = useAuth();

  return (
    // Component code
  );
}
```

### Tracking Exports

In the BatchCreator component, after a successful export:

```tsx
// Track the export
await trackExport();

// Storage automatically updates in AuthContext
// Can access via: const { userUsage } = useAuth();
```

---

## Customization

### Change Free Tier Limit

To change from 1 free export to a different number:

1. Open `src/app/pages/workspace/BatchCreator.tsx`
2. Find: `const canUseFeature = !userUsage || userUsage.exports_count === 0;`
3. Change `=== 0` to `< 5` (for 5 free exports) or adjust as needed

### Customize Pricing Page

Edit `src/app/pages/PricingPage.tsx`:
- Update `pricingTiers` array with your plans
- Modify the `handleUpgrade()` function to integrate with payment provider
- Update FAQ questions and answers

### Change Email Verification Method

Currently uses OTP (One-Time Password). To use magic links instead:
1. Change `verify_email` to `magic_link` in `authService.ts`
2. Modify verification page to handle magic link flow

---

## Integration with Payment Providers

### For Stripe:

```tsx
const handleUpgrade = async (tier: string) => {
  const stripe = await loadStripe(process.env.VITE_STRIPE_PUBLIC_KEY!);
  const response = await fetch('/api/checkout-session', {
    method: 'POST',
    body: JSON.stringify({ tier, userId: user.id })
  });
  const session = await response.json();
  await stripe?.redirectToCheckout({ sessionId: session.id });
};
```

### For Razorpay:

```tsx
const handleUpgrade = async (tier: string) => {
  const options = {
    key: process.env.VITE_RAZORPAY_KEY_ID,
    amount: getPriceInPaise(tier),
    currency: 'INR',
    name: 'AssessmentCore',
    description: `${tier} Plan`,
    handler: (response) => {
      // Verify payment and update user tier
    }
  };
  const razorpay = new window.Razorpay(options);
  razorpay.open();
};
```

---

## Troubleshooting

### Issue: "Supabase environment variables are not set"
- Solution: Make sure `.env.local` file exists with correct values
- Restart dev server after adding env variables

### Issue: "Email verification not working"
- Solution: Check Supabase email provider settings
- Verify email template is configured
- Check spam folder for verification email

### Issue: "User can access batch creator even after quota"
- Solution: Clear browser cache/localStorage
- Check that `user_usage` table has correct data
- Verify RLS policies are enabled

### Issue: "CORS errors"
- Solution: These should be handled automatically by Supabase
- If persists, check Supabase project CORS settings

---

## Security Best Practices

1. **Never commit `.env.local`** - Add to `.gitignore`
2. **Use Row Level Security** - Already configured in database setup
3. **Validate on backend** - Don't trust client-side validation for quotas
4. **Use HTTPS only** - Required for production
5. **Rotate secrets** - Regenerate keys periodically
6. **Monitor usage** - Check Supabase analytics dashboard

---

## Production Deployment

1. Create separate Supabase project for production
2. Set production environment variables in your hosting provider
3. Enable HTTPS and security headers
4. Set up proper CORS configuration
5. Configure email authentication for your domain
6. Enable backups in Supabase settings
7. Monitor usage and set up alerts

---

## Support & Documentation

- Supabase Docs: https://supabase.com/docs
- Auth Documentation: https://supabase.com/docs/guides/auth
- Database Guide: https://supabase.com/docs/guides/database
- React Integration: https://supabase.com/docs/guides/getting-started/quickstarts/reactjs

---

## Next Steps

1. Complete the Supabase setup
2. Test authentication flow end-to-end
3. Integrate with payment provider (Stripe/Razorpay/etc)
4. Set up email sending via your organization's SMTP
5. Deploy to production
6. Monitor and iterate based on user feedback
