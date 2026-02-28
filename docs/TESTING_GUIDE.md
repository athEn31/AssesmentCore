# Testing Guide - Authentication & Feature-Gating System

## 🧪 Local Testing Setup

### Prerequisites
- Node.js installed
- npm/pnpm working
- Supabase account created
- Environment variables configured in `.env.local`

---

## ✅ Pre-Launch Checklist

- [ ] `.env.local` file created with Supabase credentials
- [ ] Database tables created (ran DATABASE_SETUP.sql)
- [ ] RLS policies enabled
- [ ] Email confirmation enabled in Supabase
- [ ] Dev server can start without errors

---

## 🚀 Starting the Dev Server

```bash
cd c:\Users\krish\Downloads\AC

# Install dependencies (if needed)
npm install

# Start dev server
npm run dev

# Server should be at http://localhost:5173
```

---

## 🔬 Test Scenarios

### Scenario 1: Registration Flow

**Expected Behavior:**
1. User is not logged in
2. Visit: http://localhost:5173/workspace
3. Click "Batch QTI Creator" in sidebar
4. Should see "Authentication Required" prompt

**Test Steps:**
```
1. Click "Create Account" button
   ✓ Should navigate to /auth/register
   
2. Fill registration form:
   - Name: "Test User"
   - Email: "test@example.com"
   - Password: "TestPass123!"
   - Confirm: "TestPass123!"
   
3. Click "Create Account"
   ✓ Loading spinner appears
   ✓ Success message shown
   ✓ Auto-redirects to /auth/verify-email
```

**Backend Check:**
Open Supabase dashboard:
- Auth > Users: New user should appear
- Database > user_profiles: New profile created

---

### Scenario 2: Email Verification

**Test Steps:**
```
1. On verification page:
   - Should see email address: "test@example.com"
   
2. In development, get OTP from Supabase:
   - Auth > Users > [your user] > Copy email_confirmed link
   - OR check email in test inbox
   
3. Enter 6-digit code
   ✓ "Verify Email" button enabled only after 6 digits
   
4. Click "Verify Email"
   ✓ Loading spinner appears
   ✓ Success message shown
   ✓ Auto-redirects to /workspace
```

**Optional Features:**
```
- Click "Resend Code": 
  ✓ Shows "Verification code sent!" message
  ✓ Button disabled for 60 seconds
  
- Wrong code:
  ✓ Error message: "Verification failed..."
```

---

### Scenario 3: Login

**Test Steps:**
```
1. Navigate to: http://localhost:5173/auth/login

2. Enter credentials (from Scenario 1):
   - Email: "test@example.com"
   - Password: "TestPass123!"

3. Click "Login"
   ✓ Loading spinner appears
   ✓ Success message shown
   ✓ Auto-redirects to /workspace

4. Check browser storage:
   - F12 > Application > Cookies
   - Should see: "sb-*-auth-token"
```

---

### Scenario 4: Batch Creator - First Time (With Quota)

**Test Steps:**
```
1. Logged in, click "Batch QTI Creator"
   ✓ Should show full batch creator interface
   ✓ Header says: "Free trial - 1 export remaining this month"

2. Upload a CSV file with questions
   ✓ File validation starts
   ✓ Progress bar shows 0-100%
   ✓ Questions are validated

3. Review validation report
   ✓ Can see valid/caution/rejected counts
   ✓ Can edit question data

4. Click "Export as QTI"
   ✓ Export starts
   ✓ ZIP file downloads
   ✓ "Successfully exported X questions" message

5. After export:
   ✓ Should redirect to /pricing page (after 2 seconds)
   ✓ Shows "You've used your free export quota"
```

**Backend Check:**
Supabase dashboard:
- Database > user_usage > Check exports_count = 1
- last_export_at = today's date

---

### Scenario 5: Batch Creator - Second Time (Quota Exhausted)

**Test Steps:**
```
1. Logged in, click "Batch QTI Creator"
   ✓ Should see "Upgrade Your Plan" modal
   ✓ Message: "You have 1 export(s) this month"
   ✓ Shows "Professional Plan" benefits

2. Click "View Pricing Plans"
   ✓ Navigates to /pricing page
   ✓ Shows three pricing tiers

3. On Pricing Page:
   ✓ Free plan shows "Current Plan" button
   ✓ Professional plan shows "Upgrade Now" (highlighted)
   ✓ Enterprise shows "Contact Sales"
```

---

### Scenario 6: Logout

**Test Steps:**
```
1. Click profile/logout button
   ✓ Session cleared
   ✓ Redirected to home page /
   ✓ Browser auth token removed
   ✓ useAuth() hook returns: isAuthenticated = false

2. Try to access /workspace
   ✓ If protected: redirects to /auth/login
   ✓ If not protected: allows access but shows login prompts
```

---

## 🔍 Testing the useAuth Hook

### Test 1: In React Component

```tsx
// src/app/pages/TestPage.tsx
import { useAuth } from '@/contexts/AuthContext';

export function TestPage() {
  const { user, isAuthenticated, userUsage, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Auth Debug</h1>
      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      <p>User Email: {user?.email || 'None'}</p>
      <p>User ID: {user?.id || 'None'}</p>
      <p>Exports Used: {userUsage?.exports_count || 0}</p>
      <p>Last Export: {userUsage?.last_export_at || 'Never'}</p>
      <pre>{JSON.stringify({ user, userUsage }, null, 2)}</pre>
    </div>
  );
}
```

Then add route to `src/app/routes.ts`:
```tsx
{
  path: "/test",
  Component: TestPage,
}
```

Visit: http://localhost:5173/test

---

## 🗂️ Database Testing

### Check User Was Created

