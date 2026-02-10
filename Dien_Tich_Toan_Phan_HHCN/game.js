console.log("--- SCRIPT START: HHCN/game.js v2 ---");

window.onerror = function (msg, url, line) {
    console.warn("Lỗi HHCN: " + msg + " tại dòng " + line);
    return false;
};

const canvas = document.getElementById('gameCanvas');
const ctx = (canvas) ? canvas.getContext('2d') : null;
if (canvas && ctx) {
    canvas.width = 1000;
    canvas.height = 380;
}

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://khrucxyrvtprykaatcjn.supabase.co';
const supabaseKey = 'sb_publishable_Nn8HTw3Nxau96UR068_E7g_Mbv3Km66';
let supabaseClient = null;
try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
    }
} catch (e) {
    console.error("Supabase Init Error:", e);
}
const GAME_ID = 'hhcn_dtxq';

// Game State
const state = {
    mode: 'START', // START, DRIVING, QUIZ, FINISH
    playerName: '',
    playerClass: '',
    currentIdx: 0,
    speed: 0,
    targetSpeed: 0,
    roadOffset: 0,
    parallaxLayers: [
        { x: 0, speed: 0.2, color: '#050510' }, // Sky
        { x: 0, speed: 0.6, color: '#0a0a2a' }, // Distant City
        { x: 0, speed: 1.2, color: '#16213e' }  // Near Buildings (Slower than road speed 2.0)
    ],
    hurdle: null,
    userInput: "",
    progress: 0,
    particles: [],
    startTime: 0,
    gameStartTime: 0,
    totalTime: 0,
    cruisingDelay: 20000, // 20 seconds
    assets: {
        carImage: new Image(),
        roadImage: new Image(),
        sceneryImage: new Image(),
        isCarLoaded: false,
        isRoadLoaded: false,
        isSceneryLoaded: false,
        engineSound: new Audio('assets/sounds/engine.mp3')
    }
};

state.assets.engineSound.loop = true;

// --- IMAGE PRELOADING ---
function preloadAssets() {
    state.assets.carImage.src = 'assets/images/car.png';
    state.assets.carImage.onload = () => state.assets.isCarLoaded = true;

    state.assets.roadImage.src = 'assets/images/road_texture.png';
    state.assets.roadImage.onload = () => state.assets.isRoadLoaded = true;

    state.assets.sceneryImage.src = 'assets/images/scenery.png';
    state.assets.sceneryImage.onload = () => state.assets.isSceneryLoaded = true;
}
preloadAssets();

const QUESTIONS = [
    { "q": "Tính Stp HHCN có dài 5m, rộng 4m, cao 3m.", "a": "94" },
    { "q": "Tính Stp HHCN dài 10dm, rộng 6dm, cao 5dm.", "a": "280" },
    { "q": "Hộp dài 20cm, rộng 10cm, cao 5cm. Tính diện tích bìa.", "a": "700" },
    { "q": "Kích thước: dài 2.5m; rộng 1.5m; cao 2m. Tính Stp.", "a": "23.5" },
    { "q": "Viên gạch dài 20cm, rộng 10cm, cao 5cm. Tính Stp.", "a": "700" },
    { "q": "Đáy vuông cạnh 4cm, cao 10cm. Tính Stp.", "a": "192" },
    { "q": "Sxq = 100cm2, dài 6cm, rộng 4cm. Tính Stp.", "a": "148" },
    { "q": "Bể nước có nắp dài 1.2m; rộng 0.8m; cao 1m. Tính Stp.", "a": "5.92" },
    { "q": "Dài 3/4 m, rộng 1/2 m, cao 1/4 m. Tính Stp (số thập phân).", "a": "1.375" },
    { "q": "Thùng tôn không nắp dài 8dm, rộng 5dm, cao 4dm. Tính St tôn.", "a": "144" }
];

// --- CLASSES ---

