const lerp = (a, b, t) => a + (b - a) * t;

class ParticlePool {
    constructor(size = 200) {
        this.pool = new Array(size).fill(null).map(() => ({
            active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 3, color: "#ffaa00"
        }));
    }
    spawn(config) {
        const p = this.pool.find(item => !item.active);
        if (p) {
            p.active = true; p.x = config.x; p.y = config.y;
            p.vx = config.vx || 0; p.vy = config.vy || 0;
            p.life = config.life || 30; p.maxLife = p.life;
            p.size = config.size || 3; p.color = config.color || "#ffaa00";
        }
    }
    update(ctx) {
        this.pool.forEach(p => {
            if (!p.active) return;
            p.x += p.vx; p.y += p.vy; p.life--;
            if (p.life <= 0) { p.active = false; return; }
            ctx.save();
            ctx.globalAlpha = p.life / p.maxLife;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });
    }
}

// 3D Wireframe Assets for Object Explorer Mode
const MODELS = {
    rock: [
        {x:-30, y:20, z:-20}, {x:0, y:40, z:-30}, {x:30, y:15, z:-20}, {x:20, y:-30, z:-10},
        {x:-25, y:-25, z:-15}, {x:-10, y:0, z:40}, {x:25, y:5, z:35}, {x:0, y:-40, z:20}
    ],
    rockLines: [
        [0,1], [1,2], [2,3], [3,4], [4,0], [0,5], [1,5], [2,6], [3,6], [3,7], [4,7], [5,6], [6,7], [7,5]
    ],
    chair: [
        {x:-20,y:20,z:-20}, {x:20,y:20,z:-20}, {x:20,y:20,z:20}, {x:-20,y:20,z:20}, // Seat
        {x:-20,y:-20,z:-20}, {x:20,y:-20,z:-20}, // Backrest top
        {x:-20,y:50,z:-20}, {x:20,y:50,z:-20}, {x:20,y:50,z:20}, {x:-20,y:50,z:20} // Legs bottom
    ],
    chairLines: [
        [0,1], [1,2], [2,3], [3,0], // Seat border
        [0,4], [1,5], [4,5], // Backrest
        [0,6], [1,7], [2,8], [3,9] // Legs
    ]
};

export class CinematicEffects {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.mirrored = opts.mirrored !== false;
        this.particles = new ParticlePool(250);
        this.portal = null;

        // Portal Gesture Tracking
        this.strangeGesture = { active: false, startTime: 0 };
        this.PORTAL_HOLD_MS = 600;
        this.PORTAL_MAX_RADIUS = 260;

        // Exit Gesture Tracking (Double Flash Open Palm)
        this.exitTracker = { lastState: false, flashes: 0, lastFlashTime: 0 };

        this.screenFlash = { alpha: 0 };
        this.screenShake = { intensity: 0 };
        this._pulseClock = 0;

        // Unified Multi-Game System Architecture 
        this.menu = { active: false, selectedIdx: 0, options: ["ARCHERY", "TENNIS", "3D ROTATE"] };
        this.currentGame = null; // null, "ARCHERY", "TENNIS", "3D ROTATE"
        this.score = 0;

