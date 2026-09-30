// First-person controls and landscape viewport; no extra runtime dependencies.
const csPlayer = {
    radius: 0.9, height: 6.4, eye: 6.0, speed: 9.5, gravity: 40, jumpSpeed: 10,
    yaw: 0, pitch: 0, velocityY: 0, grounded: true,
    keys: new Set(), touches: new Map(), look: null, colliders: [],
    position: null, lastPosition: null, savedView: null, avatar: null,
    previousTime: 0, phase: 0, rotated: false, orientationSession: 0,
    settings: { gender: 'male', orbitSensitivity: 1, playerSensitivity: 1 },
    npc: { lastTick: 0, waitUntil: 0, target: null }, pendingExit: null, exitApproved: false
};

function csTouchDevice() { return matchMedia('(pointer: coarse)').matches; }
function csSpaceActive() { return document.getElementById('cube-space-page').classList.contains('active'); }
function csPlayerActive() { return csSpaceActive() && csCurrentMode === 'player'; }
function csPlayerBlocked() {
    return !!csInteractObject || (csPlayer.modals || []).some(el => el.style.display !== 'none');
}
function csClearPlayerInput() {
    csPlayer.keys.clear(); csPlayer.touches.clear(); csPlayer.look = null;
    document.querySelectorAll('#cs-player-pad button').forEach(b => b.classList.remove('pressed'));
}
function csReleasePointer() {
    // Let the browser restore the cursor to its pre-lock position; never fake a center cursor.
    if (csPlayer.mouseLookLocked) csPlayer.unlockView = { yaw: csPlayer.yaw, pitch: csPlayer.pitch };
    csPlayer.mouseLookLocked = false;
    csClearPlayerInput();
    if (document.pointerLockElement === csRenderer?.domElement) document.exitPointerLock();
}
function csRequestPointer() {
    if (csTouchDevice() || !csPlayerActive() || csPlayerBlocked()) return;
    if (csPlayer.lockPending || document.pointerLockElement === csRenderer.domElement) return;
    if (document.activeElement?.classList.contains('cs-mode-btn')) document.activeElement.blur();
    if (!csRenderer.domElement.requestPointerLock) return;
    csPlayer.lockPending = true;
    try { csRenderer.domElement.requestPointerLock()?.catch(() => { csPlayer.lockPending = false; }); }
    catch (_) { csPlayer.lockPending = false; /* Drag-to-look fallback. */ }
}

// Coordinates are expressed in the space's logical landscape viewport, even
// when a portrait-only browser displays the page rotated by CSS.
function csScreenPoint(x, y) {
    const rect = document.getElementById('cube-space-canvas').getBoundingClientRect();
    return csPlayer.rotated ? { x: y - rect.top, y: rect.right - x } : { x: x - rect.left, y: y - rect.top };
}
function csViewport() {
    const el = document.getElementById('cube-space-canvas');
    return { width: el.clientWidth, height: el.clientHeight, top: el.offsetTop };
}
function csPointerNDC(event) {
    const p = csScreenPoint(event.clientX, event.clientY), size = csViewport();
    return new THREE.Vector2(p.x / size.width * 2 - 1, 1 - p.y / size.height * 2);
}