```sql
-- In Supabase SQL Editor
SELECT id, email, created_at 
FROM user_profiles 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Result:**
- One row with your test user email
- created_at = today

### Check Usage Tracking

```sql
-- After first export
SELECT user_id, exports_count, last_export_at
FROM user_usage
WHERE user_id = 'user-uuid-from-above';
```

**Expected Result:**
- exports_count = 1
- last_export_at = today after export

### Check RLS Policies

```sql
-- This should work
SELECT * FROM user_profiles WHERE id = 'your-user-id';

-- This should fail or return empty
SELECT * FROM user_profiles WHERE id = 'other-user-id';
```

---

## 🔐 Security Testing

### Test 1: Password Validation

```
On registration page, try passwords:
- "short" → Error: "Password must be 8+ chars"
- "ValidPass123" → OK
- "Test123" → Error: "Must be 8+ chars"
```

### Test 2: Email Validation

```
Try emails:
- "notanemail" → Error shown
- "test@" → Error shown
- "test@example.com" → OK
```

### Test 3: Session Persistence

```
1. Login successfully
2. Close browser tab (not the whole app)
3. Reopen in new tab
4. Go to http://localhost:5173/workspace
✓ Should still be logged in
✓ useAuth() shows authenticated user
```

### Test 4: Token Expiry

```
1. Login and get token
2. In DevTools, manually delete auth token:
   - Application > Cookies > sb-*-auth-token > Delete
3. Refresh page
✓ Should show logged-out state
✓ Batch creator shows login prompt
```

---

## 📊 Testing with Real Supabase Logs

### View Auth Events

1. Go to Supabase Dashboard
2. Auth > Logs
3. Look for:
   - User sign ups
   - Email confirmations
   - Failed login attempts
   - Session events

### View Database Changes

1. Database > user_profiles > Data
   - Should see rows for each new user

2. Database > user_usage > Data
   - Should see exports_count increment

---

## 🐛 Debug Mode

### Enable Console Logging

Add to `src/services/authService.ts`:
```tsx
// At top of each function
console.log('Auth Function Called:', {
  functionName: 'login',
  email,
  timestamp: new Date().toISOString()
});
```

Then check browser console (F12) for logs.

### Test Error Scenarios

```tsx
// In VerifyEmailPage, try:
- Wrong OTP: "000000"
  ✓ Should show error message
  
- Invalid email format
  ✓ Should show validation error
  
- User already exists during signup
  ✓ Should show error message
```

---

## ✨ E2E Test Checklist

Complete this checklist for full feature validation:

### Authentication
- [ ] Register with new email
- [ ] Receive verification email
- [ ] Enter wrong OTP (should fail)
- [ ] Enter correct OTP (should verify)
- [ ] Login with correct password
- [ ] Login with wrong password (should fail)
- [ ] Session persists on page refresh
- [ ] Logout clears session

### Feature Gating
- [ ] Unauthenticated user can't access batch creator
- [ ] Authenticated user can access batch creator
- [ ] Upload and validate questions
- [ ] Export QTI file
- [ ] After first export, see pricing page
- [ ] Second batch creator click shows quota error
- [ ] Can navigate to pricing page

### Quota Management
- [ ] Initial exports_count = 0
- [ ] After export, exports_count = 1
- [ ] Can't export when count > 0 on free tier
- [ ] Premium user can export unlimited

---

## 📈 Performance Testing

### Test Page Load

```bash
# With DevTools open:
# F12 > Performance > Record

# Steps:
1. Load /workspace
2. Click Batch Creator
3. Stop recording

# Check:
- Page loads in < 2 seconds
- No "red" performance issues
```

### Test API Response Times

```
F12 > Network tab

Register request:
✓ Should complete in < 1 second
✓ Response: 200 OK

Verify request:
✓ Should complete in < 1 second
✓ Response: 200 OK
```

---

## 🚀 Common Test Data

### Test Accounts

```
Account 1:
- Email: test1@example.com
- Password: TestPassword123
- Purpose: First-time user flow

Account 2:
- Email: test2@example.com
- Password: TestPassword456
- Purpose: Already used quota

Account 3:
- Email: admin@example.com
- Password: AdminPassword789
- Purpose: Future admin features
```

---

## 📝 Logging Test Results

### Test Result Template

```
Date: [Date]
Test Scenario: [Name]
Tester: [Your name]
Environment: Local Development

## Test Steps:
1. [Step 1]
2. [Step 2]
... 

## Expected Results:
- [ ] Step 1 result
- [ ] Step 2 result
...

## Actual Results:
- [✓/✗] Step 1
- [✓/✗] Step 2
...

## Issues Found:
[List any bugs or unexpected behavior]

## Notes:
[Any other observations]
```

---

## 🔗 Helpful Links

- Supabase Logs: https://app.supabase.com/project/_/logs/auth
- Browser DevTools: F12
- Network Tab: F12 > Network
- Local Storage: F12 > Application > Local Storage
- This Guide: TESTING_GUIDE.md

---

## ❓ FAQ

**Q: How do I get the OTP for verification?**
A: 
1. Option 1: Check your email inbox for test message
2. Option 2: In Supabase, Auth > Users > [your user] > See email confirmation details
3. Option 3: Check the JavaScript console for test OTP

**Q: Can I test with the same email twice?**
A: No, each email can only have one account. Use different emails for testing.

**Q: How do I reset a user account?**
A: In Supabase:
1. Auth > Users
2. Find the user
3. Click delete icon
4. Re-register with same email

**Q: Page not updating after changes?**
A: Try:
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache: F12 > Network > "Disable cache"
3. Restart dev server: Ctrl+C then npm run dev

**Q: Getting "CORS" errors?**
A: Supabase handles CORS automatically. Check:
1. Correct Supabase URL in .env.local
2. Anon key is valid
3. Browser console for full error message

---

**Happy Testing! 🧪**
