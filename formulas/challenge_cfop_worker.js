'use strict';

// Share the formula library with its browser entry point.
self.window = self;
importScripts('cfop_data.js?v=5');

const faces = 'URFDLB';
const solved = [...faces].map(face => face.repeat(9)).join('');
const upper = ['U', "U'", 'U2'];
const inverses = moves => moves.slice().reverse().map(move =>
    move.endsWith('2') ? move : move.endsWith("'") ? move[0] : move + "'");
const combine = (first, second) => first.map(destination => second[destination]);
const identity = Array.from({length: 54}, (_, i) => i);
let permutations, cross, lastLayer;

function permutation(moves) {
    return moves.reduce((result, move) => combine(result, permutations[move]), identity);
}

function apply(state, mapping) {
    const next = [];
    mapping.forEach((destination, i) => { next[destination] = state[i]; });
    return next.join('');
}

function simplify(moves) {
    const suffixes = ['', '', '2', "'"];
    const amount = move => move.endsWith("'") ? 3 : move.endsWith('2') ? 2 : 1;
    const result = [];
    for (const move of moves) {
        const previous = result.at(-1);
        if (previous?.[0] !== move[0]) {
            result.push(move);
            continue;
        }
        const turns = (amount(result.pop()) + amount(move)) % 4;
        if (turns) result.push(move[0] + suffixes[turns]);
    }
    return result;
}

function readPositions(state, targets, slots, domain) {
    // A cubie is identified by its set of colors. Track one sticker per piece
    // to encode both its position and orientation.
    return targets.map(target => {
        const colors = slots[target].piece.map(i => solved[i]).sort().join('');
        return domain.find(index => state[index] === solved[target] &&
            slots[index].piece.map(i => state[i]).sort().join('') === colors);
    });
}

function makePattern(targets, domains, actions) {
    const bases = domains.map(domain => domain.length);
    const size = bases.reduce((product, base) => product * base, 1);
    const encode = positions => positions.reduce((code, value, i) => code * bases[i] + domains[i].indexOf(value), 0);
    const transitions = actions.map(action => {
        const backward = permutation(inverses(action));
        return domains.map(domain => domain.map(index => domain.indexOf(backward[index])));
    });
    const previous = new Int32Array(size).fill(-1);
    const steps = new Uint8Array(size);
    const queue = new Int32Array(size);
    const start = encode(targets);
    queue[0] = start;
    previous[start] = start;
    let end = 1;
    const digits = new Uint8Array(bases.length);
    for (let head = 0; head < end; head++) {
        const key = queue[head];
        let remaining = key;
        for (let i = bases.length - 1; i >= 0; i--) {
            digits[i] = remaining % bases[i];
            remaining = Math.floor(remaining / bases[i]);
        }
        for (let step = 0; step < actions.length; step++) {
            let next = 0;
            for (let i = 0; i < bases.length; i++) next = next * bases[i] + transitions[step][i][digits[i]];
            if (previous[next] !== -1) continue;
            previous[next] = key;
            steps[next] = step;
            queue[end++] = next;
        }
    }
    return positions => {
        const solution = [];
        let key = encode(positions);
        if (previous[key] === undefined || previous[key] === -1) throw Error('未找到 CFOP 局部解法');
        while (key !== start) {
            solution.push(...actions[steps[key]]);
            key = previous[key];
        }
        return solution;
    };
}