// Adapt the existing OrbitControls / TransformControls without modifying Three.js.
function csControlSurface(canvas) {
    const listeners = new Map();
    // TransformControls attaches drag listeners to ownerDocument in r128.
    const ownerSurface = canvas.ownerDocument ? csControlSurface(canvas.ownerDocument) : null;
    return new Proxy(canvas, {
        get(target, key) {
            if (key === 'ownerDocument') return ownerSurface;
            if (key === 'getBoundingClientRect') return () => ({ left: 0, top: 0, width: target.clientWidth, height: target.clientHeight });
            if (key === 'addEventListener') return (type, fn, options) => {
                const wrapped = event => {
                    const point = csScreenPoint(event.clientX, event.clientY);
                    fn(new Proxy(event, { get(e, prop) {
                        if (prop === 'clientX' || prop === 'pageX') return point.x;
                        if (prop === 'clientY' || prop === 'pageY') return point.y;
                        const value = Reflect.get(e, prop, e);
                        return typeof value === 'function' ? value.bind(e) : value;
                    }}));
                };
                listeners.set(fn, wrapped); target.addEventListener(type, wrapped, options);
            };
            if (key === 'removeEventListener') return (type, fn, options) => {
                target.removeEventListener(type, listeners.get(fn) || fn, options); listeners.delete(fn);
            };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    });
}

function csResizeSpace() {
    if (!csSpaceActive()) return;
    const page = document.getElementById('cube-space-page');
    const width = window.innerWidth, height = window.innerHeight;
    csPlayer.rotated = csTouchDevice() && height > width;
    page.classList.toggle('cs-landscape-fallback', csPlayer.rotated);
    page.classList.toggle('cs-touch', csTouchDevice());
    page.style.setProperty('--cs-viewport-width', `${height}px`);
    page.style.setProperty('--cs-viewport-height', `${width}px`);
    const header = page.querySelector('.global-nav-header');
    if (header) page.style.setProperty('--cs-nav-height', `${header.offsetHeight}px`);
    const size = csViewport();
    page.classList.toggle('cs-compact', size.height < 560);
    if (!csRenderer || !size.height) return;
    csCamera.aspect = size.width / size.height;
    csCamera.updateProjectionMatrix();
    csRenderer.setSize(size.width, size.height);
    if (csPlayer.handCamera) {
        csPlayer.handCamera.aspect = csCamera.aspect;
        csPlayer.handCamera.updateProjectionMatrix();
    }
}
async function csEnterLandscape() {
    const session = ++csPlayer.orientationSession;
    const header = document.querySelector('.global-nav-header');
    if (!csPlayer.navHome) { csPlayer.navHome = document.createComment('global navigation'); header.before(csPlayer.navHome); }
    document.getElementById('cube-space-page').prepend(header);
    csResizeSpace();
    if (!csTouchDevice()) return;
    const page = document.getElementById('cube-space-page');
    try {
        if (!document.fullscreenElement && page.requestFullscreen) await page.requestFullscreen();
        if (session !== csPlayer.orientationSession || !csSpaceActive()) {
            if (document.fullscreenElement === page) await document.exitFullscreen();
            return;
        }
        if (screen.orientation?.lock) await screen.orientation.lock('landscape');
    } catch (_) { /* CSS landscape also covers Safari and denied fullscreen. */ }
    if (session !== csPlayer.orientationSession || !csSpaceActive()) {
        try { screen.orientation?.unlock?.(); } catch (_) {}
        return;
    }
    csResizeSpace();
}
function csExitLandscape() {
    ++csPlayer.orientationSession;
    try { screen.orientation?.unlock?.(); } catch (_) {}
    if (document.fullscreenElement === document.getElementById('cube-space-page')) document.exitFullscreen().catch(() => {});
    csPlayer.rotated = false;
    const page = document.getElementById('cube-space-page');
    if (csPlayer.navHome) csPlayer.navHome.after(document.querySelector('.global-nav-header'));
    if (page.classList.contains('cs-landscape-fallback')) page.classList.remove('cs-landscape-fallback');
}

// Cache one world AABB per mesh on entry. Gaps between furniture parts remain
// navigable; rotations/scales are included, with conservative corners for curves.
function csBuildColliders() {
    csPlayer.colliders = [];
    csObjects.forEach(root => {
        root.updateMatrixWorld(true);
        root.traverse(mesh => {
            if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
            if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
            if (!box.isEmpty()) csPlayer.colliders.push(box);
        });
    });
}
function csPlayerFits(x, y, z) {
    const r = csPlayer.radius, h = csPlayer.height, epsilon = 0.0001;
    if (Math.abs(x) + r > 75 || Math.abs(z) + r > 75 || y < -epsilon) return false;
    return !csPlayer.colliders.some(b => {
        if (y + h <= b.min.y + epsilon || y >= b.max.y - epsilon) return false;
        const dx = x - Math.max(b.min.x, Math.min(x, b.max.x));
        const dz = z - Math.max(b.min.z, Math.min(z, b.max.z));
        return dx * dx + dz * dz < r * r - epsilon;
    });
}
function csFindSpawn(preferred) {
    const x = Math.max(-74, Math.min(74, preferred.x));
    const z = Math.max(-74, Math.min(74, preferred.z));
    // Spawn on the actual floor, never on a table, roof, or floating object.
    if (csPlayerFits(x, 0, z)) return new THREE.Vector3(x, 0, z);
    for (let ring = 1; ring <= 424; ring++) {
        const radius = ring * 0.5, count = Math.ceil(2 * Math.PI * radius / 0.5);
        for (let i = 0; i < count; i++) {
            const angle = i / count * Math.PI * 2;
            const px = x + Math.cos(angle) * radius, pz = z + Math.sin(angle) * radius;
            if (csPlayerFits(px, 0, pz)) return new THREE.Vector3(px, 0, pz);
        }
    }
    return null; // A completely occupied floor must not produce an unsafe spawn.
}

function csCreateAvatar() {
    const female = csPlayer.settings.gender === 'female';
    const skin = new THREE.MeshStandardMaterial({ color: 0xe6b795, roughness: 0.85 });
    const sleeve = new THREE.MeshStandardMaterial({ color: female ? 0xf0e5d3 : 0x3d6484, roughness: 0.9 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xd8e2eb, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: female ? 0x995c40 : 0x393945, roughness: 1 });
    const accent = new THREE.MeshStandardMaterial({ color: female ? 0xa18abd : 0x64beb5, roughness: 0.85 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf8f1e7, roughness: 0.9 });
    function part(parent, w, h, d, x, y, z, material) {
        // Bevels catch the room lighting while retaining its block-built style.
        const bevel = Math.min(w, h, d) * 0.045;
        const shape = new THREE.Shape();
        shape.moveTo(-w / 2 + bevel, -h / 2 + bevel);
        shape.lineTo(w / 2 - bevel, -h / 2 + bevel);
        shape.lineTo(w / 2 - bevel, h / 2 - bevel);
        shape.lineTo(-w / 2 + bevel, h / 2 - bevel); shape.closePath();
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, steps: 1, curveSegments: 1 });
        geometry.translate(0, 0, -d / 2 + bevel);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
        parent.add(mesh); return mesh;
    }
    const body = new THREE.Group();
    body.name = female ? 'Alex-inspired cardigan avatar' : 'Steve-inspired jacket avatar';
    // Uniform scale: a nearly cubic head, compact torso and balanced legs.
    part(body, 1.02, female ? 1.22 : 1.36, 0.54, 0, female ? 2.27 : 2.20, 0, sleeve);
    if (female) {
        part(body, 1.12, 0.43, 0.65, 0, 1.57, 0, dark);
        [-0.4, -0.2, 0, 0.2, 0.4].forEach(x => part(body, 0.024, 0.34, 0.022, x, 1.56, -0.337, sleeve));
        [-1, 1].forEach(side => {
            const collar = part(body, 0.38, 0.22, 0.035, side * 0.19, 2.75, -0.29, white); collar.rotation.z = side * 0.28;
            const bow = part(body, 0.24, 0.18, 0.06, side * 0.14, 2.55, -0.32, accent); bow.rotation.z = side * 0.22;
        });
        part(body, 0.1, 0.14, 0.08, 0, 2.55, -0.35, accent);
        [2.25, 2.05, 1.85].forEach(y => part(body, 0.04, 0.04, 0.03, 0, y, -0.29, dark));
    } else {
        part(body, 0.46, 1.17, 0.035, 0, 2.21, -0.28, white);
        part(body, 0.34, 0.35, 0.035, 0, 2.56, -0.307, accent);
        [-1, 1].forEach(side => {
            part(body, 0.045, 1.17, 0.045, side * 0.27, 2.21, -0.30, trim);
            part(body, 0.17, 0.19, 0.045, side * 0.40, 2.07, -0.30, dark);
        });
        part(body, 1.04, 0.12, 0.57, 0, 1.61, 0, dark);
    }
    csPlayer.legs = [-1, 1].map(side => {
        const leg = new THREE.Group(); leg.position.set(side * 0.265, female ? 1.65 : 1.58, 0);
        if (!female) leg.scale.y = 0.96;
        body.add(leg);
        part(leg, 0.43, 1.35, 0.45, 0, -0.68, 0, female ? white : dark);
        if (female) part(leg, 0.45, 0.45, 0.47, 0, -1.13, 0, dark);
        part(leg, 0.48, 0.25, 0.65, 0, -1.49, -0.08, female ? dark : sleeve);
        part(leg, 0.49, 0.06, 0.66, 0, -1.62, -0.08, white);
        part(leg, 0.3, 0.055, 0.025, 0, -1.45, -0.412, female ? accent : white);
        return leg;
    });
    const head = new THREE.Group(); body.add(head);
    head.name = 'head';
    part(head, 0.98, 0.94, 0.88, 0, 3.53, 0, skin);
    part(head, 1.06, 0.22, 0.97, 0, 4.01, 0.025, hair);
    part(head, 1.04, female ? 0.94 : 0.69, 0.15, 0, female ? 3.44 : 3.60, 0.44, hair);
    [-1, 1].forEach(side => part(head, 0.12, female ? 0.77 : 0.42, 0.67, side * 0.49, female ? 3.40 : 3.72, 0.10, hair));
    // Stepped, side-swept bangs instead of a flat slab of hair.
    for (let i = 0; i < 3; i++) part(head, 0.29, 0.15 + i * 0.075, 0.08, -0.30 + i * 0.29, 3.92 - i * 0.0375, -0.44, hair);
    if (female) {
        part(head, 0.38, 0.75, 0.28, 0.28, 3.10, 0.53, hair);
        part(head, 0.40, 0.10, 0.30, 0.28, 3.42, 0.53, accent);
        part(head, 0.19, 0.055, 0.035, -0.37, 3.79, -0.50, accent);
    }
    // Tiny procedural face texture adds eyes and expression without extra meshes.
    const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 64;
    const ctx = faceCanvas.getContext('2d');
    const faceTexture = new THREE.CanvasTexture(faceCanvas); faceTexture.magFilter = THREE.NearestFilter;
    csPlayer.face = { ctx, texture: faceTexture, female, eyeOffset: null, blink: false };
    csDrawFace(0);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.90, 0.86), new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 1 }));
    face.position.set(0, 3.53, -0.442); face.rotation.y = Math.PI; head.add(face);
    csPlayer.arms = [-1, 1].map(side => {
        const arm = new THREE.Group(); arm.position.set(side * 0.70, 2.78, 0); body.add(arm);
        part(arm, female ? 0.32 : 0.36, 0.89, 0.46, 0, -0.39, 0, sleeve);
        part(arm, 0.36, 0.10, 0.48, 0, -0.84, 0, female ? accent : trim);
        part(arm, 0.31, 0.40, 0.40, 0, -1.08, 0, skin);
        return arm;
    });
    // Keep the established overall height while returning to compact, Minecraft-like legs.
    // The larger head sits directly on the shoulders, with no separate neck block.
    head.children.forEach(child => child.position.y -= 3.02);
    head.position.y = 2.86; head.scale.setScalar(0.90);
    csPlayer.head = head;
    csPlayer.gaze = { angle: 0, target: 0, eyes: 0, eyeTarget: 0, nextAt: 0, headAt: 0, nextBlink: performance.now() + 2200 + Math.random() * 2400, blinkUntil: 0 };
    body.scale.setScalar(1.55);
    csPlayer.avatar = body; body.visible = false; csScene.add(body);
    const handScene = new THREE.Scene(), handCamera = new THREE.PerspectiveCamera(55, csCamera.aspect, 0.01, 10);
    handScene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 0.7));
    const light = new THREE.DirectionalLight(0xffffff, 0.35); light.position.set(-2, 4, 3); handScene.add(light);
    const arm = new THREE.Group();
    part(arm, female ? 0.19 : 0.23, 0.48, 0.24, 0, -0.21, 0, sleeve);
    part(arm, female ? 0.21 : 0.24, 0.09, 0.25, 0, 0.065, 0, female ? accent : trim);
    part(arm, female ? 0.20 : 0.24, 0.35, 0.24, 0, 0.28, 0, skin);
    arm.rotation.set(-0.8, -0.2, -0.28); arm.scale.setScalar(0.75); handScene.add(arm);
    Object.assign(csPlayer, { handScene, handCamera, arm });
}

