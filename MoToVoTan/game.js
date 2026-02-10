console.log("--- SCRIPT START: MoToVoTan/game.js (INFINITE MODE) ---");

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
const GAME_ID = 'mo_to_vo_tan';

// Game State
const state = {
    mode: 'START', // START, DRIVING, FINISH
    playerName: '',
    playerClass: '',
    distance: 0,
    speed: 0,
    targetSpeed: 0,
    roadOffset: 0,
    parallaxLayers: [
        { x: 0, speed: 0.2, color: '#050510' }, // Sky
        { x: 0, speed: 0.6, color: '#0a0a2a' }, // Distant City
        { x: 0, speed: 1.2, color: '#16213e' }  // Near Buildings
    ],
    particles: [],
    startTime: 0,
    gameStartTime: 0,
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
        }
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
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 185); ctx.lineTo(x + curbSize - 10, 185);
        ctx.moveTo(x, 345); ctx.lineTo(x + curbSize - 10, 345);
        ctx.stroke();
    }
}

function update() {
    if (state.mode === 'DRIVING') {
        state.targetSpeed = 15;
        state.speed += (state.targetSpeed - state.speed) * 0.05;
        state.distance += state.speed * 0.1;
    } else {
        state.speed *= 0.95;
    }
    userCar.update();
    updateUI();

    // Sound Control
    if (state.mode === 'DRIVING' && state.speed > 0.1) {
        if (state.assets.engineSound.paused) state.assets.engineSound.play().catch(() => { });
        const speedRatio = state.speed / 15;
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
    userCar.draw();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// --- UI & LOGIC ---

function updateUI() {
    document.getElementById('speed-val').innerText = `${Math.round(state.speed * 15)} KM/H`;
    const distStr = `${Math.floor(state.distance)}m`;
    document.getElementById('progress-text').innerText = distStr;
    const bestTimeEl = document.getElementById('best-time');
    if (bestTimeEl) bestTimeEl.innerText = distStr;
}

window.startGame = function () {
    console.log("startGame called - MoToVoTan Mode");
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
const SCORE_LOCAL_KEY = 'top_scores_mo_to_vo_tan';

async function saveHighScore(dist) {
    let locals = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
    locals.push({ name: state.playerName, class: state.playerClass, distance: dist });
    locals.sort((a, b) => b.distance - a.distance);
    localStorage.setItem(SCORE_LOCAL_KEY, JSON.stringify(locals.slice(0, 10)));
    if (dbClient) {
        const fullDisplay = `${state.playerName} - ${state.playerClass}`;
        await dbClient.from('high_scores').insert([{ game_id: GAME_ID, player_name: fullDisplay, score_time: dist }]);
        showLeaderboard();
    }
}

async function showLeaderboard() {
    const listFinish = document.getElementById('score-list');
    const startLeaderboard = document.querySelector('#start-leaderboard ul');
    let html = '';
    if (dbClient) {
        const { data } = await dbClient.from('high_scores').select('player_name, score_time')
            .eq('game_id', GAME_ID).order('score_time', { ascending: false }).limit(10);
        if (data) {
            html = data.map((s, i) => {
                const parts = (s.player_name || "Ẩn danh - KĐ").split(' - ');
                return `<li>#${i + 1} ${parts[0]} (${parts[1]}) - ${Math.floor(s.score_time)}m</li>`;
            }).join('');
        }
    }
    if (!html) {
        const items = JSON.parse(localStorage.getItem(SCORE_LOCAL_KEY)) || [];
        html = items.map((s, i) => `<li>#${i + 1} ${s.name} - ${Math.floor(s.distance)}m</li>`).join('');
    }
    if (listFinish) listFinish.innerHTML = html;
    if (startLeaderboard) startLeaderboard.innerHTML = html;
}

async function updateBestTimePreview() {
    let best;
    if (dbClient) {
        const { data } = await dbClient.from('high_scores').select('score_time')
            .eq('game_id', GAME_ID).order('score_time', { ascending: false }).limit(1);
        if (data && data.length > 0) best = data[0].score_time;
    }
    if (best) {
        if (document.getElementById('best-time')) document.getElementById('best-time').innerText = `${Math.floor(best)}m`;
    }
}

function init() {
    console.log("Initialization MoToVoTan started...");
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.onclick = window.startGame;
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) restartBtn.onclick = () => location.reload();

    const finishRunBtn = document.getElementById('finish-run-btn');
    if (finishRunBtn) {
        finishRunBtn.onclick = () => {
            state.mode = 'FINISH';
            saveHighScore(state.distance);
            document.getElementById('finish-screen').classList.remove('hidden');
            const distStr = `${Math.floor(state.distance)}m`;
            document.getElementById('final-time').innerText = distStr;
        };
    }

    showLeaderboard();
    updateBestTimePreview();
    gameLoop();
}

if (document.readyState === 'complete') init();
else window.addEventListener('load', init);
