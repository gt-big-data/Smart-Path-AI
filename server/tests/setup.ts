import dotenv from 'dotenv';
import path from 'path';

// Load environment variables for testing
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Mock OpenAI for testing
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: JSON.stringify({
                isCorrect: true,
                score: 85,
                feedback: "Great answer!",
                conceptualHint: "Think about the core concepts",
                thinkingPrompt: "Can you explain why?"
              })
            }
          }]
        })
      }
    }
  }))
})); 