function csDrawFace(offset, blink = false) {
    const face = csPlayer.face;
    const shift = Math.max(-2, Math.min(2, Math.round(offset)));
    if (!face || (face.eyeOffset === shift && face.blink === blink)) return;
    face.eyeOffset = shift; face.blink = blink;
    const { ctx, female } = face;
    ctx.fillStyle = '#e6b795'; ctx.fillRect(0, 0, 64, 64);
    if (female) {
        // Softer brows, wider eyes, lashes and a small curved mouth.
        for (const x of [15, 39]) {
            ctx.fillStyle = '#765044'; ctx.fillRect(x + 1, 24, 8, 1);
            ctx.fillStyle = '#fff7ed'; ctx.fillRect(x, 29, 10, 8);
            ctx.fillStyle = '#4a2d23'; ctx.fillRect(x + 2 + shift, 29, 5, 7);
            ctx.fillStyle = '#211916'; ctx.fillRect(x + 3 + shift, 30, 3, 5);
            ctx.fillStyle = '#fffaf0'; ctx.fillRect(x + 3 + shift, 30, 2, 2);
            ctx.fillStyle = '#5b3b30'; ctx.fillRect(x - 1, 28, 2, 2); ctx.fillRect(x + 9, 28, 2, 2);
            ctx.fillStyle = '#dfaa95'; ctx.fillRect(x, 42, 7, 2);
        }
        ctx.fillStyle = '#cb9078'; ctx.fillRect(31, 41, 2, 2);
        ctx.fillStyle = '#a86467'; ctx.fillRect(29, 48, 6, 1); ctx.fillRect(30, 49, 4, 1);
    } else {
        // Straight brows and narrower eyes distinguish the male face.
        for (const x of [16, 38]) {
            ctx.fillStyle = '#49352f'; ctx.fillRect(x - 1, 25, 12, 2);
            ctx.fillStyle = '#eee4d8'; ctx.fillRect(x, 31, 10, 6);
            ctx.fillStyle = '#493026'; ctx.fillRect(x + 3 + shift, 31, 5, 6);
            ctx.fillStyle = '#1d1716'; ctx.fillRect(x + 4 + shift, 32, 3, 4);
            ctx.fillStyle = '#fff7ea'; ctx.fillRect(x + 4 + shift, 32, 1, 1);
        }
        ctx.fillStyle = '#c58d72'; ctx.fillRect(30, 41, 4, 3);
        ctx.fillStyle = '#80574a'; ctx.fillRect(29, 48, 6, 1);
    }
    if (blink) {
        const y = female ? 29 : 31, h = female ? 8 : 6;
        for (const x of (female ? [15, 39] : [16, 38])) {
            ctx.fillStyle = '#e6b795'; ctx.fillRect(x - 1, y, 12, h + 1);
            ctx.fillStyle = female ? '#765044' : '#49352f'; ctx.fillRect(x, y + Math.floor(h / 2), 10, 1);
        }
    }
    face.texture.needsUpdate = true;
}

