#!/usr/bin/env node

/**
 * QuizHistory Verification Script Runner
 * 
 * This script tests the QuizHistory endpoints to verify they're working correctly.
 * It performs basic connectivity and authentication tests.
 * 
 * Usage:
 *   npm run test:quiz-history
 *   or
 *   npx ts-node tests/quizHistory.test.ts
 */

import { runSimpleVerification } from './quizHistory.test';

console.log('🧪 QuizHistory Endpoint Verification');
console.log('=====================================');

runSimpleVerification()
  .then((success) => {
    if (success) {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    } else {
      console.log('\n💥 Tests failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Test execution failed:', error);
    process.exit(1);
  });
