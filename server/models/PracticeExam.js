"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const schema = new mongoose_1.Schema({
    user_id: { type: String, required: true }, chat_id: { type: String, required: true },
    graph_id: { type: String, required: true }, schema_version: { type: Number, default: 2 },
    title: { type: String, required: true }, total_points: { type: Number, required: true },
    sample_filename: { type: String, required: true },
    // Private snapshot. Controllers must explicitly select it and project public fields.
    exam: { type: mongoose_1.Schema.Types.Mixed, required: true, select: false },
    blueprint: { type: mongoose_1.Schema.Types.Mixed, required: true, select: false },
}, { timestamps: true });
schema.index({ user_id: 1, chat_id: 1, createdAt: -1 });
exports.default = (0, mongoose_1.model)('PracticeExam', schema);
