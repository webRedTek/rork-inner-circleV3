# Database Query Fixes

## Fix: user_daily_usage Table Query Missing Date Parameter

**Date:** 2025-01-05  
**Issue:** Discover screen showing black/empty despite successful profile loading  
**Root Cause:** Incorrect database query for daily usage records

### Problem Description

The `user_daily_usage` table was designed to store **daily records** with a unique constraint on `(user_id, date)`, meaning one record per user per day. However, the usage store was querying only by `user_id`:

```typescript
// ❌ WRONG: Missing date filter
const { data, error } = await supabase
  .from('user_daily_usage')
  .select('*')
  .eq('user_id', userId)
  .single();
```

### Database Schema Context

From the online dashboard, the table structure shows:
```sql
constraint user_daily_usage_user_id_date_key unique (user_id, date)
```

This means the table expects:
- Multiple records per user (one per day)
- Each record identified by `user_id` + `date` combination
- Daily usage tracking, not cumulative totals

### Symptoms

1. **Debug logs showing:** "No user_daily_usage record found, creating default totals"
2. **Discover screen:** Black/empty despite 11 profiles loaded successfully
3. **Usage tracking:** Always falling back to default values (0 counts)
4. **SwipeCards:** Not rendering due to initialization issues

### Solution Implemented

**File:** `icV3/store/usage-store.ts`  
**Function:** `fetchDatabaseTotals()`

```typescript
// ✅ CORRECT: Query for today's specific record
const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
const { data, error } = await supabase
  .from('user_daily_usage')
  .select('*')
  .eq('user_id', userId)
  .eq('date', today)        // Added missing date filter
  .single();
```

### Why This Fix Works

1. **Matches Table Design:** Now queries for the specific daily record
2. **Handles New Days:** For new days, no record exists → creates default totals (correct behavior)
3. **Tracks Daily Usage:** For existing days, finds the actual usage counts
4. **Enables Proper Initialization:** Usage store completes initialization successfully

### Expected Behavior After Fix

- **New Day:** "No usage stats found" (normal) → Creates defaults → SwipeCards render
- **Existing Day:** Finds actual usage record → Shows real counts → SwipeCards render
- **Debug Logs:** Show date-specific query: `"...for user 601931... on date 2025-01-05"`
- **Discover Screen:** Initializes properly and shows SwipeCards

### Git Commits

1. `ee751c5` - Fix database table name in usage store (usage_stats -> user_daily_usage)
2. `bd31732` - Fix user_daily_usage query to include date parameter (daily records)

### Related Files

- `icV3/store/usage-store.ts` - Main fix location
- `icV3/app/(tabs)/discover.tsx` - Screen that was affected
- `icV3/components/SwipeCards.tsx` - Component that wasn't rendering

---

## Notes

- The `user_daily_usage` table is designed for **daily tracking**, not cumulative totals
- Each user can have multiple records (one per day)
- The unique constraint `(user_id, date)` enforces this daily structure
- Always include both `user_id` and `date` when querying this table 