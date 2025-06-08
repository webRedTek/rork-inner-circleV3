// This file is kept as a placeholder but all seeding functionality has been removed
// as requested by the user since data has been manually entered into the database

/**
 * Reset the seed flag in AsyncStorage
 * This is used for testing and development purposes
 */
export const resetSeedFlag = async (): Promise<void> => {
  console.log('Seed flag reset functionality has been removed as data is manually seeded');
};

/**
 * Placeholder function to maintain compatibility with existing code
 * Always returns true since data is manually seeded
 */
export const hasSeededDemoData = async (): Promise<boolean> => {
  return true;
};