# Project Overview

This file serves as a placeholder for any additional information or updates regarding environment operations.

Note: Clearing the code inspector cache or performing system-level operations is outside the scope of this environment as git and EAS are not available. If you have specific code changes or other development tasks within the project files, I'm ready to assist with those.

For any further assistance or specific requests related to the codebase, please let me know!

# iC V3 - Entrepreneur Matching App

## Store Authority Pattern

To prevent errors caused by inconsistent data structures across the app, we've implemented a **Store Authority Pattern** where certain stores are designated as the "source of truth" for specific data types.

### Auth Store Authority
The Auth Store is the authority for all authentication and user data:

```typescript
// ✅ Use these authority methods
const userProfile = useAuthStore.getState().getUserProfile();
const isAuthenticated = useAuthStore.getState().isUserAuthenticated();
const userRole = useAuthStore.getState().getUserRole();
const membershipTier = useAuthStore.getState().getUserMembershipTier();
const tierSettings = useAuthStore.getState().getTierSettings();
```

### Usage Store Authority
The Usage Store is the authority for all usage tracking and limit checking:

```typescript
// ✅ Use these authority methods
const canSwipe = useUsageStore.getState().checkSwipeLimit();
const canMatch = useUsageStore.getState().checkMatchLimit();
const currentUsage = useUsageStore.getState().getCurrentUsage('swipe');
const allLimits = useUsageStore.getState().checkAllLimits();
const databaseTotals = useUsageStore.getState().getDatabaseTotals();
```

### Benefits of Authority Pattern
1. **Consistency**: All components get the same data format
2. **Type Safety**: Guaranteed return types prevent runtime errors
3. **Single Source of Truth**: Changes in one place update everywhere
4. **Error Prevention**: Prevents "Cannot read properties of undefined" errors

### Usage Guidelines
- ❌ **Don't** access store state directly: `usageStore.usageCache.counts`
- ✅ **Do** use authority methods: `usageStore.getCurrentUsage('swipe')`
- ❌ **Don't** duplicate data transformation logic across components
- ✅ **Do** rely on the authority methods for consistent data

### Example Fix
The recent `CacheViewModal` error was caused by accessing `usageCache.usageData` directly instead of using the authority methods. The fix:

```typescript
// ❌ Before (causes errors)
const data = usageCache.usageData[type];

// ✅ After (consistent and safe)
const currentCount = useUsageStore.getState().getCurrentUsage(type);
```

### Authority Method Types
All authority methods include proper TypeScript types defined in `types/user.ts`:
- `AuthStoreAuthority` - Interface for auth authority methods
- `UsageStoreAuthority` - Interface for usage authority methods

This ensures that changes to store structures are reflected in the authority methods, preventing breaking changes across the app.