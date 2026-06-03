// =============================================================
// 1. 繧ｰ繝ｭ繝ｼ繝舌Ν螳壽焚縺ｨ迥ｶ諷句､画焚
// =============================================================

// 豕｡縺ｮ濶ｲ繝代Ξ繝�ヨ�医￥縺吶∩繝代せ繝�Ν��
const BUBBLE_COLORS = [
    { hex: '#81c3d7', hue: 195 },
    { hex: '#f3c68f', hue: 35  },
    { hex: '#c2aff0', hue: 262 },
    { hex: '#96e6b3', hue: 148 },
    { hex: '#f2a3b3', hue: 349 },
    { hex: '#8da9c4', hue: 213 },
    { hex: '#e9c46a', hue: 42  }
];

// 豕｡縺ｮ邂｡逅�
let bubbles = [];
const MAX_BUBBLES = 28;
const BUBBLE_SPAWN_MIN = 800;   // 譛遏ｭ繧ｹ繝昴�繝ｳ髢馴囈 (ms)
const BUBBLE_SPAWN_MAX = 1500;  // 譛髟ｷ繧ｹ繝昴�繝ｳ髢馴囈 (ms)
let nextSpawnTime = 0;

// 蜷瑚牡3騾｣繧ｿ繝��蛻､螳夂畑螻･豁ｴ
let tappedColorHistory = [];
// 螟ｧ辷�匱蛻､螳夂畑縺ｮ逶ｴ霑�10繧ｿ繝��螻･豁ｴ
let popColorHistory = [];
// 豬∵弌鄒､縺ｮ邂｡逅�
let meteors = [];

// フィーバータイム管理用
let feverActive = false;
let feverEndTime = 0;
let auroraTime = 0;

// オーロラ描画キャッシュ（毎フレーム再描画を避けるオフスクリーン方式）
let auroraOffscreen = null;
let auroraOffCtx = null;
let auroraSkipCount = 0; // 3フレームに1回だけ再描画
let auroraParticles = []; // 霧状のエメラルドグリーン粒子
let stars = []; // 夜空のまたたく星屑



// 繧ｳ繝ｳ繝懃ｮ｡逅�
// 繧ｳ繝ｳ繝懃ｮ｡逅
let comboCount = 0;
let lastPopTime = 0;
const COMBO_WINDOW = 1800; // 繧ｳ繝ｳ繝懃ｶ咏ｶ壽凾髢 (ms)

// 繝ｪ繝輔Ξ繝す繝･繧ｲ繝ｼ繧ｸ
let refreshProgress = 0;
const REFRESH_TARGET = 80; // 完了までに必要な泡のポップ数
let totalPops = 0;

// ゲーム状態
let gameActive = false;
let guideHidden = false;
let infiniteMode = false; // true = Endless Play（終わらないモード）

// 髻ｳ螢ｰ髢｢騾｣
let audioCtx = null;
let ambientOscs = [];
let ambientNodes = []; // 繧ｨ繝輔ぉ繧ｯ繝育ｭ峨荳ｭ髢薙ヮ繝ｼ繝我ｸ€諡ｬ邂｡逅畑
let ambientGain = null;
let ambientFilter = null;
let ambientLFO = null;


// =============================================================
// 2. 繝槭う繝ｳ繝峨繧ｷ繝｣繝ｯ繝ｼ (閭梧勹Canvas繝代繝ぅ繧ｯ繝ｫ繧ｷ繧ｹ繝Β)
// =============================================================
let showerCanvas = null;
let showerCtx = null;
let showerParticles = [];
let showerRipples = [];
let showerHue = 200;

// =============================================================
// キャッシュ＆事前レンダリング用オブジェクト
// =============================================================
const particleSpriteCache = {};
const bubbleTemplateCache = {};
let carbonatedBufferCache = null;

// パーティクルスプライトの事前レンダリング
function getParticleSprite(hue) {
    const roundedHue = Math.round((hue % 360) / 10) * 10;
    if (particleSpriteCache[roundedHue]) {
        return particleSpriteCache[roundedHue];
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `hsla(${roundedHue}, 90%, 95%, 1.0)`);
    grad.addColorStop(0.2, `hsla(${roundedHue}, 85%, 72%, 1.0)`);
    grad.addColorStop(0.5, `hsla(${roundedHue}, 85%, 72%, 0.25)`);
    grad.addColorStop(1.0, `hsla(${roundedHue}, 85%, 72%, 0.0)`);
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    
    particleSpriteCache[roundedHue] = canvas;
    return canvas;
}

function initParticleSprites() {
    for (let h = 0; h < 360; h += 10) {
        getParticleSprite(h);
    }
}

