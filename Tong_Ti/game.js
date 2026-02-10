console.log("--- SCRIPT START: Tong_Ti/game.js v4 (SUPER-STABLE) ---");

window.onerror = function (msg, url, line) {
    console.warn("Lỗi phát hiện: " + msg + " tại dòng " + line);
    return false;
};

// --- CANVAS INIT ---
const canvas = document.getElementById('gameCanvas');
const ctx = (canvas) ? canvas.getContext('2d') : null;

if (!canvas || !ctx) {
    console.error("CRITICAL: Game Canvas or Context not found!");
} else {
    canvas.width = 1000;
    canvas.height = 380;
}

// --- SUPABASE CONFIG ---
const supabaseUrl = 'https://khrucxyrvtprykaatcjn.supabase.co';
const supabaseKey = 'sb_publishable_Nn8HTw3Nxau96UR068_E7g_Mbv3Km66';
let dbClient = null;
try {
    if (window.supabase) {
        dbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log("Supabase Client initialized");
    }
} catch (e) {
    console.warn("Supabase Init Warning:", e);
}
const GAME_ID = 'tong_ti';

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
        { x: 0, speed: 1.2, color: '#16213e' }  // Near Buildings
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
        sceneryImage: new Image(),
        isCarLoaded: false,
        isSceneryLoaded: false,
        engineSound: new Audio('assets/sounds/engine.mp3')
    }
};

state.assets.engineSound.loop = true;

// --- IMAGE PRELOADING ---
function preloadAssets() {
    state.assets.carImage.src = 'assets/images/car.png';
    state.assets.carImage.onload = () => state.assets.isCarLoaded = true;

    state.assets.sceneryImage.src = 'assets/images/scenery.png';
    state.assets.sceneryImage.onload = () => state.assets.isSceneryLoaded = true;
}
preloadAssets();

const QUESTIONS = [
    { "q": "Tổng là 31.5, tỉ số là 2/3. Tìm hai số.", "a": "12.6;18.9" },
    { "q": "Hai thùng dầu 82.5l. Thùng 1 = 1/4 Thùng 2.", "a": "16.5;66.0" },
    { "q": "Mảnh vườn nửa chu vi 45.5m. Rộng = 3/4 Dài.", "a": "19.5;26.0" },
    { "q": "Gạo nếp + tẻ = 108.9kg. Nếp = 4/5 Tẻ.", "a": "48.4;60.5" },
    { "q": "Tổng là 12.6. Số lớn gấp 2.5 lần số bé.", "a": "3.6;9.0" },
    { "q": "Tổng 220.5 vở. Khối 5 = 3/4 Khối 4.", "a": "94.5;126.0" },
    { "q": "Vòi nước 157.5l. Vòi 1 = 2/5 Vòi 2.", "a": "45.0;112.5" },
    { "q": "Hai tấm vải 63.7m. Vải xanh = 3/4 Vải đỏ.", "a": "27.3;36.4" },
    { "q": "Tổng là 202.4. Số bé = 3/5 Số lớn.", "a": "75.9;126.5" },
    { "q": "Bán 93.6kg đường. Ngày 1 = 1/2 Ngày 2.", "a": "31.2;62.4" }
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
            this.trails.push({ x: this.x + 30, y: this.y + 40, life: 25, color: 'rgba(0, 242, 255, 0.6)' });
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
            ctx.fillStyle = '#00f2ff';
            ctx.fillRect(0, 60, 220, 60);
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
    update(speed) { this.x -= speed; }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = 'rgba(0, 242, 255, 0.05)';
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(0, 0, this.w, this.h, 15);
        else ctx.rect(0, 0, this.w, this.h);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#00f2ff';
        ctx.font = 'bold 30px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(this.idx + 1, this.w / 2, this.h / 2 + 10);
        ctx.restore();
    }
}

const userCar = new Car();

// --- RENDERING ---

function drawParallax() {
    state.parallaxLayers.forEach((layer, i) => {
        layer.x -= state.speed * layer.speed;
        if (layer.x <= -canvas.width) layer.x = 0;
        if (i === 0) {
            const skyGrad = ctx.createLinearGradient(0, 0, 0, 180);
            skyGrad.addColorStop(0, '#050510');
            skyGrad.addColorStop(1, '#2e1a4a');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, canvas.width, 180);
        } else if (i === 1 && state.assets.isSceneryLoaded) {
            ctx.drawImage(state.assets.sceneryImage, layer.x, 0, canvas.width, 180);
            ctx.drawImage(state.assets.sceneryImage, layer.x + canvas.width, 0, canvas.width, 180);
        }
    });
}

function drawRoad() {
    ctx.fillStyle = '#05050a';
    ctx.fillRect(0, 180, canvas.width, 180);
    const curbSize = 100;
    state.roadOffset -= state.speed * 2;
    if (state.roadOffset <= -curbSize) state.roadOffset = 0;
    for (let i = -curbSize; i < canvas.width + curbSize; i += curbSize) {
        let x = i + state.roadOffset;
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 185); ctx.lineTo(x + curbSize - 10, 185);
        ctx.moveTo(x, 345); ctx.lineTo(x + curbSize - 10, 345);
        ctx.stroke();
    }
}

