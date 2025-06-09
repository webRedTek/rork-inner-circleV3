import { initSupabase, testSupabaseConnection, isSupabaseConfigured, supabase, convertToCamelCase, convertToSnakeCase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useMatchesStore } from '@/store/matches-store';
import { useMessagesStore } from '@/store/messages-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, Match, Message } from '@/types/user';

// Helper function to extract readable error message
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  if (typeof error === 'string') return error;
  
  if (error.message) return error.message;
  
  if (error.error && error.error.message) return error.error.message;
  
  if (error.details) return String(error.details);
  
  if (error.code) return `Error code: ${error.code}`;
  
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

// Test result type
export type TestResult = {
  success: boolean;
  message: string;
  error?: string;
};

// Collection of test results
export type SupabaseTestResults = {
  connectionTest: TestResult;
  authTest?: TestResult;
  matchesTest?: TestResult;
  messagesTest?: TestResult;
};

/**
 * Runs a comprehensive test suite for Supabase integration
 * @returns Promise with test results
 */
export const runSupabaseTests = async (): Promise<SupabaseTestResults> => {
  console.log('Starting Supabase test suite...');
  const results: SupabaseTestResults = {
    connectionTest: { success: false, message: 'Connection test not run' }
  };

  // 1. Test Supabase Configuration and Connection
  try {
    if (!isSupabaseConfigured()) {
      results.connectionTest = {
        success: false,
        message: 'Supabase is not configured',
        error: 'Please configure Supabase URL and Anon Key in the setup screen'
      };
      return results;
    }

    const initialized = await initSupabase();
    if (!initialized) {
      results.connectionTest = {
        success: false,
        message: 'Failed to initialize Supabase',
        error: 'Supabase initialization failed'
      };
      return results;
    }

    const connectionResult = await testSupabaseConnection();
    if (!connectionResult.success) {
      results.connectionTest = {
        success: false,
        message: 'Connection test failed',
        error: getReadableError(connectionResult.error)
      };
      return results;
    }

    results.connectionTest = {
      success: true,
      message: 'Successfully connected to Supabase'
    };
    console.log('Connection test passed');
  } catch (error) {
    results.connectionTest = {
      success: false,
      message: 'Connection test error',
      error: getReadableError(error)
    };
    return results;
  }

  // 2. Test Authentication
  try {
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated) {
      results.authTest = {
        success: false,
        message: 'Authentication test skipped - no user logged in',
        error: 'Please log in or sign up a test user before running auth tests'
      };
    } else {
      // Test fetching user profile
      const user = authState.user;
      results.authTest = {
        success: true,
        message: `Authentication test passed - user ${user?.name || user?.email} is logged in`
      };
      console.log('Authentication test passed');
    }
  } catch (error) {
    results.authTest = {
      success: false,
      message: 'Authentication test failed',
      error: getReadableError(error)
    };
  }

  // 3. Test Matches Functionality
  try {
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated) {
      results.matchesTest = {
        success: false,
        message: 'Matches test skipped - no user logged in',
        error: 'Authentication required for matches test'
      };
    } else {
      const matchesStore = useMatchesStore.getState();
      await matchesStore.fetchPotentialMatches();
      
      if (matchesStore.error) {
        throw new Error(matchesStore.error);
      }
      
      results.matchesTest = {
        success: true,
        message: `Matches test passed - fetched ${matchesStore.potentialMatches.length} potential matches`
      };
      console.log('Matches test passed');
    }
  } catch (error) {
    results.matchesTest = {
      success: false,
      message: 'Matches test failed',
      error: getReadableError(error)
    };
  }

  // 4. Test Messages Functionality
  try {
    const authState = useAuthStore.getState();
    const matchesStore = useMatchesStore.getState();
    
    if (!authState.isAuthenticated) {
      results.messagesTest = {
        success: false,
        message: 'Messages test skipped - no user logged in',
        error: 'Authentication required for messages test'
      };
    } else if (matchesStore.matches.length === 0) {
      results.messagesTest = {
        success: false,
        message: 'Messages test skipped - no matches found',
        error: 'At least one match required for messages test'
      };
    } else {
      // Get first match for testing
      const testMatch = matchesStore.matches[0];
      const conversationId = testMatch.id;
      const receiverId = testMatch.userId === authState.user?.id ? testMatch.matchedUserId : testMatch.userId;
      
      // Test sending a message
      await useMessagesStore.getState().sendMessage(
        conversationId,
        'Test message from Supabase test suite',
        receiverId
      );
      
      const messagesStore = useMessagesStore.getState();
      if (messagesStore.error) {
        throw new Error(messagesStore.error);
      }
      
      results.messagesTest = {
        success: true,
        message: 'Messages test passed - test message sent successfully'
      };
      console.log('Messages test passed');
    }
  } catch (error) {
    results.messagesTest = {
      success: false,
      message: 'Messages test failed',
      error: getReadableError(error)
    };
  }

  console.log('Supabase test suite completed', results);
  return results;
};

