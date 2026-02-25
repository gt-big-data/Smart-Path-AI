"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const progressController_1 = require("../controllers/progressController");
const router = express_1.default.Router();
router.post('/update', progressController_1.updateConceptProgress);
router.get('/', progressController_1.getConceptProgress);
router.get('/concept-progress', progressController_1.getConceptProgress);
router.post('/concept-progress', progressController_1.updateConceptProgress);
exports.default = router;
