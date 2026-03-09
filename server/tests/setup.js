"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables for testing
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
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
