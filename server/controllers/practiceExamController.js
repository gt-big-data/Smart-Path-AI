"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.route = exports.requirePracticeExamUser = void 0;
exports.practiceExamError = practiceExamError;
exports.generate = generate;
exports.list = list;
exports.get = get;
exports.createAttempt = createAttempt;
exports.listAttempts = listAttempts;
exports.getAttempt = getAttempt;
exports.saveDraft = saveDraft;
exports.submit = submit;
const mongoose_1 = require("mongoose");
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const User_1 = __importDefault(require("../models/User"));
const PracticeExam_1 = __importDefault(require("../models/PracticeExam"));
const PracticeExamAttempt_1 = __importDefault(require("../models/PracticeExamAttempt"));
const axiosConfig_1 = require("../utils/axiosConfig");
const practiceExamContract_1 = require("../services/practiceExamContract");
const GRADING_LEASE_MS = 10 * 60 * 1000;
class ApiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
function userId(req) {
    var _a, _b;
    const value = (_b = (_a = req.session) === null || _a === void 0 ? void 0 : _a.passport) === null || _b === void 0 ? void 0 : _b.user;
    const id = typeof value === 'object' ? value === null || value === void 0 ? void 0 : value._id : value;
    if (!id)
        throw new ApiError(401, 'Sign in to access practice exams');
    return String(id);
}
function serviceHeaders() {
    const token = process.env.PRACTICE_EXAM_SERVICE_TOKEN;
    if (!token)
        throw new ApiError(503, 'Practice exam service is not configured');
    return { 'X-Practice-Exam-Token': token };
}
function ownedChat(owner, chatId) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = yield User_1.default.findById(owner);
        const chat = user === null || user === void 0 ? void 0 : user.chats.find(c => c.chat_id === chatId);
        if (!chat)
            throw new ApiError(404, 'Chat not found');
        return chat;
    });
}
function ownedExam(req) {
    return __awaiter(this, void 0, void 0, function* () {
        const owner = userId(req);
        if (!mongoose_1.Types.ObjectId.isValid(req.params.examId))
            throw new ApiError(404, 'Exam not found');
        const record = yield PracticeExam_1.default.findOne({ _id: req.params.examId, user_id: owner }).select('+exam');
        if (!record)
            throw new ApiError(404, 'Exam not found');
        yield ownedChat(owner, record.chat_id);
        return record;
    });
}
function summary(record) {
    return { id: String(record._id), chat_id: record.chat_id, graph_id: record.graph_id,
        schema_version: record.schema_version, title: record.title, total_points: record.total_points,
        sample_filename: record.sample_filename, created_at: record.createdAt };
}
function attemptView(record) {
    return { id: String(record._id), exam_id: String(record.exam_id), status: record.status,
        revision: record.revision, answers: record.answers.map((a) => ({ part_id: a.part_id, user_answer: a.user_answer })),
        grading: record.status === 'submitted' ? record.grading : undefined,
        error: record.error, submitted_at: record.submitted_at,
        created_at: record.createdAt, updated_at: record.updatedAt };
}
const requirePracticeExamUser = (req, res, next) => {
    try {
        userId(req);
        next();
    }
    catch (error) {
        next(error);
    }
};
exports.requirePracticeExamUser = requirePracticeExamUser;
function practiceExamError(error, req, res, next) {
    var _a, _b, _c;
    if (res.headersSent)
        return next(error);
    if (error instanceof ApiError)
        return res.status(error.status).json({ error: error.message });
    if ((error === null || error === void 0 ? void 0 : error.code) === 'LIMIT_FILE_SIZE')
        return res.status(413).json({ error: 'Sample PDF must be at most 10 MB' });
    if ((error === null || error === void 0 ? void 0 : error.name) === 'MulterError')
        return res.status(400).json({ error: 'Upload exactly one practice_exam PDF' });
    if (axios_1.default.isAxiosError(error)) {
        const status = (_a = error.response) === null || _a === void 0 ? void 0 : _a.status;
        const detail = (_c = (_b = error.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.detail;
        if (status === 422 && typeof detail === 'string')
            return res.status(422).json({ error: detail });
        if (status === 404)
            return res.status(422).json({ error: 'The chat study graph is missing; upload notes first' });
        return res.status(502).json({ error: 'AI service unavailable. Your saved drafts are safe; try again.' });
    }
    console.error('[Practice Exam]', (error === null || error === void 0 ? void 0 : error.message) || 'Request failed');
    return res.status(500).json({ error: 'Practice exam request failed' });
}
// Express 4 does not forward rejected promises automatically.
const route = (handler) => (req, res, next) => { void handler(req, res).catch(next); };
exports.route = route;
function generate(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const owner = userId(req);
        const chatId = req.body.chat_id;
        if (typeof chatId !== 'string' || !chatId.trim())
            throw new ApiError(400, 'chat_id is required');
        const chat = yield ownedChat(owner, chatId);
        if (!chat.graph_id)
            throw new ApiError(409, 'Upload notes in this chat before generating an exam');
        if (!req.file || !req.file.originalname.toLowerCase().endsWith('.pdf'))
            throw new ApiError(400, 'practice_exam PDF is required');
        if (!req.file.buffer.subarray(0, 1024).includes(Buffer.from('%PDF-')))
            throw new ApiError(400, 'Uploaded file is not a PDF');
        const graphId = chat.graph_id;
        const form = new form_data_1.default();
        form.append('graph_id', graphId);
        form.append('practice_exam', req.file.buffer, { filename: req.file.originalname, contentType: 'application/pdf' });
        const response = yield axiosConfig_1.pythonServiceClient.post('/practice-exam/generate', form, {
            headers: Object.assign(Object.assign({}, form.getHeaders()), serviceHeaders()), timeout: 600000, maxBodyLength: 11 * 1024 * 1024,
        });
        try {
            (0, practiceExamContract_1.validateExam)((_a = response.data) === null || _a === void 0 ? void 0 : _a.exam);
        }
        catch (_c) {
            throw new ApiError(502, 'AI service returned an invalid exam; nothing was saved');
        }
        if (!((_b = response.data) === null || _b === void 0 ? void 0 : _b.format) || response.data.schema_version !== 2)
            throw new ApiError(502, 'AI service returned an invalid blueprint');
        yield ownedChat(owner, chatId);
        const record = yield PracticeExam_1.default.create({ user_id: owner, chat_id: chatId, graph_id: graphId,
            title: response.data.exam.title, total_points: response.data.exam.total_points,
            sample_filename: req.file.originalname, schema_version: 2,
            exam: response.data.exam, blueprint: response.data.format });
        return res.status(201).json(Object.assign(Object.assign({}, summary(record)), { exam: (0, practiceExamContract_1.publicExam)(record.exam) }));
    });
}
function list(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const owner = userId(req);
        const chatId = req.query.chat_id;
        if (typeof chatId !== 'string')
            throw new ApiError(400, 'chat_id is required');
        yield ownedChat(owner, chatId);
        const limit = Number(req.query.limit || 20);
        const offset = Number(req.query.offset || 0);
        if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
            throw new ApiError(400, 'limit must be 1–100 and offset a nonnegative integer');
        }
        const filter = { user_id: owner, chat_id: chatId };
        const [records, total] = yield Promise.all([
            PracticeExam_1.default.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit),
            PracticeExam_1.default.countDocuments(filter),
        ]);
        return res.json({ exams: records.map(summary), total, limit, offset });
    });
}
function get(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const record = yield ownedExam(req);
        return res.json(Object.assign(Object.assign({}, summary(record)), { exam: (0, practiceExamContract_1.publicExam)(record.exam) }));
    });
}
function createAttempt(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const exam = yield ownedExam(req);
        const owner = userId(req);
        const requestId = req.body.request_id;
        if (typeof requestId !== 'string' || !/^[\w-]{8,100}$/.test(requestId)) {
            throw new ApiError(400, 'request_id must be a stable unique identifier of 8–100 letters, digits, underscores or hyphens');
        }
        let record;
        let created = true;
        try {
            record = yield PracticeExamAttempt_1.default.create({ user_id: owner, exam_id: exam._id, request_id: requestId });
        }
        catch (error) {
            if (error.code !== 11000)
                throw error;
            created = false;
            record = yield PracticeExamAttempt_1.default.findOne({ user_id: owner, request_id: requestId });
        }
        if (!record || String(record.exam_id) !== String(exam._id))
            throw new ApiError(409, 'request_id was already used for another exam');
        return res.status(created ? 201 : 200).json({ attempt: attemptView(record) });
    });
}
function listAttempts(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const exam = yield ownedExam(req);
        const records = yield PracticeExamAttempt_1.default.find({ user_id: userId(req), exam_id: exam._id }).sort({ createdAt: -1 }).limit(100);
        return res.json({ attempts: records.map(attemptView) });
    });
}
function ownedAttempt(req, examId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.attemptId))
            throw new ApiError(404, 'Attempt not found');
        const attempt = yield PracticeExamAttempt_1.default.findOne({ _id: req.params.attemptId, user_id: userId(req), exam_id: examId });
        if (!attempt)
            throw new ApiError(404, 'Attempt not found');
        return attempt;
    });
}
function getAttempt(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const exam = yield ownedExam(req);
        return res.json({ attempt: attemptView(yield ownedAttempt(req, exam._id)) });
    });
}
function revision(req) {
    if (!Number.isInteger(req.body.revision) || req.body.revision < 0)
        throw new ApiError(400, 'revision must be a nonnegative integer');
    return req.body.revision;
}
function saveDraft(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const exam = yield ownedExam(req);
        yield ownedAttempt(req, exam._id);
        const rev = revision(req);
        let answers;
        try {
            answers = (0, practiceExamContract_1.validateAnswers)(req.body.answers, exam.exam);
        }
        catch (error) {
            throw new ApiError(400, error.message);
        }
        const record = yield PracticeExamAttempt_1.default.findOneAndUpdate({ _id: req.params.attemptId, user_id: userId(req),
            exam_id: exam._id, status: { $in: ['draft', 'grading_failed'] }, revision: rev }, { $set: { answers, status: 'draft' }, $unset: { error: 1 }, $inc: { revision: 1 } }, { new: true });
        if (!record)
            throw new ApiError(409, 'Draft changed or is locked; reload the attempt before saving');
        return res.json({ attempt: attemptView(record) });
    });
}
function submit(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const exam = yield ownedExam(req);
        const previous = yield ownedAttempt(req, exam._id);
        if (previous.status === 'submitted')
            return res.json({ attempt: attemptView(previous) });
        const rev = revision(req);
        const headers = serviceHeaders();
        const now = new Date();
        const claimed = yield PracticeExamAttempt_1.default.findOneAndUpdate({ _id: previous._id, user_id: userId(req), revision: rev,
            $or: [{ status: { $in: ['draft', 'grading_failed'] } },
                { status: 'grading', grading_started_at: { $lt: new Date(now.getTime() - GRADING_LEASE_MS) } }] }, { $set: { status: 'grading', grading_started_at: now }, $unset: { error: 1 }, $inc: { revision: 1 } }, { new: true });
        if (!claimed)
            throw new ApiError(409, 'Attempt changed or is already grading; reload its status');
        try {
            const response = yield axiosConfig_1.pythonServiceClient.post('/practice-exam/grade', {
                exam: exam.exam, answers: claimed.answers.map(a => ({ part_id: a.part_id, user_answer: a.user_answer })),
            }, { headers, timeout: 300000 });
            let grading;
            try {
                grading = (0, practiceExamContract_1.validateGrading)(response.data, exam.exam);
            }
            catch (_a) {
                throw new ApiError(502, 'AI service returned invalid grading; your answers are saved');
            }
            const record = yield PracticeExamAttempt_1.default.findOneAndUpdate({ _id: claimed._id, status: 'grading', revision: claimed.revision }, { $set: { status: 'submitted', grading, submitted_at: new Date() }, $inc: { revision: 1 } }, { new: true });
            if (!record)
                throw new ApiError(409, 'Grading was superseded; reload the attempt');
            return res.json({ attempt: attemptView(record) });
        }
        catch (error) {
            yield PracticeExamAttempt_1.default.updateOne({ _id: claimed._id, status: 'grading', revision: claimed.revision }, { $set: { status: 'grading_failed', error: 'Grading failed. Your answers are saved; retry submission.' },
                $inc: { revision: 1 } });
            throw error;
        }
    });
}
