"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateDiagram = validateDiagram;
function validateDiagram(value) {
    const fail = () => { throw new Error('AI service returned an invalid exam diagram'); };
    const object = (v, keys) => v && typeof v === 'object' && !Array.isArray(v)
        && Object.keys(v).length === keys.length && keys.every(k => Object.prototype.hasOwnProperty.call(v, k));
    const text = (v, max = 80, empty = false) => typeof v === 'string'
        && (empty || !!v.trim()) && v.length <= max;
    const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
    const list = (v, max) => Array.isArray(v) && v.length >= 1 && v.length <= max;
    const d = value;
    if (!d || !text(d.caption))
        return fail();
    if (d.kind === 'plot') {
        if (!object(d, ['kind', 'caption', 'x_label', 'y_label', 'x_min', 'x_max', 'y_min', 'y_max', 'series'])
            || !text(d.x_label) || !text(d.y_label)
            || ![d.x_min, d.x_max, d.y_min, d.y_max].every(v => number(v, -1e6, 1e6))
            || d.x_min >= d.x_max || d.y_min >= d.y_max || !list(d.series, 6))
            return fail();
        for (const s of d.series) {
            if (!object(s, ['label', 'style', 'points']) || !text(s.label) || !['line', 'scatter'].includes(s.style)
                || !list(s.points, 200) || s.points.some((p) => !object(p, ['x', 'y'])
                || !number(p.x, d.x_min, d.x_max) || !number(p.y, d.y_min, d.y_max)))
                return fail();
        }
    }
    else if (d.kind === 'node_link') {
        if (!object(d, ['kind', 'caption', 'nodes', 'edges']) || !list(d.nodes, 20) || d.nodes.length < 2
            || !list(d.edges, 40))
            return fail();
        const ids = new Set();
        const positions = new Set();
        for (const n of d.nodes) {
            const position = JSON.stringify([n === null || n === void 0 ? void 0 : n.x, n === null || n === void 0 ? void 0 : n.y]);
            if (!object(n, ['id', 'label', 'x', 'y']) || !text(n.id, 40) || !text(n.label, 40)
                || !number(n.x, 0, 1) || !number(n.y, 0, 1) || ids.has(n.id) || positions.has(position))
                return fail();
            ids.add(n.id);
            positions.add(position);
        }
        const pairs = new Set();
        for (const e of d.edges) {
            const pair = JSON.stringify([e === null || e === void 0 ? void 0 : e.source, e === null || e === void 0 ? void 0 : e.target]);
            const reverse = JSON.stringify([e === null || e === void 0 ? void 0 : e.target, e === null || e === void 0 ? void 0 : e.source]);
            if (!object(e, ['source', 'target', 'label', 'directed']) || !ids.has(e.source) || !ids.has(e.target)
                || !text(e.label, 40, true) || typeof e.directed !== 'boolean'
                || pairs.has(pair) || (!e.directed && pairs.has(reverse)))
                return fail();
            pairs.add(pair);
            if (!e.directed)
                pairs.add(reverse);
        }
    }
    else
        return fail();
}