        // Sub-Game Specific Memory Pools
        this.archery = { arrows: [], target: { x:0, y:0, r:22, vx:3, vy:2 }, isDrawn: false, drawPower: 0 };
        this.tennis = { ball: { x:0, y:0, vx:4, vy:3, r:12 }, score: 0 };
        this.explorer = { currentAsset: "rock", rotX: 0, rotY: 0 };
    }

    update(leftLandmarksRaw, rightLandmarksRaw) {
        const left = leftLandmarksRaw ? this._prepare(leftLandmarksRaw) : null;
        const right = rightLandmarksRaw ? this._prepare(rightLandmarksRaw) : null;
        this._pulseClock += 0.06;

        this.ctx.save();
        this._applyScreenShake();

        // Global Gestures Check
        this._checkExitGesture(right || left);
        if (left && right && !this.portal) {
            this._handlePortalActivation(left, right);
        }

        // Render Background Portal Elements
        this._updatePortal();

        if (this.portal) {
            if (this.menu.active) {
                this._renderMenu(right || left);
            } else if (this.currentGame === "ARCHERY") {
                this._runArcheryGame(left, right);
            } else if (this.currentGame === "TENNIS") {
                this._runTennisGame(right || left);
            } else if (this.currentGame === "3D ROTATE") {
                this._run3DExplorer(left, right);
            }
        }

        this.particles.update(this.ctx);
        this._drawScreenFlash();
        this.ctx.restore();
    }

    _prepare(landmarks) {
        return this.mirrored ? landmarks.map(p => ({ x: 1 - p.x, y: p.y, z: p.z })) : landmarks;
    }

    _toCanvas(p) {
        return { x: p.x * this.canvas.width, y: p.y * this.canvas.height };
    }

    _palmCenter(landmarks) {
        const idxs = [0, 5, 9, 13, 17];
        let x = 0, y = 0;
        idxs.forEach(i => { x += landmarks[i].x; y += landmarks[i].y; });
        return { x: x / idxs.length, y: y / idxs.length };
    }

    _isOpenPalm(landmarks) {
        return landmarks[8].y < landmarks[5].y && landmarks[12].y < landmarks[9].y && landmarks[16].y < landmarks[13].y;
    }

    _checkExitGesture(hand) {
        if (!this.portal || !hand) return;
        const isOpen = this._isOpenPalm(hand);
        const now = performance.now();

        if (isOpen && !this.exitTracker.lastState) {
            if (now - this.exitTracker.lastFlashTime < 500) {
                this.exitTracker.flashes++;
                if (this.exitTracker.flashes >= 2) {
                    this._exitToMenu();
                }
            } else {
                this.exitTracker.flashes = 1;
            }
            this.exitTracker.lastFlashTime = now;
        }
        this.exitTracker.lastState = isOpen;
    }

    _exitToMenu() {
        this.triggerScreenFlash(0.5);
        this.exitTracker.flashes = 0;
        if (this.menu.active) {
            // Second double flash while on menu shuts the main portal
            this.portal = null;
            this.menu.active = false;
            document.body.classList.remove("portal-active");
        } else {
            this.currentGame = null;
            this.menu.active = true;
        }
    }

    _handlePortalActivation(left, right) {
        if (this._isOpenPalm(left) && this._isOpenPalm(right)) {
            if (!this.strangeGesture.active) {
                this.strangeGesture.active = true;
                this.strangeGesture.startTime = performance.now();
            } else if (performance.now() - this.strangeGesture.startTime > this.PORTAL_HOLD_MS) {
                const lp = this._toCanvas(this._palmCenter(left));
                const rp = this._toCanvas(this._palmCenter(right));
                this.portal = { x: (lp.x + rp.x) / 2, y: (lp.y + rp.y) / 2, radius: 0, ringRotation: 0, alpha: 0 };
                document.body.classList.add("portal-active");
                gsap.to(this.portal, { radius: this.PORTAL_MAX_RADIUS, alpha: 1, duration: 1.2, ease: "back.out(1)" });
                this.menu.active = true;
                this.strangeGesture.active = false;
            }
        } else { this.strangeGesture.active = false; }
    }

    _renderMenu(hand) {
        const ctx = this.ctx, p = this.portal;
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 5, 0, Math.PI * 2); ctx.clip();

        ctx.fillStyle = "rgba(0, 10, 20, 0.4)";
        ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);

        ctx.textAlign = "center";
        ctx.font = "bold 20px 'Space Grotesk'";
        ctx.fillStyle = "#ffaa00";
        ctx.fillText("SELECT SYSTEM PROTOCOL", p.x, p.y - 80);

        // Track hand to select menu items spatially vertically
        if (hand) {
            const hPos = this._toCanvas(this._palmCenter(hand));
            const relativeY = hPos.y - (p.y - 30);
            this.menu.selectedIdx = Math.max(0, Math.min(2, Math.floor((relativeY + 30) / 45)));

            // Select on pinch gesture
            const isPinch = Math.hypot(hand[8].x - hand[4].x, hand[8].y - hand[4].y) < 0.05;
            if (isPinch) {
                this.currentGame = this.menu.options[this.menu.selectedIdx];
                this.menu.active = false;
                this.triggerScreenFlash(0.4);
                if (this.currentGame === "TENNIS") this._resetTennis();
            }
        }

        this.menu.options.forEach((opt, i) => {
            const isSel = i === this.menu.selectedIdx;
            ctx.fillStyle = isSel ? "#00ffcc" : "rgba(255, 255, 255, 0.4)";
            ctx.font = isSel ? "bold 18px 'Space Grotesk'" : "16px 'Space Grotesk'";
            ctx.fillText(`${isSel ? ">  " : ""}${opt}${isSel ? "  <" : ""}`, p.x, p.y - 20 + i * 40);
        });

        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "11px sans-serif";
        ctx.fillText("Pinch finger to choose | Flash Open Palm twice to close", p.x, p.y + 110);
        ctx.restore();
    }

    // ====================================================================
    // GAME MODE 1: PERSISTENT TENNIS MATRIX 
    // ====================================================================
    _resetTennis() {
        const p = this.portal;
        this.tennis.ball = { x: p.x, y: p.y - 30, vx: 5, vy: -3, r: 10 };
    }

    _runTennisGame(hand) {
        const ctx = this.ctx, p = this.portal, t = this.tennis;
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 5, 0, Math.PI * 2); ctx.clip();

        // Neon cyber court background lines
        ctx.strokeStyle = "rgba(0, 255, 200, 0.15)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - p.radius); ctx.lineTo(p.x, p.y + p.radius); ctx.stroke();

        // Handle Ball Physics
        t.ball.x += t.ball.vx; t.ball.y += t.ball.vy;

        // Bounce from Top and Bottom boundaries
        if (t.ball.y - t.ball.r < p.y - p.radius + 10 || t.ball.y + t.ball.r > p.y + p.radius - 10) {
            t.ball.vy *= -1;
        }

        // Automatic Computer AI Paddle on left wall edge
        if (t.ball.vx < 0 && t.ball.x < p.x - p.radius + 60) {
            const paddleY = lerp(p.y, t.ball.y, 0.25);
            if (Math.abs(t.ball.y - paddleY) < 45 && t.ball.x < p.x - p.radius + 30) {
                t.ball.vx *= -1.05; // speed up slowly on rally
                this._ballSpark(t.ball.x, t.ball.y, "#ffaa00");
            }
        }

        // Handle Player Right Hand Tracker (Racket)
        if (hand) {
            const rPos = this._toCanvas(this._palmCenter(hand));
            
            // Draw Interactive Neon Racket
            ctx.strokeStyle = "#00ffcc";
            ctx.lineWidth = 5;
            ctx.shadowBlur = 15; ctx.shadowColor = "#00ffcc";
            ctx.beginPath(); ctx.moveTo(rPos.x, rPos.y - 30); ctx.lineTo(rPos.x, rPos.y + 30); ctx.stroke();
            ctx.restore(); ctx.save(); ctx.save();
            ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 5, 0, Math.PI * 2); ctx.clip();

            // Collision check against human racket
            if (t.ball.vx > 0 && Math.abs(t.ball.x - rPos.x) < 20 && Math.abs(t.ball.y - rPos.y) < 35) {
                t.ball.vx = -Math.abs(t.ball.vx) * 1.05;
                t.ball.vy += (t.ball.y - rPos.y) * 0.15; // apply angle spin
                this._ballSpark(t.ball.x, t.ball.y, "#00ffcc");
                t.score++;
            }
        }

        // Scoring Boundary misses
        if (t.ball.x > p.x + p.radius || t.ball.x < p.x - p.radius) {
            this._resetTennis();
            t.score = Math.max(0, t.score - 1);
        }

        // Render Glowing Tennis Ball
        ctx.fillStyle = "#ccff00";
        ctx.shadowBlur = 20; ctx.shadowColor = "#ccff00";
        ctx.beginPath(); ctx.arc(t.ball.x, t.ball.y, t.ball.r, 0, Math.PI * 2); ctx.fill();

        // Canvas Score string text
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 16px 'Space Grotesk'";
        ctx.fillText(`RALLY SCORE: ${t.score}`, p.x - p.radius + 40, p.y - p.radius + 40);
        ctx.restore();
    }

    _ballSpark(x, y, color) {
        for(let i=0; i<10; i++) {
            this.particles.spawn({ x, y, vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, life:15, size:3, color });
        }
    }

    // ====================================================================
    // GAME MODE 2: HOLOGRAPHIC 3D OBJECT VIEWER
    // ====================================================================
    _run3DExplorer(left, right) {
        const ctx = this.ctx, p = this.portal, e = this.explorer;
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 5, 0, Math.PI * 2); ctx.clip();

        // Render HUD Asset Toggle elements
        ctx.fillStyle = "rgba(0, 255, 200, 0.2)";
        ctx.fillRect(p.x - 90, p.y - p.radius + 20, 80, 25);
        ctx.fillRect(p.x + 10, p.y - p.radius + 20, 80, 25);
        ctx.fillStyle = "#ffffff";
        ctx.font = "12px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("ROCK", p.x - 50, p.y - p.radius + 37);
        ctx.fillText("CHAIR", p.x + 50, p.y - p.radius + 37);

        // Control matrix based on Hand position movement
        const driver = right || left;
        if (driver) {
            const dPos = this._toCanvas(this._palmCenter(driver));
            e.rotY = ((dPos.x - p.x) / p.radius) * Math.PI * 2;
            e.rotX = ((dPos.y - p.y) / p.radius) * Math.PI * 2;

            // Spatial hit test to switch models near the top buttons
            if (dPos.y < p.y - p.radius + 60) {
                e.currentAsset = (dPos.x < p.x) ? "rock" : "chair";
            }
        } else {
            e.rotY += 0.01; // automatic drift rotation when idle
        }

        // Render Vector Lines in 3D projection space
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12; ctx.shadowColor = "#00ffff";

        const nodes = MODELS[e.currentAsset];
        const lines = MODELS[e.currentAsset + "Lines"];
        const projected = [];

        // Apply Rotation Matrix math transformations
        nodes.forEach(node => {
            // Y-Axis Rotation
            let x1 = node.x * Math.cos(e.rotY) - node.z * Math.sin(e.rotY);
            let z1 = node.z * Math.cos(e.rotY) + node.x * Math.sin(e.rotY);
            // X-Axis Rotation
            let y2 = node.y * Math.cos(e.rotX) - z1 * Math.sin(e.rotX);
            let z2 = z1 * Math.cos(e.rotX) + node.y * Math.sin(e.rotX);

            // Basic Isometric Perspective scalar sizing
            const scale = 230 / (230 + z2);
            projected.push({ x: p.x + x1 * scale * 2, y: p.y + y2 * scale * 2 });
        });

        // Draw structural wire mesh paths
        lines.forEach(([start, end]) => {
            ctx.beginPath();
            ctx.moveTo(projected[start].x, projected[start].y);
            ctx.lineTo(projected[end].x, projected[end].y);
            ctx.stroke();
        });

        ctx.restore();
    }

    // ====================================================================
    // GAME MODE 3: ARCHERY ENGINE
    // ====================================================================
    _runArcheryGame(left, right) {
        const ctx = this.ctx, p = this.portal, g = this.archery;
        ctx.save();
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius - 5, 0, Math.PI * 2); ctx.clip();

        // Move target disc
        g.target.x += g.target.vx; g.target.y += g.target.vy;
        const dTarget = Math.hypot(g.target.x - p.x, g.target.y - p.y);
        if (dTarget > p.radius - g.target.r - 10) {
            const nx = (g.target.x - p.x) / dTarget, ny = (g.target.y - p.y) / dTarget;
            const dot = g.target.vx * nx + g.target.vy * ny;
            g.target.vx -= 2 * dot * nx; g.target.vy -= 2 * dot * ny;
        }

        const colors = ["#ff3333", "#ffffff", "#ffcc00"];
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = colors[i];
            ctx.beginPath(); ctx.arc(g.target.x, g.target.y, g.target.r * (1 - i * 0.3), 0, Math.PI * 2); ctx.fill();
        }

        if (left && right) {
            const bowPos = this._toCanvas(this._palmCenter(left));
            const arrowHandPos = this._toCanvas(right[8]);
            const thumbTip = this._toCanvas(right[4]);
            const isPinching = Math.hypot(arrowHandPos.x - thumbTip.x, arrowHandPos.y - thumbTip.y) < 35;

            const dx = arrowHandPos.x - bowPos.x, dy = arrowHandPos.y - bowPos.y;
            const distance = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);

            ctx.save();
            ctx.translate(bowPos.x, bowPos.y); ctx.rotate(angle);
            ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 6;
            ctx.beginPath(); ctx.arc(-20, 0, 50, -Math.PI / 2, Math.PI / 2); ctx.stroke();
            ctx.restore();

            if (isPinching) {
                g.isDrawn = true; g.drawPower = Math.min(distance / 180, 1.0);
                ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(bowPos.x + Math.cos(angle - Math.PI/3)*40, bowPos.y + Math.sin(angle - Math.PI/3)*40);
                ctx.lineTo(arrowHandPos.x, arrowHandPos.y);
                ctx.lineTo(bowPos.x + Math.cos(angle + Math.PI/3)*40, bowPos.y + Math.sin(angle + Math.PI/3)*40);
                ctx.stroke();

                ctx.strokeStyle = "#00ffcc"; ctx.lineWidth = 4;
                ctx.save(); ctx.translate(arrowHandPos.x, arrowHandPos.y); ctx.rotate(angle + Math.PI);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(distance, 0); ctx.stroke();
                ctx.restore();
            } else {
                if (g.isDrawn && g.drawPower > 0.15) {
                    g.arrows.push({ x: bowPos.x, y: bowPos.y, vx: -Math.cos(angle) * (g.drawPower * 22), vy: -Math.sin(angle) * (g.drawPower * 22), angle: angle + Math.PI });
                }
                g.isDrawn = false; g.drawPower = 0;
            }
        }

        for (let i = g.arrows.length - 1; i >= 0; i--) {
            const arr = g.arrows[i]; arr.x += arr.vx; arr.y += arr.vy;
            ctx.save(); ctx.translate(arr.x, arr.y); ctx.rotate(arr.angle);
            ctx.strokeStyle = "#00ffcc"; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(30,0); ctx.stroke();
            ctx.restore();

            if (Math.hypot(arr.x - g.target.x, arr.y - g.target.y) < g.target.r + 10) {
                this.score += 10;
                this._ballSpark(g.target.x, g.target.y, "#ffcc00");
                g.arrows.splice(i, 1); this._spawnTarget(); continue;
            }
            if (Math.hypot(arr.x - p.x, arr.y - p.y) > p.radius) g.arrows.splice(i, 1);
        }

        ctx.fillStyle = "rgba(0, 255, 200, 0.8)";
        ctx.font = "bold 14px 'Space Grotesk'"; ctx.fillText(`SCORE: ${this.score}`, p.x - p.radius + 30, p.y - p.radius + 40);
        ctx.restore();
    }

    _spawnTarget() {
        const r = this.portal.radius;
        this.archery.target.x = this.portal.x + (Math.random() - 0.5) * r * 1.2;
        this.archery.target.y = this.portal.y + (Math.random() - 0.5) * r * 1.2;
    }

    _updatePortal() {
        if (!this.portal) return;
        const ctx = this.ctx, p = this.portal;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        p.ringRotation += 0.03;

        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ringRotation);
        ctx.strokeStyle = "rgba(255, 90, 0, 0.25)"; ctx.lineWidth = 16;
        ctx.shadowBlur = 30; ctx.shadowColor = "#ff3c00";
        ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.stroke();

        ctx.strokeStyle = "#ffaa00"; ctx.lineWidth = 4; ctx.setLineDash([10, 30]);
        ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();

        if (Math.random() < 0.6) {
            const a = Math.random() * Math.PI * 2;
            this.particles.spawn({
                x: p.x + Math.cos(a) * p.radius, y: p.y + Math.sin(a) * p.radius,
                vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
                life: 25, size: 3, color: "#ff6600"
            });
        }
        ctx.restore();
    }

    triggerScreenFlash(intensity = 0.5) { this.screenFlash.alpha = Math.max(this.screenFlash.alpha, intensity); }
    _drawScreenFlash() {
        if (this.screenFlash.alpha <= 0) return;
        this.ctx.save(); this.ctx.globalAlpha = this.screenFlash.alpha;
        this.ctx.fillStyle = "#ffaa66"; this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore(); this.screenFlash.alpha *= 0.85;
    }
    triggerScreenShake(intensity = 6, durationSec = 0.3) {
        this.screenShake.intensity = intensity;
        gsap.to(this.screenShake, { intensity: 0, duration: durationSec, ease: "power1.out" });
    }
    _applyScreenShake() {
        if (this.screenShake.intensity <= 0.05) return;
        this.ctx.translate((Math.random() - 0.5) * this.screenShake.intensity, (Math.random() - 0.5) * this.screenShake.intensity);
    }
}