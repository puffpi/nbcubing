'use strict';

const ChallengeSmart = (() => {
    const players = ['top', 'bottom'].map(side => ({side, connection: null}));
    const owners = new Map();
    const page = document.getElementById('challenge-page');
    const dialog = document.getElementById('challenge-bluetooth-dialog');
    const deviceList = dialog.querySelector('.timer-bluetooth-devices');
    const dialogTitle = dialog.querySelector('h3');
    const scanButton = dialog.querySelector('[data-scan]');
    const resetGyroButton = dialog.querySelector('[data-reset-gyro]');
    const syncSolvedButton = dialog.querySelector('[data-sync-solved]');
    const feedback = dialog.querySelector('.challenge-bluetooth-feedback');
    let selection = null;
    let phase = 'idle', generation = 0, frame = 0;
    let dualBotRounds = 0, firstDualWinner;
    let botWorker, pendingBotPlan;
    const knownDevices = new Map();
    const humanResults = new Map();
    let startTurn;
    const idleMs = 180000;
    let leftAt = null;
    const canRender = () => page.classList.contains('active') && !document.hidden && leftAt === null;
    const bothBots = () => players.every(player => player.connection?.bot);
    const keyboardStart = matchMedia('(hover: hover) and (pointer: fine)');
    const hasBot = () => players.some(player => player.connection?.bot);
    const bothReady = () => players.every(player => player.connection?.ready);
    const bothSolved = () => players.every(player => player.connection?.state === timerSmartSolved);
    const startingPlayer = () => hasBot() ?
        players.find(player => !player.connection?.bot) : players[1];

    function updateStartHints() {
        if (chalCurrentEvent !== '333' || !['idle', 'done'].includes(phase)) return;
        for (const player of players) {
            if (chalHasWinner && hasBot()) player.hint.textContent = '比赛结束';
            else if (!bothReady()) player.hint.textContent = player.connection?.ready ? '待开始' : '请连接魔方';
            else if (bothBots()) player.hint.textContent = keyboardStart.matches ? '点击空格键开始' : '上滑开始';
            else if (player === startingPlayer()) player.hint.textContent = '来回转动任意一层 · 开始';
            else player.hint.textContent = player.connection.bot ? '等待玩家开始' : '等待下屏玩家开始';
        }
    }

    const quarterTurns = tokens => tokens.flatMap(move => move.endsWith('2') ? [move[0], move[0]] : [move]);

    function cancelBotPlan(message) {
        const pending = pendingBotPlan;
        pendingBotPlan = null;
        clearTimeout(pending?.timeout);
        pending?.reject(Error(message));
    }

    function closeBotWorker(message) {
        botWorker?.terminate();
        botWorker = null;
        cancelBotPlan(message);
    }

    function planBotSolve(tokens, id) {
        let geometry;
        if (!botWorker) {
            const labels = Array.from({length: 54}, (_, i) => String.fromCharCode(65 + i));
            geometry = {slots: timerCubeSlots(), quarterMoves: Object.fromEntries([...'URFDLB'].map(face => {
                const turned = timerCubeTurn(labels.join(''), face);
                return [face, labels.map(label => turned.indexOf(label))];
            }))};
            botWorker = new Worker('formulas/challenge_cfop_worker.js?v=5');
            botWorker.onmessage = ({data}) => {
                const pending = pendingBotPlan;
                if (data.id !== pending?.id) return;
                pendingBotPlan = null;
                clearTimeout(pending.timeout);
                if (data.error) {
                    closeBotWorker(data.error);
                    pending.reject(Error(data.error));
                }
                else pending.resolve(data.plans);
            };
            botWorker.onerror = () => closeBotWorker('机器人求解加载失败，请重试');
        }
        const state = quarterTurns(tokens).reduce(timerCubeTurn, timerSmartSolved);
        const orientations = (bothBots() ? ['D', 'U'] : ['D']).map(timerSmartOrientation);
        const states = Object.fromEntries(orientations.map(view => [view.bottom, view.normalise(state)]));
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => closeBotWorker('机器人求解超时，请重试'), 15000);
            pendingBotPlan = {id, resolve, reject, timeout};
            try {
                botWorker.postMessage({id, states, ...geometry});
            } catch (error) {
                closeBotWorker(error.message);
            }
        }).then(plans => Object.fromEntries(orientations.map(({bottom, mapping}) => {
            const originalFace = Object.fromEntries(Object.entries(mapping).map(([from, to]) => [to, from]));
            return [bottom, plans[bottom].map(({kind, moves, yaw}) => ({
                kind, yaw, moves: moves.map(move => originalFace[move[0]] + move.slice(1))
            }))];
        })));
    }

    function botTime(player, index) {
        if (bothBots()) {
            firstDualWinner ??= Math.floor(Math.random() * 2);
            const baseline = 12000 - Math.min(4, dualBotRounds) * 650;
            const advantage = index === (firstDualWinner + dualBotRounds) % 2 ? -180 : 180;
            return baseline + advantage + (Math.random() - 0.5) * 200;
        }
        const bot = player.connection;
        const opponent = players[1 - index].connection;
        if (bot.pace?.opponent !== opponent) {
            const inherited = bot.lastTime ?? humanAverage(player.lastHumanId);
            bot.pace = {opponent, rounds: 0, initial: inherited ?? (19200 + Math.random() * 1600), fresh: inherited == null};
        }
        const {rounds, initial, fresh} = bot.pace;
        if (!rounds) return initial;
        const target = humanAverage(opponent.device.id) ?? (fresh ? 12500 : initial);
        const progress = Math.min(1, rounds / 4);
        const baseline = initial + (target - initial) * progress;
        if (fresh && rounds === 1 && target < initial) return Math.min(initial - 900, baseline);
        if (rounds < 4) return baseline;
        const variation = (Math.random() - 0.5) * 0.22;
        return baseline * (1 + variation);
    }

    function setBotPose(player, [pitch, yaw, roll], duration = 0) {
        const previous = player.botPose ?? [0, 0, 0];
        yaw += 360 * Math.round((previous[1] - yaw) / 360);
        const pose = [pitch, yaw, roll];
        const transform = ([x, y, z]) => `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
        player.poseAnimation?.cancel();
        player.botPose = pose;
        player.cube.style.setProperty('--cube-gyro-transform', transform(pose));
        if (duration > 0 && canRender() && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const camera = 'rotateX(var(--cube-x, -25deg)) rotateY(var(--cube-y, -32deg)) ';
            player.poseAnimation = player.body.animate([camera + transform(previous), camera + transform(pose)]
                .map(transform => ({transform})), {duration, easing: 'ease-in-out'});
        }
    }

    function timeBotSolution(stages, duration) {
        const solve = stages.flatMap(({kind, moves, yaw}) => {
            const pause = kind === 'f2l' ? 100 + Math.random() * 90 :
                kind === 'cross' ? 0 : 550 + Math.random() * 100;
            return moves.map((move, i) => ({
                move, yaw: i === 0 ? yaw : undefined, pause: i === 0 ? pause : 0,
                weight: 0.90 + Math.random() * 0.20
            }));
        });
        const intervals = solve.slice(1);
        const totalPause = intervals.reduce((sum, step) => sum + step.pause, 0);
        const pauseScale = totalPause ? Math.min(1, duration * 0.36 / totalPause) : 1;
        const turnBudget = duration - totalPause * pauseScale;
        const totalWeight = intervals.reduce((sum, step) => sum + step.weight, 0);
        for (const step of intervals) {
            step.turnMs = turnBudget * step.weight / totalWeight;
            step.delay = step.turnMs + step.pause * pauseScale;
        }
        return solve;
    }

    function runBot(player, stages, bottom, duration, request) {
        const attempt = player.attempt;
        const scramble = quarterTurns(attempt.tokens);
        const roll = bottom === 'U' ? 180 : 0;
        const solve = timeBotSolution(stages, duration);
        const scrambleStepMs = 5000 / scramble.length;
        const timeline = scramble.map(move => ({move, delay: scrambleStepMs}));
        const inspection = bothBots() ? 2750 + Math.random() * 500 : 8000 + Math.random() * 4000;
        let facing = solve[0].yaw ?? 0;
        timeline.push(
            {pose: [20, -55, roll], delay: inspection * 0.08, duration: 560},
            {pose: [-18, 45, roll], delay: inspection * 0.27, duration: 420},
            {pose: [0, facing, roll], delay: inspection * 0.33, duration: 380},
            {move: solve[0].move, delay: inspection * 0.32, turnMs: solve[1]?.turnMs}
        );
        for (const {move, yaw, delay, turnMs} of solve.slice(1)) {
            if (yaw !== undefined && yaw !== facing) {
                // Bring the next F2L slot around to the front right.
                timeline.push({pose: [0, yaw, roll], delay: delay * 0.25, duration: Math.min(240, delay * 0.75)});
                timeline.push({move, delay: delay * 0.75, turnMs});
                facing = yaw;
            } else timeline.push({move, delay, turnMs});
        }
        setBotPose(player, [0, 0, 0], 260);
        let index = 0, stamp = performance.now() + timeline[0].delay;
        const active = () => phase === 'round' && request === generation && attempt.phase !== 'done';
        function schedule() {
            if (!timeline[index] || !active()) return;
            player.botTimer = setTimeout(() => {
                const now = performance.now();
                while (timeline[index] && active() && stamp <= now) {
                    const step = timeline[index++];
                    if (step.pose) setBotPose(player, step.pose, step.duration - (now - stamp));
                    else applyMove(player, step.move, stamp, step.turnMs == null ? undefined :
                        Math.max(35, Math.min(150, step.turnMs * 0.72)));
                    if (timeline[index]) stamp += timeline[index].delay;
                }
                schedule();
            }, Math.max(0, Math.ceil(stamp - performance.now())));
        }
        schedule();
    }

    for (const player of players) {
        player.visualMoves = [];
        const half = document.getElementById(`challenge-${player.side}-area`);
        player.panel = half.querySelector('.challenge-smart-panel');
        player.cube = player.panel.querySelector('.timer-virtual-cube');
        player.stats = player.panel.querySelector('.challenge-smart-stats');
        player.status = player.panel.querySelector('.timer-bluetooth-status');
        player.dnf = player.panel.querySelector('.challenge-smart-dnf');
        player.dnf.onclick = () => {
            if (phase === 'round' && player.attempt?.phase === 'solving' && !player.connection?.bot) {
                completeAttempt(player, Infinity);
            }
        };
        player.hint = half.querySelector('.challenge-smart-hint');
        player.timer = half.querySelector('.challenge-timer');
        player.scramble = half.querySelector('.challenge-scramble');
        player.status.onclick = () => openChooser(player);
    }

    function renderCubeState(player, state) {
        player.visualMoves.length = 0;
        player.turnAnimation?.cancel();
        player.turnAnimation = null;
        if (state) renderMoyuCubeStickers(player.body, state);
    }

    function animateNextTurn(player) {
        const step = player.visualMoves.shift();
        if (!step) return;
        const animation = animateMoyuLayer(player.body, step.move, player.visualMoves.length ?
            Math.min(55, step.duration ?? 55) : step.duration ?? 80);
        if (!animation) {
            renderCubeState(player, player.connection.state);
            return;
        }
        player.turnAnimation = animation;
        animation.finished.then(() => {
            if (player.turnAnimation !== animation) return;
            player.turnAnimation = null;
            renderMoyuCubeStickers(player.body, step.state);
            animateNextTurn(player);
        }, () => {});
    }

    function applyMove(player, move, stamp, duration) {
        const previous = player.connection.state;
        const state = timerCubeTurn(previous, move);
        player.connection.state = state;
        if (phase === 'round') processMove(player, move, stamp);
        else if (canRender() && ['idle', 'done'].includes(phase)) detectStartTurn(player, move, previous);
        if (!canRender()) return;
        // Visual catch-up must not delay move processing or the clock.
        if (player.visualMoves.length >= 3) renderCubeState(player, previous);
        player.visualMoves.push({move, state, duration});
        if (!player.turnAnimation) animateNextTurn(player);
    }

    function renderConnection(player) {
        const connection = player.connection;
        player.cube.toggleAttribute('data-idle-spin', !connection);
        if (!connection) {
            player.poseAnimation?.cancel();
            player.botPose = null;
            for (const property of ['--cube-gyro-transform', '--cube-x', '--cube-y']) {
                player.cube.style.removeProperty(property);
            }
        }
        player.status.classList.toggle('connected', Boolean(connection?.ready));
        const label = connection?.bot ? '心之敌' : connection?.ready ? '已连接' : connection ? '同步中…' : '未连接';
        player.status.querySelector('.challenge-smart-connection-label').textContent = label;
        const level = connection?.ready && !connection.bot ? connection.level ?? null : null;
        renderCubeBatteryStatus(player.status, player.status.querySelector('.challenge-bluetooth-icon'),
            player.status.querySelector('.timer-cube-battery'), level);
        player.status.setAttribute('aria-label', level === null ? label : `${label}，魔方剩余电量 ${level}%`);
        player.status.disabled = chalCurrentEvent !== '333';
        player.status.title = connection?.device?.name || '';
    }

    function resetRound(message = '') {
        generation++;
        startTurn = null;
        cancelBotPlan('本轮已取消');
        cancelAnimationFrame(frame);
        frame = 0;
        phase = 'idle';
        for (const player of players) {
            clearTimeout(player.botTimer);
            if (player.connection?.bot) {
                player.connection.state = timerSmartSolved;
                setBotPose(player, [0, 0, 0]);
            }
            renderCubeState(player, player.connection?.state);
            player.attempt = null;
            player.timer.textContent = '0.00';
            player.timer.className = 'challenge-timer';
            player.scramble.replaceChildren();
            player.stats.replaceChildren();
            player.dnf.hidden = true;
            player.scramble.classList.remove('minx-grid');
            player.hint.textContent = message;
        }
        chalRoundHandicapMs = 0;
        showChallengeHandicap();
        if (!message) updateStartHints();
    }

    function disconnect(player, message = '蓝牙已断开') {
        const connection = player.connection;
        if (!connection) return;
        if (selection?.player === player) closeChooser();
        player.connection = null;
        renderCubeState(player);
        if (!connection.bot) {
            clearTimeout(connection.idleTimer);
            connection.device.removeEventListener('gattserverdisconnected', connection.onDisconnect);
            const stopping = connection.session?.stop();
            const closing = connection.device.gatt.disconnect();
            connection.released = Promise.allSettled([connection.finished, stopping, closing]).then(() => {
                if (owners.get(connection.device.id) === connection) owners.delete(connection.device.id);
            });
        } else {
            player.body = buildTimerCube(player.cube, 3);
        }
        renderConnection(player);
        startTurn = null;
        updateStartHints();
        if (phase === 'round' || phase === 'generating') resetRound();
        if (message) player.status.title = message;
        if (/^(连接失败|同步失败)/.test(message)) player.hint.textContent = message;
        return connection.released;
    }

    function checkIdle(player, now = performance.now()) {
        const connection = player.connection;
        if (!connection || connection.bot) return;
        clearTimeout(connection.idleTimer);
        const remaining = idleMs - (now - (leftAt ?? connection.lastActivity));
        if (remaining <= 0) {
            void disconnect(player, '魔方闲置 3 分钟，蓝牙已断开');
        } else {
            connection.idleTimer = setTimeout(() => checkIdle(player), remaining);
        }
    }

    function syncNativeIdle(connection, force = false) {
        const now = performance.now();
        if (!connection.device.gatt.setChallengeIdleTimeout || !connection.ready ||
            (!force && (leftAt !== null || now - (connection.nativeIdleSyncedAt ?? -Infinity) < 1000))) return;
        connection.nativeIdleSyncedAt = now;
        // Allow the next throttled activity update to arrive before the native fallback fires.
        const grace = leftAt === null ? 1000 : 0;
        const remaining = Math.max(0, idleMs + grace - (now - (leftAt ?? connection.lastActivity)));
        void connection.device.gatt.setChallengeIdleTimeout(Math.ceil(remaining));
    }

    function refreshView() {
        cancelAnimationFrame(frame);
        frame = 0;
        startTurn = null;
        for (const player of players) {
            const connection = player.connection;
            renderCubeState(player, canRender() ? connection?.state : null);
            if (canRender() && connection?.gyro) renderGyro(player, connection);
        }
        if (canRender()) updateClocks();
    }

    function renderGyro(player, connection) {
        const reference = connection.gyroReferenceInverse;
        const q = connection.gyro;
        player.cube.style.setProperty('--cube-gyro-transform',
            moyuGyroTransform(reference ? timerQuaternionProduct(reference, q) : q));
    }

    function closeChooser() {
        if (!selection) return;
        selection.controller.abort();
        selection = null;
        dialog.hidden = true;
    }

    function appendDeviceRow(label, select, disconnectDevice, disabled = false) {
        const row = document.createElement('div');
        row.className = 'timer-bluetooth-device-row';
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.onclick = select;
        row.append(button);
        if (disconnectDevice) {
            const power = document.createElement('button');
            power.type = 'button';
            power.className = 'timer-bluetooth-disconnect';
            power.title = '断开连接';
            power.setAttribute('aria-label', power.title);
            power.textContent = '⏻';
            power.onclick = disconnectDevice;
            row.append(power);
        }
        deviceList.append(row);
    }

    function renderDevices(choice) {
        if (selection !== choice) return;
        const {player} = choice;
        const connection = player.connection;
        const remove = () => disconnect(player, '');
        deviceList.replaceChildren();
        for (const device of knownDevices.values()) {
            const active = connection?.device?.id === device.id;
            const inUse = !active && owners.has(device.id);
            appendDeviceRow(`魔域智能魔方 · ${device.name}${inUse ? ' · 使用中' : ''}`,
                active ? null : () => void connect(choice, device), active ? remove : null,
                inUse || (!active && Boolean(connection?.device)));
        }
        appendDeviceRow('心之敌', connection?.bot ? null : () => {
            if (connection) disconnect(player, '');
            else closeChooser();
            player.connection = {bot: true, ready: true, state: timerSmartSolved};
            renderCubeState(player, timerSmartSolved);
            renderConnection(player);
            updateStartHints();
        }, connection?.bot ? remove : null);
    }

    function addDevice(choice, device) {
        if (selection !== choice || !/^WCU_MY32_[0-9A-F]{4}$/i.test(device.name || '')) return;
        choice.devices.add(device.id);
        if (knownDevices.get(device.id) === device) return;
        knownDevices.set(device.id, device);
        renderDevices(choice);
    }

    function openChooser(player) {
        closeChooser();
        startTurn = null;
        const choice = {player, controller: new AbortController(), devices: new Set()};
        selection = choice;
        dialog.classList.toggle('challenge-bluetooth-top', player.side === 'top');
        dialog.hidden = false;
        feedback.hidden = true;
        scanButton.disabled = Boolean(player.connection?.device);
        resetGyroButton.disabled = !player.connection?.ready || Boolean(player.connection.bot);
        syncSolvedButton.disabled = resetGyroButton.disabled || phase === 'round' || phase === 'generating';
        dialogTitle.textContent = player.connection?.bot ? '心之敌 · 已加入' : player.connection?.ready ? '已连接，转动已同步' :
            player.connection ? '已连接，转动未同步' : '连接魔域智能三阶';
        renderDevices(choice);
        navigator.bluetooth?.getDevices?.().then(devices => {
            devices.forEach(device => addDevice(choice, device));
        }).catch(() => {});
    }

    function showBluetoothFeedback(message) {
        feedback.textContent = message;
        feedback.hidden = false;
    }

    resetGyroButton.onclick = () => {
        const player = selection?.player;
        const connection = player?.connection;
        if (!connection?.ready) return;
        if (!connection.gyro) {
            showBluetoothFeedback('暂未收到陀螺仪数据');
            return;
        }
        const [x, y, z, w] = connection.gyro;
        connection.gyroReferenceInverse = [-x, -y, -z, w];
        player.cube.style.setProperty('--cube-x', '0deg');
        player.cube.style.setProperty('--cube-y', '0deg');
        player.cube.style.removeProperty('--cube-gyro-transform');
        showBluetoothFeedback('重置陀螺仪成功');
    };

    syncSolvedButton.onclick = () => {
        const player = selection?.player;
        const connection = player?.connection;
        if (!connection?.ready || phase === 'round' || phase === 'generating') return;
        connection.state = timerSmartSolved;
        renderCubeState(player, connection.state);
        updateStartHints();
        showBluetoothFeedback('复原同步成功');
    };

    scanButton.onclick = async () => {
        const choice = selection;
        if (!choice || choice.scanning) return;
        const bluetooth = navigator.bluetooth;
        if (window.__nbNativeBluetooth && !window.scanChallengeBluetooth) {
            dialogTitle.textContent = '当前 App 版本不支持双魔方连接';
            return;
        }
        if (!bluetooth?.requestDevice) {
            dialogTitle.textContent = '当前浏览器不支持蓝牙连接';
            return;
        }
        choice.scanning = true;
        dialogTitle.textContent = '搜寻魔域智能三阶…';
        try {
            if (window.scanChallengeBluetooth) {
                await window.scanChallengeBluetooth(device => addDevice(choice, device), choice.controller.signal);
                if (selection === choice) dialogTitle.textContent = choice.devices.size ? '选择智能魔方' : '未找到魔方，请唤醒后重试';
            } else {
                const device = await bluetooth.requestDevice({
                    filters: [{namePrefix: 'WCU_MY32_'}],
                    optionalServices: ['0783b03e-7735-b5a0-1760-a305d2795cb0'],
                    optionalManufacturerData: timerMoyuManufacturerIds()
                });
                if (selection === choice) await connect(choice, device);
            }
        } catch (error) {
            if (selection === choice) dialogTitle.textContent = error.name === 'NotFoundError' ? '未选择设备，可重新搜寻' : error.message;
        } finally {
            choice.scanning = false;
        }
    };
    dialog.addEventListener('click', event => {
        if (event.target === dialog || event.target.closest('[data-close]')) closeChooser();
    });
    document.addEventListener('visibilitychange', () => {
        if (!page.classList.contains('challenge-smart')) return;
        if (!document.hidden) players.forEach(player => checkIdle(player));
        refreshView();
    });
    document.addEventListener('keydown', event => {
        if (selection && event.key === 'Escape') closeChooser();
        if (event.code !== 'Space' || event.repeat || event.defaultPrevented || event.altKey ||
            event.ctrlKey || event.metaKey || event.shiftKey ||
            event.target.closest?.('button, a, input, select, textarea, [contenteditable]')) return;
        if (keyboardStart.matches && canRender() && bothBots() && !roundControlsOpen()) {
            event.preventDefault();
            void startRound();
        }
    });
    keyboardStart.addEventListener('change', () => {
        if (page.classList.contains('challenge-smart')) updateStartHints();
    });

    async function connect(choice, device) {
        if (selection !== choice || choice.player.connection?.device) return;
        if (window.__nbNativeBluetooth && !window.scanChallengeBluetooth) {
            dialogTitle.textContent = '当前 App 版本不支持双魔方连接';
            return;
        }
        if (!/^WCU_MY32_[0-9A-F]{4}$/i.test(device.name || '')) {
            dialogTitle.textContent = '请选择魔域 MY32 智能三阶';
            return;
        }
        if (owners.has(device.id)) {
            dialogTitle.textContent = '这个魔方已在使用，请选择另一只';
            return;
        }
        const player = choice.player;
        if (timerBluetoothDevice?.id === device.id) await disconnectTimerBluetooth();
        if (selection !== choice || owners.has(device.id)) return;
        if (player.connection?.bot) disconnect(player, '');
        knownDevices.set(device.id, device);
        closeChooser();
        const connection = {device, player, ready: false, lastActivity: performance.now()};
        let finishConnection;
        connection.finished = new Promise(resolve => { finishConnection = resolve; });
        const isActive = () => player.connection === connection;
        connection.onDisconnect = () => { if (isActive()) disconnect(player); };
        player.connection = connection;
        owners.set(device.id, connection);
        device.addEventListener('gattserverdisconnected', connection.onDisconnect);
        player.hint.textContent = '';
        renderConnection(player);
        checkIdle(player);
        try {
            await timerMoyuAdvertisementMac(device);
            if (!isActive()) return;
            await startMoyuSession(device, {
                isActive,
                onSession(session) { connection.session = session; },
                onState(state) {
                    const firstState = connection.state == null;
                    connection.state = state;
                    connection.ready = true;
                    renderConnection(player);
                    renderCubeState(player, state);
                    startTurn = null;
                    if (firstState) {
                        player.lastHumanId = device.id;
                        syncNativeIdle(connection, true);
                        updateStartHints();
                    }
                },
                onMove(move, stamp) {
                    connection.lastActivity = performance.now();
                    syncNativeIdle(connection);
                    applyMove(player, move, stamp);
                },
                onBattery(level) {
                    connection.level = level;
                    renderConnection(player);
                },
                shouldPollBattery() {
                    return canRender() && !['inspection', 'solving'].includes(player.attempt?.phase);
                },
                onGyro(q) {
                    if (!isActive()) return;
                    connection.gyro = q;
                    const last = connection.activityPose;
                    if (!last || Math.abs(q.reduce((dot, value, i) => dot + value * last[i], 0)) < Math.cos(Math.PI / 120)) {
                        connection.activityPose = q;
                        connection.lastActivity = performance.now();
                        syncNativeIdle(connection);
                    }
                    if (canRender()) renderGyro(player, connection);
                },
                onGap(lostPackets) {
                    if (lostPackets) {
                        connection.ready = false;
                        startTurn = null;
                        renderConnection(player);
                    }
                    if ((lostPackets && ['round', 'generating'].includes(phase)) || player.attempt?.phase === 'solving') {
                        resetRound('转动同步中断，本轮已取消');
                    }
                },
                onError(error) {
                    if (isActive()) disconnect(player, `同步失败：${error.message}`);
                }
            });
        } catch (error) {
            if (isActive()) disconnect(player, `连接失败：${error.message}`);
        } finally {
            try {
                if (!isActive() && device.gatt.connected) await device.gatt.disconnect();
            } finally {
                finishConnection();
            }
        }
    }

    function renderScramble(player) {
        const {tokens, index, errors} = player.attempt;
        const content = document.createDocumentFragment();
        const add = (text, classes = '') => {
            const token = document.createElement('span');
            token.className = `smart-scramble-token ${classes}`;
            token.textContent = text;
            content.append(token, document.createTextNode(' '));
        };
        tokens.slice(0, index).forEach(token => add(token, 'smart-correct'));
        errors.slice().reverse().forEach((move, i) => add(timerSmartInverse(move),
            i === 0 ? 'smart-undo smart-current' : 'smart-undo'));
        tokens.slice(index).forEach((token, i) => add(token, i === 0 && !errors.length ? 'smart-current' : ''));
        player.scramble.replaceChildren(content);
    }

    function recordSolveMove(attempt, move, stamp) {
        const gap = Math.max(0, stamp - (attempt.lastStamp ?? stamp));
        if (gap > 350) attempt.pauseMs += gap - 150;
        if (move === attempt.lastMove && gap <= 120 && !attempt.doubleTurn) {
            attempt.doubleTurn = true;
        } else {
            attempt.steps++;
            attempt.doubleTurn = false;
        }
        attempt.lastMove = move;
        attempt.lastStamp = stamp;
    }

    function renderSolveStats(player) {
        const {steps, time, pauseMs} = player.attempt;
        const duration = Math.max(1, time);
        const tps = (steps * 1000 / duration).toFixed(1);
        const pause = Number(Math.min(100, pauseMs / duration * 100).toFixed(1));
        player.stats.replaceChildren(...[`${steps} 步`, `TPS ${tps}`, `停顿率 ${pause}%`].map(text => {
            const line = document.createElement('span');
            line.textContent = text;
            return line;
        }));
    }

    function trackHumanTime(deviceId, time) {
        const result = humanResults.get(deviceId) ?? {count: 0, total: 0, best: Infinity, worst: 0};
        result.count++;
        result.total += time;
        result.best = Math.min(result.best, time);
        result.worst = Math.max(result.worst, time);
        humanResults.set(deviceId, result);
    }

    function humanAverage(deviceId) {
        const result = humanResults.get(deviceId);
        if (!result) return undefined;
        const {count, total, best, worst} = result;
        return count <= 3 ? total / count : (total - best - worst) / (count - 2);
    }

    function updateClocks() {
        frame = 0;
        if (!canRender()) return;
        let ticking = false;
        for (const player of players) {
            const attempt = player.attempt;
            if (!attempt || !['inspection', 'solving'].includes(attempt.phase)) continue;
            const session = player.connection.session;
            const now = player.connection.bot ? performance.now() :
                session.lastMoveStamp + Math.max(0, performance.now() - session.lastPacketReceivedAt);
            if (attempt.phase === 'inspection') {
                const remaining = Math.max(0, Math.ceil((attempt.inspectionEnd - now) / 1000));
                player.timer.textContent = remaining;
                ticking ||= remaining > 0;
            } else {
                player.timer.textContent = formatTimerOutput(Math.max(0, now - attempt.started));
                ticking = true;
            }
        }
        if (ticking) frame = requestAnimationFrame(updateClocks);
    }

    function processMove(player, move, stamp) {
        const attempt = player.attempt;
        if (phase !== 'round' || !attempt || attempt.phase === 'done') return;
        if (attempt.phase === 'scrambling') {
            advanceMoyuScramble(attempt, move);
            if (attempt.index !== attempt.tokens.length || attempt.errors.length) {
                renderScramble(player);
                return;
            }
            attempt.phase = 'inspection';
            attempt.inspectionEnd = stamp + 15000;
            player.timer.classList.add('ready');
            player.timer.textContent = '15';
            renderScramble(player);
            player.hint.textContent = '观察中 · 转动即开始';
        } else {
            if (attempt.phase === 'inspection') {
                attempt.phase = 'solving';
                attempt.started = stamp;
                player.timer.classList.remove('ready');
                player.hint.textContent = '还原中';
                player.dnf.hidden = Boolean(player.connection.bot);
            }
            recordSolveMove(attempt, move, stamp);
            if (player.connection.state === timerSmartSolved) {
                const elapsed = Math.max(0, stamp - attempt.started);
                // Synthetic timestamps use fractional intervals that can accumulate float error.
                completeAttempt(player, player.connection.bot ? Math.round(elapsed * 1000) / 1000 : elapsed);
            }
        }
        if (!frame && phase === 'round' && canRender()) frame = requestAnimationFrame(updateClocks);
    }

    function completeAttempt(player, time) {
        player.attempt.phase = 'done';
        player.attempt.time = time;
        player.dnf.hidden = true;
        if (Number.isFinite(time)) {
            player.timer.textContent = formatTimerOutput(time);
            player.hint.textContent = '已还原';
            renderSolveStats(player);
            if (!player.connection.bot) trackHumanTime(player.connection.device.id, time);
        } else {
            player.timer.textContent = 'DNF';
            player.hint.textContent = '';
            player.stats.textContent = 'DNF';
        }
        if (players.every(item => item.attempt.phase === 'done')) finishRound();
    }

    function finishRound() {
        phase = 'done';
        if (bothBots()) dualBotRounds++;
        for (const {connection, attempt} of players) {
            if (!connection.bot) continue;
            connection.lastTime = attempt.time;
            if (bothBots()) delete connection.pace;
            else connection.pace.rounds++;
        }
        const [top, bottom] = players.map(player => player.attempt.time +
            (player.side === chalRoundHandicapSide ? chalRoundHandicapMs : 0));
        if (top < bottom) chalScoreTop++;
        if (bottom < top) chalScoreBottom++;
        updateChallengeScores();
        checkChalWinCondition();
        startTurn = null;
        updateStartHints();
    }

    function roundControlsOpen() {
        return selection || ['chal-more-dropdown', 'chal-event-popup', 'chal-settings-modal', 'chal-alert-modal'].some(id =>
            ['block', 'flex'].includes(document.getElementById(id)?.style.display));
    }

    function detectStartTurn(player, move, previous) {
        const pending = startTurn;
        startTurn = null;
        if (!bothReady() || bothBots() || player !== startingPlayer() || (hasBot() && chalHasWinner) || roundControlsOpen()) return;
        if (pending && move === timerSmartInverse(pending) && bothSolved()) {
            void startRound();
        } else if (previous === timerSmartSolved && players.every(other =>
            other === player || other.connection.state === timerSmartSolved)) {
            startTurn = move;
        }
    }

    async function startRound() {
        if (chalCurrentEvent !== '333' || !['idle', 'done'].includes(phase) || roundControlsOpen() ||
            (hasBot() && chalHasWinner) || !bothReady() || !bothSolved()) return;
        const previousPhase = phase;
        phase = 'generating';
        const request = ++generation;
        players.forEach(player => { player.hint.textContent = '正在生成打乱…'; });
        try {
            const tokens = await timerSmartGenerateTokens();
            if (request !== generation) return;
            const botPlans = hasBot() ? await planBotSolve(tokens, request) : null;
            if (request !== generation) return;
            if (!bothReady() || !bothSolved()) {
                throw Error('请先将两只魔方复原，再开始对局');
            }
            phase = 'round';
            chalRoundHandicapSide = bothBots() ? 'none' : uiSettings.chalHandicapSide || 'none';
            chalRoundHandicapMs = Math.round(Number(uiSettings.chalHandicapSeconds || 0) * 1000);
            showChallengeHandicap();
            for (const [index, player] of players.entries()) {
                player.attempt = {phase: 'scrambling', tokens, index: 0, partial: null, errors: [], steps: 0, pauseMs: 0};
                player.timer.textContent = '0.00';
                player.stats.replaceChildren();
                player.hint.textContent = '按公式打乱';
                renderScramble(player);
                if (player.connection.bot) {
                    const bottom = bothBots() && player.side === 'bottom' ? 'U' : 'D';
                    runBot(player, botPlans[bottom], bottom, botTime(player, index), request);
                }
            }
        } catch (error) {
            if (request !== generation) return;
            phase = previousPhase;
            players.forEach(player => { player.hint.textContent = error.message; });
        }
    }

    function leave() {
        closeChooser();
        if (!page.classList.contains('challenge-smart')) return;
        leftAt = performance.now();
        for (const player of players) {
            checkIdle(player);
            if (player.connection?.device) syncNativeIdle(player.connection, true);
        }
        refreshView();
    }

    function enter() {
        if (!page.classList.contains('challenge-smart')) {
            updateMode();
            return;
        }
        players.forEach(player => checkIdle(player));
        leftAt = null;
        for (const player of players) {
            checkIdle(player);
            if (player.connection?.device) syncNativeIdle(player.connection, true);
        }
        refreshView();
    }

    function resetMatch() {
        dualBotRounds = 0;
        firstDualWinner = undefined;
        humanResults.clear();
        startTurn = null;
        for (const player of players) {
            if (player.connection?.bot) {
                delete player.connection.pace;
                delete player.connection.lastTime;
            }
        }
        if (hasBot()) resetRound();
        else updateStartHints();
    }

    function updateMode() {
        closeChooser();
        closeBotWorker('已切换挑战项目');
        players.forEach(player => disconnect(player, ''));
        resetMatch();
        resetRound();
        leftAt = null;
        const smart = chalCategory === 'smart';
        page.classList.toggle('challenge-smart', smart);
        for (const player of players) {
            player.panel.hidden = !smart;
            player.hint.hidden = !smart;
            if (!smart) continue;
            player.body = buildTimerCube(player.cube, chalCurrentEvent === '222' ? 2 : 3);
            player.cube.dataset.appearance = uiSettings.smartCubeAppearance || 'black';
            renderConnection(player);
        }
        if (smart) resetRound(chalCurrentEvent === '333' ? '' : '暂未支持智能二阶连接');
    }

    return {
        startFromSwipe() { if (!keyboardStart.matches && bothBots()) return startRound(); },
        updateMode, enter, leave, resetMatch, closeChooser,
        async releaseDeviceForTimer(id) {
            const connection = owners.get(id);
            if (!connection) return;
            await (connection.released || disconnect(connection.player, ''));
        },
        get choosing() { return selection !== null; }
    };
})();