/**
 * Seeds the database with test data if it's empty
 * @returns Promise with test result
 */
export const seedTestData = async (): Promise<TestResult> => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase not configured',
        error: 'Please configure Supabase before seeding data'
      };
    }

    // Check if database already has data
    const { data: existingUsers, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      return {
        success: false,
        message: 'Failed to check database status',
        error: getReadableError(error)
      };
    }

    if (existingUsers && existingUsers.length > 0) {
      return {
        success: false,
        message: 'Database already contains data',
        error: 'Seeding skipped as database is not empty'
      };
    }

    // Insert test users
    const testUsers = [
      {
        id: `test-user-${Date.now()}-1`,
        email: 'test1@example.com',
        name: 'Test User 1',
        business_field: 'Technology',
        entrepreneur_status: 'current',
        membership_tier: 'basic',
        business_verified: false,
        created_at: Date.now()
      },
      {
        id: `test-user-${Date.now()}-2`,
        email: 'test2@example.com',
        name: 'Test User 2',
        business_field: 'Technology',
        entrepreneur_status: 'current',
        membership_tier: 'basic',
        business_verified: false,
        created_at: Date.now()
      }
    ];

    const { error: usersError } = await supabase
      .from('users')
      .insert(testUsers);

    if (usersError) {
      return {
        success: false,
        message: 'Failed to seed test users',
        error: getReadableError(usersError)
      };
    }

    return {
      success: true,
      message: 'Test data seeded successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error seeding test data',
      error: getReadableError(error)
    };
  }
};

/**
 * Clears test data from the database
 * @returns Promise with test result
 */
export const clearTestData = async (): Promise<TestResult> => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase not configured',
        error: 'Please configure Supabase before clearing data'
      };
    }

    // Delete test data from tables
    const tables = ['messages', 'matches', 'likes', 'users'];
    const errors = [];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', 'non-existent-id'); // This is a workaround to delete all rows
      
      if (error) {
        errors.push(`Failed to clear ${table}: ${getReadableError(error)}`);
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        message: 'Failed to clear all test data',
        error: errors.join('; ')
      };
    }

    return {
      success: true,
      message: 'Test data cleared successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Error clearing test data',
      error: getReadableError(error)
    };
  }
};

/**
 * Tests authentication by creating a test user if none exists
 * @param email Test user email
 * @param password Test user password
 * @returns Promise with test result
 */
export const testAuthSignup = async (email: string, password: string): Promise<TestResult> => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase not configured',
        error: 'Please configure Supabase before testing auth'
      };
    }

    // Check if already authenticated
    const authState = useAuthStore.getState();
    if (authState.isAuthenticated) {
      return {
        success: false,
        message: 'Already authenticated',
        error: 'Please log out before testing signup'
      };
    }

    // Attempt to sign up
    await useAuthStore.getState().signup({ 
      email, 
      name: 'Test User', 
      businessField: 'Technology', 
      entrepreneurStatus: 'current' 
    }, password);
    
    const newAuthState = useAuthStore.getState();
    if (newAuthState.error) {
      throw new Error(newAuthState.error);
    }

    if (!newAuthState.isAuthenticated) {
      throw new Error('Signup completed but user is not authenticated');
    }

    return {
      success: true,
      message: 'Auth signup test passed'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Auth signup test failed',
      error: getReadableError(error)
    };
  }
};

/**
 * Tests authentication by logging in with a test user
 * @param email Test user email
 * @param password Test user password
 * @returns Promise with test result
 */
export const testAuthLogin = async (email: string, password: string): Promise<TestResult> => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        message: 'Supabase not configured',
        error: 'Please configure Supabase before testing auth'
      };
    }

    // Check if already authenticated
    const authState = useAuthStore.getState();
    if (authState.isAuthenticated) {
      return {
        success: false,
        message: 'Already authenticated',
        error: 'Please log out before testing login'
      };
    }

    // Attempt to log in
    await useAuthStore.getState().login(email, password);
    
    const newAuthState = useAuthStore.getState();
    if (newAuthState.error) {
      throw new Error(newAuthState.error);
    }

    if (!newAuthState.isAuthenticated) {
      throw new Error('Login completed but user is not authenticated');
    }

    return {
      success: true,
      message: 'Auth login test passed'
    };
  } catch (error) {
    return {
      success: false,
      message: 'Auth login test failed',
      error: getReadableError(error)
    };
  }
};