// バブルテンプレートの事前レンダリング
function getBubbleTemplate(type, hue, colorHex) {
    const key = `${type}_${hue}`;
    if (bubbleTemplateCache[key]) {
        return bubbleTemplateCache[key];
    }
    
    const canvas = document.createElement('canvas');
    const canvasSize = 128;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    const center = canvasSize / 2;
    const templateRadius = 30; // 基準半径
    
    ctx.save();
    ctx.translate(center, center);
    
    if (type === 'silver') {
        const drawRadius = templateRadius;
        
        // 1. Glow
        const glowGrad = ctx.createRadialGradient(0, 0, drawRadius * 0.5, 0, 0, drawRadius * 2.0);
        glowGrad.addColorStop(0, 'rgba(226, 232, 240, 0.3)');
        glowGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius * 2.0, 0, Math.PI * 2);
        ctx.fill();
        
        // 2. Body
        const bodyGrad = ctx.createRadialGradient(-drawRadius * 0.2, -drawRadius * 0.2, drawRadius * 0.08, 0, 0, drawRadius);
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.35, '#f1f5f9');
        bodyGrad.addColorStop(0.8, '#cbd5e1');
        bodyGrad.addColorStop(1, '#94a3b8');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 3. Outline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius - 0.5, 0, Math.PI * 2);
        ctx.stroke();
        
        // 4. Highlight
        const hlX = -drawRadius * 0.3;
        const hlY = -drawRadius * 0.3;
        const hlR = drawRadius * 0.22;
        const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
        hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
        ctx.fill();
    } else {
        const drawRadius = templateRadius;
        
        // 1. Glow
        const glowGrad = ctx.createRadialGradient(0, 0, drawRadius * 0.5, 0, 0, drawRadius * 1.8);
        glowGrad.addColorStop(0, `hsla(${hue}, 70%, 75%, 0.12)`);
        glowGrad.addColorStop(1, `hsla(${hue}, 70%, 75%, 0)`);
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius * 1.8, 0, Math.PI * 2);
        ctx.fill();
        
        // 2. Body
        const bodyGrad = ctx.createRadialGradient(-drawRadius * 0.2, -drawRadius * 0.2, drawRadius * 0.08, 0, 0, drawRadius);
        bodyGrad.addColorStop(0, `hsla(${hue}, 80%, 88%, 0.9)`);
        bodyGrad.addColorStop(0.4, `hsla(${hue}, 70%, 72%, 0.55)`);
        bodyGrad.addColorStop(0.85, `hsla(${hue}, 60%, 58%, 0.2)`);
        bodyGrad.addColorStop(1, `hsla(${hue}, 50%, 50%, 0.08)`);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // 3. Outline
        ctx.strokeStyle = `hsla(${hue}, 65%, 82%, 0.25)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, drawRadius - 0.8, 0, Math.PI * 2);
        ctx.stroke();
        
        // 4. Highlight
        const hlX = -drawRadius * 0.3;
        const hlY = -drawRadius * 0.3;
        const hlR = drawRadius * 0.22;
        const hlGrad = ctx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
        hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
        hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
    bubbleTemplateCache[key] = canvas;
    return canvas;
}

function initBubbleTemplates() {
    getBubbleTemplate('silver', 210, '#cbd5e1');
    BUBBLE_COLORS.forEach(c => {
        getBubbleTemplate('normal', c.hue, c.hex);
    });
}

// 炭酸バブル効果音の事前合成
function pregenerateCarbonatedBuffer() {
    if (carbonatedBufferCache || !audioCtx) return;
    
    try {
        const durationSeconds = 6.5;
        const sampleRate = audioCtx.sampleRate;
        const bufferSize = sampleRate * durationSeconds;
        
        const audioBuffer = audioCtx.createBuffer(2, bufferSize, sampleRate);
        const leftData = audioBuffer.getChannelData(0);
        const rightData = audioBuffer.getChannelData(1);
        
        // 1. ベースノイズの合成
        for (let i = 0; i < bufferSize; i++) {
            const time = i / sampleRate;
            const amp = Math.min(1.0, time / 0.15) * Math.exp(-time / 2.0) * 0.032;
            const noise = Math.random() * 2 - 1;
            leftData[i] = noise * amp;
            rightData[i] = noise * amp;
        }
        
        // 2. パチパチ音（400個）を一括加算
        const bubbleCount = 400;
        const clickDuration = durationSeconds - 0.2;
        
        for (let i = 0; i < bubbleCount; i++) {
            let timeOffset;
            if (i < 320) {
                timeOffset = Math.pow(Math.random(), 1.4) * 4.0;
            } else {
                timeOffset = 4.0 + Math.random() * (clickDuration - 4.0);
            }
            
            const isNoise = Math.random() < 0.35;
            const clickLen = isNoise 
                ? (0.003 + Math.random() * 0.006) 
                : (0.004 + Math.random() * 0.012);

            const startSample = Math.floor(timeOffset * sampleRate);
            const lengthSamples = Math.floor(clickLen * sampleRate);

            let volumeMultiplier = 1.0;
            if (timeOffset <= 4.0) {
                volumeMultiplier = 1.7 - (timeOffset / 4.0) * 0.5;
            } else {
                const postRatio = (timeOffset - 4.0) / (clickDuration - 4.0);
                volumeMultiplier = Math.max(0.12, 1.0 - postRatio * 0.88);
            }

            const maxVolume = (isNoise
                ? (0.026 + Math.random() * 0.028)
                : (0.020 + Math.random() * 0.022)) * volumeMultiplier * 0.85;

            // 各個別の泡の定位（ステレオの広がり）
            const clickPan = (Math.random() * 2 - 1);
            const gainL = Math.cos((clickPan + 1) * Math.PI / 4);
            const gainR = Math.sin((clickPan + 1) * Math.PI / 4);

            const clickFreq = 2800 + Math.random() * 6800;

            for (let j = 0; j < lengthSamples; j++) {
                const idx = startSample + j;
                if (idx >= bufferSize) break;

                const progress = j / lengthSamples;
                const env = Math.exp(-progress * 4.5) * (1.0 - progress);

                let val = 0;
                if (isNoise) {
                    val = (Math.random() * 2 - 1) * maxVolume * env;
                } else {
                    const angle = (j / sampleRate) * clickFreq * Math.PI * 2;
                    val = Math.sin(angle) * maxVolume * env;
                }

                leftData[idx] += val * gainL;
                rightData[idx] += val * gainR;
            }
        }
        
        carbonatedBufferCache = audioBuffer;
    } catch (e) {
        console.warn("炭酸バブルバッファの事前生成エラー:", e);
    }
}

// ハプティクス（バイブレーション）をトリガーするヘルパー関数
function triggerHaptic(type) {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
            switch (type) {
                case 'light':
                    // 通常バブルのプチッとした微小な振動 (12ms)
                    navigator.vibrate(12);
                    break;
                case 'medium':
                    // 連鎖バブルなどの少し強めの振動 (25ms)
                    navigator.vibrate(25);
                    break;
                case 'heavy':
                    // フィーバー突入時のしっかりとした振動
                    navigator.vibrate([40, 60, 40]);
                    break;
                case 'explosion':
                    // 大爆発・流星群発生時の連続した振動
                    navigator.vibrate([30, 40, 30, 40, 50]);
                    break;
                case 'success':
                    // ゲームクリア時の心地よい2回振動
                    navigator.vibrate([60, 80, 80]);
                    break;
                default:
                    if (typeof type === 'number' || Array.isArray(type)) {
                        navigator.vibrate(type);
                    }
                    break;
            }
        } catch (e) {
            console.warn("ハプティクス再生エラー:", e);
        }
    }
}

// 星屑の初期化 (夜空のまたたき用)
function initStars() {
    if (!showerCanvas) return;
    stars = [];
    // 画面解像度に合わせて適切な星の数を計算
    const starCount = Math.floor((showerCanvas.width * showerCanvas.height) / 7000);
    const starColors = [
        'rgba(255, 255, 255, ', // 純白
        'rgba(224, 242, 254, ', // 青白い星
        'rgba(254, 240, 138, ', // 黄色い星
        'rgba(253, 244, 245, '  // 淡いピンクの星
    ];

    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * showerCanvas.width,
            y: Math.random() * showerCanvas.height,
            size: Math.random() * 1.5 + 0.5, // 0.5px 〜 2px
            baseAlpha: 0.15 + Math.random() * 0.55,
            twinkleSpeed: 0.005 + Math.random() * 0.02,
            phase: Math.random() * Math.PI * 2,
            colorBase: starColors[Math.floor(Math.random() * starColors.length)]
        });
    }
}

// 星屑のまたたき更新と描画
function drawStars() {
    if (!showerCtx || stars.length === 0) return;

    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        
        // 位相を進めてまたたきを計算
        star.phase += star.twinkleSpeed;
        const twinkle = Math.sin(star.phase);
        const currentAlpha = Math.max(0.1, star.baseAlpha + twinkle * 0.25);

        showerCtx.fillStyle = star.colorBase + currentAlpha + ')';
        const size = star.size;
        showerCtx.fillRect(star.x - size / 2, star.y - size / 2, size, size);
    }
}

function initShower() {
    showerCanvas = document.getElementById('shower-canvas');
    if (!showerCanvas) return;
    showerCtx = showerCanvas.getContext('2d');
    
    resizeShowerCanvas();
    initStars(); // 星屑の初期設定
    window.addEventListener('resize', resizeShowerCanvas);
    
    // 繝槭え繧ｹ遘ｻ蜍輔〒蜈峨霆瑚ｷ｡繧堤匱逕
    const addParticleFlow = (clientX, clientY) => {
        createShowerParticles(clientX, clientY, 2);
    };
    
    // 繧ｯ繝ｪ繝け上ち繝メ譎ゅ蜃ｦ逅ｼ壽ｳ｡縺後≠繧後繝昴ャ繝励€√↑縺代ｌ縺ｰ豕｢邏
    const handleInteraction = (clientX, clientY) => {
        if (document.querySelector('.overlay.active')) return;
        
        // 豕｡縺ｮ繝昴ャ繝励ｒ隧ｦ縺ｿ繧
        if (tryPopBubble(clientX, clientY)) {
            return; // 豕｡繧偵繝縺励◆繧芽レ譎ｯ豕｢邏九荳崎ｦ
        }
        
        // 遨ｺ謖ｯ繧翫↑繧芽レ譎ｯ縺ｫ豕｢邏九→邊貞ｭ舌ｒ逋ｺ逕
        createShowerRipple(clientX, clientY);
        createShowerParticles(clientX, clientY, 15);
    };

    let isDragging = false;

    window.addEventListener('mousemove', (e) => {
        addParticleFlow(e.clientX, e.clientY);
        if (isDragging && gameActive) {
            tryPopBubble(e.clientX, e.clientY);
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            addParticleFlow(touch.clientX, touch.clientY);
            
            // ゲーム中ならなぞりポップを実行し、画面スクロールを防止する
            if (gameActive) {
                tryPopBubble(touch.clientX, touch.clientY);
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        }
    }, { passive: false });

    window.addEventListener('mousedown', (e) => {
        isDragging = true;
        initAudio(); // 繝ｦ繝ｼ繧ｶ繝ｼ謫堺ｽ懊逶ｴ荳九〒遒ｺ螳溘↓蛻晄悄蛹
        startAmbientSound(); // 閭梧勹繧｢繝ｳ繝薙お繝ｳ繝磯浹縺ｮ髢句ｧ
        handleInteraction(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    window.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    window.addEventListener('touchstart', (e) => {
        isDragging = true;
        initAudio(); // 繝ｦ繝ｼ繧ｶ繝ｼ謫堺ｽ懊逶ｴ荳九〒遒ｺ螳溘↓蛻晄悄蛹
        startAmbientSound(); // 閭梧勹繧｢繝ｳ繝薙お繝ｳ繝磯浹縺ｮ髢句ｧ
        if (e.touches.length > 0) {
            handleInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    window.addEventListener('touchcancel', () => {
        isDragging = false;
    });
}

function resizeShowerCanvas() {
    if (!showerCanvas) return;
    showerCanvas.width = window.innerWidth;
    showerCanvas.height = window.innerHeight;
    initStars(); // 画面リサイズ時に星屑を再配置
}

function createShowerParticles(x, y, count, hueBase, isSpecialEvent = false) {
    for (let i = 0; i < count; i++) {
        let particleHue;
        if (isSpecialEvent && (hueBase === null || hueBase === 'multi')) {
            // 指定された5色から選択（シルバーの割合を減らし、レッドとブルーを増量）
            const allowedHues = [210, 262, 262, 213, 213, 213, 148, 148, 349, 349, 349];
            particleHue = allowedHues[Math.floor(Math.random() * allowedHues.length)];
        } else {
            particleHue = (hueBase !== undefined && hueBase !== null)
                ? hueBase
                : (showerHue + 0.4) % 360;
            particleHue = (particleHue + (Math.random() - 0.5) * 16) % 360;
        }
        
        const speedScale = isSpecialEvent ? (1.5 + Math.random() * 4.5) : (0.5 + Math.random() * 1.2);
        const angle = Math.random() * Math.PI * 2;
        const vx = Math.cos(angle) * speedScale;
        const vy = Math.sin(angle) * speedScale - (isSpecialEvent ? 0.3 : 0.2);
        
        let pType = 'circle';
        if (isSpecialEvent) {
            const rand = Math.random();
            pType = rand < 0.45 ? 'circle' : (rand < 0.85 ? 'sparkle' : 'ring');
        }
        
        showerParticles.push({
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            size: Math.random() * (isSpecialEvent ? 6.5 : 4.2) + 2.8,
            maxLife: Math.random() * (isSpecialEvent ? 55 : 45) + (isSpecialEvent ? 35 : 20),
            life: 0,
            hue: particleHue,
            alpha: 0.95,
            type: pType,
            angle: Math.random() * Math.PI * 2,
            spin: isSpecialEvent ? (Math.random() - 0.5) * 0.12 : 0,
            gravity: isSpecialEvent ? 0.035 : 0.0,
            friction: isSpecialEvent ? 0.94 : 0.985
        });
    }
}

function createShowerRipple(x, y, maxR, speed, hue) {
    showerRipples.push({
        x: x,
        y: y,
        r: 0,
        maxR: maxR || (165 + Math.random() * 80),
        speed: speed || (2.2 + Math.random() * 1.2),
        alpha: 0.8,
        hue: (hue !== undefined && hue !== null) ? hue : 195
    });
}

function updateShower() {
    // コンボ中は背景を活発にする
    const now = performance.now();
    const activeCombo = (now - lastPopTime < COMBO_WINDOW) ? comboCount : 0;

    // 粒子（パーティクル）の更新
    for (let i = showerParticles.length - 1; i >= 0; i--) {
        const p = showerParticles[i];
        p.life++;
        
        // 物理演算（プロパティがある場合のみ適用、なければ通常時の減衰）
        const friction = p.friction !== undefined ? p.friction : 0.985;
        const gravity = p.gravity !== undefined ? p.gravity : 0.0;
        
        p.vx *= friction;
        p.vy *= friction;
        p.vy += gravity;
        
        // 大爆発時（重力あり）のみ風の揺らぎと回転を適用
        if (gravity > 0) {
            p.vx += Math.sin(p.life * 0.08) * 0.025; // 気流揺らぎ (Sway)
            if (p.angle !== undefined && p.spin !== undefined) {
                p.angle += p.spin;
            }
        }
        
        p.x += p.vx;
        p.y += p.vy;
        
        p.alpha = 0.95 * (1.0 - (p.life / p.maxLife));

        if (p.life >= p.maxLife) {
            showerParticles.splice(i, 1);
        }
    }

    // 波紋（リプル）の更新と消滅処理
    for (let i = showerRipples.length - 1; i >= 0; i--) {
        const r = showerRipples[i];
        r.r += r.speed;
        r.alpha = 0.8 * (1.0 - (r.r / r.maxR));
        if (r.r >= r.maxR || r.alpha <= 0) {
            showerRipples.splice(i, 1);
        }
    }

    // クリックなしの背景の自動波紋生成
    // アクティブなコンボ中やフィーバー中は発生確率を上げて背景を賑やかにする
    if (showerCanvas) {
        const baseChance = feverActive ? 0.020 : 0.008;
        const comboBonus = Math.min(activeCombo * 0.002, 0.010);
        const spawnChance = baseChance + comboBonus;

        if (Math.random() < spawnChance) {
            const rx = Math.random() * showerCanvas.width;
            const ry = Math.random() * showerCanvas.height;
            
            // 通常時は水色系統(185〜210)、フィーバー中はオーロラと調和するエメラルドグリーン(135〜155)
            const autoHue = feverActive 
                ? (135 + Math.random() * 20) 
                : (185 + Math.random() * 25);
            
            // 自動生成の波紋はタップ時よりやや控えめなサイズと速度に設定
            const autoMaxR = 90 + Math.random() * 70;
            const autoSpeed = 1.5 + Math.random() * 0.8;
            
            createShowerRipple(rx, ry, autoMaxR, autoSpeed, autoHue);
        }
    }
}


function getAuroraWave(x, globalT, width, height) {
    const yOffset = height * -0.15; // 少し上部に引き上げる
    const amplitude = 35; // 波幅をやや抑えてシャープな流れにする
    const frequency = 0.0010;

    const ampScale1 = 1.0 + 0.15 * Math.sin(globalT * 0.40);
    const ampScale2 = 1.0 + 0.20 * Math.cos(globalT * 0.25);
    const freqScale1 = 1.0 + 0.08 * Math.sin(globalT * 0.18);
    const domeHeight = 120 + Math.sin(globalT * 0.32) * 15;

    const windDrift = globalT * 1.8;
    const t1 = windDrift + globalT * 0.50;
    const t2 = windDrift + globalT * 0.20;

    // 右上（0.65付近）を一番高い輝きの中心にする
    const cx = (x - width * 0.65) / (width * 0.5);
    const z = 0.50 + 0.50 * Math.max(0, 1.0 - cx * cx * 1.2);

    const wave = Math.sin(x * frequency * freqScale1 - t1) * (amplitude * ampScale1)
               + Math.sin(x * frequency * 0.38 - t2) * (amplitude * 0.28 * ampScale2);

    // 画像の右上から左下へと流れるような傾き（傾斜）を加える
    const slope = (width - x) * 0.18;

    const yBase = yOffset + (1.0 - z) * domeHeight + wave * z + slope;
    const curtainHeight = (580 + Math.sin(x * 0.0018 - globalT * 0.6) * 50) * z;

    return { yBase, curtainHeight, z };
}

function initAuroraParticles() {
    auroraParticles = [];
    const colorChoices = [
        "200, 255, 235", // 明るいミントグリーン（発光感）
        "16, 220, 120",  // 鮮やかなエメラルドグリーン
        "10, 180, 130"   // 深みのあるミントブルー
    ];
    for (let i = 0; i < 320; i++) {
        const p = {
            xRatio: Math.random(),
            yRatio: Math.random(), // 0 = 底部 (発光部), 1 = 上部 (透明フェード)
            size: 6 + Math.random() * 18, // 6px〜24pxのより大きくて柔らかい粒子
            alpha: 0.03 + Math.random() * 0.09, // より透け感のある不透明度
            speedX: (Math.random() - 0.5) * 0.0006, // 非常にゆったりとした水平移動
            speedY: 0.001 + Math.random() * 0.002, // ゆっくりと上昇
            phase: Math.random() * Math.PI * 2,
            phaseSpeed: 0.008 + Math.random() * 0.015,
            colorBase: colorChoices[Math.floor(Math.random() * colorChoices.length)]
        };
        auroraParticles.push(p);
    }
}

function drawAuroraParticles(scale) {
    if (!auroraOffCtx || !showerCanvas) return;
    if (auroraParticles.length === 0) {
        initAuroraParticles();
    }

    const globalT = auroraTime * 0.60;

    auroraOffCtx.save();
    auroraOffCtx.globalCompositeOperation = 'screen';

    for (let p of auroraParticles) {
        // ドリフトと上昇更新
        p.xRatio += p.speedX;
        if (p.xRatio < 0) p.xRatio += 1;
        if (p.xRatio > 1) p.xRatio -= 1;

        p.yRatio += p.speedY;
        if (p.yRatio > 1) {
            p.yRatio = 0;
            p.xRatio = Math.random();
            p.size = 6 + Math.random() * 18;
            p.alpha = 0.03 + Math.random() * 0.09;
            const colorChoices = ["200, 255, 235", "16, 220, 120", "10, 180, 130"];
            p.colorBase = colorChoices[Math.floor(Math.random() * colorChoices.length)];
        }

        p.phase += p.phaseSpeed;

        const rx = p.xRatio * showerCanvas.width;
        const waveInfo = getAuroraWave(rx, globalT, showerCanvas.width, showerCanvas.height);

        // 粒子のY座標 (上に向かって透けながら上昇)
        const x = rx * scale;
        const y = (waveInfo.yBase + (1.0 - p.yRatio) * waveInfo.curtainHeight) * scale;

        // 全体をもっと透けたグラデーションにするためのフェード計算
        const fade = Math.pow(1.0 - p.yRatio, 2.0); // 2乗にして上部ほどより早く、かつ滑らかに透明に溶け込ませる
        const twinkle = 0.4 + 0.6 * Math.sin(p.phase);
        const finalAlpha = p.alpha * fade * twinkle * waveInfo.z * 0.9;

        if (finalAlpha <= 0) continue;

        auroraOffCtx.fillStyle = `rgba(${p.colorBase}, ${finalAlpha})`;
        auroraOffCtx.beginPath();
        const size = p.size * waveInfo.z * (0.4 + 0.6 * fade) * scale;
        auroraOffCtx.arc(x, y, size, 0, Math.PI * 2);
        auroraOffCtx.fill();
    }

    auroraOffCtx.restore();
}

function drawRealAuroraCurtain() {
    if (!showerCtx || !showerCanvas) return;
    auroraTime += 0.0055;

    const scale = 0.25 / 1.2; // ぼかし量を1.2倍にするため、解像度スケールを調整 (約0.2083)
    const offWidth = Math.ceil(showerCanvas.width * scale);
    const offHeight = Math.ceil(showerCanvas.height * scale);

    // ── オフスクリーンCanvasの初期化（初回のみ） ──
    if (!auroraOffscreen || auroraOffscreen.width !== offWidth || auroraOffscreen.height !== offHeight) {
        auroraOffscreen = document.createElement('canvas');
        auroraOffscreen.width  = offWidth;
        auroraOffscreen.height = offHeight;
        auroraOffCtx = auroraOffscreen.getContext('2d');
        auroraSkipCount = 0;
    }

    // ── 3フレームに1回だけ重い描画処理を実行（それ以外はキャッシュを貼るだけ） ──
    auroraSkipCount++;
    if (auroraSkipCount >= 3) {
        auroraSkipCount = 0;

        // オフスクリーンをクリア
        auroraOffCtx.clearRect(0, 0, offWidth, offHeight);
        auroraOffCtx.save();
        auroraOffCtx.globalCompositeOperation = 'source-over';
        auroraOffCtx.shadowBlur = 0;

        const step = 3; // 3px間隔（元の12px相当）
        const globalT = auroraTime * 0.60;
        const globalAlphaMod = 0.70 + Math.sin(globalT * 1.05) * 0.30;

        for (let ox = 0; ox < offWidth; ox += step) {
            const rx = ox / scale;
            const waveInfo = getAuroraWave(rx, globalT, showerCanvas.width, showerCanvas.height);
            const oyBase = waveInfo.yBase * scale;
            const ocurtainHeight = waveInfo.curtainHeight * scale;
            const oz = waveInfo.z;

            // 画像の右上のように、太く柔らかい光の柱（Rays）が縦に広がるような質感を作る（細かな縦筋にはならない）
            const rayVal = Math.sin(rx * 0.008 + globalT * 0.30) * Math.cos(rx * 0.003 - globalT * 0.12);
            const curtainRays = 0.70 + 0.30 * Math.abs(rayVal);
            const midAlpha = 0.028 * globalAlphaMod * curtainRays;

            const grad = auroraOffCtx.createLinearGradient(ox, oyBase, ox, oyBase + ocurtainHeight);
            const a = midAlpha * oz;

            // 画像の右上にある本物のオーロラのような、眩しいミントホワイトの発光コアを持つグラデーション
            grad.addColorStop(0.00, "rgba(  0,  20,  10, 0)"); // 最上部：透明
            grad.addColorStop(0.35, "rgba(  2,  80,  45, " + (a * 0.15) + ")"); // 上部フェード
            grad.addColorStop(0.68, "rgba(  5, 175,  95, " + (a * 1.10) + ")"); // エメラルドグリーン
            grad.addColorStop(0.82, "rgba( 16, 235, 130, " + (a * 2.00) + ")"); // マイルドなネオングリーン (眩しさ軽減)
            grad.addColorStop(0.85, "rgba(225, 255, 245, " + (a * 3.08) + ")"); // 眩しさを抑えたホワイトコア (1.1倍に調整)
            grad.addColorStop(0.88, "rgba( 16, 235, 130, " + (a * 1.80) + ")"); // 下部マイルドグリーン (眩しさ軽減)
            grad.addColorStop(0.94, "rgba(  2, 120,  65, " + (a * 0.50) + ")"); // 下部フェード
            grad.addColorStop(1.00, "rgba(  0,  20,  10, 0)"); // 最下部：透明

            auroraOffCtx.strokeStyle = grad;
            auroraOffCtx.lineWidth = (step / scale + 110.0) * oz * scale; // 非常に太い線幅もスケール
            auroraOffCtx.beginPath();
            auroraOffCtx.moveTo(ox, oyBase);
            auroraOffCtx.lineTo(ox, oyBase + ocurtainHeight);
            auroraOffCtx.stroke();
        }

        // ── 霧状のエメラルドグリーン粒子のカーテンの描画 ──
        drawAuroraParticles(scale);

        auroraOffCtx.restore();
    }

    // ── キャッシュ画像を本Canvasにscreenブレンドで貼り付け（ぼかしフィルタを廃止して拡大補間を利用） ──
    showerCtx.save();
    showerCtx.globalCompositeOperation = 'screen';
    showerCtx.drawImage(auroraOffscreen, 0, 0, showerCanvas.width, showerCanvas.height);
    showerCtx.restore();
}

function drawShower() {
    if (!showerCtx || !showerCanvas) return;
    
    // 繧ｳ繝ｳ繝應ｸｭ縺ｯ谿句ワ繧貞ｼｷ縺上＠縺ｦ闖ｯ繧°縺ｫ
    const now = performance.now();
    const activeCombo = (now - lastPopTime < COMBO_WINDOW) ? comboCount : 0;
    const clearAlpha = Math.max(0.06, 0.12 - activeCombo * 0.006);

    // 谿句ワ縺ｮ縺ゅｋ繧ｯ繝ｪ繧｢
    showerCtx.fillStyle = `rgba(6, 9, 19, ${clearAlpha})`;
    showerCtx.fillRect(0, 0, showerCanvas.width, showerCanvas.height);
    
    // 夜空のまたたく星屑を描画
    drawStars();
    
    // フィーバー中はリアルな緑のオーロラカーテンを描画
    if (feverActive) {
        drawRealAuroraCurtain();
    }
    
    showerCtx.save();
    showerCtx.globalCompositeOperation = 'screen';
    
    // 粒子の描画
    showerParticles.forEach(p => {
        // 通常の円形（type指定がない、または 'circle'）
        if (!p.type || p.type === 'circle') {
            const sprite = getParticleSprite(p.hue);
            const dSize = p.size * 3.6; // Core + Glow (1.8 * 2 = 3.6)
            showerCtx.globalAlpha = p.alpha;
            showerCtx.drawImage(sprite, p.x - dSize / 2, p.y - dSize / 2, dSize, dSize);
        } else {
            // 大爆発時の特殊形状（sparkle, ring）
            const lifeRatio = p.life / (p.maxLife || 50);
            const currentHue = (p.hue + lifeRatio * 15) % 360;
            const currentLightness = 72 + lifeRatio * 15;
            const color = `hsla(${currentHue}, 90%, ${currentLightness}%, ${p.alpha})`;
            const currentSize = Math.max(0.4, p.size * (1.0 - lifeRatio));
            
            showerCtx.fillStyle = color;
            showerCtx.strokeStyle = color;
            
            if (p.type === 'sparkle') {
                showerCtx.save();
                showerCtx.translate(p.x, p.y);
                if (p.angle !== undefined) {
                    showerCtx.rotate(p.angle);
                }
                
                // 4点星型パスを1回で描画
                showerCtx.beginPath();
                showerCtx.moveTo(0, -currentSize * 2.5);
                showerCtx.lineTo(currentSize * 0.35, 0);
                showerCtx.lineTo(currentSize * 2.5, 0);
                showerCtx.lineTo(0, currentSize * 0.35);
                showerCtx.lineTo(0, currentSize * 2.5);
                showerCtx.lineTo(-currentSize * 0.35, 0);
                showerCtx.lineTo(-currentSize * 2.5, 0);
                showerCtx.lineTo(0, -currentSize * 0.35);
                showerCtx.closePath();
                showerCtx.fill();

                // スパークルの擬似グロー（キャッシュ画像を使用）
                const glowSprite = getParticleSprite(currentHue);
                const gSize = currentSize * 6.0; // Glow size (3.0 * 2)
                showerCtx.globalAlpha = p.alpha * 0.25;
                showerCtx.drawImage(glowSprite, -gSize / 2, -gSize / 2, gSize, gSize);

                showerCtx.restore();
            } else if (p.type === 'ring') {
                showerCtx.globalAlpha = p.alpha;
                showerCtx.lineWidth = 1.0;
                showerCtx.beginPath();
                showerCtx.arc(p.x, p.y, currentSize * 1.3, 0, Math.PI * 2);
                showerCtx.stroke();
            }
        }
    });
    
    // グローバルアルファを元に戻す
    showerCtx.globalAlpha = 1.0;
    
    // 豕｢邏九謠冗判域ｳ｢邏九＃縺ｨ縺ｫ濶ｲ逶ｸ繧貞渚譏
    showerRipples.forEach(r => {
        const hue = r.hue || 195;
        const color = `hsla(${hue}, 70%, 75%, ${r.alpha * 0.55})`;
        showerCtx.strokeStyle = color;
        showerCtx.lineWidth = 3.2;
        
        showerCtx.beginPath();
        showerCtx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        showerCtx.stroke();

        // 擬似的なグロー効果として、外側に薄くて太い線を重ねる
        showerCtx.strokeStyle = `hsla(${hue}, 70%, 75%, ${r.alpha * 0.15})`;
        showerCtx.lineWidth = 6.4;
        showerCtx.beginPath();
        showerCtx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        showerCtx.stroke();
    });
    
    // 豬∵弌鄒､縺ｮ謠冗判医せ繧ｯ繝ｪ繝ｼ繝ｳ蜷域繝｢繝ｼ繝牙縺ｧ逋ｺ蜈牙柑譫懊ｒ豢ｻ縺加
    drawMeteors();
    
    showerCtx.restore();
    
    // 豕｡縺ｯ騾壼ｸｸ縺ｮ繧ｳ繝ｳ繝昴ず繝ヨ縺ｧ謠冗判育ｲ貞ｭ舌荳翫↓魄ｮ譏弱↓陦ｨ遉ｺ
    drawBubbles();
}


// =============================================================
// 2.5 荳牡縺ｮ豬∵弌鄒､繧ｷ繧ｹ繝Β
// =============================================================

// 豬∵弌鄒､繧偵ヨ繝ｪ繧ｬ繝ｼ縺吶ｋ
function triggerMeteorShower(originX, originY) {
    playMeteorSound(originX); // 髻ｳ貅舌ヱ繝ｳ險ｭ螳壹縺溘ａ縺ｫX蠎ｧ讓吶ｒ蠑輔″貂｡縺
    
    const count = 15; // 流れ星の総数
    const duration = 1000; // 1.0秒間かけて順次放出 (より集中して飛び散るように短縮)
    // 指定5色（シルバー: 210, 紫: 262, 青: 213, 緑: 148, 赤: 349）からシルバーを減らし、レッド・ブルーを増量した配色
    const colors = [210, 262, 262, 213, 213, 213, 148, 148, 349, 349, 349];
    
    // 逋ｺ逕滓ｺ舌′貂｡縺輔ｌ縺ｪ縺九▲縺溷ｴ蜷医繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ育判髱｢荳ｭ螟ｮ
    const x = (originX !== undefined) ? originX : (showerCanvas ? showerCanvas.width / 2 : 0);
    const y = (originY !== undefined) ? originY : (showerCanvas ? showerCanvas.height / 2 : 0);
    
    for (let i = 0; i < count; i++) {
        const delayTime = (i / count) * duration + Math.random() * 50;
        setTimeout(() => {
            if (!gameActive) return;
            createMeteor(colors[i % colors.length], x, y);
        }, delayTime);
    }
}

// 豬∵弌繧1譛ｬ菴懈縺吶ｋ
function createMeteor(hue, originX, originY) {
    if (!showerCanvas) return;
    
    // 蜈ｨ譁ｹ菴搾ｼ0縲360蠎ｦ峨↓繝ｩ繝ｳ繝€繝縺ｪ隗貞ｺｦ
    const angle = Math.random() * Math.PI * 2;
    const speed = 14 + Math.random() * 12; // 14縲26px/繝輔Ξ繝ｼ繝
    
    // 貎ｰ縺励◆豕｡縺ｮ霑代￥医ｏ縺壹°縺ｫ繝ｩ繝ｳ繝€繝縺ｧ謨｣繧峨☆峨°繧牙ｰ
    const startX = originX + (Math.random() - 0.5) * 20;
    const startY = originY + (Math.random() - 0.5) * 20;
    
    meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed: speed,
        angle: angle,
        length: 100 + Math.random() * 100, // 鬟帙謨｣繧九◆繧∝ｰ代＠遏ｭ繧√蟆ｾ100縲200px峨↓縺励※邯ｺ鮗励↓
        width: 1.5 + Math.random() * 2.0,
        hue: hue,
        alpha: 0,
        fadeSpeed: 0.12, // 縺吶＄霑代￥縺ｧ逋ｺ逕溘☆繧九◆繧∝ｰ代＠譌ｩ繧√↓繝輔ぉ繝ｼ繝峨う繝ｳ
        targetAlpha: 0.85 + Math.random() * 0.15,
        sparkleChance: 0.5 // 繧ｹ繝代繧ｯ繝ｫ邇ｒ繧ｄ鬮倥￥縺励※闖ｯ繧°縺ｫ
    });
}

// 豬∵弌縺ｮ螟ｧ辷匱繧偵ヨ繝ｪ繧ｬ繝ｼ縺吶ｋ
function triggerMeteorBigExplosion(originX, originY) {
    triggerHaptic('explosion');
    // 最初の爆発音
    playMeteorBigExplosionSound(originX);
    // 炭酸バブルサウンドの再生
    playCarbonatedBubbleSound(originX);
    
    const x = (originX !== undefined) ? originX : (showerCanvas ? showerCanvas.width / 2 : 0);
    const y = (originY !== undefined) ? originY : (showerCanvas ? showerCanvas.height / 2 : 0);
    
    // 1. メインの巨大大輪花火 (レッドとブルーを主体にし、シルバーを削減)
    createShowerParticles(x, y, 20, 210, true); // シルバー (40 -> 20に減量)
    createShowerParticles(x, y, 50, 349, true); // レッド (30 -> 50に大幅増量)
    createShowerRipple(x, y, 270, 3.2, 349); // 特大波紋をシルバーからレッド(349)に変更
    launchExplosionMeteors(x, y, 50, 60); // 50本の流星
    
    // 2. クライマックスの多重連鎖爆発 (時間差で色彩豊かな大輪が重なり合う)
    
    // 子爆発1: 0.12秒後 (左上にずれた青・紫の花火)
    setTimeout(() => {
        const cx = x - 130 + (Math.random() - 0.5) * 60;
        const cy = y - 90 + (Math.random() - 0.5) * 60;
        playFeverStartSound(cx); // チャイムスイープ音
        createShowerParticles(cx, cy, 20, 262, true); // 紫 (25 -> 20に減量)
        createShowerParticles(cx, cy, 35, 213, true); // 青 (20 -> 35に増量)
        createShowerRipple(cx, cy, 180, 3.8, 213); // 波紋を青(213)に変更
        launchExplosionMeteors(cx, cy, 25, 45);
    }, 120);
    
    // 子爆発2: 0.26秒後 (右上にずれた青・緑の花火)
    setTimeout(() => {
        const cx = x + 140 + (Math.random() - 0.5) * 60;
        const cy = y - 80 + (Math.random() - 0.5) * 60;
        playFeverStartSound(cx);
        createShowerParticles(cx, cy, 20, 148, true); // 緑 (25 -> 20に減量)
        createShowerParticles(cx, cy, 35, 213, true); // 青 (20 -> 35に増量)
        createShowerRipple(cx, cy, 180, 3.8, 213); // 波紋を青(213)に変更
        launchExplosionMeteors(cx, cy, 25, 45);
    }, 260);
    
    // 子爆発3: 0.40秒後 (少し下にずれた赤・紫の花火)
    setTimeout(() => {
        const cx = x - 40 + (Math.random() - 0.5) * 60;
        const cy = y + 100 + (Math.random() - 0.5) * 50;
        playFeverStartSound(cx);
        createShowerParticles(cx, cy, 35, 349, true); // 赤 (25 -> 35に増量)
        createShowerParticles(cx, cy, 20, 262, true); // 紫 (20枚維持)
        createShowerRipple(cx, cy, 190, 4.0, 349); // 波紋は赤(349)
        launchExplosionMeteors(cx, cy, 25, 45);
    }, 400);
    
    // 子爆発4: 0.52秒後 (右下にずれた青・シルバーの花火)
    setTimeout(() => {
        const cx = x + 110 + (Math.random() - 0.5) * 60;
        const cy = y + 80 + (Math.random() - 0.5) * 50;
        playFeverStartSound(cx);
        createShowerParticles(cx, cy, 10, 210, true); // シルバー (25 -> 10に大幅減量)
        createShowerParticles(cx, cy, 20, 213, true); // 青 (20本追加)
        createShowerParticles(cx, cy, 15, 148, true); // 緑 (20 -> 15に減量)
        createShowerRipple(cx, cy, 160, 4.0, 213); // 波紋を青(213)に変更
        launchExplosionMeteors(cx, cy, 20, 40);
    }, 520);
    
    // 最終フィナーレ特大花火: 0.68秒後 (中央上空のマルチカラー錦冠花火 ＋ 再度の大爆発音！)
    setTimeout(() => {
        const cx = x + (Math.random() - 0.5) * 40;
        const cy = y - 120 + (Math.random() - 0.5) * 40;
        playMeteorBigExplosionSound(cx); // 2回目の大爆発音でクライマックスの轟音を再現！
        createShowerParticles(cx, cy, 100, 'multi', true); // 豪華マルチカラー星屑 (重み付け適用で赤・青増量)
        createShowerRipple(cx, cy, 310, 4.5, 213); // 特大の波紋をシルバーからブルー(213)に変更してシルバーの支配度を低下
        createShowerRipple(cx, cy, 225, 5.2, 262); // 中サイズ波紋: 紫
        createShowerRipple(cx, cy, 170, 6.0, 210); // 小サイズ波紋をシルバー(210)に設定
        launchExplosionMeteors(cx, cy, 50, 70); // 最後の錦冠の火花
    }, 680);
}

// 爆発点から流星群を放出するヘルパー関数
function launchExplosionMeteors(cx, cy, count, duration) {
    // 指定5色（シルバー: 210, 紫: 262, 青: 213, 緑: 148, 赤: 349）からシルバーを減らし、レッド・ブルーを増量した配色
    const colors = [210, 262, 262, 213, 213, 213, 148, 148, 349, 349, 349];
    for (let i = 0; i < count; i++) {
        const delayTime = (i / count) * duration + Math.random() * 4;
        setTimeout(() => {
            createBigExplosionMeteor(colors[i % colors.length], cx, cy);
        }, delayTime);
    }
}

function createBigExplosionMeteor(hue, originX, originY) {
    if (!showerCanvas) return;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 25; // 25縲50px/繝輔Ξ繝ｼ繝 (荳€迸ｬ縺ｧ讌ｵ髯舌∪縺ｧ諡｡謨｣縺輔○繧)
    
    const startX = originX + (Math.random() - 0.5) * 15;
    const startY = originY + (Math.random() - 0.5) * 15;
    
    meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed: speed,
        angle: angle,
        length: 70 + Math.random() * 80, // 荳€迸ｬ縺ｮ髢縺ｮ縺溘ａ縲√＆繧峨↓蠑輔″邱縺ｾ縺｣縺溽洒縺ｰｾ (70縲150px)
        width: 2.0 + Math.random() * 2.5, // 蟆代＠螟ｪ繧√〒蜉帛ｼｷ縺ｻ瑚ｷ｡
        hue: hue,
        alpha: 0,
        fadeSpeed: 0.45, // 1縲2繝輔Ξ繝ｼ繝縺ｧ荳€迸ｬ縺ｫ縺励※譛€鬮倩ｼ晏ｺｦ縺ｫ遶九■荳翫￡繧
        targetAlpha: 0.9 + Math.random() * 0.1,
        sparkleChance: 0.8, // 繧ｹ繝代う繧ｯ医″繧峨ａ縺搾ｼ臥匱逕溽｢ｺ邇ｒ螟ｧ蟷↓蠑輔″荳翫￡
        life: 0,
        maxLife: 8 + Math.random() * 8 // 8縲16繝輔Ξ繝ｼ繝 (邏0.13縲0.26遘) 縺ｮ讌ｵ髯舌遏ｭ蟇ｿ蜻ｽ
    });
}

// 豬∵弌縺ｮ迚ｩ逅嫌蜍墓峩譁ｰ
function updateMeteors() {
    // 既存 of 流星はゲーム終了後も画面外に消えるまで更新を続ける
    
    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        
        m.x += m.vx;
        m.y += m.vy;
        
        // 蟇ｿ蜻ｽ譖ｴ譁ｰ縺ｨ繝輔ぉ繝ｼ繝峨い繧ｦ繝亥愛螳 (螟ｧ辷匱縺ｮ蟇ｿ蜻ｽ莉倥″豬∵弌縺ｫ蟇ｾ蠢)
        if (m.maxLife !== undefined) {
            m.life++;
            // 蟇ｿ蜻ｽ縺ｮ蠕悟濠60%繧定ｶ∴縺溘ｉ峨蠕舌€↓騾乗縺ｫ縺励※邯ｺ鮗励↓繝輔ぉ繝ｼ繝峨い繧ｦ繝域ｶ域ｻ＆縺帙ｋ
            if (m.life > m.maxLife * 0.6) {
                m.alpha = m.targetAlpha * (1 - (m.life - m.maxLife * 0.6) / (m.maxLife * 0.4));
            } else if (m.alpha < m.targetAlpha) {
                m.alpha = Math.min(m.targetAlpha, m.alpha + m.fadeSpeed);
            }
            
            // 蟇ｿ蜻ｽ縺悟ｰｽ縺阪◆繧画ｶ亥悉
            if (m.life >= m.maxLife) {
                meteors.splice(i, 1);
                continue;
            }
        } else {
            // 騾壼ｸｸ縺ｮ豬∵弌医ヵ繧ｧ繝ｼ繝峨う繝ｳ縺ｮ縺ｿ縲∫判髱｢螟悶〒豸亥悉
            if (m.alpha < m.targetAlpha) {
                m.alpha = Math.min(m.targetAlpha, m.alpha + m.fadeSpeed);
            }
        }
        
        // 霆碁％荳翫↓縺阪ｉ繧√″邊貞ｭ舌ｒ逋ｺ逕
        if (Math.random() < m.sparkleChance) {
            createShowerParticles(
                m.x - m.vx * 0.2,
                m.y - m.vy * 0.2,
                1,
                m.hue
            );
        }
        
        // 蜈ｨ譁ｹ蜷代逕ｻ髱｢螟門愛螳 (荳贋ｸ句ｷｦ蜿ｳ縺★繧後°縺ｫ螳悟縺ｫ螟悶ｌ縺溘ｉ蜑企勁)
        if (showerCanvas && (
            m.x < -m.length || 
            m.x > showerCanvas.width + m.length || 
            m.y < -m.length || 
            m.y > showerCanvas.height + m.length
        )) {
            meteors.splice(i, 1);
        }
    }
}

// 豬∵弌縺ｮ謠冗判
function drawMeteors() {
    if (!showerCtx || meteors.length === 0) return;
    
    meteors.forEach(m => {
        const tailX = m.x - m.vx * (m.length / m.speed);
        const tailY = m.y - m.vy * (m.length / m.speed);
        
        const grad = showerCtx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
        grad.addColorStop(0.2, `hsla(${m.hue}, 95%, 82%, ${m.alpha})`);
        grad.addColorStop(0.5, `hsla(${m.hue}, 90%, 65%, ${m.alpha * 0.6})`);
        grad.addColorStop(1, `hsla(${m.hue}, 90%, 50%, 0)`);
        
        // 擬似的なグロー効果として、先に少し太い半透明の線を引く
        const glowGrad = showerCtx.createLinearGradient(m.x, m.y, tailX, tailY);
        glowGrad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha * 0.3})`);
        glowGrad.addColorStop(0.2, `hsla(${m.hue}, 95%, 82%, ${m.alpha * 0.3})`);
        glowGrad.addColorStop(0.5, `hsla(${m.hue}, 90%, 65%, ${m.alpha * 0.18})`);
        glowGrad.addColorStop(1, `hsla(${m.hue}, 90%, 50%, 0)`);
        
        showerCtx.save();
        showerCtx.lineCap = 'round';
        
        // グロー線
        showerCtx.strokeStyle = glowGrad;
        showerCtx.lineWidth = m.width * 2.5;
        showerCtx.beginPath();
        showerCtx.moveTo(m.x, m.y);
        showerCtx.lineTo(tailX, tailY);
        showerCtx.stroke();
        
        // 実線
        showerCtx.strokeStyle = grad;
        showerCtx.lineWidth = m.width;
        showerCtx.beginPath();
        showerCtx.moveTo(m.x, m.y);
        showerCtx.lineTo(tailX, tailY);
        showerCtx.stroke();
        
        showerCtx.restore();
    });
}

