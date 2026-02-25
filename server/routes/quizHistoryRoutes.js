"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const quizHistoryController_1 = require("../controllers/quizHistoryController");
const router = express_1.default.Router();
// Save a new quiz history when a quiz is completed
router.post('/', quizHistoryController_1.saveQuizHistory);
// Process all existing quiz history to create progress records (MUST come before /:id)
router.post('/process-all', quizHistoryController_1.processAllQuizHistory);
// Get all quiz histories for the authenticated user
router.get('/', quizHistoryController_1.getUserQuizHistories);
// Admin/debug endpoint to get all quiz histories across users
router.get('/admin/all', quizHistoryController_1.getAllQuizHistories);
// Get a specific quiz history by ID (user must own it) - MUST be last
router.get('/:id', quizHistoryController_1.getQuizHistoryById);
exports.default = router;