class Car {
    constructor() {
        this.w = 308;
        this.h = 190;
        this.x = 100;
        this.y = 160;
        this.targetY = 160;
        this.trails = [];
    }

    update() {
        this.y += (this.targetY - this.y) * 0.1;
        if (state.speed > 1) {
            this.trails.push({ x: this.x + 30, y: this.y + 40, life: 25, color: 'rgba(255, 204, 0, 0.6)' });
            this.trails.push({ x: this.x + 30, y: this.y + 80, life: 25, color: 'rgba(255, 100, 0, 0.6)' });
        }
        this.trails.forEach((t, i) => {
            t.x -= state.speed * 2;
            t.life--;
            if (t.life <= 0) this.trails.splice(i, 1);
        });
    }

    draw() {
        this.trails.forEach(t => {
            ctx.fillStyle = t.color;
            ctx.globalAlpha = t.life / 25;
            ctx.fillRect(t.x, t.y, 60, 3);
            ctx.globalAlpha = 1;
        });

        ctx.save();
        ctx.translate(this.x, this.y);

        if (state.assets.isCarLoaded) {
            ctx.drawImage(state.assets.carImage, 0, 0, this.w, this.h);
        } else {
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(0, 60, 220, 60);
            ctx.fillStyle = '#ff6600';
            ctx.fillRect(40, 30, 120, 40);
        }

        ctx.restore();
    }
}

class Hurdle {
    constructor(idx) {
        this.w = 80;
        this.h = 80;
        this.x = canvas.width + 100;
        this.y = 190 + Math.random() * 80;
        this.idx = idx;
    }

    update(speed) {
        this.x -= speed;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Box (Compatible with older browsers)
        ctx.fillStyle = 'rgba(0, 242, 255, 0.05)';
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00f2ff';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(0, 0, this.w, this.h, 15);
        } else {
            ctx.rect(0, 0, this.w, this.h);
        }
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Number
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 30px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(this.idx + 1, this.w / 2, this.h / 2 + 10);

        ctx.restore();
    }
}

const userCar = new Car();

// --- RENDERING HELPERS ---