// =============================================================
// 3. 蜈峨豕｡繧ｷ繧ｹ繝Β
// =============================================================

// 譁ｰ縺励＞豕｡繧剃ｸ€縺､逕滓縺吶ｋ
function createBubble() {
    const limit = feverActive ? 60 : MAX_BUBBLES;
    if (!showerCanvas || bubbles.length >= limit) return;
    
    const colorInfo = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
    let radius = 22 + Math.random() * 22; // 22〜44px
    
    let type = 'normal';
    // フィーバー中でなければ、低確率で銀色の泡が発生。フィーバー中は25%の確率で連鎖バブルが発生
    if (!feverActive) {
        if (Math.random() < 0.03) { // 3%の確率
            type = 'silver';
            radius *= 1.25; // 銀色の泡は少し大きく
        }
    } else {
        // 画面上にすでに連鎖バブルが存在するかチェック（破裂中や予約中のものも含め、画面上に1つだけに制限する）
        const hasChain = bubbles.some(b => b.type === 'chain');
        if (!hasChain && Math.random() < 0.35) { // 35%の確率で連鎖バブルが発生
            type = 'chain';
            radius *= 1.15; // 連鎖バブルは少し大きく
        }
    }
    
    bubbles.push({
        type: type,
        x: radius + Math.random() * (showerCanvas.width - radius * 2),
        y: showerCanvas.height + radius + Math.random() * 40,
        radius: radius,
        color: type === 'silver' ? '#e2e8f0' : (type === 'chain' ? '#e8d5db' : colorInfo.hex),
        hue: type === 'silver' ? 210 : (type === 'chain' ? 345 : colorInfo.hue),
        vy: type === 'silver' ? -(0.25 + Math.random() * 0.35) : -(0.3 + Math.random() * 0.5),
        swayAmplitude: 0.3 + Math.random() * 0.5,
        swaySpeed: 0.008 + Math.random() * 0.02,
        swayOffset: Math.random() * Math.PI * 2,
        alpha: type === 'silver' ? 0.9 : (type === 'chain' ? 0.85 : 0.65 + Math.random() * 0.2),
        pushX: 0,
        pushY: 0,
        wobble: 0,
        wobbleTime: Math.random() * Math.PI * 2, // 振動位相をバラつかせる
        popScaleX: 1,
        popScaleY: 1,
        time: 0,
        popping: false,
        reserved: false, // ドミノ連鎖予約フラグ
        popFrame: 0,
        popMaxFrames: 18,
        popScale: 1,
        popTriggered: false
    });
}