function csUpdateGaze(now, dt, walking) {
    const gaze = csPlayer.gaze;
    if (!gaze) return;
    if (walking) {
        gaze.target = 0; gaze.eyeTarget = 0; gaze.headAt = now;
        gaze.nextAt = now + 2500;
    } else if (now >= gaze.nextAt) {
        const direction = [0, 0, -1, 1][Math.floor(Math.random() * 4)];
        gaze.target = direction * (0.24 + Math.random() * 0.12);
        gaze.eyeTarget = -direction * 2;
        gaze.headAt = now + 180; // Eyes orient first, the head follows gently.
        gaze.nextAt = now + 2800 + Math.random() * 3700;
    }
    gaze.eyes += (gaze.eyeTarget - gaze.eyes) * (1 - Math.exp(-dt * 12));
    if (now >= gaze.headAt) {
        const delta = gaze.target - gaze.angle;
        gaze.angle += Math.max(-dt * 0.55, Math.min(dt * 0.55, delta * (1 - Math.exp(-dt * 4))));
    }
    csPlayer.head.rotation.y = Math.max(-0.36, Math.min(0.36, gaze.angle));
    if (now >= gaze.nextBlink) {
        gaze.blinkUntil = now + 150;
        gaze.nextBlink = now + 3000 + Math.random() * 3500;
    }
    // Both pupils move together and remain inside the eye whites.
    csDrawFace(gaze.eyes, now < gaze.blinkUntil);
}

