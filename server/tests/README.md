# QuizHistory Endpoint Verification Tests

This directory contains verification scripts to test the QuizHistory MongoDB endpoints.

## Test Files

### 1. `quizHistory.test.ts`
**Basic endpoint verification** - Tests that endpoints are properly secured and responding.

**Features:**
- Tests POST `/api/quiz-history/` endpoint (expects 401 Unauthorized)
- Tests GET `/api/quiz-history/` endpoint (expects 401 Unauthorized)  
- Tests server connectivity
- Verifies authentication is working correctly

### 2. `quizHistoryComprehensive.test.ts`
**Comprehensive testing** - More detailed testing with mock sessions and data validation.

**Features:**
- Creates mock session for testing
- Tests full POST/GET workflow
- Validates data integrity
- Comprehensive error handling
- Cleanup logging

### 3. `runQuizHistoryTest.ts`
**Test runner** - Simple script to execute the basic verification test.

## Running the Tests

### Option 1: Using npm script (Recommended)
```bash
npm run test:quiz-history
```

### Option 2: Direct execution
```bash
# Basic test
npx ts-node --project tsconfig.json tests/runQuizHistoryTest.ts

# Comprehensive test
npx ts-node --project tsconfig.json tests/quizHistoryComprehensive.test.ts

# Direct test file
npx ts-node --project tsconfig.json tests/quizHistory.test.ts
```

## Prerequisites

1. **Server must be running** on `http://localhost:4000`
2. **MongoDB must be connected** (server should show "MongoDB connected")
3. **Environment variables** must be loaded (`.env` file)

## Expected Results

### ✅ Success Case
```
🧪 QuizHistory Endpoint Verification
=====================================
🚀 Starting Simple QuizHistory Endpoint Verification (No Auth)
============================================================
📝 Testing POST /api/quiz-history/ (expecting 401 Unauthorized)
✅ Correctly received 401 Unauthorized for POST

📖 Testing GET /api/quiz-history/ (expecting 401 Unauthorized)
✅ Correctly received 401 Unauthorized for GET

🌐 Testing server connectivity
✅ Server is running and responding

============================================================
✅ Simple verification passed - endpoints are properly secured
============================================================

🎉 All tests completed successfully!
```

### ❌ Failure Case
If the server is not running or endpoints are not working, you'll see error messages indicating the specific issues.

## Test Data

The tests use mock data that includes:

```typescript
{
  concepts: [
    {
      conceptID: 'test_concept_001',
      name: 'Test Concept Name'
    }
  ],
  questions: [
    {
      questionText: 'Test question?',
      userAnswer: 'Test answer',
      correctAnswer: 'Correct answer',
      explanation: 'Test explanation',
      timestamp: '2024-01-15T10:30:00.000Z'
    }
  ]
}
```

## Notes

- **Authentication Required**: The endpoints require user authentication, so tests expect 401 responses when not authenticated
- **No DELETE Endpoint**: Currently no cleanup endpoint exists, so test data cleanup is logged but not automated
- **Session Management**: Tests use mock sessions for comprehensive testing
- **Data Integrity**: Tests verify that saved data matches retrieved data

## Troubleshooting

### Server Not Running
```
❌ Server is not responding: Error: connect ECONNREFUSED 127.0.0.1:4000
```
**Solution**: Start the server with `npm run dev`

### MongoDB Not Connected
```
❌ Could not connect to MongoDB
```
**Solution**: Check MongoDB connection string in `.env` file

### Authentication Issues
```
❌ Unexpected: Save succeeded without authentication
```
**Solution**: This indicates authentication middleware is not working properly

## Adding New Tests

To add new test cases:

1. Create a new test file in this directory
2. Import necessary dependencies (`axios`, `dotenv`)
3. Use the existing test patterns for consistency
4. Add any new npm scripts to `package.json` if needed
5. Update this README with new test information