function updateBubbles(timestamp) {
    // 新しい泡のスポーン（ゲームが進行中のみ）
    if (gameActive) {
        // フィーバー終了チェック
        if (feverActive && performance.now() > feverEndTime) {
            feverActive = false;
        }
        
        const limit = feverActive ? 60 : MAX_BUBBLES;
        // オーロラ（フィーバータイム）が出ている間は球の発生率を4倍にする（間隔を1/4に）
        const spawnMin = feverActive ? Math.floor(BUBBLE_SPAWN_MIN / 4) : BUBBLE_SPAWN_MIN;
        const spawnMax = feverActive ? Math.floor(BUBBLE_SPAWN_MAX / 4) : BUBBLE_SPAWN_MAX;
        
        if (timestamp >= nextSpawnTime && bubbles.length < limit) {
            createBubble();
            nextSpawnTime = timestamp + spawnMin + Math.random() * (spawnMax - spawnMin);
        }
    }
    
    // 各泡の更新
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        
        if (b.popping) {
            // ポップアニメーション
            b.popFrame++;
            const progress = b.popFrame / b.popMaxFrames;
            
            // アスペクト比を弾性イージングで変形させる「ぷにゅん」破裂
            if (progress < 0.3) {
                // タップ直後の30%の時間で、一瞬「横に潰れて膨らむ」（ぷにゅっ）
                const factor = Math.sin((progress / 0.3) * Math.PI);
                b.popScaleX = 1 + factor * 0.35;
                b.popScaleY = 1 - factor * 0.22;
            } else {
                // 後半の70%の時間で、「縦にビヨーンと伸びながら消滅する」
                const t = (progress - 0.3) / 0.7;
                b.popScaleX = 1.35 * (1 - t);
                b.popScaleY = 1.48 * (1 - t);
            }
            
            b.popScale = b.popScaleX; // 後方互換性維持
            
            // ピーク時に波紋と粒子を発生
            if (!b.popTriggered && progress >= 0.3) {
                b.popTriggered = true;
                
                const rippleSize = 115 + Math.min(comboCount, 12) * 24;
                const particleCount = 10 + Math.min(comboCount, 12) * 4;
                const rippleSpeed = 2.8 + Math.min(comboCount, 12) * 0.3;
                
                createShowerRipple(b.x, b.y, rippleSize, rippleSpeed, b.hue);
                createShowerParticles(b.x, b.y, particleCount, b.hue, false);
            }
            
            // アニメーション完了で削除
            if (b.popFrame >= b.popMaxFrames) {
                bubbles.splice(i, 1);
                continue;
            }
        } else {
            // 通常の浮遊更新
            b.time++;
            const speedMultiplier = feverActive ? 1.8 : 1.0;
            
            // 元のゆらゆら移動成分
            const baseDy = b.vy * speedMultiplier;
            const baseDx = Math.sin(b.time * b.swaySpeed * speedMultiplier + b.swayOffset) * b.swayAmplitude * speedMultiplier;
            
            b.y += baseDy;
            b.x += baseDx;
            
            // 画面端で折り返し（元の端での固定処理に復元）
            if (b.x - b.radius < 0) {
                b.x = b.radius;
            }
            if (showerCanvas && b.x + b.radius > showerCanvas.width) {
                b.x = showerCanvas.width - b.radius;
            }
            
            // 画面の上に抜けたら削除
            if (b.y + b.radius < -30) {
                bubbles.splice(i, 1);
            }
        }
    }
}

function drawBubbles() {
    if (!showerCtx) return;
    
    bubbles.forEach(b => {
        const drawRadius = b.radius;
        if (drawRadius <= 0.5) return;
        
        let scaleX = 1;
        let scaleY = 1;
        
        // ポップ時のみアスペクト比スケールをかける（浮遊時は完全な円）
        if (b.popping) {
            scaleX = b.popScaleX || 1;
            scaleY = b.popScaleY || 1;
        }

        showerCtx.save();
        
        // 座標系をバブルの中心に移動させ、アスペクト比スケールをかける
        showerCtx.translate(b.x, b.y);
        showerCtx.scale(scaleX, scaleY);
        
        // ポップ中はフェードアウト
        const alphaMultiplier = b.popping ? Math.max(0, 1 - (b.popFrame / b.popMaxFrames)) : 1;
        showerCtx.globalAlpha = b.alpha * alphaMultiplier;
        
        if (b.type === 'silver' || b.type === 'normal') {
            const template = getBubbleTemplate(b.type, b.hue, b.color);
            const size = 128 * (drawRadius / 30);
            showerCtx.drawImage(template, -size / 2, -size / 2, size, size);
        } else if (b.type === 'chain') {
            // 連鎖バブルの外光（ネオンオーラ）
            const glowGrad = showerCtx.createRadialGradient(
                0, 0, drawRadius * 0.4,
                0, 0, drawRadius * 2.2
            );
            glowGrad.addColorStop(0, 'rgba(226, 232, 240, 0.3)');
            glowGrad.addColorStop(0.5, 'rgba(226, 232, 240, 0.08)');
            glowGrad.addColorStop(1, 'rgba(226, 232, 240, 0)');
            showerCtx.fillStyle = glowGrad;
            showerCtx.beginPath();
            showerCtx.arc(0, 0, drawRadius * 2.2, 0, Math.PI * 2);
            showerCtx.fill();
            
            // メインの球体（シルバーのグラデーション）
            const bodyGrad = showerCtx.createRadialGradient(
                -drawRadius * 0.2, -drawRadius * 0.2, drawRadius * 0.05,
                0, 0, drawRadius
            );
            bodyGrad.addColorStop(0, '#ffffff'); // 発光する中心
            bodyGrad.addColorStop(0.3, 'rgba(248, 250, 252, 0.95)');
            bodyGrad.addColorStop(0.75, 'rgba(226, 232, 240, 0.55)');
            bodyGrad.addColorStop(1, 'rgba(148, 163, 184, 0.18)');
            showerCtx.fillStyle = bodyGrad;
            showerCtx.beginPath();
            showerCtx.arc(0, 0, drawRadius, 0, Math.PI * 2);
            showerCtx.fill();
            
            // 輪郭リング
            showerCtx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
            showerCtx.lineWidth = 1.8;
            showerCtx.beginPath();
            showerCtx.arc(0, 0, drawRadius - 0.5, 0, Math.PI * 2);
            showerCtx.stroke();
            
            // パルス発光コア
            const pulse = 1.0 + 0.18 * Math.sin(b.time * 0.15);
            const coreR = Math.max(2, drawRadius * 0.25 * pulse);
            const coreGrad = showerCtx.createRadialGradient(
                0, 0, 0,
                0, 0, coreR
            );
            coreGrad.addColorStop(0, '#ffffff');
            coreGrad.addColorStop(0.5, 'rgba(226, 232, 240, 0.95)');
            coreGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
            showerCtx.fillStyle = coreGrad;
            showerCtx.beginPath();
            showerCtx.arc(0, 0, coreR, 0, Math.PI * 2);
            showerCtx.fill();
            
            // 二重回転リング（時計回りと反時計回り）
            showerCtx.save();
            
            // リング1 (時計回り)
            showerCtx.save();
            showerCtx.rotate(b.time * 0.025);
            showerCtx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
            showerCtx.lineWidth = 1.5;
            showerCtx.setLineDash([4, 6]);
            showerCtx.beginPath();
            showerCtx.arc(0, 0, drawRadius * 1.18, 0, Math.PI * 2);
            showerCtx.stroke();
            showerCtx.restore();
            
            // リング2 (反時計回り)
            showerCtx.save();
            showerCtx.rotate(-b.time * 0.018);
            showerCtx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
            showerCtx.lineWidth = 1.0;
            showerCtx.setLineDash([5, 8]);
            showerCtx.beginPath();
            showerCtx.arc(0, 0, drawRadius * 1.28, 0, Math.PI * 2);
            showerCtx.stroke();
            showerCtx.restore();
            
            showerCtx.restore(); // 元の座標系に戻す
            
            // ハイライト
            const hlX = -drawRadius * 0.3;
            const hlY = -drawRadius * 0.3;
            const hlR = drawRadius * 0.22;
            const hlGrad = showerCtx.createRadialGradient(hlX, hlY, 0, hlX, hlY, hlR);
            hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
            hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            showerCtx.fillStyle = hlGrad;
            showerCtx.beginPath();
            showerCtx.arc(hlX, hlY, hlR, 0, Math.PI * 2);
            showerCtx.fill();
        }
        
        showerCtx.restore();
    });
}

// =============================================================
// 3.5 蜉ｹ譫憺浹繧ｷ繧ｹ繝Β (Web Audio API)
// =============================================================