function csEnterPlayer() {
    csBuildColliders();
    const spawn = csFindSpawn(csPlayer.lastPosition || new THREE.Vector3(0, 0, 8));
    if (!spawn) {
        document.getElementById('cube-space-hint').textContent = '没有可站立的地面空位，请在编辑模式腾出空间。';
        return false;
    }
    if (!csPlayer.avatar) csCreateAvatar();
    csPlayer.savedView = { position: csCamera.position.clone(), quaternion: csCamera.quaternion.clone(), target: csOrbitCtrl.target.clone(), fov: csCamera.fov };
    csPlayer.position = spawn; csPlayer.velocityY = 0; csPlayer.grounded = true;
    csPlayer.previousTime = 0; csPlayer.avatar.visible = false;
    csOrbitCtrl.enabled = false; csTransformCtrl.detach(); csTransformCtrl.enabled = false;
    csSelectedObject = null; hideInfoCard(); csClearPlayerInput();
    csCamera.fov = 65; csCamera.updateProjectionMatrix(); csUpdatePlayerCamera();
    document.getElementById('cube-space-hint').textContent = csTouchDevice() ? '左侧移动 · 中间跳跃 · 滑动转头 · 轻点互动' : '点击画面开始 · WASD 移动 · 空格跳跃 · Esc 释放鼠标';
    return true;
}
function csLeavePlayer() {
    if (!csPlayer.position) return;
    csPlayer.lastPosition = csPlayer.position.clone();
    csReleasePointer(); csPlayer.avatar.visible = false;
    if (csPlayer.savedView) {
        csCamera.position.copy(csPlayer.savedView.position); csCamera.quaternion.copy(csPlayer.savedView.quaternion);
        csCamera.fov = csPlayer.savedView.fov; csCamera.updateProjectionMatrix();
        csOrbitCtrl.target.copy(csPlayer.savedView.target);
    }
    csOrbitCtrl.enabled = true; csTransformCtrl.enabled = true;
}
function csUpdatePlayerCamera() {
    csCamera.position.copy(csPlayer.position); csCamera.position.y += csPlayer.eye;
    csCamera.quaternion.setFromEuler(new THREE.Euler(csPlayer.pitch, csPlayer.yaw, 0, 'YXZ'));
    csPlayer.avatar.position.copy(csPlayer.position); csPlayer.avatar.rotation.y = csPlayer.yaw;
    csCamera.updateMatrixWorld(true);
}
function csJump() {
    if (csPlayerActive() && !csPlayerBlocked() && csPlayer.grounded) {
        csPlayer.velocityY = csPlayer.jumpSpeed; csPlayer.grounded = false;
    }
}
function csMoveAxis(axis, amount) {
    const p = csPlayer.position, start = p[axis];
    p[axis] += amount;
    if (csPlayerFits(p.x, p.y, p.z)) return true;
    // Find the contact instead of discarding a complete step, including thin walls.
    let low = 0, high = 1;
    for (let i = 0; i < 12; i++) {
        const fraction = (low + high) / 2; p[axis] = start + amount * fraction;
        if (csPlayerFits(p.x, p.y, p.z)) low = fraction; else high = fraction;
    }
    p[axis] = start + amount * low;
    return false;
}
function csUpdatePlayer(now) {
    if (!csPlayerActive()) { csPlayer.previousTime = 0; return; }
    const dt = csPlayer.previousTime ? Math.min((now - csPlayer.previousTime) / 1000, 0.05) : 0;
    csPlayer.previousTime = now;
    if (document.hidden || csPlayerBlocked()) { csReleasePointer(); return; }
    const pressed = code => csPlayer.keys.has(code) || [...csPlayer.touches.values()].includes(code);
    let forward = Number(pressed('KeyW')) - Number(pressed('KeyS'));
    let right = Number(pressed('KeyD')) - Number(pressed('KeyA'));
    const length = Math.hypot(forward, right) || 1; forward /= length; right /= length;
    const dx = (right * Math.cos(csPlayer.yaw) - forward * Math.sin(csPlayer.yaw)) * csPlayer.speed;
    const dz = (-forward * Math.cos(csPlayer.yaw) - right * Math.sin(csPlayer.yaw)) * csPlayer.speed;
    const steps = Math.max(1, Math.ceil(dt * Math.max(csPlayer.speed, Math.abs(csPlayer.velocityY) + csPlayer.gravity * dt) / 0.08));
    const step = dt / steps;
    for (let i = 0; i < steps; i++) {
        csMoveAxis('x', dx * step); csMoveAxis('z', dz * step);
        csPlayer.velocityY -= csPlayer.gravity * step;
        const falling = csPlayer.velocityY < 0;
        if (!csMoveAxis('y', csPlayer.velocityY * step)) {
            csPlayer.grounded = falling; csPlayer.velocityY = 0;
        } else csPlayer.grounded = false;
    }
    csPlayer.phase += dt * (Math.abs(forward) + Math.abs(right) > 0 ? 9 : 2);
    const stride = (Math.abs(forward) + Math.abs(right) > 0 && csPlayer.grounded) ? 1 : 0;
    csPlayer.legs.forEach((leg, i) => leg.rotation.x = Math.sin(csPlayer.phase + i * Math.PI) * 0.35 * stride);
    csPlayer.arms.forEach((arm, i) => {
        arm.rotation.x = Math.sin(csPlayer.phase + i * Math.PI) * (stride ? 0.12 : 0.035);
        arm.rotation.z = (i === 0 ? 1 : -1) * Math.sin(csPlayer.phase * 0.6) * 0.018;
    });
    csUpdateGaze(now, dt, !!stride);
    const halfWidth = Math.tan(55 * Math.PI / 360) * csPlayer.handCamera.aspect;
    csPlayer.arm.position.set(halfWidth * 0.64, -0.46 + Math.sin(csPlayer.phase) * (stride ? 0.016 : 0.004), -1);
    csUpdatePlayerCamera();
}
function csRenderPlayerHand() {
    if (!csPlayerActive()) return;
    csRenderer.autoClear = false; csRenderer.clearDepth();
    csRenderer.render(csPlayer.handScene, csPlayer.handCamera); csRenderer.autoClear = true;
}