function drawParallax() {
    state.parallaxLayers.forEach((layer, i) => {
        layer.x -= state.speed * layer.speed;
        if (layer.x <= -canvas.width) layer.x = 0;

        if (i === 0) { // Night Sky
            const skyGrad = ctx.createLinearGradient(0, 0, 0, 180);
            skyGrad.addColorStop(0, '#050510');
            skyGrad.addColorStop(0.6, '#1a0a2e');
            skyGrad.addColorStop(1, '#2e1a4a');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, canvas.width, 180);

            // Crescent Moon
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#fff';
            ctx.beginPath();
            ctx.arc(800, 50, 25, 0, Math.PI * 2);
            ctx.fill();
            // Dark part to make it crescent
            ctx.fillStyle = '#050510';
            ctx.beginPath();
            ctx.arc(815, 35, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (i === 1 && state.assets.isSceneryLoaded) {
            // Draw Scenery Image if available
            ctx.drawImage(state.assets.sceneryImage, layer.x, 0, canvas.width, 180);
            ctx.drawImage(state.assets.sceneryImage, layer.x + canvas.width, 0, canvas.width, 180);
        }
    });
}

function drawRoad() {
    // Road Texture
    if (state.assets.isRoadLoaded) {
        ctx.drawImage(state.assets.roadImage, 0, 180, canvas.width, 180);
    } else {
        ctx.fillStyle = '#05050a';
        ctx.fillRect(0, 180, canvas.width, 180);
    }

    // Neon Curbs
    const curbSize = 100;
    state.roadOffset -= state.speed * 2;
    if (state.roadOffset <= -curbSize) state.roadOffset = 0;

    for (let i = -curbSize; i < canvas.width + curbSize; i += curbSize) {
        let x = i + state.roadOffset;
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ffcc00';
        ctx.beginPath();
        ctx.moveTo(x, 185);
        ctx.lineTo(x + curbSize - 10, 185);
        ctx.moveTo(x, 345);
        ctx.lineTo(x + curbSize - 10, 345);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Glowing Lane Markers
    ctx.strokeStyle = 'rgba(255, 204, 0, 0.4)';
    ctx.setLineDash([90, 110]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 265);
    ctx.lineTo(canvas.width, 265);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
}

// --- GAME LOOP ---

function update() {
    if (state.mode === 'DRIVING') {
        state.targetSpeed = 12;
        state.speed += (state.targetSpeed - state.speed) * 0.05;

        // Initial 20-second delay logic
        const elapsed = Date.now() - state.startTime;
        const isCruising = elapsed < state.cruisingDelay;

        if (!state.hurdle && !isCruising && Math.random() < 0.0015) {
            state.hurdle = new Hurdle(state.currentIdx);
        }

        if (state.hurdle) {
            state.hurdle.update(state.speed * 2);
            if (state.hurdle.x < -100) state.hurdle = null;

            const carRect = { x: userCar.x + 40, y: userCar.y + 40, w: 220, h: 100 };
            const hRect = { x: state.hurdle.x + 10, y: state.hurdle.y + 10, w: 60, h: 60 };

            if (carRect.x < hRect.x + hRect.w &&
                carRect.x + carRect.w > hRect.x &&
                carRect.y < hRect.y + hRect.h &&
                carRect.y + carRect.h > hRect.y) {
                triggerQuiz();
            }
        }
    } else if (state.mode === 'QUIZ') {
        state.speed *= 0.85;
    } else {
        state.speed *= 0.95;
    }

    userCar.update();
    updateUI();

    // Sound Control
    if (state.mode === 'DRIVING' && state.speed > 0.1) {
        if (state.assets.engineSound.paused) state.assets.engineSound.play().catch(() => { });

        // Sync pitch and volume with speed
        const speedRatio = state.speed / 12; // 12 is target speed
        state.assets.engineSound.playbackRate = 0.6 + speedRatio * 0.8;
        state.assets.engineSound.volume = Math.min(1.0, 0.2 + speedRatio * 0.5);
    } else {
        state.assets.engineSound.pause();
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawParallax();
    drawRoad();
    if (state.hurdle) state.hurdle.draw();
    userCar.draw();
    if (state.mode === 'FINISH') drawFireworks();
}

function gameLoop() {
    try {
        update();
        draw();
    } catch (e) {
        console.error("Game Loop Error:", e);
        alert("Lỗi game: " + e.message + ". Vui lòng làm mới trang.");
        return; // Stop requesting animation frames
    }
    requestAnimationFrame(gameLoop);
}

// --- LOGIC & UI ---

function triggerQuiz() {
    state.mode = 'QUIZ';
    const panel = document.getElementById('quiz-panel');
    panel.classList.remove('inactive');
    document.getElementById('question-text').innerText = QUESTIONS[state.currentIdx].q;
    document.getElementById('answer-input').focus();
}

function updateUI() {
    document.getElementById('speed-val').innerText = `${Math.round(state.speed * 15)} KM/H`;
    const progressPerc = (state.currentIdx / QUESTIONS.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPerc}%`;
    document.getElementById('progress-text').innerText = `${state.currentIdx}/10`;

    // Timer display preview
    if (state.mode === 'DRIVING' || state.mode === 'QUIZ') {
        const currentTotal = Math.floor((Date.now() - state.gameStartTime) / 1000);
        const mins = Math.floor(currentTotal / 60).toString().padStart(2, '0');
        const secs = (currentTotal % 60).toString().padStart(2, '0');
        // Update nav preview if desired
    }

    // Cruising Phase HUD Update
    const elapsed = Date.now() - state.startTime;
    const remaining = Math.max(0, Math.ceil((state.cruisingDelay - elapsed) / 1000));

    const statusOverlay = document.getElementById('status-overlay');
    const statusText = document.getElementById('status-text');

    if (state.mode === 'DRIVING') {
        if (remaining > 0) {
            statusOverlay.classList.remove('hidden');
            statusText.innerText = `START IN: ${remaining}s`;
            statusText.style.color = '#ffcc00';
        } else {
            statusOverlay.classList.add('hidden');
        }
    } else {
        statusOverlay.classList.add('hidden');
    }
}

function checkAnswer() {
    const input = document.getElementById('answer-input').value;
    const processed = input.replace(',', '.').replace(/\s/g, '');

    if (processed === QUESTIONS[state.currentIdx].a) {
        state.currentIdx++;
        state.hurdle = null;
        document.getElementById('answer-input').value = "";
        document.getElementById('quiz-panel').classList.add('inactive');

        if (state.currentIdx >= QUESTIONS.length) {
            state.mode = 'FINISH';
            state.totalTime = Math.floor((Date.now() - state.gameStartTime) / 1000);
            saveHighScore(state.totalTime);
            showLeaderboard();
            document.getElementById('finish-screen').classList.remove('hidden');

            const mins = Math.floor(state.totalTime / 60).toString().padStart(2, '0');
            const secs = (state.totalTime % 60).toString().padStart(2, '0');
            document.getElementById('final-time').innerText = `${mins}:${secs}`;
        } else {
            state.mode = 'DRIVING';
        }
    } else {
        document.getElementById('answer-input').value = "";
    }
}

// --- EVENTS ---

window.addEventListener('keydown', (e) => {
    if (state.mode === 'DRIVING') {
        if (e.key === 'ArrowUp') userCar.targetY = 120;
        if (e.key === 'ArrowDown') userCar.targetY = 180;
    }
    if (e.key === 'Enter' && state.mode === 'QUIZ') checkAnswer();
});

// Touch Controls for Mobile
canvas.addEventListener('touchstart', (e) => {
    if (state.mode !== 'DRIVING') return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const touchY = touch.clientY - rect.top;
    const canvasHeight = rect.height;

    if (touchY < canvasHeight / 2) {
        userCar.targetY = 120;
    } else {
        userCar.targetY = 180;
    }
}, { passive: false });

// Support for Mouse Click as fallback touch
canvas.addEventListener('mousedown', (e) => {
    if (state.mode !== 'DRIVING') return;
    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const canvasHeight = rect.height;

    if (clickY < canvasHeight / 2) {
        userCar.targetY = 120;
    } else {
        userCar.targetY = 180;
    }
});

// --- INITIALIZATION ---
function init() {
    console.log("Initialization started...");
    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        console.log("Start button found");
    }

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) {
        submitBtn.onclick = checkAnswer;
    }

    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.onclick = () => location.reload();
    }

    updateBestTimePreview();
    showLeaderboard();
}

if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init);
}

// Make realStartGame global
window.realStartGame = realStartGame;

function realStartGame() {
    console.log("realStartGame function called");
    try {
        const nameInputEl = document.getElementById('player-name');
        const classSelectEl = document.getElementById('player-class');

        if (!nameInputEl || !classSelectEl) {
            console.error("Missing inputs");
            return;
        }

        const nameInput = nameInputEl.value.trim();
        const classSelect = classSelectEl.value;

        if (!nameInput) {
            alert("Em hãy nhập tên của mình nhé!");
            return;
        }
        if (!classSelect) {
            alert("Em hãy chọn lớp của mình nhé!");
            return;
        }

        state.playerName = nameInput;
        state.playerClass = classSelect;

        state.mode = 'DRIVING';
        state.targetSpeed = 8;
        state.startTime = Date.now();
        state.gameStartTime = Date.now();

        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.style.display = 'none';
            startScreen.classList.add('hidden');
        }

        if (state.assets.engineSound) {
            state.assets.engineSound.play().catch(e => console.log("Audio play blocked"));
        }
    } catch (err) {
        console.error("Lỗi startGame:", err);
        alert("Có lỗi xảy ra khi bắt đầu game. Hãy thử làm mới trang (F5)!");
    }
}

// --- HIGH SCORE LOGIC (ONLINE) ---
const SCORE_LOCAL_KEY = 'top_scores_hhcn';

async function saveHighScore(time) {
    // 1. Lưu offline
    let locals = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
    locals.push({ name: state.playerName, class: state.playerClass, time: time });
    locals.sort((a, b) => a.time - b.time);
    localStorage.setItem(SCORE_LOCAL_KEY, JSON.stringify(locals.slice(0, 10)));

    // 2. Lưu online tự động
    if (supabaseClient) {
        const fullDisplay = `${state.playerName} - ${state.playerClass}`;
        const { error } = await supabaseClient
            .from('high_scores')
            .insert([{ game_id: GAME_ID, player_name: fullDisplay, score_time: time }]);

        if (error) console.error("Lỗi lưu điểm online:", error);
        showLeaderboard();
    }
}

async function showLeaderboard() {
    const listFinish = document.getElementById('score-list');
    const startLeaderboard = document.querySelector('#start-leaderboard ul');

    let html = '';

    if (supabaseClient) {
        const { data, error } = await supabaseClient
            .from('high_scores')
            .select('player_name, score_time')
            .eq('game_id', GAME_ID)
            .order('score_time', { ascending: true })
            .limit(10);

        if (!error && data) {
            html = data.map((s, i) => {
                const pName = s.player_name || "Ẩn danh - KĐ";
                const parts = pName.split(' - ');
                const name = parts[0] || "Ẩn danh";
                const className = parts[1] || "KĐ";
                const mins = Math.floor(s.score_time / 60).toString().padStart(2, '0');
                const secs = (Math.floor(s.score_time % 60)).toString().padStart(2, '0');

                return `
                    <li>
                        <div class="player-info">
                            <span class="player-name-tag">#${i + 1} ${name}</span>
                            <span class="player-class-tag">Lớp: ${className}</span>
                        </div>
                        <span class="score-time-tag">${mins}:${secs}</span>
                    </li>`;
            }).join('');
        }
    }

    if (!html) {
        const items = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
        html = items.map((s, i) => {
            const mins = Math.floor(s.time / 60).toString().padStart(2, '0');
            const secs = (Math.floor(s.time % 60)).toString().padStart(2, '0');
            return `
                <li>
                    <div class="player-info">
                        <span class="player-name-tag">#${i + 1} ${s.name}</span>
                        <span class="player-class-tag">Lớp: ${s.class}</span>
                    </div>
                    <span class="score-time-tag">${mins}:${secs}</span>
                </li>`;
        }).join('');
    }

    if (listFinish) listFinish.innerHTML = html || '<li>Chưa có kỷ lục</li>';
    if (startLeaderboard) startLeaderboard.innerHTML = html || '<li>Chưa có kỷ lục</li>';
}

async function updateBestTimePreview() {
    let best;
    if (supabaseClient) {
        const { data } = await supabaseClient
            .from('high_scores')
            .select('score_time')
            .eq('game_id', GAME_ID)
            .order('score_time', { ascending: true })
            .limit(1);
        if (data && data.length > 0) best = data[0].score_time;
    }

    if (!best) {
        const locals = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
        if (locals.length > 0) best = locals[0].time;
    }

    if (best && !isNaN(best)) {
        const mins = Math.floor(best / 60).toString().padStart(2, '0');
        const secs = (Math.floor(best % 60)).toString().padStart(2, '0');
        const bestTimeEl = document.getElementById('best-time');
        if (bestTimeEl) bestTimeEl.innerText = `${mins}:${secs}`;
    }
}
// Removed immediate calls

function drawFireworks() {
    if (Math.random() < 0.1) {
        state.particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * 200,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 100,
            color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
    }

    state.particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 100;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        if (p.life <= 0) state.particles.splice(i, 1);
    });
}

gameLoop();