// AudioContext縺ｮ蛻晄悄蛹厄ｼ医Θ繝ｼ繧ｶ繝ｼ謫堺ｽ懈凾縺ｫ驕ｻｶ螳溯｡鯉ｼ
function initAudio() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx && AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
        
        if (audioCtx) {
            // 縺吶〒縺ｫ繧ｳ繝ｳ繝く繧ｹ繝医′縺ゅｋ蝣ｴ蜷医〒繧ゅ€《uspended縺ｧ縺ゅｌ縺ｰ譏守､ｺ逧↓蜀埼幕繧定ｩｦ縺ｿ繧具ｼ育音縺ｫSafari繧ヰ繝け繧ｰ繝ｩ繧ｦ繝ｳ繝牙ｾｩ蟶ｰ蟇ｾ遲厄ｼ
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch((err) => {
                    console.warn("AudioContext縺ｮ蜀埼幕縺ｫ螟ｱ謨励＠縺ｾ縺励◆:", err);
                });
            }
            
            // 繝ｭ繝け隗｣髯､縺ｮ縺溘ａ縺ｮ繝€繝溘辟｡髻ｳ蜀咲函域ｯ主屓縺ｮ繧､繝ｳ繧ｿ繝ｩ繧ｯ繧ｷ繝ｧ繝ｳ縺ｧ螳溯｡後＠縺ｦ繝ｭ繝け隗｣髯､繧堤｢ｺ螳溘↓縺吶ｋ縲∽ｾ句､悶せ繝ｭ繝ｼ蟇ｾ遲悶→縺励※菫晁ｭｷ
            try {
                const buffer = audioCtx.createBuffer(1, 1, 22050);
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtx.destination);
                source.start(0);
            } catch (err) {
                console.warn("繝€繝溘髻ｳ貅舌蜀咲函縺ｫ螟ｱ謨励＠縺ｾ縺励◆:", err);
            }
            pregenerateCarbonatedBuffer();
        }
    } catch (e) {
        console.warn("Web Audio API縺ｮ蛻晄悄蛹悶↓螟ｱ謨励＠縺ｾ縺励◆縲ら┌髻ｳ縺ｧ螳溯｡後＠縺ｾ縺:", e);
    }
}

function initApp() {
    // 初回起動時はゲームを開始せずスタート画面を表示する
    initShower();
    initParticleSprites();
    initBubbleTemplates();
    
    // 『スタート選択』画面: 通常Playボタン
    const btnPlayNormal = document.getElementById('btn-play-normal');
    if (btnPlayNormal) {
        const startNormal = () => {
            initAudio();
            infiniteMode = false;
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) startOverlay.classList.remove('active');
            startGame();
        };
        btnPlayNormal.addEventListener('click', startNormal);
        btnPlayNormal.addEventListener('touchend', (e) => {
            e.preventDefault();
            startNormal();
        }, { passive: false });
    }

    // 『スタート選択』画面: Endless Playボタン
    const btnPlayInfinite = document.getElementById('btn-play-infinite');
    if (btnPlayInfinite) {
        const startInfinite = () => {
            initAudio();
            infiniteMode = true;
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) startOverlay.classList.remove('active');
            startGame();
        };
        btnPlayInfinite.addEventListener('click', startInfinite);
        btnPlayInfinite.addEventListener('touchend', (e) => {
            e.preventDefault();
            startInfinite();
        }, { passive: false });
    }

    // 再スタートボタン (リフレッシュ完了画面から)
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
        btnRestart.addEventListener('click', () => {
            initAudio();
            // リスタート時はスタート画面に戻る
            const overlay = document.getElementById('gameover-overlay');
            if (overlay) overlay.classList.remove('active');
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) startOverlay.classList.add('active');
        });
        btnRestart.addEventListener('touchend', (e) => {
            e.preventDefault();
            initAudio();
            const overlay = document.getElementById('gameover-overlay');
            if (overlay) overlay.classList.remove('active');
            const startOverlay = document.getElementById('start-overlay');
            if (startOverlay) startOverlay.classList.add('active');
        }, { passive: false });
    }
    
    // ゲーム終了ボタン (無限モードでも強制終了できるように引数 true を渡す)
    const btnQuit = document.getElementById('btn-quit-active');
    if (btnQuit) {
        btnQuit.addEventListener('click', () => endGame(true));
        btnQuit.addEventListener('touchend', (e) => {
            e.preventDefault();
            endGame(true);
        }, { passive: false });
    }
    
    // アニメーションループ開始（ゲーム待機中も背景アニメは動かす）
    requestAnimationFrame(mainLoop);
}

function endGame(forceQuit = false) {
    // 無限モードかつ強制終了でない場合はオーバーレイを出さずに自動再スタート
    if (infiniteMode && !forceQuit) {
        startGame();
        return;
    }

    gameActive = false;
    
    // クリア効果音の再生
    playClearSound();
    triggerHaptic('success');
    
    // アンビエント音を即座に停止（フェードアウトではなく即時消音）
    stopAmbientSound(true);
    
    // リフレッシュ完了画面を表示
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

// 豕｡縺悟ｼｾ縺代ｋ縲後ヴ繝√Ι繝ｳ縲埼浹繧貞粋謌舌＠縺ｦ蜀咲函医ョ繧｣繝ｬ繧､上お繧ｳ繝ｼ莉倥″  繝励メ繝→縺≧遐ｴ陬る浹繝ｬ繧､繝､繝ｼ
function playPopSound(combo = 1, originX) {
    initAudio();
    if (!audioCtx) return;
    
    // ブラウザの自動再生ブロック対策
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playPopSound(combo, originX);
        }).catch(() => {});
        return;
    }
    
    try {
        const now = audioCtx.currentTime;
        
        // 1. メインの「ピチョン」水滴音用のオシレーター
        const osc = audioCtx.createOscillator();
        const mainGain = audioCtx.createGain();
        
        // 2. 指先の物理的な質感「プチッ」を出すための超短音オシレーター
        const clickOsc = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        
        // ディレイ（エコー）回路の追加
        const delay = audioCtx.createDelay();
        const feedback = audioCtx.createGain();
        
        osc.connect(mainGain);
        mainGain.connect(audioCtx.destination);
        mainGain.connect(delay);
        
        clickOsc.connect(clickGain);
        clickGain.connect(audioCtx.destination);
        
        delay.delayTime.setValueAtTime(0.15, now);
        feedback.gain.setValueAtTime(0.20, now);
        
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(audioCtx.destination);
        
        // --- 音色・パラメータ設定 ---
        osc.type = 'sine';
        // 美しいCマイナー・ペンタトニック・スケール
        const popScale = [261.63, 311.13, 349.23, 392.00, 466.16]; // C4, Eb4, F4, G4, Bb4
        
        // 画面幅に対してX座標がどの位置にあるかで音程（インデックス）を決める
        const xRatio = (originX !== undefined && showerCanvas) 
            ? Math.max(0, Math.min(0.99, originX / showerCanvas.width)) 
            : 0.5;
        const scaleIndex = Math.floor(xRatio * popScale.length);
        let baseFreq = popScale[scaleIndex];
        
        // コンボ数が上がると、オクターブが上昇する（4コンボごとに1オクターブ、最大2オクターブまでシフト）
        const octaveShift = Math.floor((combo - 1) / 4);
        baseFreq = baseFreq * Math.pow(2, Math.min(2, octaveShift));
        
        const targetFreq = baseFreq * 2.2;
        const duration = 0.08 + Math.min(combo - 1, 5) * 0.006;
        
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, now + duration * 0.85);
        
        mainGain.gain.setValueAtTime(0, now);
        mainGain.gain.linearRampToValueAtTime(0.3, now + 0.003); // 3msアタック
        mainGain.gain.exponentialRampToValueAtTime(0.0001, now + duration); // スムーズに消音
        
        // B. 物理的な「プチッ」音
        clickOsc.type = 'sine';
        const clickFreq = 1800 + Math.min(combo - 1, 8) * 120;
        clickOsc.frequency.setValueAtTime(clickFreq, now);
        
        clickGain.gain.setValueAtTime(0, now);
        clickGain.gain.linearRampToValueAtTime(0.12, now + 0.001);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        
        osc.start(now);
        osc.stop(now + duration + 0.05);
        
        clickOsc.start(now);
        clickOsc.stop(now + 0.03);
        
        setTimeout(() => {
            try {
                osc.disconnect();
                mainGain.disconnect();
                clickOsc.disconnect();
                clickGain.disconnect();
                delay.disconnect();
                feedback.disconnect();
            } catch (e) {}
        }, 1200);
        
    } catch (e) {
        console.warn("効果音再生エラー:", e);
    }
}


// フィーバー突入・花火連打時のチャイムスイープ音
function playFeverStartSound(originX) {
    initAudio();
    if (!audioCtx) return;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playFeverStartSound(originX);
        }).catch(() => {});
        return;
    }
    
    try {
        const now = audioCtx.currentTime;
        const xRatio = (originX !== undefined && showerCanvas) 
            ? Math.max(0, Math.min(0.99, originX / showerCanvas.width)) 
            : 0.5;
        const basePan = xRatio * 2 - 1;
        
        // 神秘的なウインドチャイム・ペンタトニックスケール (より高域で広く澄んだ音階)
        const chimeScale = [523.25, 659.25, 783.99, 987.77, 1046.50, 1318.51, 1567.98, 1975.53]; // C5, E5, G5, B5, C6, E6, G6, B6
        
        // 共通のステレオディレイとフィルタ回路を作成（神秘的な広がりを演出）
        const delay = audioCtx.createDelay(1.0);
        const feedback = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        delay.delayTime.setValueAtTime(0.24, now); // 240ms のエコー
        feedback.gain.setValueAtTime(0.48, now); // 48% フィードバック
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now); // 低域の残響をカットしてクリスタルな質感に
        
        // 接続: delay -> filter -> feedback -> delay
        delay.connect(filter);
        filter.connect(feedback);
        feedback.connect(delay);
        
        // 出力ゲイン（ディレイ音のミックス量）
        const delayMix = audioCtx.createGain();
        delayMix.gain.setValueAtTime(0.25, now); // ディレイ音量を適切に設定
        
        filter.connect(delayMix);
        delayMix.connect(audioCtx.destination);
        
        chimeScale.forEach((freq, idx) => {
            const timeOffset = idx * 0.055; // ややゆったりとしたスイープ（55ms間隔）
            const playTime = now + timeOffset;
            
            // A. メイン音 (純粋なサイン波で優しく)
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            // B. キラキラしたオクターブ上の倍音 (サイン波)
            const oscHigh = audioCtx.createOscillator();
            const gainHigh = audioCtx.createGain();
            
            let panner = null;
            try {
                if (audioCtx.createStereoPanner) {
                    panner = audioCtx.createStereoPanner();
                    // 音が進むにつれて左右に美しく広がるパンニング
                    const panOffset = (idx % 2 === 0 ? 0.35 : -0.35) * (idx / chimeScale.length);
                    panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, basePan + panOffset)), playTime);
                }
            } catch (e) {}
            
            const dest = panner ? panner : audioCtx.destination;
            if (panner) panner.connect(audioCtx.destination);
            
            // メイン接続
            osc.connect(gain);
            gain.connect(dest);
            gain.connect(delay); // ディレイ回路へセンド
            
            // 倍音接続
            oscHigh.connect(gainHigh);
            gainHigh.connect(dest);
            gainHigh.connect(delay);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, playTime);
            // 音の終盤にわずかに周波数をゆらして温かみを出す
            osc.frequency.linearRampToValueAtTime(freq * 1.002, playTime + 0.6);
            
            oscHigh.type = 'sine';
            oscHigh.frequency.setValueAtTime(freq * 2.0, playTime); // 1オクターブ上
            
            // エンベロープ設定
            const duration = 0.7; // 余韻を長めに
            
            // メインゲイン
            gain.gain.setValueAtTime(0, playTime);
            gain.gain.linearRampToValueAtTime(0.06, playTime + 0.025); // 25msかけて優しくアタック
            gain.gain.exponentialRampToValueAtTime(0.0001, playTime + duration);
            
            // 倍音ゲイン (かすかに重ねて空気感を出す)
            gainHigh.gain.setValueAtTime(0, playTime);
            gainHigh.gain.linearRampToValueAtTime(0.015, playTime + 0.035);
            gainHigh.gain.exponentialRampToValueAtTime(0.0001, playTime + duration * 0.7);
            
            osc.start(playTime);
            osc.stop(playTime + duration + 0.05);
            
            oscHigh.start(playTime);
            oscHigh.stop(playTime + duration + 0.05);
            
            setTimeout(() => {
                try {
                    osc.disconnect();
                    gain.disconnect();
                    oscHigh.disconnect();
                    gainHigh.disconnect();
                    if (panner) panner.disconnect();
                } catch(e) {}
            }, (timeOffset + duration + 0.1) * 1000);
        });
        
        // ディレイ全体のクリーンアップ
        setTimeout(() => {
            try {
                delay.disconnect();
                feedback.disconnect();
                filter.disconnect();
                delayMix.disconnect();
            } catch(e) {}
        }, (chimeScale.length * 0.055 + 2.5) * 1000);
        
    } catch(e) {
        console.warn("効果音再生エラー:", e);
    }
}

// フィーバー中にタップするとなるバックグランドチャイム音（極めて綺麗で短い高音サイン波）
function playFeverChimeBackground(originX) {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const xRatio = (originX !== undefined && showerCanvas) 
            ? Math.max(0, Math.min(0.99, originX / showerCanvas.width)) 
            : 0.5;
        const basePan = xRatio * 2 - 1;
        
        // フィーバー用の超高域音階
        const feverScale = [1567.98, 1760.00, 2093.00, 2349.32, 2637.02]; // G6, A6, C7, D7, E7
        const freq = feverScale[Math.floor(Math.random() * feverScale.length)];
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        let panner = null;
        try {
            if (audioCtx.createStereoPanner) {
                panner = audioCtx.createStereoPanner();
                panner.pan.setValueAtTime(basePan, now);
            }
        } catch(e) {}
        
        osc.connect(gain);
        const dest = panner ? panner : audioCtx.destination;
        if (panner) panner.connect(audioCtx.destination);
        gain.connect(dest);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.035, now + 0.001); // 薄めの音量で
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
        
        osc.start(now);
        osc.stop(now + 0.22);
        
        setTimeout(() => {
            try {
                osc.disconnect();
                gain.disconnect();
                if (panner) panner.disconnect();
            } catch(e) {}
        }, 250);
    } catch(e) {}
}

function playClearSound() {
    initAudio();
    if (!audioCtx) return;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playClearSound();
        }).catch(() => {});
        return;
    }
    
    try {
        const now = audioCtx.currentTime;
        // 6髻ｳ縺ｮ荳頑繝壹Φ繧ｿ繝医ル繝け繝輔Ξ繝ｼ繧ｺ (C5, D5, E5, G5, A5, C6)
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        
        notes.forEach((freq, index) => {
            const timeOffset = index * 0.07; // 70ms縺壹▽縺壹ｉ縺励※霆ｽ蠢ｫ縺ｫ鬧￠荳翫′繧
            
            // A. 譛ｨ逅ｴ縺ｮ譛ｬ菴馴浹井ｸ芽ｧ呈ｳ｢縺ｧ繧ｳ繧ｷ縺ｮ縺ゅｋ髻ｿ縺搾ｼ
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            
            // 譛ｨ逅ｴ繧峨＠縺洒縺ｸ幄｡ｰ (0.22遘偵〒貂幄｡ｰ)
            const duration = 0.22;
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.002); // 2ms繧｢繧ｿ繝け
            gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + duration); // 謖焚貂幄｡ｰ
            
            // B. 繝励Λ繧ｹ繝√ャ繧ｯ譛ｨ逅ｴ縺ｮ謇捺茶髻ｳ縲後さ繝ャ縲搾ｼ井ｸ€迸ｬ縺縺鷹ｳｴ繧矩ｫ倬浹繧ｵ繧､繝ｳ豕｢
            const hitOsc = audioCtx.createOscillator();
            const hitGain = audioCtx.createGain();
            
            hitOsc.connect(hitGain);
            hitGain.connect(audioCtx.destination);
            
            hitOsc.type = 'sine';
            hitOsc.frequency.setValueAtTime(freq * 3.0, now + timeOffset); // 3蛟阪繧ｪ繝ｼ繝舌繝医繝ｳ縺ｧ謇捺茶諢
            
            hitGain.gain.setValueAtTime(0, now + timeOffset);
            hitGain.gain.linearRampToValueAtTime(0.06, now + timeOffset + 0.001); // 1ms縺ｧ遶九■荳翫￡
            hitGain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.015); // 15ms縺ｧ諤･豼€縺ｫ豸亥悉
            
            // 繧ｹ繧ｿ繝ｼ繝医→繧ｹ繝医ャ繝
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + duration + 0.05);
            
            hitOsc.start(now + timeOffset);
            hitOsc.stop(now + timeOffset + 0.03);
            
            osc.onended = () => {
                osc.disconnect();
                gain.disconnect();
                hitOsc.disconnect();
                hitGain.disconnect();
            };
        });
    } catch (e) {
        console.warn("繧ｯ繝ｪ繧｢髻ｳ蜀咲函繧ｨ繝ｩ繝ｼ:", e);
    }
}

