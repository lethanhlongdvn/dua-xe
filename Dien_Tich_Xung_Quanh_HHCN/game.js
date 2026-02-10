const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set internal resolution
canvas.width = 1000;
canvas.height = 380;

// Game State
const state = {
    mode: 'START', // START, DRIVING, QUIZ, FINISH
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
    { "q": "Tính Sxq HHCN có dài 5m, rộng 4m, cao 3m.", "a": "54" },
    { "q": "Tính Sxq HHCN dài 10dm, rộng 6dm, cao 5dm.", "a": "160" },
    { "q": "Hộp dài 20cm, rộng 10cm, cao 5cm. Tính Sxq bìa.", "a": "300" },
    { "q": "Kích thước: dài 2.5m; rộng 1.5m; cao 2m. Tính Sxq.", "a": "16" },
    { "q": "Viên gạch dài 20cm, rộng 10cm, cao 5cm. Tính Sxq.", "a": "300" },
    { "q": "Đáy vuông cạnh 4cm, cao 10cm. Tính Sxq.", "a": "160" },
    { "q": "S đáy = 24cm2, chu vi đáy = 20cm, cao 4cm. Tính Sxq.", "a": "80" },
    { "q": "Bể nước không nắp dài 1.2m; rộng 0.8m; cao 1m. Tính Sxq.", "a": "4" },
    { "q": "Dài 3/4 m, rộng 1/2 m, cao 1/4 m. Tính Sxq (số thập phân).", "a": "0.625" },
    { "q": "Thùng tôn không nắp dài 8dm, rộng 5dm, cao 4dm. Tính Sxq.", "a": "104" }
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

        // Add light trails (Adjusted for larger size)
        if (state.speed > 1) {
            this.trails.push({ x: this.x + 30, y: this.y + 20, life: 25, color: 'rgba(0, 242, 255, 0.6)' });
            this.trails.push({ x: this.x + 30, y: this.y + 75, life: 25, color: 'rgba(0, 102, 255, 0.6)' });
        }
        this.trails.forEach((t, i) => {
            t.x -= state.speed * 2; // Match road speed
            t.life--;
            if (t.life <= 0) this.trails.splice(i, 1);
        });
    }

    draw() {
        // Draw Light Trails
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
            // Fallback rendering...
            ctx.fillStyle = '#00f2ff';
            ctx.fillRect(0, 40, 200, 60);
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

        // Cyber Box
        ctx.fillStyle = 'rgba(0, 242, 255, 0.05)';
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#00f2ff';
        ctx.beginPath();
        ctx.roundRect(0, 0, this.w, this.h, 15);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Number
        ctx.fillStyle = '#00f2ff';
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
            skyGrad.addColorStop(0.6, '#0a0a2e');
            skyGrad.addColorStop(1, '#1a1a4a');
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, canvas.width, 180);

            // Crescent Moon
            ctx.fillStyle = '#fff';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#fff';
            ctx.beginPath();
            ctx.arc(800, 50, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#050510';
            ctx.beginPath();
            ctx.arc(815, 35, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (i === 1 && state.assets.isSceneryLoaded) {
            ctx.drawImage(state.assets.sceneryImage, layer.x, 0, canvas.width, 180);
            ctx.drawImage(state.assets.sceneryImage, layer.x + canvas.width, 0, canvas.width, 180);
        }
    });
}

function drawRoad() {
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
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#00f2ff';
        ctx.beginPath();
        ctx.moveTo(x, 185);
        ctx.lineTo(x + curbSize - 10, 185);
        ctx.moveTo(x, 345);
        ctx.lineTo(x + curbSize - 10, 345);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Glowing Lane Markers
    ctx.strokeStyle = 'rgba(0, 242, 255, 0.4)';
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
        const speedRatio = state.speed / 12;
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
    update();
    draw();
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

    const elapsed = Date.now() - state.startTime;
    const remaining = Math.max(0, Math.ceil((state.cruisingDelay - elapsed) / 1000));

    const statusOverlay = document.getElementById('status-overlay');
    const statusText = document.getElementById('status-text');

    if (state.mode === 'DRIVING') {
        if (remaining > 0) {
            statusOverlay.classList.remove('hidden');
            statusText.innerText = `START IN: ${remaining}s`;
            statusText.style.color = '#00f2ff';
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
            document.getElementById('finish-screen').classList.remove('hidden');
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
    if (e.key === ' ' && state.mode === 'START') startGame();
});

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('submit-btn').addEventListener('click', checkAnswer);
document.getElementById('restart-btn').addEventListener('click', () => location.reload());

function startGame() {
    state.mode = 'DRIVING';
    state.startTime = Date.now();
    document.getElementById('start-screen').classList.add('hidden');
}

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
