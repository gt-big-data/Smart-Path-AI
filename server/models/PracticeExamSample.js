"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
// One bounded PDF per document: the 10 MB upload limit leaves room below Mongo's
// 16 MB document limit. Keep bytes out of ordinary list/metadata queries.
const schema = new mongoose_1.Schema({
    user_id: { type: String, required: true },
    chat_id: { type: String, required: true },
    filename: { type: String, required: true },
    size_bytes: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    sha256: { type: String, required: true, select: false },
    pdf: { type: Buffer, required: true, select: false },
}, { timestamps: true });
schema.index({ user_id: 1, chat_id: 1, sha256: 1 }, { unique: true });
schema.index({ user_id: 1, chat_id: 1, createdAt: -1 });
exports.default = (0, mongoose_1.model)('PracticeExamSample', schema);