// 譟斐ｉ縺九↑繝輔Ρ繝ｼ縺ｨ縺励◆迺ｰ蠅レ譎ｯ髻ｳ縺ｮ髢句ｧ具ｼ3.5遘偵繝輔ぉ繝ｼ繝峨う繝ｳ  繧ｳ繝ｼ繝ｩ繧ｹ  繝ｪ繝舌繝  蜻ｼ蜷ｸ縺吶ｋ繝輔ぅ繝ｫ繧ｿ繝ｼLFO
function startAmbientSound() {
    if (!audioCtx || !gameActive) return; // ゲームがアクティブでない場合は開始しない
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            if (gameActive) { // 非同期解決後にもアクティブか再確認
                startAmbientSound();
            }
        }).catch(() => {});
        return;
    }
    
    // 縺吶〒縺ｫ蜀咲函荳ｭ縺ｮ蝣ｴ蜷医菴輔ｂ縺励↑縺
    if (ambientOscs.length > 0) return;
    
    try {
        const now = audioCtx.currentTime;
        
        // 1. 繝｡繧､繝ｳ縺ｮ繝ｭ繝ｼ繝代せ繝輔ぅ繝ｫ繧ｿ繝ｼ (譟斐ｉ縺九￥蛹∩霎ｼ繧€繧医≧縺ｪ貂ｩ縺九＞繝医繝ｳ)
        ambientFilter = audioCtx.createBiquadFilter();
        ambientFilter.type = 'lowpass';
        ambientFilter.frequency.setValueAtTime(320, now); // 蝓ｺ貅門€､繧320Hz縺ｫ荳九￡縺ｦ縲√＆繧峨↓繝輔Ρ繝ｼ縺ｨ縺励◆髻ｳ縺ｫ縺吶ｋ
        ambientNodes.push(ambientFilter);
        
        // LFO (繝輔ぅ繝ｫ繧ｿ繝ｼ縺ｮ驕ｮ譁ｭ蜻ｨ豕｢謨ｰ繧偵ｆ縺｣縺上ｊ謠ｺ繧峨＠縲∝他蜷ｸ繧偵☆繧九ｈ縺↑讌ｵ荳翫豬ｮ驕頑─繧貞縺)
        ambientLFO = audioCtx.createOscillator();
        ambientLFO.frequency.setValueAtTime(0.04, now); // 25遘貞捉譛 (0.04Hz) 縺ｧ髱槫ｸｸ縺ｫ繧▲縺溘ｊ縺ｨ謠ｺ繧峨☆
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(100, now); // 繝輔ぅ繝ｫ繧ｿ繝ｼ蜻ｨ豕｢謨ｰ繧陳ｱ100Hz謠ｺ繧峨☆ (220Hz 縲 420Hz 縺ｮ雜∪繧阪ｄ縺句ｸｯ蝓溘ｒ繧ｹ繧ｦ繧｣繝ｼ繝)
        
        ambientLFO.connect(lfoGain);
        lfoGain.connect(ambientFilter.frequency); // 繝輔ぅ繝ｫ繧ｿ繝ｼ縺ｮ繧ｫ繝ヨ繧ｪ繝募捉豕｢謨ｰ縺ｸ謗･邯
        ambientLFO.start(now);
        
        ambientOscs.push(ambientLFO);
        ambientNodes.push(lfoGain);
        
        // 2. 繧ｳ繝ｼ繝ｩ繧ｹ繧ｨ繝輔ぉ繧ｯ繝亥屓霍ｯ縺ｮ霑ｽ蜉
        const chorusDelay = audioCtx.createDelay();
        chorusDelay.delayTime.setValueAtTime(0.02, now); // 20ms縺ｮ驕ｻｶ
        
        const chorusLFO = audioCtx.createOscillator();
        chorusLFO.frequency.setValueAtTime(0.45, now); // 0.45Hz縺ｮ讌ｵ繧√※繧▲縺上ｊ縺励◆謠ｺ繧
        chorusLFO.frequency.setValueAtTime(0.45, now); // 0.45Hz縺ｮ讌ｵ繧√※繧▲縺上ｊ縺励◆謠ｺ繧
        
        const chorusLFOGain = audioCtx.createGain();
        chorusLFOGain.gain.setValueAtTime(0.0045, now); // 繝ぅ繝ｬ繧､繧ｿ繧､繝繧陳ｱ4.5ms謠ｺ繧峨☆ (15.5ms縲24.5ms)
        
        chorusLFO.connect(chorusLFOGain);
        chorusLFOGain.connect(chorusDelay.delayTime);
        chorusLFO.start(now);
        
        ambientOscs.push(chorusLFO);
        ambientNodes.push(chorusDelay);
        ambientNodes.push(chorusLFOGain);
        
        // 3. 繝ｪ繝舌繝厄ｼ2邉ｻ邨ｱ繝輔ぅ繝ｼ繝峨ヰ繝け繝ぅ繝ｬ繧､縺ｫ繧医ｋ雎翫°縺ｪ遨ｺ髢捺ｮ矩涸牙屓霍ｯ縺ｮ霑ｽ蜉
        const revDelay1 = audioCtx.createDelay();
        const revFeedback1 = audioCtx.createGain();
        const revDelay2 = audioCtx.createDelay();
        const revFeedback2 = audioCtx.createGain();
        
        revDelay1.delayTime.setValueAtTime(0.12, now); // 120ms驕ｻｶ
        revFeedback1.gain.setValueAtTime(0.55, now);   // 55%繝輔ぅ繝ｼ繝峨ヰ繝け
        revDelay2.delayTime.setValueAtTime(0.17, now); // 170ms驕ｻｶ
        revFeedback2.gain.setValueAtTime(0.52, now);   // 52%繝輔ぅ繝ｼ繝峨ヰ繝け
        
        // 繝輔ぅ繝ｼ繝峨ヰ繝け謗･邯
        revDelay1.connect(revFeedback1);
        revFeedback1.connect(revDelay1);
        revDelay2.connect(revFeedback2);
        revFeedback2.connect(revDelay2);
        
        const revMix = audioCtx.createGain();
        revMix.gain.setValueAtTime(0.62, now); // 繝ｪ繝舌繝夜㍼繧62%縺ｫ蠑輔″荳翫￡縲√ｈ繧頑ｮ矩涸縺ｫ蛹∪繧後ｋ諢溘§縺ｫ
        
        ambientNodes.push(revDelay1, revFeedback1, revDelay2, revFeedback2, revMix);
        
        // 4. 髻ｳ驥上さ繝ｳ繝医Ο繝ｼ繝ｫ逕ｨ縺ｮGainNode (阮￥郢顔ｴｰ縺ｫ)
        ambientGain = audioCtx.createGain();
        ambientGain.gain.setValueAtTime(0, now);
        // 3.5遘偵°縺代※遨ｺ豌嶺ｸｭ縺ｫ貅ｶ縺題ｾｼ繧€繧医≧縺ｫ繝輔Ρ繝ｼ縺ｨ繝輔ぉ繝ｼ繝峨う繝ｳ (髻ｳ驥上縺輔ｉ縺ｫ蠕ｮ蟆上↑0.003)
        ambientGain.gain.linearRampToValueAtTime(0.003, now + 3.5);
        ambientNodes.push(ambientGain);
        
        // --- 蜷お繝輔ぉ繧ｯ繝医謗･邯壽ｧ区 ---
        // A. 逶ｴ謗･髻ｳ繝ｫ繝ｼ繝: filter -> ambientGain
        ambientFilter.connect(ambientGain);
        
        // B. 繧ｳ繝ｼ繝ｩ繧ｹ髻ｳ繝ｫ繝ｼ繝: filter -> chorusDelay -> ambientGain
        ambientFilter.connect(chorusDelay);
        chorusDelay.connect(ambientGain);
        
        // C. 繝ｪ繝舌繝夜浹繝ｫ繝ｼ繝: (繝輔ぅ繝ｫ繧ｿ繝ｼ蠕後髻ｳ縺後Μ繝舌繝門屓霍ｯ縺ｫ蜈･繧翫€√Α繝け繧ｹ縺輔ｌ縺ｦ蜃ｺ蜉帙∈)
        ambientFilter.connect(revDelay1);
        ambientFilter.connect(revDelay2);
        revDelay1.connect(revMix);
        revDelay2.connect(revMix);
        revMix.connect(ambientGain);
        
        // 蜈ｨ菴薙譛€邨ょ蜉帙ｒ繧ｹ繝斐繧ｫ繝ｼ縺ｸ
        ambientGain.connect(audioCtx.destination);
        
        // 5. 豬ｮ驕頑─縺ｮ讌ｵ縺ｿ縺ｨ縺ｪ繧狗ｾ弱＠縺ユ繝ｳ繧ｷ繝ｧ繝ｳ蜥碁浹 (C4, G4, B4, D5, G5)
        const freqs = [261.63, 392.00, 493.88, 587.33, 783.99];
        
        freqs.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine'; // 貔ｓ縺縺繧翫ｒ蜃ｺ縺吶◆繧√↓繧ｵ繧､繝ｳ豕｢繧剃ｽｿ逕ｨ
            
            osc.type = 'sine'; // 貔ｓ縺縺繧翫ｒ蜃ｺ縺吶◆繧√↓繧ｵ繧､繝ｳ豕｢繧剃ｽｿ逕ｨ
            
            // 繧上★縺九↓繝メ繝･繝ｼ繝ｳ縺励※縲√さ繝ｼ繝ｩ繧ｹ縺ｨ蜷医ｏ縺輔▲纎繧ｧ讌ｵ荳翫繧ｷ繝･繝ｯ繝ｼ諢溘ｒ菴懊ｋ
            const detuneOffset = (idx % 2 === 0 ? 2 : -2) + (Math.random() - 0.5) * 1; // 邏ｱ2繧ｻ繝ｳ繝
            osc.detune.setValueAtTime(detuneOffset, now);
            
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(ambientFilter);
            osc.start(now);
            
            ambientOscs.push(osc);
        });
    } catch (e) {
        console.warn("アンビエント音の開始エラー:", e);
    }
}

// 柔らかな環境背景音の停止（2秒のフェードアウト）
function stopAmbientSound(immediate = false) {
    if (ambientOscs.length === 0) return;
    
    try {
        const now = audioCtx.currentTime;
        const fadeTime = immediate ? 0.05 : 0.5; // 即時なら50ms、通常は0.5秒で素早く消音
        
        if (ambientGain) {
            ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
            ambientGain.gain.exponentialRampToValueAtTime(0.0001, now + fadeTime);
        }
        
        const currentOscs = [...ambientOscs];
        const currentNodes = [...ambientNodes];
        ambientOscs = [];
        ambientNodes = [];
        
        setTimeout(() => {
            // オシレーターの完全停止と接続解除
            currentOscs.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
            // エフェクトノードの一括接続解除
            currentNodes.forEach(node => {
                try {
                    node.disconnect();
                } catch (e) {}
            });
        }, fadeTime * 1000 + 100);
    } catch (e) {
        console.warn("アンビエント音の停止エラー:", e);
    }
}

// 流星群が流れる際のキラキラしたステレオ通過音を合成再生
function playMeteorSound(originX) {
    initAudio();
    if (!audioCtx) return;
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playMeteorSound(originX);
        }).catch(() => {});
        return;
    }
    
    try {
        const now = audioCtx.currentTime;
        
        // 発生元のX座標から基準定位（パン）を計算（画面の左端＝-1.0、右端＝+1.0）
        const basePan = (originX !== undefined && showerCanvas) 
            ? Math.max(-1.0, Math.min(1.0, (originX / showerCanvas.width) * 2 - 1)) 
            : 0;
        
        // 1. 全体を包む「シュワーー」という風のような通過音 (FM風の周波数スイープ)
        const sweepOsc = audioCtx.createOscillator();
        const sweepFilter = audioCtx.createBiquadFilter();
        const sweepGain = audioCtx.createGain();
        
        sweepOsc.type = 'triangle';
        sweepOsc.frequency.setValueAtTime(80, now);
        sweepOsc.frequency.exponentialRampToValueAtTime(220, now + 1.2);
        
        sweepFilter.type = 'bandpass';
        sweepFilter.Q.setValueAtTime(3.0, now);
        sweepFilter.frequency.setValueAtTime(300, now);
        sweepFilter.frequency.exponentialRampToValueAtTime(2800, now + 1.0);
        
        sweepGain.gain.setValueAtTime(0, now);
        sweepGain.gain.linearRampToValueAtTime(0.06, now + 0.3); // 0.3秒でアタック
        sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
        
        sweepOsc.connect(sweepFilter);
        sweepFilter.connect(sweepGain);
        sweepGain.connect(audioCtx.destination);
        
        sweepOsc.start(now);
        sweepOsc.stop(now + 1.4);
        
        // 2. 「チリーン」「ピキーン」という超高音のキラキラ星屑音 (8音)
        // 左右へパンニングさせて立体感を出す
        const scale = [1567.98, 1760.00, 1975.53, 2349.32, 2637.02, 3135.96, 3520.00, 3951.07]; // G6~B7の超高音
        const starCount = 8;
        
        for (let i = 0; i < starCount; i++) {
            const timeOffset = (i / starCount) * 1.0 + Math.random() * 0.15;
            const freq = scale[Math.floor(Math.random() * scale.length)];
            
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            let panner = null;
            try {
                if (audioCtx.createStereoPanner) {
                    panner = audioCtx.createStereoPanner();
                }
            } catch (err) {
                panner = null;
            }
            
            if (panner) {
                osc.connect(gain);
                gain.connect(panner);
                panner.connect(audioCtx.destination);
                // 発生源のパン（basePan）を基準に、左右に散らして立体感を表現
                const panVal = basePan + (Math.random() - 0.5) * 0.8;
                panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, panVal)), now + timeOffset);
            } else {
                osc.connect(gain);
                gain.connect(audioCtx.destination);
            }
            
            osc.type = Math.random() > 0.4 ? 'sine' : 'triangle';
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            
            const duration = 0.15 + Math.random() * 0.1;
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.035, now + timeOffset + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + duration);
            
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + duration + 0.05);
            
            setTimeout(() => {
                try {
                    osc.disconnect();
                    gain.disconnect();
                    if (panner) panner.disconnect();
                } catch(e) {}
            }, (timeOffset + duration + 0.2) * 1000);
        }
        
        // sweepOscのクリーンアップ
        setTimeout(() => {
            try {
                sweepOsc.disconnect();
                sweepFilter.disconnect();
                sweepGain.disconnect();
            } catch(e) {}
        }, 1600);
        
    } catch (e) {
        console.warn("流星群効果音再生エラー:", e);
    }
}