function fixedFaceAlgorithm(algorithm) {
    // Decompose wide and slice turns into face turns and a whole-cube
    // rotation. Carry that rotation in the frame rather than turning the view.
    const equivalent = {
        r: ['L', 'x'], l: ['R', "x'"], f: ['B', 'z'], b: ['F', "z'"],
        u: ['D', 'y'], d: ['U', "y'"],
        M: ['R', "L'", "x'"], S: ["F'", 'B', 'z'], E: ['U', "D'", "y'"]
    };
    const rotations = {x: 'UFDB', y: 'FRBL', z: 'ULDR'};
    const frame = Object.fromEntries([...faces].map(face => [face, face]));
    const moves = [];
    const tokens = algorithm.replace(/[()]/g, ' ').replace(/2'/g, '2').trim().split(/\s+/);
    for (const token of tokens) {
        if (!/^[URFDLBrlfbudMESxyz](?:2|')?$/.test(token)) return null;
        const turn = token[0];
        const base = equivalent[turn] || [turn];
        const steps = token.endsWith("'") ? inverses(base) : token.endsWith('2') ? [...base, ...base] : base;
        for (const step of steps) {
            const cycle = rotations[step[0]];
            if (cycle) {
                const colors = [...cycle].map(face => frame[face]);
                const offset = step.endsWith("'") ? 3 : 1;
                [...cycle].forEach((face, i) => { frame[face] = colors[(i + offset) % 4]; });
            } else {
                moves.push(frame[step[0]] + step.slice(1));
            }
        }
    }
    return simplify(moves);
}

function buildLastLayer(kind, slots) {
    const keyFor = kind === 'oll' ? state => state.replace(/[^U]/g, '.') : state => state;
    const entries = CFOP_ALGORITHMS[kind];
    if (entries.length !== (kind === 'oll' ? 57 : 21)) throw Error('CFOP 顶层公式数量不完整');
    const algorithms = entries.map(({name, algs}) => {
        for (const variant of algs) {
            const moves = fixedFaceAlgorithm(variant);
            if (!moves?.every(move => permutations[move])) continue;
            const mapping = permutation(inverses(moves));
            if (mapping.some((dest, i) => slots[i].p[1] !== 1 && dest !== i)) continue;
            const caseState = apply(solved, mapping);
            if (kind === 'pll' && !caseState.startsWith('UUUUUUUUU')) continue;
            if (keyFor(caseState) === keyFor(solved)) continue;
            return {moves, mapping};
        }
        throw Error(`无法载入 ${kind.toUpperCase()} 公式 ${name}`);
    });
    const setups = [[], ...upper.map(move => [move])];
    const solutions = new Map([[keyFor(solved), []]]);
    if (kind === 'oll') {
        for (const {moves, mapping} of algorithms) {
            for (const setup of setups) {
                const key = keyFor(apply(solved, combine(mapping, permutation(inverses(setup)))));
                if (!solutions.has(key)) solutions.set(key, [...setup, ...moves]);
            }
        }
        if (solutions.size !== 216) throw Error('单公式 OLL 覆盖不完整');
        return state => solutions.get(keyFor(state));
    }
    // Seed PLL skips, then cover every case with one algorithm and optional AUF.
    for (const setup of setups) {
        const state = apply(solved, permutation(inverses(setup)));
        solutions.set(state, setup);
    }
    const sideFaces = 'FRBL';
    for (const {moves} of algorithms) {
        for (let angle = 0; angle < 4; angle++) {
            const rotated = moves.map(move => {
                const side = sideFaces.indexOf(move[0]);
                return side < 0 ? move : sideFaces[(side + angle) % 4] + move.slice(1);
            });
            for (const setup of setups) {
                for (const alignment of setups) {
                    const sequence = [...setup, ...rotated, ...alignment];
                    const key = keyFor(apply(solved, permutation(inverses(sequence))));
                    if (!solutions.has(key)) solutions.set(key, sequence);
                }
            }
        }
    }
    if (solutions.size !== 288) throw Error('单公式 PLL 覆盖不完整');
    return state => {
        const moves = solutions.get(keyFor(state));
        if (!moves) throw Error('无法识别 CFOP 顶层状态');
        return moves;
    };
}

function initialize(slots, quarterMoves) {
    const pieces = new Map();
    for (const [index, slot] of slots.entries()) {
        const key = slot.p.join(',');
        if (!pieces.has(key)) pieces.set(key, []);
        slot.piece = pieces.get(key);
        slot.piece.push(index);
    }
    permutations = Object.create(null);
    for (const face of faces) {
        const turn = quarterMoves[face];
        permutations[face] = turn;
        permutations[face + '2'] = combine(turn, turn);
        permutations[face + "'"] = combine(permutations[face + '2'], turn);
    }
    const edge = slots.flatMap((slot, i) => slot.piece.length === 2 ? [i] : []);
    const corner = slots.flatMap((slot, i) => slot.piece.length === 3 ? [i] : []);
    const crossTargets = edge.filter(i => slots[i].face === 'D');
    const allMoves = Object.keys(permutations).map(move => [move]);
    const crossPattern = makePattern(crossTargets, crossTargets.map(() => edge), allMoves);
    cross = state => crossPattern(readPositions(state, crossTargets, slots, edge));

    const pairs = corner.filter(i => slots[i].face === 'D').map(i => {
        const [x, , z] = slots[i].p;
        const middle = edge.find(index => slots[index].p.join(',') === [x, 0, z].join(','));
        return [i, middle];
    });
    const triggers = upper.map(move => [move]);
    for (const face of 'RFLB') {
        for (const turn of [face, face + "'"]) {
            for (const u of upper) triggers.push([turn, u, ...inverses([turn])]);
        }
    }
    const crossStickers = crossTargets.flatMap(i => slots[i].piece);
    const pairActions = triggers.map(moves => ({moves, map: permutation(moves)}))
        .filter(({map}) => crossStickers.every(i => map[i] === i));
    const pairTables = pairs.map(() => new Map());
    lastLayer = ['oll', 'pll'].map(kind => buildLastLayer(kind, slots));
    return (state, pair, locked) => {
        const targets = pairs[pair];
        const tables = pairTables[pair];
        if (!tables.has(locked)) {
            const protectedStickers = pairs.flatMap((indices, i) =>
                locked & (1 << i) ? indices.flatMap(index => slots[index].piece) : []);
            const actions = pairActions.filter(({map}) => protectedStickers.every(i => map[i] === i));
            tables.set(locked, makePattern(targets, [corner, edge], actions.map(action => action.moves)));
        }
        const positions = [
            ...readPositions(state, targets.slice(0, 1), slots, corner),
            ...readPositions(state, targets.slice(1), slots, edge)
        ];
        const [x, , z] = slots[targets[0]].p;
        const yaw = z === 1 ? (x === 1 ? 0 : 90) : (x === 1 ? -90 : 180);
        return {moves: simplify(tables.get(locked)(positions)), yaw};
    };
}

let solvePair;
function solve(state) {
    const stages = [];
    function addStage(kind, moves, yaw) {
        const stage = [];
        for (const move of simplify(moves)) {
            // Stop where the physical timer would detect the solved cube,
            // including halfway through a double turn.
            for (const turn of move.endsWith('2') ? [move[0], move[0]] : [move]) {
                if (state === solved) break;
                state = apply(state, permutations[turn]);
                stage.push(turn);
            }
            if (state === solved) break;
        }
        if (stage.length) stages.push({kind, moves: stage, yaw});
    }
    addStage('cross', cross(state));
    let locked = 0;
    while (locked !== 15 && state !== solved) {
        const candidates = [0, 1, 2, 3].filter(pair => !(locked & (1 << pair)))
            .map(pair => ({pair, ...solvePair(state, pair, locked)}))
            .sort((a, b) => a.moves.length - b.moves.length);
        const {pair, moves, yaw} = candidates[0];
        addStage('f2l', moves, yaw);
        locked |= 1 << pair;
    }
    const [oll, pll] = lastLayer;
    addStage('oll', oll(state));
    addStage('pll', pll(state));
    if (state !== solved || !stages.length) throw Error('CFOP 解法校验失败');
    return stages;
}

self.onmessage = ({data: {id, states, slots, quarterMoves}}) => {
    try {
        solvePair ??= initialize(slots, quarterMoves);
        const plans = Object.fromEntries(Object.entries(states).map(([bottom, state]) => [bottom, solve(state)]));
        self.postMessage({id, plans});
    } catch (error) {
        self.postMessage({id, error: error.message});
    }
};