function csInitPlayerInput() {
    const canvas = csRenderer.domElement;
    csPlayer.modals = [...document.querySelectorAll('#cube-space-page [id$="-modal"]')];
    csLoadSettings();
    canvas.addEventListener('pointerdown', e => {
        if (!csPlayerActive() || (e.pointerType === 'mouse' && e.button !== 0)) return;
        if (csPlayerBlocked()) {
            hideInteractCards(); csClearPlayerInput();
            if (e.pointerType === 'mouse') csRequestPointer();
            return;
        }
        if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) {
            csHandleSpacePointer(e); return;
        }
        if (csPlayer.look) return;
        const p = csScreenPoint(e.clientX, e.clientY);
        csPlayer.look = { id: e.pointerId, x: p.x, y: p.y, startX: p.x, startY: p.y, moved: false, time: performance.now(), touch: e.pointerType !== 'mouse' };
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
        if (!csPlayerActive() || csPlayerBlocked()) return;
        let dx = 0, dy = 0;
        if (document.pointerLockElement === canvas && csPlayer.mouseLookLocked) {
            // Browsers can deliver one synthetic movement when the lock starts.
            if (csPlayer.ignoreLockMove) { csPlayer.ignoreLockMove = false; return; }
            dx = e.movementX; dy = e.movementY;
        }
        else if (csPlayer.look?.id === e.pointerId) {
            const p = csScreenPoint(e.clientX, e.clientY), look = csPlayer.look;
            dx = p.x - look.x; dy = p.y - look.y; look.x = p.x; look.y = p.y;
            if (Math.hypot(p.x - look.startX, p.y - look.startY) > 7) look.moved = true;
        } else return;
        // Discard cursor warps and device spikes without changing the view.
        if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 120 || Math.abs(dy) > 120) return;
        const sensitivity = 0.003 * csPlayer.settings.playerSensitivity;
        csPlayer.yaw -= dx * sensitivity;
        csPlayer.pitch = Math.max(-1.48, Math.min(1.48, csPlayer.pitch - dy * sensitivity));
        if (csPlayer.mouseLookLocked) csPlayer.lockedView = { yaw: csPlayer.yaw, pitch: csPlayer.pitch };
        csUpdatePlayerCamera();
    });
    canvas.addEventListener('pointerup', e => {
        const look = csPlayer.look;
        if (!look || look.id !== e.pointerId) return;
        csPlayer.look = null;
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        if (!look.moved && performance.now() - look.time < 450) {
            csHandleSpacePointer(e);
            if (!look.touch && !csInteractObject) csRequestPointer();
        }
    });
    canvas.addEventListener('pointercancel', csClearPlayerInput);
    canvas.addEventListener('lostpointercapture', () => { csPlayer.look = null; });
    document.querySelectorAll('#cs-player-pad button').forEach(button => {
        button.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (!csPlayerActive() || csPlayerBlocked()) return;
            button.setPointerCapture(e.pointerId); button.classList.add('pressed');
            csPlayer.touches.set(e.pointerId, button.dataset.key);
            if (button.dataset.key === 'Space') csJump();
        });
        const release = e => { csPlayer.touches.delete(e.pointerId); button.classList.remove('pressed'); };
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, release));
    });
    document.addEventListener('keydown', e => {
        if (!csPlayerActive()) return;
        if (e.code === 'Escape') {
            if (csPlayer.mouseLookLocked) csPlayer.lockedView = { yaw: csPlayer.yaw, pitch: csPlayer.pitch };
            hideInteractCards(); csReleasePointer(); return;
        }
        if (csPlayerBlocked() || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
        if (!['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) return;
        e.preventDefault(); csPlayer.keys.add(e.code);
        if (e.code === 'Space' && !e.repeat) csJump();
    }, true);
    document.addEventListener('keyup', e => csPlayer.keys.delete(e.code));
    document.addEventListener('pointerlockchange', () => {
        csPlayer.lockPending = false;
        const wasLocked = csPlayer.mouseLookLocked;
        csPlayer.mouseLookLocked = document.pointerLockElement === canvas;
        if (csPlayer.mouseLookLocked) csPlayer.ignoreLockMove = true;
        if (!csPlayer.mouseLookLocked && (csPlayer.unlockView || (wasLocked && csPlayer.lockedView))) {
            const view = csPlayer.unlockView || csPlayer.lockedView;
            csPlayer.yaw = view.yaw; csPlayer.pitch = view.pitch;
            csPlayer.unlockView = null;
            csUpdatePlayerCamera();
        }
        if (csPlayer.mouseLookLocked) csPlayer.lockedView = { yaw: csPlayer.yaw, pitch: csPlayer.pitch };
        if (csPlayer.mouseLookLocked && (!csPlayerActive() || csPlayerBlocked())) { csReleasePointer(); return; }
        csClearPlayerInput();
        if (csPlayerActive()) document.getElementById('cube-space-hint').textContent = document.pointerLockElement === canvas
            ? 'WASD 移动 · 空格跳跃 · 瞄准后点击互动 · Esc 释放鼠标'
            : '点击画面继续';
    });
    document.addEventListener('pointerlockerror', () => { csPlayer.lockPending = false; });
    window.addEventListener('blur', csReleasePointer);
    document.addEventListener('visibilitychange', csReleasePointer);
    new MutationObserver(() => {
        if (!csSpaceActive()) {
            if (csCurrentMode === 'player') setCubeSpaceMode('observe');
            csExitLandscape();
        }
    }).observe(document.getElementById('cube-space-page'), { attributes: true, attributeFilter: ['class'] });
}
window.addEventListener('resize', csResizeSpace);
document.addEventListener('fullscreenchange', csResizeSpace);

function csLoadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('nbCubeSpacePlayerSettings') || '{}');
        csPlayer.settings.gender = saved.gender === 'female' ? 'female' : 'male';
        for (const key of ['orbitSensitivity', 'playerSensitivity']) {
            const value = Number(saved[key]);
            if (Number.isFinite(value) && value >= 0.3 && value <= 2.5) csPlayer.settings[key] = value;
        }
    } catch (_) { /* Keep defaults if storage is unavailable or malformed. */ }
    csOrbitCtrl.rotateSpeed = csPlayer.settings.orbitSensitivity;
}
function csOpenSettings() {
    csReleasePointer(); hideInteractCards();
    document.getElementById('cs-avatar-gender').value = csPlayer.settings.gender;
    for (const key of ['orbitSensitivity', 'playerSensitivity']) {
        const input = document.getElementById(`cs-setting-${key}`);
        input.value = csPlayer.settings[key]; input.nextElementSibling.value = `${Number(input.value).toFixed(1)}×`;
    }
    document.getElementById('cs-settings-error').textContent = '';
    document.getElementById('cs-settings-modal').style.display = 'flex';
}
function csCloseSettings() { document.getElementById('cs-settings-modal').style.display = 'none'; }
function csSaveSettings() {
    const settings = { gender: document.getElementById('cs-avatar-gender').value };
    for (const key of ['orbitSensitivity', 'playerSensitivity']) settings[key] = Number(document.getElementById(`cs-setting-${key}`).value);
    try { localStorage.setItem('nbCubeSpacePlayerSettings', JSON.stringify(settings)); }
    catch (_) { document.getElementById('cs-settings-error').textContent = '保存失败，请检查浏览器存储空间后重试。'; return; }
    const changed = settings.gender !== csPlayer.settings.gender;
    csPlayer.settings = settings; csOrbitCtrl.rotateSpeed = settings.orbitSensitivity;
    if (changed && csPlayer.avatar) {
        const position = csPlayer.avatar.position.clone(), rotation = csPlayer.avatar.rotation.clone();
        const geometries = new Set(), materials = new Set();
        for (const root of [csPlayer.avatar, csPlayer.handScene]) root.traverse(object => {
            if (object.geometry) geometries.add(object.geometry);
            if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(m => materials.add(m));
        });
        csScene.remove(csPlayer.avatar);
        geometries.forEach(g => g.dispose()); materials.forEach(m => { m.map?.dispose(); m.dispose(); });
        csCreateAvatar(); csPlayer.avatar.position.copy(position); csPlayer.avatar.rotation.copy(rotation);
        csPlayer.avatar.visible = csCurrentMode === 'observe';
    }
    csCloseSettings();
}