// 流星の大爆発の際のキラキラした爽快な宇宙爆発音を合成再生
function playMeteorBigExplosionSound(originX) {
    initAudio();
    if (!audioCtx) return;
    
    // Web Audio APIの初期化/レジューム試行
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            // 再起呼び出しを避けるためここでは再生しない
        }).catch(() => {});
        return;
    }
    
    try {
        const now = audioCtx.currentTime;
        
        // 発生元のX座標から基準定位（パン）を計算（画面の左端＝-1.0、右端＝+1.0）
        const basePan = (originX !== undefined && showerCanvas) 
            ? Math.max(-1.0, Math.min(1.0, (originX / showerCanvas.width) * 2 - 1)) 
            : 0;
            
        // 1. 爆発の際の衝突音と重なる爽快な「スクラッチ音」
        // Q値を高めて、キラキラした周波数成分を強調
        const sweepOsc1 = audioCtx.createOscillator();
        const sweepOsc2 = audioCtx.createOscillator();
        const sweepFilter = audioCtx.createBiquadFilter();
        const sweepGain = audioCtx.createGain();
        
        sweepOsc1.type = 'triangle';
        sweepOsc1.frequency.setValueAtTime(600, now);
        sweepOsc1.frequency.exponentialRampToValueAtTime(2400, now + 0.25);
        
        sweepOsc2.type = 'sine';
        sweepOsc2.frequency.setValueAtTime(608, now);
        sweepOsc2.frequency.exponentialRampToValueAtTime(2415, now + 0.25);
        
        sweepFilter.type = 'bandpass';
        sweepFilter.Q.setValueAtTime(7.5, now);
        sweepFilter.frequency.setValueAtTime(1500, now);
        sweepFilter.frequency.exponentialRampToValueAtTime(8000, now + 0.20);
        
        sweepGain.gain.setValueAtTime(0, now);
        sweepGain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        
        sweepOsc1.connect(sweepFilter);
        sweepOsc2.connect(sweepFilter);
        sweepFilter.connect(sweepGain);
        
        let sweepPanner = null;
        try {
            if (audioCtx.createStereoPanner) {
                sweepPanner = audioCtx.createStereoPanner();
            }
        } catch (err) {
            sweepPanner = null;
        }
        if (sweepPanner) {
            sweepGain.connect(sweepPanner);
            sweepPanner.connect(audioCtx.destination);
            sweepPanner.pan.setValueAtTime(basePan, now);
            sweepPanner.pan.linearRampToValueAtTime(-basePan * 0.5, now + 0.25);
        } else {
            sweepGain.connect(audioCtx.destination);
        }
        
        sweepOsc1.start(now);
        sweepOsc1.stop(now + 0.35);
        sweepOsc2.start(now);
        sweepOsc2.stop(now + 0.35);

        // ベル音（ウインドチャイム）用のステレオリバーブ（交差フィードバック・ディレイ）を作成
        const bellDelayL = audioCtx.createDelay();
        const bellDelayR = audioCtx.createDelay();
        const bellFeedbackL = audioCtx.createGain();
        const bellFeedbackR = audioCtx.createGain();
        const bellCrossL = audioCtx.createGain(); // 交差フィードバック (L -> R)
        const bellCrossR = audioCtx.createGain(); // 交差フィードバック (R -> L)
        const bellDelayFilterL = audioCtx.createBiquadFilter();
        const bellDelayFilterR = audioCtx.createBiquadFilter();
        
        // ステレオ出力用のパンナー
        let delayPannerL = null;
        let delayPannerR = null;
        try {
            if (audioCtx.createStereoPanner) {
                delayPannerL = audioCtx.createStereoPanner();
                delayPannerR = audioCtx.createStereoPanner();
                delayPannerL.pan.setValueAtTime(-0.7, now); // 左側に定位
                delayPannerR.pan.setValueAtTime(0.7, now);  // 右側に定位
            }
        } catch (e) {}
        bellDelayL.delayTime.setValueAtTime(0.095, now); // L側遅延 95ms
        bellDelayR.delayTime.setValueAtTime(0.145, now); // R側遅延 145ms
        
        bellFeedbackL.gain.setValueAtTime(0.52, now); // フィードバック量 52%
        bellFeedbackR.gain.setValueAtTime(0.48, now); // フィードバック量 48%
        
        bellCrossL.gain.setValueAtTime(0.20, now);    // 交差フィードバック量 20%
        bellCrossR.gain.setValueAtTime(0.20, now);    // 交差フィードバック量 20%
        bellDelayFilterL.type = 'highpass';
        bellDelayFilterL.frequency.setValueAtTime(1500, now); // 1.5kHzハイパスでクリアな高域残響のみ残す
        bellDelayFilterR.type = 'highpass';
        bellDelayFilterR.frequency.setValueAtTime(1200, now); // R側は少し低めからカバー

        // Lチャンネルフィードバックループ接続
        bellDelayL.connect(bellDelayFilterL);
        bellDelayFilterL.connect(bellFeedbackL);
        bellFeedbackL.connect(bellDelayL);
        
        // Rチャンネルフィードバックループ接続
        bellDelayR.connect(bellDelayFilterR);
        bellDelayFilterR.connect(bellFeedbackR);
        bellFeedbackR.connect(bellDelayR);
        
        // 交差フィードバック（Lの遅延がRのフィードバックへ、Rの遅延がLのフィードバックへ）
        bellDelayFilterL.connect(bellCrossL);
        bellCrossL.connect(bellDelayR);
        bellDelayFilterR.connect(bellCrossR);
        bellCrossR.connect(bellDelayL);
        
        // メイン出力への接続（ステレオ定位処理）
        if (delayPannerL && delayPannerR) {
            bellDelayFilterL.connect(delayPannerL);
            delayPannerL.connect(audioCtx.destination);
            bellDelayFilterR.connect(delayPannerR);
            delayPannerR.connect(audioCtx.destination);
        } else {
            bellDelayFilterL.connect(audioCtx.destination);
            bellDelayFilterR.connect(audioCtx.destination);
        }

        // キラキラ感のある超高域中心のウィンドチャイムスケール
        const scale = [
            1046.50, 1174.66, 1318.51, 1567.98, 1760.00,   // C6, D6, E6, G6, A6 (澄んだ高音)
            2093.00, 2349.32, 2637.02, 3135.96, 3520.00,   // C7, D7, E7, G7, A7 (煌めく超高音)
            4186.01, 4698.63, 5274.04, 6271.93, 7040.00,   // C8, D8, E8, G8, A8 (突き抜ける極高音)
            8372.02, 9397.26                               // C9, D9 (ウインドチャイムの極小金属棒の超音波域)
        ];
        const starCount = 42; // 音数を少し増やしてアルペジオを引き立てる
        
        for (let i = 0; i < starCount; i++) {
            // アルペジオタイムをさらに長く（0.95秒＋揺らぎ）
            const timeOffset = (i / starCount) * 0.95 + Math.random() * 0.06;
            
            // 概ね上昇するグリッサンドのインデックス計算
            const scaleIndex = Math.min(scale.length - 1, Math.floor((i / starCount) * scale.length + (Math.random() * 3 - 1.5)));
            const freq = scale[Math.max(0, scaleIndex)];
            
            let panner = null;
            try {
                if (audioCtx.createStereoPanner) {
                    panner = audioCtx.createStereoPanner();
                }
            } catch (err) {
                panner = null;
            }
            
            const destNode = panner ? panner : audioCtx.destination;
            if (panner) {
                panner.connect(audioCtx.destination);
                // シャラシャラと鳴りながら、ステレオ定位も左から右へ広がるように演出
                const spread = (Math.random() - 0.5) * 1.8;
                panner.pan.setValueAtTime(Math.max(-1.0, Math.min(1.0, basePan + spread)), now + timeOffset);
            }
            
            // 余韻を180ms〜320msに長くしてウインドチャイムの金属棒の余韻を再現
            const duration = 0.18 + Math.random() * 0.14;
            
            // A. 三角波 (ウインドチャイムのベース音、控えめ)
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(destNode);
            gain.connect(bellDelayL); // リバーブ左バスへ送る
            gain.connect(bellDelayR); // リバーブ右バスへ送る
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.015, now + timeOffset + 0.001); // 1msの極速アタック
            gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + duration);
            
            // B. 非調和倍音 2.76倍 (ウィンドチャイムの金属特有の非整数の響き)
            const oscMetal = audioCtx.createOscillator();
            const gainMetal = audioCtx.createGain();
            oscMetal.connect(gainMetal);
            gainMetal.connect(destNode);
            gainMetal.connect(bellDelayL);
            gainMetal.connect(bellDelayR);
            oscMetal.type = 'sine';
            oscMetal.frequency.setValueAtTime(freq * 2.76, now + timeOffset);
            
            const durMetal = duration * 0.85;
            gainMetal.gain.setValueAtTime(0, now + timeOffset);
            gainMetal.gain.linearRampToValueAtTime(0.015, now + timeOffset + 0.0015);
            gainMetal.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + durMetal);
            
            // C. 4倍音 (サイン波で高い澄んだ響き)
            const oscHigh = audioCtx.createOscillator();
            const gainHigh = audioCtx.createGain();
            oscHigh.connect(gainHigh);
            gainHigh.connect(destNode);
            gainHigh.connect(bellDelayL);
            gainHigh.connect(bellDelayR);
            oscHigh.type = 'sine';
            oscHigh.frequency.setValueAtTime(freq * 4.0, now + timeOffset);
            
            const durHigh = duration * 0.60;
            gainHigh.gain.setValueAtTime(0, now + timeOffset);
            gainHigh.gain.linearRampToValueAtTime(0.010, now + timeOffset + 0.001);
            gainHigh.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + durHigh);
            
            // D. 金属製アタック音 5.4倍音
            const hitOsc = audioCtx.createOscillator();
            const hitGain = audioCtx.createGain();
            hitOsc.connect(hitGain);
            hitGain.connect(destNode);
            hitOsc.type = 'sine';
            hitOsc.frequency.setValueAtTime(freq * 5.4, now + timeOffset);
            
            hitGain.gain.setValueAtTime(0, now + timeOffset);
            hitGain.gain.linearRampToValueAtTime(0.020, now + timeOffset + 0.0005);
            hitGain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.006);
            
            osc.start(now + timeOffset);
            osc.stop(now + timeOffset + duration + 0.02);
            
            oscMetal.start(now + timeOffset);
            oscMetal.stop(now + timeOffset + durMetal + 0.02);
            
            oscHigh.start(now + timeOffset);
            oscHigh.stop(now + timeOffset + durHigh + 0.02);
            
            hitOsc.start(now + timeOffset);
            hitOsc.stop(now + timeOffset + 0.02);
            
            setTimeout(() => {
                try {
                    osc.disconnect();
                    gain.disconnect();
                    oscMetal.disconnect();
                    gainMetal.disconnect();
                    oscHigh.disconnect();
                    gainHigh.disconnect();
                    hitOsc.disconnect();
                    hitGain.disconnect();
                    if (panner) panner.disconnect();
                } catch(e) {}
            }, (timeOffset + duration + 0.25) * 1000);
        }
        
        // リバーブ全体の接続解除クリーンアップ（2.6秒に延長）
        setTimeout(() => {
            try {
                sweepOsc1.disconnect();
                sweepOsc2.disconnect();
                sweepFilter.disconnect();
                sweepGain.disconnect();
                if (sweepPanner) sweepPanner.disconnect();
                
                bellDelayL.disconnect();
                bellDelayR.disconnect();
                bellFeedbackL.disconnect();
                bellFeedbackR.disconnect();
                bellCrossL.disconnect();
                bellCrossR.disconnect();
                bellDelayFilterL.disconnect();
                bellDelayFilterR.disconnect();
                if (delayPannerL) delayPannerL.disconnect();
                if (delayPannerR) delayPannerR.disconnect();
            } catch(e) {}
        }, 2600);
        
    } catch (e) {
        console.warn("大爆発効果音再生エラー:", e);
    }
}

// 炭酸バブルサウンドの再生（異なる色の玉5個を2回連続でクリアしたときの大爆発で再生）
function playCarbonatedBubbleSound(originX) {
    initAudio();
    if (!audioCtx) return;

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            playCarbonatedBubbleSound(originX);
        }).catch(() => {});
        return;
    }

    // キャッシュが生成されていなければ生成を試みる
    if (!carbonatedBufferCache) {
        pregenerateCarbonatedBuffer();
    }
    if (!carbonatedBufferCache) return;

    try {
        const now = audioCtx.currentTime;
        const durationSeconds = 6.5;

        // 発生元のX座標から基準定位（パン）を計算（画面の左端＝-1.0、右端＝+1.0）
        const basePan = (originX !== undefined && showerCanvas) 
            ? Math.max(-1.0, Math.min(1.0, (originX / showerCanvas.width) * 2 - 1)) 
            : 0;

        // 3. AudioBufferSourceNode の作成と再生
        const noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = carbonatedBufferCache;

        // タップ位置に応じたベース定位を設定するパンナー
        let basePanner = null;
        try {
            if (audioCtx.createStereoPanner) {
                basePanner = audioCtx.createStereoPanner();
                basePanner.pan.setValueAtTime(basePan, now);
            }
        } catch (e) {}

        // ハイパスフィルターで高音のシュワシュワ成分のみを取り出す（一括適用）
        const filterNode = audioCtx.createBiquadFilter();
        filterNode.type = 'highpass';
        filterNode.frequency.setValueAtTime(4200, now);
        filterNode.frequency.exponentialRampToValueAtTime(2200, now + durationSeconds - 0.5);

        // ディレイ空間エコー回路
        const delayNodeL = audioCtx.createDelay(1.5);
        const delayNodeR = audioCtx.createDelay(1.5);

        const delayFeedbackL = audioCtx.createGain();
        const delayFeedbackR = audioCtx.createGain();
        
        delayNodeL.delayTime.setValueAtTime(0.16, now); 
        delayNodeR.delayTime.setValueAtTime(0.26, now); 
        
        delayFeedbackL.gain.setValueAtTime(0.42, now); 
        delayFeedbackR.gain.setValueAtTime(0.42, now);

        const delayFilterL = audioCtx.createBiquadFilter();
        const delayFilterR = audioCtx.createBiquadFilter();
        delayFilterL.type = 'bandpass';
        delayFilterL.frequency.setValueAtTime(3600, now);
        delayFilterL.Q.setValueAtTime(0.8, now); 
        
        delayFilterR.type = 'bandpass';
        delayFilterR.frequency.setValueAtTime(4200, now);
        delayFilterR.Q.setValueAtTime(0.8, now);

        let delayPannerL = null;
        let delayPannerR = null;
        try {
            if (audioCtx.createStereoPanner) {
                delayPannerL = audioCtx.createStereoPanner();
                delayPannerR = audioCtx.createStereoPanner();
                delayPannerL.pan.setValueAtTime(-0.9, now); 
                delayPannerR.pan.setValueAtTime(0.9, now);
            }
        } catch (e) {}

        // 接続
        if (basePanner) {
            noiseNode.connect(basePanner);
            basePanner.connect(filterNode);
        } else {
            noiseNode.connect(filterNode);
        }
        
        // ディレイへの接続（センド）
        filterNode.connect(delayNodeL);
        filterNode.connect(delayNodeR);

        delayNodeL.connect(delayFilterL);
        delayFilterL.connect(delayFeedbackL);
        delayFeedbackL.connect(delayNodeL);
        
        delayNodeR.connect(delayFilterR);
        delayFilterR.connect(delayFeedbackR);
        delayFeedbackR.connect(delayNodeR);

        // クロスフィードバック
        const delayCrossL = audioCtx.createGain();
        const delayCrossR = audioCtx.createGain();
        delayCrossL.gain.setValueAtTime(0.18, now); 
        delayCrossR.gain.setValueAtTime(0.18, now);
        delayFilterL.connect(delayCrossL);
        delayCrossL.connect(delayNodeR);
        delayFilterR.connect(delayCrossR);
        delayCrossR.connect(delayNodeL);

        // 出力ゲイン（最終音量微調整用）
        const outputGain = audioCtx.createGain();
        outputGain.gain.setValueAtTime(1.0, now);
        outputGain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

        filterNode.connect(outputGain);
        outputGain.connect(audioCtx.destination);

        if (delayPannerL && delayPannerR) {
            delayFilterL.connect(delayPannerL);
            delayPannerL.connect(audioCtx.destination);
            delayFilterR.connect(delayPannerR);
            delayPannerR.connect(audioCtx.destination);
        } else {
            delayFilterL.connect(audioCtx.destination);
            delayFilterR.connect(audioCtx.destination);
        }

        noiseNode.start(now);
        noiseNode.stop(now + durationSeconds + 0.1);

        // クリーンアップ
        setTimeout(() => {
            try {
                noiseNode.disconnect();
                if (basePanner) basePanner.disconnect();
                filterNode.disconnect();
                outputGain.disconnect();
                delayNodeL.disconnect();
                delayNodeR.disconnect();
                delayFeedbackL.disconnect();
                delayFeedbackR.disconnect();
                delayCrossL.disconnect();
                delayCrossR.disconnect();
                if (delayPannerL) delayPannerL.disconnect();
                if (delayPannerR) delayPannerR.disconnect();
            } catch (e) {}
        }, 8000);

    } catch (e) {
        console.warn("炭酸サウンド再生エラー:", e);
    }
}