function update() {
    if (state.mode === 'DRIVING') {
        state.targetSpeed = 12;
        state.speed += (state.targetSpeed - state.speed) * 0.05;
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
            if (carRect.x < hRect.x + hRect.w && carRect.x + carRect.w > hRect.x &&
                carRect.y < hRect.y + hRect.h && carRect.y + carRect.h > hRect.y) {
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
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- UI & LOGIC ---

function triggerQuiz() {
    state.mode = 'QUIZ';
    document.getElementById('quiz-panel').classList.remove('inactive');
    document.getElementById('question-text').innerText = QUESTIONS[state.currentIdx].q;
    document.getElementById('answer-input').focus();
}

function updateUI() {
    document.getElementById('speed-val').innerText = `${Math.round(state.speed * 15)} KM/H`;
    const progressPerc = (state.currentIdx / QUESTIONS.length) * 100;
    document.getElementById('progress-bar').style.width = `${progressPerc}%`;
    document.getElementById('progress-text').innerText = `${state.currentIdx}/10`;

    const elapsed = Date.now() - state.startTime;
    const remaining = Math.max(0, Math.ceil((state.cruisingDelay - elapsed) / 1000));
    const statusOverlay = document.getElementById('status-overlay');
    const statusText = document.getElementById('status-text');

    if (state.mode === 'DRIVING' && remaining > 0) {
        statusOverlay.classList.remove('hidden');
        statusText.innerText = `START IN: ${remaining}s`;
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

// Global Start Function
window.startGame = function () {
    console.log("startGame called");
    const nameInput = document.getElementById('player-name').value.trim();
    const classSelect = document.getElementById('player-class').value;
    if (!nameInput || !classSelect) {
        alert("Em hãy nhập tên và chọn lớp nhé!");
        return;
    }
    state.playerName = nameInput;
    state.playerClass = classSelect;
    state.mode = 'DRIVING';
    state.startTime = Date.now();
    state.gameStartTime = Date.now();
    document.getElementById('start-screen').style.display = 'none';
    if (state.assets.engineSound) state.assets.engineSound.play().catch(() => { });
};

// --- HIGH SCORE ---
const SCORE_LOCAL_KEY = 'top_scores_tong_ti';

async function saveHighScore(time) {
    let locals = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
    locals.push({ name: state.playerName, class: state.playerClass, time: time });
    locals.sort((a, b) => a.time - b.time);
    localStorage.setItem(SCORE_LOCAL_KEY, JSON.stringify(locals.slice(0, 10)));
    if (dbClient) {
        const fullDisplay = `${state.playerName} - ${state.playerClass}`;
        await dbClient.from('high_scores').insert([{ game_id: GAME_ID, player_name: fullDisplay, score_time: time }]);
        showLeaderboard();
    }
}

async function showLeaderboard() {
    const listFinish = document.getElementById('score-list');
    const startLeaderboard = document.querySelector('#start-leaderboard ul');
    let html = '';
    if (dbClient) {
        const { data } = await dbClient.from('high_scores').select('player_name, score_time')
            .eq('game_id', GAME_ID).order('score_time', { ascending: true }).limit(10);
        if (data) {
            html = data.map((s, i) => {
                const parts = (s.player_name || "Ẩn danh - KĐ").split(' - ');
                const mins = Math.floor(s.score_time / 60).toString().padStart(2, '0');
                const secs = (s.score_time % 60).toString().padStart(2, '0');
                return `<li>#${i + 1} ${parts[0]} (${parts[1]}) - ${mins}:${secs}</li>`;
            }).join('');
        }
    }
    if (!html) {
        const items = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
        html = items.map((s, i) => `<li>#${i + 1} ${s.name} - ${s.class}</li>`).join('');
    }
    if (listFinish) listFinish.innerHTML = html;
    if (startLeaderboard) startLeaderboard.innerHTML = html;
}

async function updateBestTimePreview() {
    let best;
    if (dbClient) {
        const { data } = await dbClient.from('high_scores').select('score_time')
            .eq('game_id', GAME_ID).order('score_time', { ascending: true }).limit(1);
        if (data && data.length > 0) best = data[0].score_time;
    }
    if (best) {
        const mins = Math.floor(best / 60).toString().padStart(2, '0');
        const secs = (best % 60).toString().padStart(2, '0');
        if (document.getElementById('best-time')) document.getElementById('best-time').innerText = `${mins}:${secs}`;
    }
}

function drawFireworks() {
    if (Math.random() < 0.1) {
        state.particles.push({
            x: Math.random() * canvas.width, y: Math.random() * 200,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
            life: 100, color: `hsl(${Math.random() * 360}, 100%, 60%)`
        });
    }
    state.particles.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.life--;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        if (p.life <= 0) state.particles.splice(i, 1);
    });
}

function init() {
    console.log("Initialization started...");
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.onclick = window.startGame;
    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn) submitBtn.onclick = checkAnswer;
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.onclick = () => location.reload();
    showLeaderboard();
    updateBestTimePreview();
    gameLoop();
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
