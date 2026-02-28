# Quick Reference Card - Auth System

## 🚀 30-Second Quick Start

```bash
# 1. Create Supabase project at https://app.supabase.com
# 2. Create .env.local
VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key

# 3. Run SQL from docs/DATABASE_SETUP.sql in Supabase
# 4. Start dev server
npm run dev

# 5. Test at http://localhost:5173/workspace
```

---

## 💻 useAuth Hook Cheat Sheet

```tsx
import { useAuth } from '@/contexts/AuthContext';

const {
  user,              // { id, email, ...}
  isAuthenticated,   // boolean
  loading,           // boolean
  userProfile,       // { email, full_name, ... }
  userUsage,         // { exports_count, last_export_at }
  login,             // async (email, password)
  register,          // async (email, password, name)
  logout,            // async ()
  verifyEmail,       // async (email, token)
  trackExport,       // async ()
  refreshUsage       // async ()
} = useAuth();
```

---

## 📁 Key Files to Know

| File | Purpose |
|------|---------|
| `src/services/authService.ts` | All auth API calls |
| `src/contexts/AuthContext.tsx` | Global auth state |
| `src/app/routes.ts` | Route definitions |
| `src/app/pages/auth/*` | Auth pages |
| `src/app/pages/PricingPage.tsx` | Pricing page |
| `src/app/pages/workspace/BatchCreator.tsx` | Protected feature |
| `docs/DATABASE_SETUP.sql` | Database schema |

---

## 🔗 Routes

```
/ → Home page
/auth/register → Registration
/auth/login → Login
/auth/verify-email → Email verification
/pricing → Pricing page
/workspace → Workspace (with Batch Creator)
/workspace/batch-creator → Batch creator
/workspace/qti-renderer → QTI renderer
```

---

## 🗄️ Database Tables

### user_profiles
```sql
SELECT * FROM user_profiles WHERE id = auth.uid();
```

### user_usage
```sql
SELECT exports_count FROM user_usage WHERE user_id = auth.uid();
```

---

## 🎯 Common Tasks

### Check if user is authenticated
```tsx
const { isAuthenticated } = useAuth();
if (!isAuthenticated) { /* show login */ }
```

### Get current user info
```tsx
const { user, userProfile } = useAuth();
console.log(user?.email);
console.log(userProfile?.full_name);
```

### Track an export
```tsx
await trackExport();
const { userUsage } = useAuth();
console.log(userUsage.exports_count); // Incremented
```

### Redirect if not authenticated
```tsx
if (!isAuthenticated) {
  navigate('/auth/login');
}
```

### Check quota
```tsx
const isQuotaExhausted = userUsage && userUsage.exports_count > 0;
if (isQuotaExhausted) {
  navigate('/pricing');
}
```

---

## 🔐 Environment Variables

```env
# .env.local
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Get from: Supabase > Settings > API

---

## 📊 Customization

### Change quota limit
In `BatchCreator.tsx`:
```tsx
// From: 1 export
const canUseFeature = !userUsage || userUsage.exports_count === 0;

// To: 5 exports
const canUseFeature = !userUsage || userUsage.exports_count < 5;
```

### Customize pricing
In `PricingPage.tsx`:
```tsx
const pricingTiers = [
  { name: 'Pro', price: '$29', ... },
  { name: 'Enterprise', price: 'Custom', ... }
];
```

---

## 🧪 Quick Test URLs

- Registration: http://localhost:5173/auth/register
- Login: http://localhost:5173/auth/login
- Pricing: http://localhost:5173/pricing
- Batch Creator: http://localhost:5173/workspace/batch-creator

---

## ⚠️ Common Issues

| Issue | Solution |
|-------|----------|
| Can't find modules | Restart dev server |
| Email not received | Check spam folder |
| Auth not working | Check .env.local |
| User stuck on auth | Clear cookies + localStorage |
| RLS errors | Run SQL setup in Supabase |

---

## 📚 Full Documentation

- `IMPLEMENTATION_COMPLETE.md` - Overview
- `docs/AUTH_IMPLEMENTATION_GUIDE.md` - Setup
- `docs/TESTING_GUIDE.md` - Testing
- `docs/DATABASE_SETUP.sql` - Database schema

---

## 🚀 Next Steps

1. ✅ Create Supabase account
2. ✅ Add .env.local
3. ✅ Run DATABASE_SETUP.sql
4. ✅ npm run dev
5. ⏳ Test authentication flow
6. ⏳ Integrate payment processor
7. ⏳ Deploy to production

---

## 🔗 Useful Links

- Supabase Docs: https://supabase.com/docs
- Auth Setup: https://supabase.com/docs/guides/auth
- Your Supabase Dashboard: https://app.supabase.com
- React Router: https://reactrouter.com

---

**Quick! You're ready to go. 🚀**