// =============================================================
// 6. メインループ ＆ 初期化
// =============================================================

function mainLoop(timestamp) {
    // iOS Safari等のロードタイミングによるサイズズレ対策: 毎フレーム確認して一致していない場合リサイズ
    if (showerCanvas && (showerCanvas.width !== window.innerWidth || showerCanvas.height !== window.innerHeight)) {
        resizeShowerCanvas();
    }
    
    // バックグラウンドのマインドシャワーの更新と描画（泡もここで描画される）
    updateShower();
    updateBubbles(timestamp);
    updateMeteors();
    drawShower();
    
    requestAnimationFrame(mainLoop);
}

// 連鎖バブルがタップされた際に、周囲の泡を巻き込んで連鎖爆発させる
function triggerChainReaction(parentBubble) {
    if (!parentBubble) return;

    const chainRadius = 500; // 連鎖する判定半径（500px）

    // 1. 半径500px以内の連鎖対象の泡を収集
    const targetBubbles = [];
    bubbles.forEach(b => {
        // すでにポップ中(popping)またはドミノ予約済み(reserved)の泡は除外
        if (b === parentBubble || b.popping || b.reserved) return;

        const dx = b.x - parentBubble.x;
        const dy = b.y - parentBubble.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= chainRadius) {
            targetBubbles.push({ bubble: b, dist: dist });
            b.reserved = true; // 重複巻き込みを防ぐために先に予約フラグを立てる
        }
    });

    // 2. 距離が近い順（昇順）にソート
    targetBubbles.sort((a, b) => a.dist - b.dist);

    // 3. ドミノ倒しのように1つずつ時間差（一定の間隔）で破裂をスケジュール
    const dominoInterval = 90; // 各破裂の間隔 (90ms)

    targetBubbles.forEach((target, index) => {
        const b = target.bubble;
        const delayTime = (index + 1) * dominoInterval; // 1個ずつ順番に遅延を増やす

        setTimeout(() => {
            if (!gameActive) return;

            // 時間差の番が来たらポップアニメーションを開始する
            b.popping = true;

            // 巻き込まれたバブルのポップトリガー処理
            if (!b.popTriggered) {
                b.popTriggered = true;
                
                // コンボをさらにアップして上昇アルペジオにする
                comboCount++;
                
                // ポップ音とエフェクトの再生
                playPopSound(comboCount, b.x);
                
                // 連鎖中の振動は、すべて震わせるとノイズになるので3回に1回だけプチッと振動させる
                if (comboCount % 3 === 0) {
                    triggerHaptic('light');
                }
                
                // 巻き込まれた泡が別の「連鎖バブル（金色）」なら、さらにそこから連鎖を誘発
                if (b.type === 'chain') {
                    triggerChainReaction(b);
                }
                
                const rippleSize = 100 + Math.min(comboCount, 12) * 20;
                const particleCount = 8 + Math.min(comboCount, 12) * 3;
                const rippleSpeed = 2.5 + Math.min(comboCount, 12) * 0.25;

                createShowerRipple(b.x, b.y, rippleSize, rippleSpeed, b.hue);
                createShowerParticles(b.x, b.y, particleCount, b.hue, false);
                
                // リフレッシュゲージも進行
                totalPops++;
                refreshProgress = Math.min(1, totalPops / REFRESH_TARGET);
                updateRefreshGauge();
                
                if (comboCount >= 2) {
                    showCombo(comboCount);
                }
                
                if (refreshProgress >= 1) {
                    setTimeout(() => {
                        endGame();
                    }, 600);
                }
            }
        }, delayTime);
    });

    // 連鎖バブル中心部にエネルギー放出の追加特殊波紋（半径500pxの白銀波紋）
    createShowerRipple(parentBubble.x, parentBubble.y, 500, 4.2, 210); // 白銀の特大波紋
    createShowerParticles(parentBubble.x, parentBubble.y, 35, 210, false); // 白銀の大量の粒子
}

// 泡をタップしてポップする（ヒット判定）
function tryPopBubble(clientX, clientY) {
    if (!gameActive) return false;
    
    // 手前（後から描画された）泡から判定
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.popping || b.reserved) continue; // ポップ中または連鎖予約済みの泡は除外
        
        const dx = clientX - b.x;
        const dy = clientY - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 半径の1.2倍を判定範囲にして触りやすく
        if (dist <= b.radius * 1.2) {
            b.popping = true;
            
            // コンボ管理
            const now = performance.now();
            if (now - lastPopTime < COMBO_WINDOW) {
                comboCount++;
            } else {
                comboCount = 1;
            }
            lastPopTime = now;
            
            // 特殊泡またはフィーバーに応じた効果音再生
            if (b.type === 'silver') {
                feverActive = true;
                feverEndTime = now + 8000; // フィーバータイムは8秒間
                playFeverStartSound(b.x);
                triggerHaptic('heavy');
                createShowerRipple(b.x, b.y, 280, 3.2, 210); // 白銀の特大波紋 (色相210)
            } else if (b.type === 'chain') {
                playPopSound(comboCount, b.x);
                triggerHaptic('medium');
                triggerChainReaction(b);
            } else {
                playPopSound(comboCount, b.x);
                triggerHaptic('light');
                
                // フィーバー中ならさらに追加 of チャイム音をバックに薄く重ねる
                if (feverActive) {
                    playFeverChimeBackground(b.x);
                }
            }
            
            // 同色3連続タップの判定
            tappedColorHistory.push(b.color);
            if (tappedColorHistory.length > 3) {
                tappedColorHistory.shift();
            }
            if (tappedColorHistory.length === 3 &&
                tappedColorHistory[0] === tappedColorHistory[1] &&
                tappedColorHistory[1] === tappedColorHistory[2]) {
                triggerMeteorShower(b.x, b.y);
                tappedColorHistory = []; // トリガー後の履歴をリセット
            }
            
            // 大爆発判定用の履歴管理 (直近10タップ分)
            popColorHistory.push(b.color);
            if (popColorHistory.length > 10) {
                popColorHistory.shift();
            }
            
            if (popColorHistory.length === 10) {
                // 1. 髫｣謗･縺吶ｋ騾｣邯壹ち繝��縺後↑縺�°繝√ぉ繝�け
                let hasConsecutiveSame = false;
                for (let j = 0; j < 9; j++) {
                    if (popColorHistory[j] === popColorHistory[j + 1]) {
                        hasConsecutiveSame = true;
                        break;
                    }
                }
                
                if (!hasConsecutiveSame) {
                    // 2. 蜑榊濠5繧ｿ繝��縺ｨ蠕悟濠5繧ｿ繝��縺後◎繧後◇繧後Θ繝九�繧ｯ�磯㍾隍�↑縺暦ｼ峨°繝√ぉ繝�け
                    const first5 = popColorHistory.slice(0, 5);
                    const last5 = popColorHistory.slice(5, 10);
                    
                    const first5Unique = new Set(first5).size === 5;
                    const last5Unique = new Set(last5).size === 5;
                    
                    if (first5Unique && last5Unique) {
                        // 豬∵弌縺ｮ螟ｧ辷�匱繧偵ヨ繝ｪ繧ｬ繝ｼ
                        triggerMeteorBigExplosion(b.x, b.y);
                        // 螻･豁ｴ繧偵Μ繧ｻ繝�ヨ
                        popColorHistory = [];
                        tappedColorHistory = []; // 蜷瑚牡縺ｮ3騾｣繧ゅけ繝ｪ繧｢
                    }
                }
            }
            
            // 繝ｪ繝輔Ξ繝�す繝･繧ｲ繝ｼ繧ｸ譖ｴ譁ｰ
            totalPops++;
            refreshProgress = Math.min(1, totalPops / REFRESH_TARGET);
            updateRefreshGauge();
            
            // 繧ｳ繝ｳ繝懆｡ｨ遉ｺ
            if (comboCount >= 2) {
                showCombo(comboCount);
            }
            
            // 繧ｬ繧､繝峨ユ繧ｭ繧ｹ繝医ｒ豸医☆�亥�蝗槭ち繝��蠕鯉ｼ�
            if (!guideHidden) {
                guideHidden = true;
                const guide = document.getElementById('guide-text');
                if (guide) {
                    guide.style.opacity = '0';
                }
            }
            
            // 繧ｲ繝ｼ繧ｸ貅繧ｿ繝ｳ 竊� 繝ｪ繝輔Ξ繝�す繝･螳御ｺ�
            if (refreshProgress >= 1) {
                setTimeout(() => {
                    endGame();
                }, 600);
            }
            
            return true;
        }
    }
    return false;
}


// =============================================================
// 4. UI譖ｴ譁ｰ
// =============================================================

// 繧ｳ繝ｳ繝懈焚繧堤判髱｢荳ｭ螟ｮ縺ｫ縺ｵ繧上▲縺ｨ陦ｨ遉ｺ
// 褒める言葉の定義（日本語＋英語）
const COMBO_PRAISES = [
    { jp: "いいぞ！", en: "Nice!" },
    { jp: "すごい！", en: "Amazing!" },
    { jp: "その調子！", en: "Keep it up!" },
    { jp: "すてき！", en: "Lovely!" },
    { jp: "さすが！", en: "Brilliant!" },
    { jp: "お見事！", en: "Well done!" },
    { jp: "バッチリ！", en: "Perfect!" },
    { jp: "心地いい！", en: "So soothing!" },
    { jp: "癒やされる！", en: "So relaxing!" },
    { jp: "素晴らしい！", en: "Wonderful!" },
    { jp: "いい波きてる！", en: "Great flow!" },
    { jp: "天才！", en: "Genius!" },
    { jp: "気持ちいい！", en: "Feels great!" },
    { jp: "バツグン！", en: "Excellent!" }
];

const SPECIAL_PRAISES = [
    { jp: "✨奇跡的！✨", en: "✨Miraculous!✨" },
    { jp: "🌟超リフレッシュ！🌟", en: "🌟Super Refreshed!🌟" },
    { jp: "🎉パーフェクト！🎉", en: "🎉Perfect Combo!🎉" },
    { jp: "💖極上の癒やし！💖", en: "💖Ultimate Bliss!💖" },
    { jp: "🚀神業タップ！🚀", en: "🚀Godlike Tap!🚀" },
    { jp: "🌈ビューティフル！🌈", en: "🌈Beautiful!🌈" },
    { jp: "💫大宇宙の調和！💫", en: "💫Cosmic Harmony!💫" },
    { jp: "💎至高の輝き！💎", en: "💎Supreme Radiance!💎" },
    { jp: "🍀幸せいっぱい！🍀", en: "🍀Full of Happiness!🍀" }
];

let lastPraiseIdx = -1;
let lastSpecialPraiseIdx = -1;

// コンボ数に応じて褒める言葉（日本語＋英語）を画面中央に表示
function showCombo(count) {
    const el = document.getElementById('combo-display');
    if (!el) return;
    
    let praise = null;
    if (count % 10 === 0) {
        // 10タップごとの特別な言葉
        let idx;
        do {
            idx = Math.floor(Math.random() * SPECIAL_PRAISES.length);
        } while (idx === lastSpecialPraiseIdx && SPECIAL_PRAISES.length > 1);
        
        lastSpecialPraiseIdx = idx;
        praise = SPECIAL_PRAISES[idx];
        el.classList.add('special');
    } else {
        // 通常の褒める言葉
        let idx;
        do {
            idx = Math.floor(Math.random() * COMBO_PRAISES.length);
        } while (idx === lastPraiseIdx && COMBO_PRAISES.length > 1);
        
        lastPraiseIdx = idx;
        praise = COMBO_PRAISES[idx];
        el.classList.remove('special');
    }
    
    // セキュアなDOM APIで組み立て
    el.replaceChildren();
    
    const jpDiv = document.createElement('div');
    jpDiv.className = 'combo-jp';
    jpDiv.textContent = praise.jp;
    el.appendChild(jpDiv);
    
    const enDiv = document.createElement('div');
    enDiv.className = 'combo-en';
    enDiv.textContent = praise.en;
    el.appendChild(enDiv);
    
    el.classList.remove('show');
    // リフローを強制してアニメーションを再トリガー
    void el.offsetWidth;
    el.classList.add('show');
}

// 繝ｪ繝輔Ξ繝�す繝･繧ｲ繝ｼ繧ｸ縺ｮ繝舌�繧呈峩譁ｰ
function updateRefreshGauge() {
    const fill = document.getElementById('refresh-gauge-fill');
    if (fill) {
        fill.style.width = (refreshProgress * 100) + '%';
    }
    
    // 繝ｩ繝吶Ν陦ｨ遉ｺ��50%莉･荳翫〒縺ｵ繧上▲縺ｨ陦ｨ遉ｺ��
    const label = document.getElementById('refresh-gauge-label');
    if (label) {
        if (refreshProgress >= 0.5) {
            label.classList.add('visible');
            label.textContent = Math.round(refreshProgress * 100) + '%';
        } else {
            label.classList.remove('visible');
        }
    }
}


// =============================================================
// 5. 繧ｲ繝ｼ繝�迥ｶ諷狗ｮ｡逅�
// =============================================================

function startGame() {
    // 縺吶∋縺ｦ繧偵Μ繧ｻ繝�ヨ
    bubbles = [];
    meteors = [];
    tappedColorHistory = [];
    popColorHistory = [];
    comboCount = 0;
    lastPopTime = 0;
    totalPops = 0;
    refreshProgress = 0;
    gameActive = true;
    guideHidden = false;
    nextSpawnTime = performance.now() + 400; // 蟆代＠髢薙ｒ鄂ｮ縺�※豕｡縺悟�蟋九ａ繧�
    
    // UI蛻晄悄蛹�
    updateRefreshGauge();
    
    const guide = document.getElementById('guide-text');
    if (guide) {
        guide.style.opacity = '';
    }
    
    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
        comboEl.classList.remove('show');
    }
    
    // 繧ｲ繝ｼ繝�繧ｪ繝ｼ繝舌�繝｢繝ｼ繝繝ｫ繧帝撼陦ｨ遉ｺ縺ｫ
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    // 閭梧勹縺ｮ譟斐ｉ縺九↑繧｢繝ｳ繝薙お繝ｳ繝磯浹繧帝幕蟋�
    startAmbientSound();
}


// ページ全体（スタイルシートやレイアウト含む）の読み込み完了後に初期化を実行（レイアウト確定後にサイズ取得するため）
if (document.readyState === 'complete') {
    initApp();
} else {
    window.addEventListener('load', initApp);
}