// Use the existing reset confirmation card as the source for both new dialogs.
function csInitDialogs() {
    const page = document.getElementById('cube-space-page');
    const template = document.getElementById('cs-reset-modal');
    const create = (id, title, content, cancel, confirm, confirmLabel) => {
        const modal = template.cloneNode(true); modal.id = id;
        const card = modal.firstElementChild, heading = card.querySelector('h3');
        heading.removeAttribute('id'); heading.textContent = title;
        const body = document.createElement('div'); body.innerHTML = content; heading.after(body);
        const buttons = card.querySelectorAll('button');
        buttons[0].setAttribute('onclick', cancel); buttons[1].setAttribute('onclick', confirm);
        buttons[1].textContent = confirmLabel; page.appendChild(modal);
        modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-label', title); modal.setAttribute('aria-modal', 'true');
        return modal;
    };
    create('cs-exit-modal', '是否退出魔方空间？', '<p style="font-size:14px;color:var(--text-muted);line-height:1.8">退出后改动信息将自动保存</p><p id="cs-exit-error" role="status"></p>', 'csCancelExit()', 'csConfirmExit()', '确定');
    const settings = create('cs-settings-modal', '魔方空间设置', `
        <div class="cs-settings-fields">
            <label for="cs-avatar-gender">主角性别</label>
            <select id="cs-avatar-gender" class="cs-input"><option value="male">男</option><option value="female">女</option></select>
            <div style="font-weight:700;margin-top:16px">视角灵敏度</div>
            <label for="cs-setting-orbitSensitivity">观察者模式 / 编辑模式</label>
            <div class="cs-setting-range"><input id="cs-setting-orbitSensitivity" type="range" min="0.3" max="2.5" step="0.1" oninput="this.nextElementSibling.value=Number(this.value).toFixed(1)+'×'"><output></output></div>
            <label for="cs-setting-playerSensitivity">玩家模式</label>
            <div class="cs-setting-range"><input id="cs-setting-playerSensitivity" type="range" min="0.3" max="2.5" step="0.1" oninput="this.nextElementSibling.value=Number(this.value).toFixed(1)+'×'"><output></output></div>
            <div style="font-size:12px;color:var(--text-muted)">适用于鼠标转头和手机滑动视角</div>
            <p id="cs-settings-error" role="status"></p>
        </div>`, 'csCloseSettings()', 'csSaveSettings()', '保存');
    settings.querySelector('button').textContent = '退出';
}
csInitDialogs();

function csRequestExit(action) {
    if (!csSpaceActive() || csPlayer.exitApproved) return false;
    csPlayer.pendingExit = action; csReleasePointer(); hideInteractCards();
    csCloseSettings(); window.closeNavDropdowns?.();
    document.getElementById('cs-exit-error').textContent = '';
    document.getElementById('cs-exit-modal').style.display = 'flex';
    return true;
}
function csCancelExit() {
    csPlayer.pendingExit = null;
    document.getElementById('cs-exit-modal').style.display = 'none';
}
function csConfirmExit() {
    try { saveCsConfig(); }
    catch (_) { document.getElementById('cs-exit-error').textContent = '保存失败，请检查浏览器存储空间后重试。'; return; }
    const action = csPlayer.pendingExit;
    csCancelExit();
    if (!action) return;
    csPlayer.exitApproved = true;
    try {
        if (csCurrentMode === 'player') setCubeSpaceMode('observe');
        csReleasePointer(); csExitLandscape();
        document.getElementById('cube-space-page').classList.remove('active');
        if (csPlayer.avatar) csPlayer.avatar.visible = false;
        action();
    } finally { csPlayer.exitApproved = false; }
}
// Delay the entire navigation click, including any initialization in its inline
// handler. Merely guarding showPage would already have run those side effects.
document.addEventListener('click', event => {
    if (!csSpaceActive() || csPlayer.exitApproved || !event.target.closest('.global-nav-header')) return;
    let target = event.target;
    while (target && !target.onclick && target.tagName !== 'A') target = target.parentElement;
    if (!target || target.getAttribute('onclick') === 'openCubeSpace()' || target.getAttribute('target') === '_blank') return;
    event.preventDefault(); event.stopImmediatePropagation();
    csRequestExit(() => target.click());
}, true);

function csPrepareObserver() {
    csBuildColliders(); csPlayer.sceneDirty = false;
    if (!csPlayer.avatar) csCreateAvatar();
    const preferred = csPlayer.lastPosition || csPlayer.npc.home || new THREE.Vector3(3, 0, 7);
    const spawn = csFindSpawn(preferred);
    csPlayer.avatar.visible = !!spawn;
    if (!spawn) return;
    csPlayer.avatar.position.copy(spawn);
    csPlayer.npc.home = spawn.clone(); csPlayer.npc.target = null;
    csPlayer.npc.lastTick = 0; csPlayer.npc.waitUntil = performance.now() + 8000 + Math.random() * 8000;
    csPlayer.legs.forEach(leg => leg.rotation.x = 0);
    csPlayer.arms.forEach(arm => arm.rotation.x = 0);
}
function csUpdateObserver(now) {
    if (!csSpaceActive() || csCurrentMode !== 'observe' || document.hidden || csPlayerBlocked()) return;
    const npc = csPlayer.npc;
    if (now - npc.lastTick < 80) return; // At most 12.5 movement updates per second.
    const dt = Math.min((now - npc.lastTick) / 1000, 0.12); npc.lastTick = now;
    if (csPlayer.sceneDirty) { csPrepareObserver(); return; }
    if (!csPlayer.avatar?.visible) return;
    csUpdateGaze(now, dt, !!npc.target);
    csPlayer.arms.forEach((arm, i) => {
        arm.rotation.x = -Math.sin(now * 0.0018 + i * Math.PI) * 0.035;
        arm.rotation.z = (i === 0 ? 1 : -1) * Math.sin(now * 0.0012) * 0.018;
    });
    const position = csPlayer.avatar.position;
    if (!npc.target) {
        if (now < npc.waitUntil) return;
        const sofa = csObjects.find(o => o.userData.id === 'smart_sofa');
        const center = sofa && sofa.position.distanceTo(npc.home) < 15 && Math.random() < 0.5 ? sofa.position : npc.home;
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2, distance = 3 + Math.random() * 4;
            const x = center.x + Math.cos(angle) * distance, z = center.z + Math.sin(angle) * distance;
            if (Math.hypot(x - npc.home.x, z - npc.home.z) <= 14 && csPlayerFits(x, 0, z)) {
                // Check a straight walk once; blocked routes are skipped, no pathfinding loop.
                const steps = Math.ceil(Math.hypot(x - position.x, z - position.z) / 0.25);
                let clear = true;
                for (let j = 1; j <= steps; j++) if (!csPlayerFits(position.x + (x - position.x) * j / steps, 0, position.z + (z - position.z) * j / steps)) { clear = false; break; }
                if (clear) { npc.target = new THREE.Vector3(x, 0, z); break; }
            }
        }
        npc.waitUntil = now + 10000 + Math.random() * 14000;
        if (!npc.target) return;
    }
    const dx = npc.target.x - position.x, dz = npc.target.z - position.z, distance = Math.hypot(dx, dz);
    const amount = Math.min(distance, dt * 1.8);
    if (distance < 0.05 || !csPlayerFits(position.x + dx / distance * amount, 0, position.z + dz / distance * amount)) {
        npc.target = null; npc.waitUntil = now + 10000 + Math.random() * 14000;
        csPlayer.legs.forEach(leg => leg.rotation.x = 0);
        return;
    }
    const desiredYaw = Math.atan2(-dx, -dz);
    const deltaYaw = Math.atan2(Math.sin(desiredYaw - csPlayer.avatar.rotation.y), Math.cos(desiredYaw - csPlayer.avatar.rotation.y));
    csPlayer.avatar.rotation.y += Math.max(-dt * 1.8, Math.min(dt * 1.8, deltaYaw));
    if (Math.abs(deltaYaw) > 0.45) return; // Turn the body before taking a step.
    position.x += dx / distance * amount; position.z += dz / distance * amount;
    csPlayer.legs.forEach((leg, i) => leg.rotation.x = Math.sin(now * 0.006 + i * Math.PI) * 0.23);
    csPlayer.arms.forEach((arm, i) => arm.rotation.x = -Math.sin(now * 0.006 + i * Math.PI) * 0.16);
}
