// =============================================================
// 1. グローバル変数と状態変数
// =============================================================

// 泡の色パレット（くすみパステル）
const BUBBLE_COLORS = [
    { hex: '#81c3d7', hue: 195 },
    { hex: '#f3c68f', hue: 35  },
    { hex: '#c2aff0', hue: 262 },
    { hex: '#96e6b3', hue: 148 },
    { hex: '#f2a3b3', hue: 349 },
    { hex: '#8da9c4', hue: 213 },
    { hex: '#e9c46a', hue: 42  }
];

// 泡の管理
let bubbles = [];
const MAX_BUBBLES = 34; // 画面上の泡上限（全モード共通）
const FEVER_MAX_BUBBLES = 72; // フィーバー中の泡上限
const BUBBLE_SPAWN_MIN = 286; // ~800/2.8
const BUBBLE_SPAWN_MAX = 536; // ~1500/2.8
let nextSpawnTime = 0;

// 同色3連タップ判定用履歴
let tappedColorHistory = [];
// 大量連鎖判定用の直近10タップ履歴
let popColorHistory = [];
// 流れ星の管理
let meteors = [];
let lastShootingStarTime = Date.now();
let nextShootingStarDelay = 10000 + Math.random() * 20000; // 初回は起動10秒〜30秒の間のランダムなタイミングで流れるよう調整

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

// ジャイロセンサー（パララックス用）
let targetGyroX = 0;
let targetGyroY = 0;
let currentGyroX = 0;
let currentGyroY = 0;
let gyroActive = false;
let gyroPermissionRequested = false;

// コンボ管理
let comboCount = 0;
let maxComboCount = 0;
let lastPopTime = 0;
let gameStartTime = 0;
const COMBO_WINDOW = 1900; // コンボ有効時間 (ms)

// リラクゼーション設定（脳リフレクソ改用）
let volumeBGM = 0.35;
let volumeSolfeggio = 0.1;
let volumeSE = 0.8;
let currentTheme = 'starry';
let hapticEnabled = true;
let gyroEnabled = false;
let breathGuideEnabled = false;
let breathCycleTime = 0;
let breathState = 'inhale';
let breathPattern = 'coherent'; // 'coherent' | '478' | 'box'
let langMode = 'bilingual'; // 'bilingual' | 'ja' | 'en'

// リフレッシュゲージ
let refreshProgress = 0;
const REFRESH_TARGET = 80; // 完了までに必要な泡のポップ数
let totalPops = 0;
let sessionPops = 0;

// ゲーム状態
let gameActive = false;
let guideHidden = false;
let infiniteMode = false; // true = Endless Play（終わらないモード）
let meditationMode = false; // true = 瞑想モード（タップ無効、低速、呼吸ガイド強制）
let popEffectMode = 'praise'; // デフォルト快感コメント

// 音声関連
let audioCtx = null;
let ambientOscs = [];
let ambientNodes = []; // エフェクト等中間ノード一括管理用
let ambientGain = null;
let ambientFilter = null;
let ambientLFO = null;
let solfeggioOscs = []; // 528Hz, 396Hz のオシレーター格納用
let solfeggioGain528 = null;
let solfeggioGain396 = null;


// =============================================================
// 2. メインシャワー（光彩Canvasパーティクルシステム）
// =============================================================
let showerCanvas = null;
let showerCtx = null;
let showerParticles = [];
let cursorTrailParticles = [];
let showerRipples = [];
let showerHue = 200;
let viewW = 0; // CSS論理幅（描画・当たり判定用）
let viewH = 0; // CSS論理高
let canvasDpr = 1;
let _heavyFrameStreak = 0; // 負荷検知（ぼやけ抑制用）

// =============================================================
// キャッシュ＆事前レンダリング用オブジェクト
// =============================================================
const particleSpriteCache = {};
const bubbleTemplateCache = {};
let carbonatedBufferCache = null;

// モバイル判定（ユーザーエージェント基準）
const IS_MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// フレームレート制限（モバイルは30fps、PCは60fps）
let _lastFrameTime = 0;
const TARGET_FPS = IS_MOBILE ? 30 : 60;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

// 背景グラデーションキャッシュ（毎フレーム再生成を避ける）
let _bgGradientCache = null;
let _bgGradientTheme = null;
let _bgGradientW = 0;
let _bgGradientH = 0;

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
    const canvasSize = 256;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');
    
    const center = canvasSize / 2;
    const templateRadius = 60; // 基準半径（高DPI向けに2倍）
    
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

function handleOrientation(event) {
    const maxTilt = 30; // 30度で最大の傾きとする
    let g = event.gamma || 0; // 左右の傾き (-90 〜 90)
    let b = event.beta || 0;  // 前後の傾き (-180 〜 180)
    
    // 左右: -30度〜30度を -1.0〜1.0 にマッピング
    targetGyroX = Math.max(-1, Math.min(1, g / maxTilt));
    // 前後: 通常の縦持ち角度（約55度）を基準にし、前後30度のズレを -1.0〜1.0 にマッピング
    targetGyroY = Math.max(-1, Math.min(1, (b - 55) / maxTilt));
}

function requestGyroPermission() {
    if (gyroActive) return;
    
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(permissionState => {
                if (permissionState === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    gyroActive = true;
                }
            })
            .catch(err => {
                console.warn("ジャイロセンサーの許可要求エラー:", err);
            });
    } else {
        // iOS以外（AndroidやPC等）
        window.addEventListener('deviceorientation', handleOrientation);
        gyroActive = true;
    }
}

// 星屑の初期化 (夜空のまたたき用)
function initStars() {
    if (!showerCanvas) return;
    stars = [];
    // 画面解像度に合わせて適切な星の数を計算
    const starCount = Math.floor((viewW * viewH) / 7000);
    const starColors = [
        'rgba(255, 255, 255, ', // 純白
        'rgba(224, 242, 254, ', // 青白い星
        'rgba(254, 240, 138, ', // 黄色い星
        'rgba(253, 244, 245, '  // 淡いピンクの星
    ];

    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * viewW,
            y: Math.random() * viewH,
            size: Math.random() * 1.5 + 0.5, // 0.5px 〜 2px
            baseAlpha: 0.15 + Math.random() * 0.55,
            twinkleSpeed: 0.008 + Math.random() * 0.012,
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
        
        // 位相を進めてまたたきを計算 (非常に緩やかに明滅)
        star.phase += star.twinkleSpeed;
        const twinkle = Math.sin(star.phase);
        const currentAlpha = Math.max(0.1, star.baseAlpha + twinkle * 0.18);

        // ジャイロによる視差効果（星は奥にあるため、傾きと逆方向に小さく動かす）
        const offsetX = currentGyroX * -25 * (star.size / 2);
        const offsetY = currentGyroY * -25 * (star.size / 2);

        showerCtx.fillStyle = star.colorBase + currentAlpha + ')';
        const size = star.size;
        showerCtx.fillRect(star.x + offsetX - size / 2, star.y + offsetY - size / 2, size, size);
    }
}

function createCursorTrail(x, y) {
    if (!gameActive) return;
    
    // Choose hue based on visual theme
    let hue = showerHue;
    if (currentTheme === 'starry') {
        hue = Math.random() < 0.5 ? 45 : 210; // Gold or silver
    } else if (currentTheme === 'sakura') {
        hue = Math.random() < 0.5 ? 340 : 0; // Pink or white
    } else if (currentTheme === 'aurora') {
        hue = Math.random() < 0.5 ? 145 : 195; // Emerald or cyan
    } else {
        hue = (showerHue + (Math.random() - 0.5) * 20) % 360;
    }
    
    const count = 2; // Create 2 trail particles per move event
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 1.5;
        cursorTrailParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.2, // Drifts slightly up
            size: 2 + Math.random() * 4,
            life: 0,
            maxLife: 20 + Math.random() * 15,
            hue: hue,
            spin: (Math.random() - 0.5) * 0.1,
            angle: Math.random() * Math.PI * 2,
            alpha: 0.8
        });
    }
}

function initShower() {
    showerCanvas = document.getElementById('shower-canvas');
    if (!showerCanvas) return;
    showerCtx = showerCanvas.getContext('2d');
    
    resizeShowerCanvas();
    initStars(); // 星屑の初期設定
    window.addEventListener('resize', resizeShowerCanvas);
    
    const addParticleFlow = (clientX, clientY) => {
        createShowerParticles(clientX, clientY, 2);
        createCursorTrail(clientX, clientY);
    };
    
    const handleInteraction = (clientX, clientY) => {
        // モード選択・終了・ジャイロ確認など「操作を塞ぐ」オーバーレイだけブロック
        if (document.querySelector(
            '#start-overlay.active, #gameover-overlay.active, #gyro-confirm-dialog.active, #sound-guide-dialog.active'
        )) {
            return;
        }
        if (!gameActive) return;
        
        if (tryPopBubble(clientX, clientY)) {
            return;
        }
        
        createShowerRipple(clientX, clientY);
        createShowerParticles(clientX, clientY, 15);
    };

    const isElementInUI = (target) => {
        if (!target) return false;
        return !!(target.closest && target.closest('#settings-panel, #start-overlay, #gameover-overlay, #gyro-confirm-dialog, #sound-guide-dialog, .game-actions, .btn-settings, .refresh-gauge'));
    };

    let isDragging = false;
    let lastDragX = null;
    let lastDragY = null;

    // 前回のドラッグ位置から現在の位置までの中間点を補間してポップ判定を行う（高速スワイプ時のすり抜け防止）
    const handleDragPop = (clientX, clientY) => {
        if (!gameActive) return;
        if (lastDragX !== null && lastDragY !== null) {
            const dx = clientX - lastDragX;
            const dy = clientY - lastDragY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // 距離が12px以上の場合は中間地点を生成して判定（ステップ過多で固まるのを防ぐ）
            if (dist > 12) {
                const steps = Math.min(8, Math.ceil(dist / 12));
                for (let s = 1; s <= steps; s++) {
                    const t = s / steps;
                    const interX = lastDragX + dx * t;
                    const interY = lastDragY + dy * t;
                    tryPopBubble(interX, interY);
                }
            } else {
                tryPopBubble(clientX, clientY);
            }
        } else {
            tryPopBubble(clientX, clientY);
        }
        lastDragX = clientX;
        lastDragY = clientY;
    };

    window.addEventListener('mousemove', (e) => {
        if (isElementInUI(e.target)) return;
        addParticleFlow(e.clientX, e.clientY);
        if (isDragging && gameActive) {
            handleDragPop(e.clientX, e.clientY);
        }
    });

    window.addEventListener('touchmove', (e) => {
        if (isElementInUI(e.target)) return;
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            addParticleFlow(touch.clientX, touch.clientY);
            
            // ゲーム中ならなぞりポップを実行し、画面スクロールを防止する
            if (gameActive && isDragging) {
                handleDragPop(touch.clientX, touch.clientY);
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        }
    }, { passive: false });

    window.addEventListener('mousedown', (e) => {
        if (isElementInUI(e.target)) return;
        isDragging = true;
        lastDragX = e.clientX;
        lastDragY = e.clientY;
        initAudio();
        handleInteraction(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        lastDragX = null;
        lastDragY = null;
    });

    window.addEventListener('mouseleave', () => {
        isDragging = false;
        lastDragX = null;
        lastDragY = null;
    });

    window.addEventListener('touchstart', (e) => {
        if (isElementInUI(e.target)) return;
        if (e.cancelable) {
            e.preventDefault();
        }
        isDragging = true;
        // 先にヒット判定してから音声解除（初回タップの泡反応を優先）
        if (e.touches.length > 0) {
            const touch = e.touches[0];
            lastDragX = touch.clientX;
            lastDragY = touch.clientY;
            handleInteraction(touch.clientX, touch.clientY);
        }
        initAudio();
    }, { passive: false });

    window.addEventListener('touchend', () => {
        isDragging = false;
        lastDragX = null;
        lastDragY = null;
    });

    window.addEventListener('touchcancel', () => {
        isDragging = false;
        lastDragX = null;
        lastDragY = null;
    });

    // 2本指以上のマルチタッチ（ピンチズーム）を防止
    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            if (e.cancelable) {
                e.preventDefault();
            }
        }
    }, { passive: false });
}

function resizeShowerCanvas() {
    if (!showerCanvas) return;
    const nextW = window.innerWidth;
    const nextH = window.innerHeight;
    // iOSのツールバー伸縮などで毎フレームリサイズすると操作不能になるため、実変化時のみ
    const sizeChanged = Math.abs(nextW - viewW) > 8 || Math.abs(nextH - viewH) > 8 || viewW === 0;
    if (!sizeChanged && showerCtx) return;

    viewW = nextW;
    viewH = nextH;
    // モバイルは描画負荷を抑えつつRetinaのぼやけを緩和（上限1.5）
    canvasDpr = Math.min(window.devicePixelRatio || 1, IS_MOBILE ? 1.5 : 2);
    showerCanvas.style.width = viewW + 'px';
    showerCanvas.style.height = viewH + 'px';
    showerCanvas.width = Math.max(1, Math.round(viewW * canvasDpr));
    showerCanvas.height = Math.max(1, Math.round(viewH * canvasDpr));
    if (!showerCtx) {
        showerCtx = showerCanvas.getContext('2d');
    }
    // 以降の描画はCSSピクセル座標で行う
    showerCtx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
    showerCtx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in showerCtx) {
        showerCtx.imageSmoothingQuality = IS_MOBILE ? 'medium' : 'high';
    }
    initStars(); // 画面リサイズ時に星屑を再配置
}

function createShowerParticles(x, y, count, hueBase, isSpecialEvent = false) {
    // 泡が多いとGPUが落ちて操作不能になるため、粒子数を厳しく抑制
    const maxParticles = IS_MOBILE ? 120 : 300;
    if (showerParticles.length > maxParticles) {
        showerParticles.splice(0, showerParticles.length - maxParticles);
    }
    const room = maxParticles - showerParticles.length;
    if (room <= 0) return;
    if (count > room) count = room;
    if (bubbles.length > 20 && !isSpecialEvent) {
        count = Math.max(2, Math.floor(count * 0.55));
    }
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
            // モバイルは重い sparkle/ring を減らして固まりを防ぐ
            if (IS_MOBILE) {
                pType = rand < 0.85 ? 'circle' : 'sparkle';
            } else {
                pType = rand < 0.45 ? 'circle' : (rand < 0.85 ? 'sparkle' : 'ring');
            }
        }
        
        showerParticles.push({
            x: x,
            y: y,
            vx: vx,
            vy: vy,
            size: Math.random() * (isSpecialEvent ? 6.5 : 4.2) + 2.8,
            maxLife: Math.random() * (isSpecialEvent ? 60 : 45) + (isSpecialEvent ? 35 : 20),
            life: 0,
            hue: particleHue,
            // 連鎖煙の視認性は確保しつつ、過剰な負荷は避ける
            alpha: isSpecialEvent
                ? (IS_MOBILE ? 0.58 : 0.68)
                : (IS_MOBILE ? 0.72 : 0.95),
            type: pType,
            angle: Math.random() * Math.PI * 2,
            spin: isSpecialEvent ? (Math.random() - 0.5) * 0.12 : 0,
            gravity: isSpecialEvent ? 0.035 : 0.0,
            friction: isSpecialEvent ? 0.94 : 0.985
        });
    }
}

// 連鎖後の煙: 軽量（円スプライトのみ）かつ見えやすい専用パーティクル
function createChainSmoke(x, y, count, hue) {
    const maxParticles = IS_MOBILE ? 120 : 300;
    if (showerParticles.length > maxParticles) {
        showerParticles.splice(0, showerParticles.length - maxParticles);
    }
    const room = maxParticles - showerParticles.length;
    if (room <= 0) return;
    count = Math.min(count, room, IS_MOBILE ? 28 : 48);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.35 + Math.random() * 1.1;
        showerParticles.push({
            x: x + (Math.random() - 0.5) * 18,
            y: y + (Math.random() - 0.5) * 18,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 0.35,
            size: 3.5 + Math.random() * 5.5,
            maxLife: 40 + Math.random() * 50,
            life: 0,
            hue: (hue + (Math.random() - 0.5) * 18 + 360) % 360,
            alpha: IS_MOBILE ? 0.72 : 0.85,
            type: 'circle',
            angle: 0,
            spin: 0,
            gravity: -0.008,
            friction: 0.97
        });
    }
}

function createShowerRipple(x, y, maxR, speed, hue, alpha) {
    showerRipples.push({
        x: x,
        y: y,
        r: 0,
        maxR: maxR || (165 + Math.random() * 80),
        speed: speed || (2.2 + Math.random() * 1.2),
        alpha: alpha !== undefined ? alpha : 0.8,
        hue: (hue !== undefined && hue !== null) ? hue : 195
    });
}

function updateShower() {
    // ジャイロの傾きを滑らかに補間
    currentGyroX += (targetGyroX - currentGyroX) * 0.1;
    currentGyroY += (targetGyroY - currentGyroY) * 0.1;

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
        let spawnChance = baseChance + comboBonus;
        if (meditationMode) {
            spawnChance *= 1.2; // 瞑想モード時は波紋20%増し
        }

        if (Math.random() < spawnChance) {
            const rx = Math.random() * viewW;
            const ry = Math.random() * viewH;
            
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

    // 星屑パーティクルトレイル（カーソルトレイル）の更新
    for (let i = cursorTrailParticles.length - 1; i >= 0; i--) {
        const p = cursorTrailParticles[i];
        p.life++;
        
        p.vx *= 0.96; // 摩擦
        p.vy *= 0.96;
        p.vy -= 0.04; // わずかに上昇
        
        p.x += p.vx;
        p.y += p.vy;
        
        p.angle += p.spin;
        
        const lifeRatio = p.life / p.maxLife;
        p.alpha = 0.8 * (1.0 - lifeRatio);
        
        if (p.life >= p.maxLife) {
            cursorTrailParticles.splice(i, 1);
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
        "212, 255, 213", // 明るいミントグリーン（発光感、黄緑寄りを5%戻す）
        "48, 220, 100",  // 鮮やかなエメラルドグリーン（黄緑寄りを5%戻す）
        "38, 180, 106"   // 深みのあるミントブルー（黄緑寄りを5%戻す）
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
            const colorChoices = ["212, 255, 213", "48, 220, 100", "38, 180, 106"];
            p.colorBase = colorChoices[Math.floor(Math.random() * colorChoices.length)];
        }

        p.phase += p.phaseSpeed;

        const rx = p.xRatio * viewW;
        const waveInfo = getAuroraWave(rx, globalT, viewW, viewH);

        // 粒子のY座標 (上に向かって透けながら上昇)
        const x = rx * scale;
        const y = (waveInfo.yBase + (1.0 - p.yRatio) * waveInfo.curtainHeight) * scale;

        // 全体をもっと透けたグラデーションにするためのフェード計算
        const fade = Math.pow(1.0 - p.yRatio, 2.0); // 2乗にして上部ほどより早く、かつ滑らかに透明に溶け込ませる
        const twinkle = 0.4 + 0.6 * Math.sin(p.phase);
        // モバイル時は霧状粒子の輝度も抑えるＨ0.6595 → 0.46）
        const auroraParticleAlphaMod = IS_MOBILE ? 0.46 : 0.6595;
        const finalAlpha = p.alpha * fade * twinkle * waveInfo.z * auroraParticleAlphaMod;

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
    if (!showerCtx || !showerCanvas || meditationMode) return;
    auroraTime += 0.0055;

    const scale = 0.25 / 1.2; // ぼかし量を1.2倍にするため、解像度スケールを調整 (約0.2083)
    const offWidth = Math.ceil(viewW * scale);
    const offHeight = Math.ceil(viewH * scale);

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
            const waveInfo = getAuroraWave(rx, globalT, viewW, viewH);
            const oyBase = waveInfo.yBase * scale;
            const ocurtainHeight = waveInfo.curtainHeight * scale;
            const oz = waveInfo.z;

            // 画像の右上のように、太く柔らかい光の柱（Rays）が縦に広がるような質感を作る（細かな縦筋にはならない）
            const rayVal = Math.sin(rx * 0.008 + globalT * 0.30) * Math.cos(rx * 0.003 - globalT * 0.12);
            const curtainRays = 0.70 + 0.30 * Math.abs(rayVal);
            // モバイル時はオーロラカーテンの輝度を抑えて眩しくない表示に（0.02052 → 0.014）
            const baseAuroraAlpha = IS_MOBILE ? 0.014 : 0.02052;
            const midAlpha = baseAuroraAlpha * globalAlphaMod * curtainRays;

            const grad = auroraOffCtx.createLinearGradient(ox, oyBase, ox, oyBase + ocurtainHeight);
            const a = midAlpha * oz;

            // 画像の右上にある本物のオーロラのような、眩しいミントホワイトの発光コアを持つグラデーション
            grad.addColorStop(0.00, "rgba(  0,  20,  10, 0)"); // 最上部：透明
            grad.addColorStop(0.35, "rgba( 14,  80,  35, " + (a * 0.15) + ")"); // 上部フェード（黄緑寄りを5%戻す）
            grad.addColorStop(0.68, "rgba( 20, 175,  85, " + (a * 1.10) + ")"); // エメラルドグリーン（黄緑寄りを5%戻す）
            grad.addColorStop(0.82, "rgba( 32, 235, 118, " + (a * 2.00) + ")"); // マイルドなネオングリーン（黄緑寄りを5%戻す）
            grad.addColorStop(0.85, "rgba(228, 255, 238, " + (a * 2.30) + ")"); // 眩しさを抑えたホワイトコア（黄緑寄りを5%戻す）
            grad.addColorStop(0.88, "rgba( 32, 235, 118, " + (a * 1.80) + ")"); // 下部マイルドグリーン（黄緑寄りを5%戻す）
            grad.addColorStop(0.94, "rgba( 12, 120,  58, " + (a * 0.50) + ")"); // 下部フェード（黄緑寄りを5%戻す）
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
    // オーロラをジャイロの傾きと逆方向に少しずらす (パララックス効果)
    const auroraOffsetX = currentGyroX * -40;
    const auroraOffsetY = currentGyroY * -30;
    showerCtx.drawImage(auroraOffscreen, auroraOffsetX, auroraOffsetY, viewW, viewH);
    showerCtx.restore();
}

function getThemeClearColor(ctx, width, height, alpha) {
    // サイズ・テーマが変わった時だけ再生成（毎フレームのグラデーション生成を廃止）
    if (_bgGradientCache === null || _bgGradientTheme !== currentTheme ||
        _bgGradientW !== width || _bgGradientH !== height) {
        const grad = ctx.createRadialGradient(
            width / 2, height * 0.3, 0,
            width / 2, height * 0.3, Math.max(width, height)
        );
        // alphaを1.0で生成し、後でglobalAlphaで調整する方式に変更
        if (currentTheme === 'aurora') {
            grad.addColorStop(0, 'rgb(6, 25, 23)');
            grad.addColorStop(0.6, 'rgb(3, 8, 11)');
            grad.addColorStop(1, 'rgb(0, 2, 4)');
        } else if (currentTheme === 'starry') {
            grad.addColorStop(0, 'rgb(0, 0, 0)');
            grad.addColorStop(0.6, 'rgb(0, 0, 0)');
            grad.addColorStop(1, 'rgb(0, 0, 0)');
        } else if (currentTheme === 'sakura') {
            grad.addColorStop(0, 'rgb(26, 15, 24)');
            grad.addColorStop(0.6, 'rgb(10, 5, 13)');
            grad.addColorStop(1, 'rgb(3, 1, 6)');
        } else { // ocean / deepsea
            grad.addColorStop(0, 'rgb(11, 21, 40)');
            grad.addColorStop(0.6, 'rgb(5, 8, 17)');
            grad.addColorStop(1, 'rgb(1, 2, 5)');
        }
        _bgGradientCache = grad;
        _bgGradientTheme = currentTheme;
        _bgGradientW = width;
        _bgGradientH = height;
    }
    return _bgGradientCache;
}

function drawShower() {
    if (!showerCtx || !showerCanvas) return;
    
    const now = performance.now();
    const activeCombo = (now - lastPopTime < COMBO_WINDOW) ? comboCount : 0;
    // 負荷時は残像を弱めて画面全体のぼやけを防ぐ（煙はパーティクル側で担保）
    const highLoad = IS_MOBILE && (
        _heavyFrameStreak > 2 ||
        bubbles.length > 26 ||
        showerParticles.length > 70
    );
    const clearAlpha = highLoad
        ? Math.max(0.10, 0.16 - activeCombo * 0.003)
        : (feverActive
            ? Math.max(0.07, 0.11 - activeCombo * 0.003)
            : Math.max(0.08, 0.13 - activeCombo * 0.005));

    // 残像のあるクリア（キャッシュされたグラデーションを使用）
    showerCtx.globalAlpha = clearAlpha;
    showerCtx.fillStyle = getThemeClearColor(showerCtx, viewW, viewH, clearAlpha);
    showerCtx.fillRect(0, 0, viewW, viewH);
    showerCtx.globalAlpha = 1.0;
    
    // 夜空のまたたく星屑を描画
    drawStars();
    
    // フィーバー中のオーロラは負荷時スキップ（低解像度拡大が全体ぼやけの主因）
    if (feverActive && !meditationMode && !highLoad) {
        drawRealAuroraCurtain();
    }
    
    showerCtx.save();
    showerCtx.globalCompositeOperation = 'screen';
    
    // 粒子の描画
    // 負荷時は補間を抑えて輪郭のぼやけを減らす
    const prevSmooth = showerCtx.imageSmoothingEnabled;
    if (highLoad) showerCtx.imageSmoothingEnabled = false;

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
    
    // カーソルトレイル（星屑トレイル）の描画 - 軽量化: グラデーション生成を廃止しスプライト流用
    cursorTrailParticles.forEach(p => {
        const sprite = getParticleSprite(p.hue);
        const size = p.size;
        const dSize = size * 4.0;
        showerCtx.globalAlpha = p.alpha;
        showerCtx.drawImage(sprite, p.x - dSize / 2, p.y - dSize / 2, dSize, dSize);
    });
    
    // グローバルアルファを元に戻す
    showerCtx.globalAlpha = 1.0;
    
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
    
    drawMeteors();
    
    showerCtx.restore();
    
    drawBubbles();
    showerCtx.imageSmoothingEnabled = prevSmooth;
}


// =============================================================
// 流星群エフェクト
// =============================================================

function triggerMeteorShower(originX, originY) {
    playMeteorSound(originX);
    
    const count = 15; // 流れ星の総数
    const duration = 1000; // 1.0秒間かけて順次放出 (より集中して飛び散るように短縮)
    // 指定5色（シルバー: 210, 紫: 262, 青: 213, 緑: 148, 赤: 349）からシルバーを減らし、レッド・ブルーを増量した配色
    const colors = [210, 262, 262, 213, 213, 213, 148, 148, 349, 349, 349];
    
    const x = (originX !== undefined) ? originX : (showerCanvas ? viewW / 2 : 0);
    const y = (originY !== undefined) ? originY : (showerCanvas ? viewH / 2 : 0);
    
    for (let i = 0; i < count; i++) {
        const delayTime = (i / count) * duration + Math.random() * 50;
        setTimeout(() => {
            if (!gameActive) return;
            createMeteor(colors[i % colors.length], x, y);
        }, delayTime);
    }
}

function createMeteor(hue, originX, originY) {
    if (!showerCanvas) return;
    
    const angle = Math.random() * Math.PI * 2;
    const speed = 14 + Math.random() * 12;
    
    const startX = originX + (Math.random() - 0.5) * 20;
    const startY = originY + (Math.random() - 0.5) * 20;
    
    meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed: speed,
        angle: angle,
        length: 100 + Math.random() * 100,
        width: 1.5 + Math.random() * 2.0,
        hue: hue,
        alpha: 0,
        fadeSpeed: 0.12,
        targetAlpha: 0.85 + Math.random() * 0.15,
        sparkleChance: 0.5
    });
}

function triggerMeteorBigExplosion(originX, originY) {
    triggerHaptic('explosion');
    // 最初の爆発音
    playMeteorBigExplosionSound(originX);
    // 炭酸バブルサウンドの再生
    playCarbonatedBubbleSound(originX);
    
    const x = (originX !== undefined) ? originX : (showerCanvas ? viewW / 2 : 0);
    const y = (originY !== undefined) ? originY : (showerCanvas ? viewH / 2 : 0);
    
    // 1. メインの巨大大輪花火 (レッドとブルーを主体にし、シルバーを削減)
    createShowerParticles(x, y, 20, 210, true); // シルバー (40 -> 20に減量)
    createShowerParticles(x, y, 50, 349, true); // レッド (30 -> 50に大幅増量)
    createShowerRipple(x, y, 270, 3.2, 349, 0.42); // 特大波紋をシルバーからレッド(349)に変更 (発光量を0.42に微減)
    launchExplosionMeteors(x, y, 50, 60); // 50本の流星
    
    // 2. クライマックスの多重連鎖爆発 (時間差で色彩豊かな大輪が重なり合う)
    
    // 子爆発1: 0.12秒後 (左上にずれた青・紫の花火)
    setTimeout(() => {
        const cx = x - 130 + (Math.random() - 0.5) * 60;
        const cy = y - 90 + (Math.random() - 0.5) * 60;
        playFeverStartSound(cx); // チャイムスイープ音
        createShowerParticles(cx, cy, 20, 262, true); // 紫 (25 -> 20に減量)
        createShowerParticles(cx, cy, 35, 213, true); // 青 (20 -> 35に増量)
        createShowerRipple(cx, cy, 180, 3.8, 213, 0.42); // 波紋を青(213)に変更 (発光量を0.42に微減)
        launchExplosionMeteors(cx, cy, 25, 45);
    }, 120);
    
    // 子爆発2: 0.26秒後 (右上にずれた青・緑の花火)
    setTimeout(() => {
        const cx = x + 140 + (Math.random() - 0.5) * 60;
        const cy = y - 80 + (Math.random() - 0.5) * 60;
        playFeverStartSound(cx);
        createShowerParticles(cx, cy, 20, 148, true); // 緑 (25 -> 20に減量)
        createShowerParticles(cx, cy, 35, 213, true); // 青 (20 -> 35に増量)
        createShowerRipple(cx, cy, 180, 3.8, 213, 0.42); // 波紋を青(213)に変更 (発光量を0.42に微減)
        launchExplosionMeteors(cx, cy, 25, 45);
    }, 260);
    
    // 子爆発3: 0.40秒後 (少し下にずれた赤・紫の花火)
    setTimeout(() => {
        const cx = x - 40 + (Math.random() - 0.5) * 60;
        const cy = y + 100 + (Math.random() - 0.5) * 50;
        playFeverStartSound(cx);
        createShowerParticles(cx, cy, 35, 349, true); // 赤 (25 -> 35に増量)
        createShowerParticles(cx, cy, 20, 262, true); // 紫 (20枚維持)
        createShowerRipple(cx, cy, 190, 4.0, 349, 0.42); // 波紋は赤(349) (発光量を0.42に微減)
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
        createShowerRipple(cx, cy, 160, 4.0, 213, 0.42); // 波紋を青(213)に変更 (発光量を0.42に微減)
        launchExplosionMeteors(cx, cy, 20, 40);
    }, 520);
    
    // 最終フィナーレ特大花火: 0.68秒後 (中央上空のマルチカラー錦冠花火 ＋ 再度の大爆発音！)
    setTimeout(() => {
        const cx = x + (Math.random() - 0.5) * 40;
        const cy = y - 120 + (Math.random() - 0.5) * 40;
        playMeteorBigExplosionSound(cx); // 2回目の大爆発音でクライマックスの轟音を再現！
        createShowerParticles(cx, cy, 100, 'multi', true); // 豪華マルチカラー星屑 (重み付け適用で赤・青増量)
        createShowerRipple(cx, cy, 310, 4.5, 213, 0.42); // 特大の波紋をシルバーからブルー(213)に変更してシルバーの支配度を低下 (発光量を0.42に微減)
        createShowerRipple(cx, cy, 225, 5.2, 262, 0.42); // 中サイズ波紋: 紫 (発光量を0.42に微減)
        createShowerRipple(cx, cy, 170, 6.0, 210, 0.42); // 小サイズ波紋をシルバー(210)に設定 (発光量を0.42に微減)
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
    const speed = 25 + Math.random() * 25;
    
    const startX = originX + (Math.random() - 0.5) * 15;
    const startY = originY + (Math.random() - 0.5) * 15;
    
    meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed: speed,
        angle: angle,
        length: 70 + Math.random() * 80,
        width: 2.0 + Math.random() * 2.5,
        hue: hue,
        alpha: 0,
        fadeSpeed: 0.45,
        // モバイル時は大爆発流星の最大輝度を抑えて眩しくしない（0.623 → 0.44）
        targetAlpha: (0.9 + Math.random() * 0.1) * (IS_MOBILE ? 0.44 : 0.623),
        sparkleChance: 0.8,
        life: 0,
        maxLife: 8 + Math.random() * 8
    });
}

// バックグラウンドで流れる自然な流れ星の生成（60秒に1回）
function spawnBackgroundShootingStar() {
    if (!showerCanvas) return;
    
    // 画面左上〜中央上部から発生し、右下方向へ流れる
    const startFromLeft = Math.random() < 0.5;
    let startX, startY;
    
    if (startFromLeft) {
        // 左端からスタート（上半分）
        startX = -100;
        startY = Math.random() * viewH * 0.45;
    } else {
        // 上端からスタート（左半分）
        startX = Math.random() * viewW * 0.55;
        startY = -100;
    }
    
    // 右下への角度（約 20度 〜 45度）
    const angle = (18 + Math.random() * 22) * Math.PI / 180;
    const speed = 14 + Math.random() * 6; // 14〜20px/フレーム（自然な高速感と視認性を両立）
    
    meteors.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        speed: speed,
        angle: angle,
        length: 120 + Math.random() * 80, // 目で追いやすいように尾の長さを少し延長（120〜200px）
        width: 1.0 + Math.random() * 0.8,  // 線が細すぎて消えないよう少し太さを調整（1.0〜1.8px）
        hue: 0, 
        alpha: 0,
        fadeSpeed: 0.18, 
        targetAlpha: 0.52 + Math.random() * 0.22, // 視認できるよう不透明度を50%〜74%程度に引き上げ
        sparkleChance: 0, 
        maxLife: 20 + Math.random() * 15, // 画面内を心地よく流れる適度な寿命（20〜35フレーム：約0.33〜0.6秒）
        life: 0,
        isBackground: true
    });
}

function updateMeteors() {
    // ランダムな間隔（平均25秒周期：10秒〜40秒の間）で自然な流れ星を流す
    const now = Date.now();
    if (now - lastShootingStarTime >= nextShootingStarDelay) {
        spawnBackgroundShootingStar();
        lastShootingStarTime = now;
        // 次回のディレイを10秒〜40秒 of ランダムな範囲（平均25秒：50秒に約2回ペース）に再設定
        let delay = 10000 + Math.random() * 30000;
        if (meditationMode) {
            delay /= 1.2; // 瞑想モード時はディレイを短縮して流れ星20%増しにする
        }
        nextShootingStarDelay = delay;
    }

    // 既存 of 流星はゲーム終了後も画面外に消えるまで更新を続ける
    
    for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        
        m.x += m.vx;
        m.y += m.vy;
        
        if (m.maxLife !== undefined) {
            m.life++;
            if (m.life > m.maxLife * 0.6) {
                m.alpha = m.targetAlpha * (1 - (m.life - m.maxLife * 0.6) / (m.maxLife * 0.4));
            } else if (m.alpha < m.targetAlpha) {
                m.alpha = Math.min(m.targetAlpha, m.alpha + m.fadeSpeed);
            }
            
            if (m.life >= m.maxLife) {
                meteors.splice(i, 1);
                continue;
            }
        } else {
            if (m.alpha < m.targetAlpha) {
                m.alpha = Math.min(m.targetAlpha, m.alpha + m.fadeSpeed);
            }
        }
        
        // 軌道上にきらめき粒子を発生
        if (Math.random() < m.sparkleChance) {
            createShowerParticles(
                m.x - m.vx * 0.2,
                m.y - m.vy * 0.2,
                1,
                m.hue,
                m.maxLife !== undefined // 大爆発流星の時はisSpecialEventをtrueにして発光量0.9xを適用
            );
        }
        
        if (showerCanvas && (
            m.x < -m.length || 
            m.x > viewW + m.length || 
            m.y < -m.length || 
            m.y > viewH + m.length
        )) {
            meteors.splice(i, 1);
        }
    }
}

function drawMeteors() {
    if (!showerCtx || meteors.length === 0) return;
    
    meteors.forEach(m => {
        const tailX = m.x - m.vx * (m.length / m.speed);
        const tailY = m.y - m.vy * (m.length / m.speed);
        
        let grad, glowGrad;
        
        if (m.isBackground) {
            // 自然な流れ星のグラデーション（ほぼ純白〜微かに淡い青白にフェード）
            grad = showerCtx.createLinearGradient(m.x, m.y, tailX, tailY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
            grad.addColorStop(0.3, `rgba(242, 246, 255, ${m.alpha * 0.85})`); // 透明度を少し引き上げ
            grad.addColorStop(1, `rgba(255, 255, 255, 0)`);
            
            // 周囲のグロー（光背）も視認できるように少し強調
            glowGrad = showerCtx.createLinearGradient(m.x, m.y, tailX, tailY);
            glowGrad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha * 0.22})`);
            glowGrad.addColorStop(0.5, `rgba(240, 245, 255, 0)`);
        } else {
            grad = showerCtx.createLinearGradient(m.x, m.y, tailX, tailY);
            grad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha})`);
            grad.addColorStop(0.2, `hsla(${m.hue}, 95%, 82%, ${m.alpha})`);
            grad.addColorStop(0.5, `hsla(${m.hue}, 90%, 65%, ${m.alpha * 0.6})`);
            grad.addColorStop(1, `hsla(${m.hue}, 90%, 50%, 0)`);
            
            glowGrad = showerCtx.createLinearGradient(m.x, m.y, tailX, tailY);
            glowGrad.addColorStop(0, `rgba(255, 255, 255, ${m.alpha * 0.3})`);
            glowGrad.addColorStop(0.2, `hsla(${m.hue}, 95%, 82%, ${m.alpha * 0.3})`);
            glowGrad.addColorStop(0.5, `hsla(${m.hue}, 90%, 65%, ${m.alpha * 0.18})`);
            glowGrad.addColorStop(1, `hsla(${m.hue}, 90%, 50%, 0)`);
        }
        
        showerCtx.save();
        showerCtx.lineCap = 'round';
        
        // グロー線
        showerCtx.strokeStyle = glowGrad;
        showerCtx.lineWidth = m.isBackground ? m.width * 1.5 : m.width * 2.5;
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
// 3. 泡のシステム
// =============================================================

// iOS: resume完了前に startAmbientSound が呼ばれると無音のまま残ることがある
let pendingAmbientStart = false;
let audioResumePromise = null;

// Audio が running になったときにアンビエントを確実に開始する
function ensureAmbientAfterUnlock() {
    if (!gameActive || !audioCtx || audioCtx.state !== 'running') return;
    pendingAmbientStart = false;
    if (ambientOscs.length === 0) {
        startAmbientSound();
    }
}

// AudioContextの初期化（ユーザー操作時に都度呼び出し）
// options.resume === false のときは Context 生成のみ（ページロード時など、ジェスチャ外での resume を避ける）
function initAudio(options) {
    const allowResume = !options || options.resume !== false;
    try {
        // すでに再生中なら重い解除処理を繰り返さない（毎タップの Audio 生成で iOS が固まる対策）
        if (audioCtx && audioCtx.state === 'running') {
            scheduleCarbonatedPregen();
            if (gameActive || pendingAmbientStart) {
                ensureAmbientAfterUnlock();
            }
            return Promise.resolve();
        }

        // ★Chrome (iOS) 対策: ユーザージェスチャ直下で HTML5 Audio を同期再生しスピーカーを開放
        if (allowResume) {
            try {
                const audio = new Audio();
                audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAARKwAARKwAAAEAAgAZAAAATUFOWQAAAAADAAgAZGF0YQgAAAAAAAAA';
                audio.volume = 0.0001;
                audio.play().catch(() => {});
            } catch (_) {}
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (audioCtx && audioCtx.state === 'closed') {
            audioCtx = null;
            carbonatedBufferCache = null;
            audioResumePromise = null;
        }
        if (!audioCtx && AudioContextClass) {
            audioCtx = new AudioContextClass();
            carbonatedBufferCache = null;
            audioResumePromise = null;
        }

        if (audioCtx) {
            if (!audioCtx._stateChangeListenerAdded) {
                audioCtx._stateChangeListenerAdded = true;
                audioCtx.onstatechange = () => {
                    if (audioCtx && audioCtx.state === 'running') {
                        scheduleCarbonatedPregen();
                        if (gameActive || pendingAmbientStart) {
                            // stop+start の連打は固まりの原因。未開始時のみ開始する
                            ensureAmbientAfterUnlock();
                        }
                    }
                };
            }

            if (audioCtx.state === 'running') {
                scheduleCarbonatedPregen();
                if (gameActive || pendingAmbientStart) {
                    ensureAmbientAfterUnlock();
                }
                return audioResumePromise || Promise.resolve();
            }

            // ジェスチャ外では resume しない（iOS で以後の解除が不安定になることがある）
            if (!allowResume) {
                if (gameActive) pendingAmbientStart = true;
                return Promise.resolve();
            }

            // ロック解除用の無音バッファ（ユーザージェスチャ同期スタック内）
            try {
                const buffer = audioCtx.createBuffer(1, 1, 22050);
                const source = audioCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(audioCtx.destination);
                source.start(0);
            } catch (_) {}

            if (gameActive) pendingAmbientStart = true;

            if (!audioResumePromise) {
                audioResumePromise = audioCtx.resume()
                    .then(() => {
                        audioResumePromise = null;
                        scheduleCarbonatedPregen();
                        if (gameActive || pendingAmbientStart) {
                            ensureAmbientAfterUnlock();
                        }
                    })
                    .catch((err) => {
                        audioResumePromise = null;
                        console.warn("AudioContextのresumeに失敗しました:", err);
                    });
            } else {
                // 進行中の resume 完了後も、今回の開始要求を拾わせる
                audioResumePromise.then(() => {
                    if (gameActive || pendingAmbientStart) {
                        ensureAmbientAfterUnlock();
                    }
                }).catch(() => {});
            }

            return audioResumePromise || Promise.resolve();
        }
    } catch (e) {
        console.warn("Web Audio APIの初期化に失敗しました。無音で動作します:", e);
    }
    return Promise.resolve();
}

// 炭酸バッファ生成は重いので、タップ判定のあとへずらす（iOSの初回タップ取りこぼし防止）
function scheduleCarbonatedPregen() {
    if (carbonatedBufferCache || !audioCtx) return;
    const run = () => {
        try {
            pregenerateCarbonatedBuffer();
        } catch (_) {}
    };
    if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout: 900 });
    } else {
        setTimeout(run, 0);
    }
}

// 泡を一つ生成する
function createBubble(forceType) {
    let limit = feverActive ? FEVER_MAX_BUBBLES : MAX_BUBBLES;
    if (meditationMode) {
        limit = Math.floor(limit / 2);
    }
    if (!showerCanvas || bubbles.length >= limit) return;
    
    const colorInfo = BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)];
    // スマホ（幅600px以下）では画面幅比でサイズをスケールダウン
    const isMobile = window.innerWidth <= 600;
    // スマホ時は0.72倍
    const mobileScale = 0.72;
    const sizeScale = isMobile ? Math.min(1, window.innerWidth / 600) * mobileScale : 1;
    let radius = (22 + Math.random() * 22) * sizeScale; // スマホ: 約16〜32px
    
    let type = 'normal';
    if (forceType) {
        type = forceType;
        if (type === 'silver') {
            radius *= 1.25;
        }
    } else {
        // フィーバー中でなければ、低確率で銀色の泡が発生。フィーバー中は25%の確率で連鎖バブルが発生
        if (meditationMode) {
            // 瞑想モード時は20個に1個（5%）の確率で銀色（白い球）が発生
            if (Math.random() < 0.05) {
                type = 'silver';
                radius *= 1.25;
            }
        } else {
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
        }
    }
    
    // 浮遊速度の決定
    let vy = type === 'silver' ? -(0.25 + Math.random() * 0.35) : -(0.3 + Math.random() * 0.5);
    
    bubbles.push({
        type: type,
        x: radius + Math.random() * (viewW - radius * 2),
        y: viewH + radius + Math.random() * 40,
        radius: radius,
        color: type === 'silver' ? '#e2e8f0' : (type === 'chain' ? '#e8d5db' : colorInfo.hex),
        hue: type === 'silver' ? 210 : (type === 'chain' ? 345 : colorInfo.hue),
        vy: vy,
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
        reservedAt: 0,
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
        
        let limit = feverActive ? FEVER_MAX_BUBBLES : MAX_BUBBLES;
        // オーロラ（フィーバータイム）が出ている間は球の発生率を4倍にする（間隔を1/4に）
        let spawnMin = feverActive ? Math.floor(BUBBLE_SPAWN_MIN / 4) : BUBBLE_SPAWN_MIN;
        let spawnMax = feverActive ? Math.floor(BUBBLE_SPAWN_MAX / 4) : BUBBLE_SPAWN_MAX;
        
        if (meditationMode) {
            limit = Math.floor(limit / 2);
            spawnMin *= 2;
            spawnMax *= 2;
        }
        
        if (timestamp >= nextSpawnTime && bubbles.length < limit) {
            createBubble();
            nextSpawnTime = timestamp + spawnMin + Math.random() * (spawnMax - spawnMin);
        }
    }
    
    // 各泡の更新
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];

        // 連鎖予約のまま残った泡を復帰（無反応タップの原因）
        if (b.reserved && !b.popping && b.reservedAt && (performance.now() - b.reservedAt > 4000)) {
            b.reserved = false;
            b.reservedAt = 0;
        }
        
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
            
            // ピーク時に波紋と粒子を発生（瞑想モード時は刺激を避けるため発生させない）
            if (!b.popTriggered && progress >= 0.3) {
                b.popTriggered = true;
                
                if (!meditationMode) {
                    const rippleSize = 115 + Math.min(comboCount, 12) * 24;
                    const particleCount = 10 + Math.min(comboCount, 12) * 4;
                    const rippleSpeed = 2.8 + Math.min(comboCount, 12) * 0.3;
                    
                    createShowerRipple(b.x, b.y, rippleSize, rippleSpeed, b.hue);
                    createShowerParticles(b.x, b.y, particleCount, b.hue, false);
                }
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
            if (showerCanvas && b.x + b.radius > viewW) {
                b.x = viewW - b.radius;
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
        
        // ジャイロによる視差効果（手前のバブルほど大きく動くパララックス）
        const bOffsetX = currentGyroX * 0.4 * b.radius;
        const bOffsetY = currentGyroY * 0.4 * b.radius;
        
        // 座標系をバブルの中心に移動させ、アスペクト比スケールをかける
        showerCtx.translate(b.x + bOffsetX, b.y + bOffsetY);
        showerCtx.scale(scaleX, scaleY);
        
        // ポップ中はフェードアウト
        const alphaMultiplier = b.popping ? Math.max(0, 1 - (b.popFrame / b.popMaxFrames)) : 1;
        showerCtx.globalAlpha = b.alpha * alphaMultiplier;
        
        if (b.type === 'silver' || b.type === 'normal') {
            const template = getBubbleTemplate(b.type, b.hue, b.color);
            const size = 256 * (drawRadius / 60);
            showerCtx.drawImage(template, -size / 2, -size / 2, size, size);
        } else if (b.type === 'chain') {
            // 連鎖バブルは事前キャッシュされたシルバーテンプレートを流用して軽量描画
            const template = getBubbleTemplate('silver', 210, '#cbd5e1');
            const size = 256 * (drawRadius / 60);
            showerCtx.drawImage(template, -size / 2, -size / 2, size, size);
            
            // 回転リングのみ追加描画（グラデーション生成なし）
            showerCtx.save();
            showerCtx.rotate(b.time * 0.025);
            showerCtx.strokeStyle = 'rgba(226, 232, 240, 0.5)';
            showerCtx.lineWidth = 1.5;
            showerCtx.setLineDash([4, 6]);
            showerCtx.beginPath();
            showerCtx.arc(0, 0, drawRadius * 1.18, 0, Math.PI * 2);
            showerCtx.stroke();
            showerCtx.restore();
        }
        
        showerCtx.restore();
    });
}



const THEME_BUBBLE_COLORS = {
    ocean: [
        { hex: '#81c3d7', hue: 195 },
        { hex: '#f3c68f', hue: 35  },
        { hex: '#c2aff0', hue: 262 },
        { hex: '#96e6b3', hue: 148 },
        { hex: '#f2a3b3', hue: 349 },
        { hex: '#8da9c4', hue: 213 }
    ],
    aurora: [
        { hex: '#38d064', hue: 140 }, // Mint emerald
        { hex: '#96e6b3', hue: 148 }, // Pale green
        { hex: '#38b06a', hue: 150 }, // Deep mint
        { hex: '#81c3d7', hue: 195 }, // Cyan
        { hex: '#c2aff0', hue: 262 }, // Violet
        { hex: '#a7f3d0', hue: 152 }  // Glow emerald
    ],
    starry: [
        { hex: '#ffd700', hue: 45 },  // Gold
        { hex: '#f8fafc', hue: 210 }, // Diamond White
        { hex: '#a5f3fc', hue: 187 }, // Ice Blue
        { hex: '#ffcc80', hue: 35 },  // Pale Amber
        { hex: '#c2aff0', hue: 262 }, // Starry Violet
        { hex: '#cbd5e1', hue: 215 }  // Soft Silver
    ],
    sakura: [
        { hex: '#fbcfe8', hue: 330 }, // Sakura pink
        { hex: '#f472b6', hue: 330 }, // Rose pink
        { hex: '#fecdd3', hue: 350 }, // Peach
        { hex: '#fda4af', hue: 353 }, // Deep peach
        { hex: '#ffffff', hue: 0 },   // Pure white
        { hex: '#e8d5db', hue: 340 }  // Warm grey
    ]
};

function applyTheme(themeName) {
    if (!THEME_BUBBLE_COLORS[themeName]) return;
    currentTheme = themeName;
    
    // Body class
    document.body.classList.remove('theme-aurora', 'theme-starry', 'theme-sakura');
    if (themeName !== 'ocean') {
        document.body.classList.add(`theme-${themeName}`);
    }
    
    // Modify bubble colors in-place
    BUBBLE_COLORS.length = 0;
    THEME_BUBBLE_COLORS[themeName].forEach(color => BUBBLE_COLORS.push(color));
    
    // Base Hues
    if (themeName === 'ocean') {
        showerHue = 200;
    } else if (themeName === 'aurora') {
        showerHue = 145;
    } else if (themeName === 'starry') {
        showerHue = 45;
    } else if (themeName === 'sakura') {
        showerHue = 340;
    }
    
    // Clear caches
    for (let key in bubbleTemplateCache) {
        delete bubbleTemplateCache[key];
    }
    for (let key in particleSpriteCache) {
        delete particleSpriteCache[key];
    }
    // 背景グラデーションキャッシュもリセット
    _bgGradientCache = null;
    
    // Re-init templates and particles
    initBubbleTemplates();
    initParticleSprites();
    initStars();
    initAuroraParticles();
    
    // UI class active
    const themeButtons = document.querySelectorAll('#theme-options .btn-option');
    themeButtons.forEach(btn => {
        if (btn.getAttribute('data-theme') === themeName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

function setNightMode(enabled) {
    const chkNightMode = document.getElementById('chk-night-mode');
    if (chkNightMode) {
        chkNightMode.checked = enabled;
    }
    if (enabled) {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }
}

// ──────────────────────────────────────────────
// 言語モード切り替え
// mode: 'bilingual' | 'ja' | 'en'
// ──────────────────────────────────────────────
function applyLangMode(mode) {
    langMode = mode;

    // body クラスを切り替え
    document.body.classList.remove('lang-ja', 'lang-en', 'lang-bilingual');
    if (mode === 'ja') {
        document.body.classList.add('lang-ja');
    } else if (mode === 'en') {
        document.body.classList.add('lang-en');
    } else {
        document.body.classList.add('lang-bilingual');
    }

    // 設定ボタンのアクティブ状態を更新
    const langBtns = document.querySelectorAll('#lang-options .btn-option');
    langBtns.forEach(btn => {
        if (btn.getAttribute('data-lang') === mode) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // ────────────────────────────────────────────
    // 英語モード専用: テキストが日英混在している
    // 要素を書き換える（CSSで隠せない箇所）
    // ────────────────────────────────────────────
    const langTexts = {
        // [selector, bilingual, ja, en]
        '#btn-quit-active':     ['終了する / Quit', '終了する', 'Quit'],
        '#btn-sound-guide-open': ['🔊 音が鳴らないときは / If there is no sound', '🔊 音が鳴らないときは', '🔊 If there is no sound'],
    };

    Object.entries(langTexts).forEach(([sel, texts]) => {
        if (!texts) return;
        const el = document.querySelector(sel);
        if (!el) return;
        if (mode === 'bilingual') el.textContent = texts[0];
        else if (mode === 'ja')   el.textContent = texts[1];
        else                       el.textContent = texts[2];
    });

    // スタート画面のモードカードの説明テキスト (btn-mode-detail)
    const modeDetails = {
        'btn-play-normal': {
            bilingual: '泡を80個つぶしてゴール ／ 約3〜5分',
            ja:        '泡を80個つぶしてゴール ／ 約3〜5分',
            en:        'Pop 80 bubbles to finish · 3–5 min'
        },
        'btn-play-infinite': {
            bilingual: 'ゴールなく自由に楽しむ ／ 時間無制限',
            ja:        'ゴールなく自由に楽しむ ／ 時間無制限',
            en:        'Play freely without a goal · No time limit'
        },
        'btn-play-meditation': {
            bilingual: '呼吸ガイドに合わせて深くリラックス',
            ja:        '呼吸ガイドに合わせて深くリラックス',
            en:        'Deep relaxation with breath guide'
        }
    };

    Object.entries(modeDetails).forEach(([btnId, texts]) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const detail = btn.querySelector('.btn-mode-detail');
        if (detail) detail.textContent = texts[mode] || texts['bilingual'];
    });

    // スタート画面バッジテキスト
    const badgeNormal = document.querySelector('#mode-card-normal .mode-badge');
    if (badgeNormal) {
        if (mode === 'en') badgeNormal.textContent = '✦ Recommended for beginners';
        else               badgeNormal.textContent = '✦ はじめての方におすすめ';
    }
    const badgeMeditation = document.querySelector('#mode-card-meditation .mode-badge');
    if (badgeMeditation) {
        if (mode === 'en') badgeMeditation.textContent = '✦ Recommended for mental fatigue';
        else               badgeMeditation.textContent = '✦ 脳疲労の強い方におすすめ';
    }

    // how-to-guide の説明テキスト
    const howToDescs = document.querySelectorAll('.how-to-desc');
    const howToDescTexts = [
        { bilingual: '揺れる泡を\nゆっくり眺める', ja: '揺れる泡を\nゆっくり眺める', en: 'Watch the swaying\nbubbles slowly' },
        { bilingual: '気になった泡を\nそっとタップ',   ja: '気になった泡を\nそっとタップ',   en: 'Gently tap a bubble\nthat catches your eye' },
        { bilingual: 'あたまが\nクリアになる',       ja: 'あたまが\nクリアになる',       en: 'Your mind becomes\nclear and refreshed' }
    ];
    howToDescs.forEach((el, i) => {
        if (howToDescTexts[i]) {
            el.textContent = howToDescTexts[i][mode] || howToDescTexts[i]['bilingual'];
        }
    });

    // 呼吸ガイドテキストを即時反映（breathStateを強制リセットして再描画を促す）
    breathState = '';
    
    if (window.updateBreathPatternUI) {
        window.updateBreathPatternUI();
    }

    // ガイドテキスト（ゲーム開始前）の初期表示切り替え
    const guide = document.getElementById('guide-text');
    if (guide && !gameActive) {
        if (mode === 'en') {
            guide.innerHTML = '<span class="en-text">Gently tap while watching the swaying spheres</span>';
        } else if (mode === 'ja') {
            guide.innerHTML = '<span class="ja-text">揺れる球をながめながらゆっくりとタップしてみてください</span>';
        } else {
            guide.innerHTML = '<span class="ja-text">揺れる球をながめながらゆっくりとタップしてみてください</span><br class="lang-divider"><span class="en-text">Gently tap while watching the swaying spheres</span>';
        }
    }
}


function initApp() {
    // 初回起動時はゲームを開始せずスタート画面を表示する
    initShower();
    applyTheme('starry');
    
    // ナイトモードの初期化 (デフォルトはオフ)
    setNightMode(false);
    
    const chkNightMode = document.getElementById('chk-night-mode');
    if (chkNightMode) {
        chkNightMode.addEventListener('change', (e) => {
            setNightMode(e.target.checked);
        });
    }

    // 言語モードの初期化 (デフォルトはBilingual)
    applyLangMode('bilingual');

    const langButtons = document.querySelectorAll('#lang-options .btn-option');
    langButtons.forEach(btn => {
        const setLang = () => {
            const lang = btn.getAttribute('data-lang');
            applyLangMode(lang);
        };
        btn.addEventListener('click', setLang);
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            setLang();
        }, { passive: false });
    });
    
    // 設定関連UIの初期化
    const btnSettings = document.getElementById('btn-settings');
    const settingsPanel = document.getElementById('settings-panel');
    const btnSettingsClose = document.getElementById('btn-settings-close');
    
    if (btnSettings && settingsPanel) {
        btnSettings.addEventListener('click', () => {
            settingsPanel.classList.add('active');
        });
    }
    if (btnSettingsClose && settingsPanel) {
        btnSettingsClose.addEventListener('click', () => {
            settingsPanel.classList.remove('active');
        });
    }

    // 設定パネルのスワイプ閉じ対応（右スワイプで閉じる）
    if (settingsPanel) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchCurrentX = 0;
        let isSwiping = false;
        let ignoreSwipe = false;

        settingsPanel.addEventListener('touchstart', (e) => {
            // 音量スライダーなどの操作時はスワイプ判定を無視する
            if (e.target.closest('input[type="range"]')) {
                ignoreSwipe = true;
                return;
            }
            ignoreSwipe = false;
            
            const touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchCurrentX = touchStartX;
            isSwiping = false;
            
            // ドラッグ中の追従を滑らかにするため一時的にトランジションを無効化
            settingsPanel.style.transition = 'none';
        }, { passive: true });

        settingsPanel.addEventListener('touchmove', (e) => {
            if (ignoreSwipe) return;
            
            const touch = e.touches[0];
            touchCurrentX = touch.clientX;
            const diffX = touchCurrentX - touchStartX;
            const diffY = touch.clientY - touchStartY;
            
            // 右スワイプ方向であり、横の動きが縦スクロールより強い場合のみスワイプと判定
            if (!isSwiping && diffX > 10 && Math.abs(diffX) > Math.abs(diffY)) {
                isSwiping = true;
            }
            
            if (isSwiping) {
                // スワイプ量に合わせてパネルを右にずらす（左方向へのドラッグは防ぐ）
                const translateVal = Math.max(0, diffX);
                settingsPanel.style.transform = `translateX(${translateVal}px)`;
                
                // スワイプ中は背景やパネル自身のスクロール等のデフォルト挙動を防止
                if (e.cancelable) {
                    e.preventDefault();
                }
            }
        }, { passive: false });

        settingsPanel.addEventListener('touchend', () => {
            if (ignoreSwipe) return;
            
            // トランジションを元に戻す
            settingsPanel.style.transition = '';
            
            const diffX = touchCurrentX - touchStartX;
            
            // 100px以上右へスワイプされていたら閉じる
            if (isSwiping && diffX > 100) {
                settingsPanel.classList.remove('active');
            }
            
            // トランスフォームスタイルをクリアして元のCSSクラスのスタイリングに戻す
            settingsPanel.style.transform = '';
            isSwiping = false;
        }, { passive: true });

        settingsPanel.addEventListener('touchcancel', () => {
            settingsPanel.style.transition = '';
            settingsPanel.style.transform = '';
            isSwiping = false;
            ignoreSwipe = false;
        }, { passive: true });
    }
    
    const sliderVolBGM = document.getElementById('slider-vol-bgm');
    const labelVolBGM = document.getElementById('label-vol-bgm');
    if (sliderVolBGM) {
        sliderVolBGM.value = volumeBGM;
        if (labelVolBGM) labelVolBGM.textContent = Math.round(volumeBGM * 100) + '%';
        sliderVolBGM.addEventListener('input', (e) => {
            volumeBGM = parseFloat(e.target.value);
            if (labelVolBGM) labelVolBGM.textContent = Math.round(volumeBGM * 100) + '%';
            if (ambientGain && audioCtx) {
                const now = audioCtx.currentTime;
                ambientGain.gain.setValueAtTime(ambientGain.gain.value, now);
                ambientGain.gain.linearRampToValueAtTime(0.003 * volumeBGM, now + 0.1);
            }
        });
    }

    const sliderVolSolfeggio = document.getElementById('slider-vol-solfeggio');
    const labelVolSolfeggio = document.getElementById('label-vol-solfeggio');
    if (sliderVolSolfeggio) {
        sliderVolSolfeggio.value = volumeSolfeggio;
        if (labelVolSolfeggio) labelVolSolfeggio.textContent = Math.round(volumeSolfeggio * 100) + '%';
        sliderVolSolfeggio.addEventListener('input', (e) => {
            volumeSolfeggio = parseFloat(e.target.value);
            if (labelVolSolfeggio) labelVolSolfeggio.textContent = Math.round(volumeSolfeggio * 100) + '%';
            if (solfeggioGain528 && solfeggioGain396 && audioCtx) {
                const now = audioCtx.currentTime;
                solfeggioGain528.gain.setValueAtTime(solfeggioGain528.gain.value, now);
                solfeggioGain528.gain.linearRampToValueAtTime(0.006 * volumeSolfeggio, now + 0.1);
                
                solfeggioGain396.gain.setValueAtTime(solfeggioGain396.gain.value, now);
                solfeggioGain396.gain.linearRampToValueAtTime(0.009 * volumeSolfeggio, now + 0.1);
            }
        });
    }
    
    const sliderVolSE = document.getElementById('slider-vol-se');
    const labelVolSE = document.getElementById('label-vol-se');
    if (sliderVolSE) {
        sliderVolSE.value = volumeSE;
        if (labelVolSE) labelVolSE.textContent = Math.round(volumeSE * 100) + '%';
        sliderVolSE.addEventListener('input', (e) => {
            volumeSE = parseFloat(e.target.value);
            if (labelVolSE) labelVolSE.textContent = Math.round(volumeSE * 100) + '%';
        });
    }
    
    window.updatePopEffectUI = function(effect) {
        popEffectMode = effect;
        const effectButtons = document.querySelectorAll('#pop-effect-options .btn-option');
        effectButtons.forEach(b => {
            if (b.getAttribute('data-effect') === effect) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
    };
    
    const themeButtons = document.querySelectorAll('#theme-options .btn-option');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.getAttribute('data-theme');
            applyTheme(theme);
        });
    });

    const effectButtons = document.querySelectorAll('#pop-effect-options .btn-option');
    effectButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const effect = btn.getAttribute('data-effect');
            updatePopEffectUI(effect);
        });
    });
    
    const chkGyro = document.getElementById('chk-gyro');
    if (chkGyro) {
        chkGyro.checked = gyroEnabled;
        chkGyro.addEventListener('change', (e) => {
            gyroEnabled = e.target.checked;
            if (!gyroEnabled) {
                targetGyroX = 0;
                targetGyroY = 0;
            } else {
                requestGyroPermission();
            }
        });
    }
    
    const chkHaptic = document.getElementById('chk-haptic');
    if (chkHaptic) {
        chkHaptic.checked = hapticEnabled;
        chkHaptic.addEventListener('change', (e) => {
            hapticEnabled = e.target.checked;
        });
    }
    
    const updateBreathPatternUI = () => {
        const descEl = document.getElementById('breath-pattern-desc');
        const container = document.getElementById('breath-pattern-container');
        if (container) {
            container.style.display = breathGuideEnabled ? '' : 'none';
        }
        
        if (descEl) {
            let desc = '';
            if (langMode === 'en') {
                if (breathPattern === 'coherent') {
                    desc = '<strong>[Coherent Breathing] Inhale 5s / Exhale 5s</strong><br>Synchronizes breath with heart rhythm to balance the autonomic nervous system. The fundamental method for deepest relaxation.';
                } else if (breathPattern === '478') {
                    desc = '<strong>[4-7-8 Method] Inhale 4s / Hold 7s / Exhale 8s</strong><br>Strongly calms the nervous system. Blocks excess thoughts, ideal for relieving anxiety and easing into restful sleep.';
                } else if (breathPattern === 'box') {
                    desc = '<strong>[Box Breathing] Inhale 4s / Hold 4s / Exhale 4s / Hold 4s</strong><br>Releases tension while maintaining clear focus. Resets the nervous system and enhances concentration.';
                }
            } else if (langMode === 'ja') {
                if (breathPattern === 'coherent') {
                    desc = '<strong>【コヒーレント呼吸】吸う5秒 / 吐く5秒</strong><br>心拍と呼吸の周期を同調させ、自律神経のバランスを整えます。最も深いリラクゼーションをもたらす基本の呼吸法です。';
                } else if (breathPattern === '478') {
                    desc = '<strong>【4-7-8呼吸法】吸う4秒 / 止める7秒 / 吐く8秒</strong><br>神経系を強力に鎮静させます。余計な思考を遮断し、強い不安の解消や安眠・睡眠導入に極めて効果的です。';
                } else if (breathPattern === 'box') {
                    desc = '<strong>【ボックス呼吸】吸う4秒 / 止める4秒 / 吐く4秒 / 止める4秒</strong><br>緊張をほぐしながらも、意識をクリアに保ちます。自律神経をリセットし、高い集中力を引き出します。';
                }
            } else {
                // Bilingual
                if (breathPattern === 'coherent') {
                    desc = '<strong>【コヒーレント呼吸】吸う5秒 / 吐く5秒</strong><br>心拍と呼吸の周期を同調させ、自律神経のバランスを整えます。最も深いリラクゼーションをもたらす基本の呼吸法です。<br><span class="en-sub" style="margin-top:4px; display:block; opacity:0.8; font-size: 10px;">[Coherent Breathing] Inhale 5s / Exhale 5s - Synchronizes breath with heart rhythm to balance the autonomic nervous system.</span>';
                } else if (breathPattern === '478') {
                    desc = '<strong>【4-7-8呼吸法】吸う4秒 / 止める7秒 / 吐く8秒</strong><br>神経系を強力に鎮静させます。余計な思考を遮断し、強い不安の解消や安眠・睡眠導入に極めて効果的です。<br><span class="en-sub" style="margin-top:4px; display:block; opacity:0.8; font-size: 10px;">[4-7-8 Method] Inhale 4s / Hold 7s / Exhale 8s - Strongly calms the nervous system and blocks excess thoughts.</span>';
                } else if (breathPattern === 'box') {
                    desc = '<strong>【ボックス呼吸】吸う4秒 / 止める4秒 / 吐く4秒 / 止める4秒</strong><br>緊張をほぐしながらも、意識をクリアに保ちます。自律神経をリセットし、高い集中力を引き出します。<br><span class="en-sub" style="margin-top:4px; display:block; opacity:0.8; font-size: 10px;">[Box Breathing] Inhale 4s / Hold 4s / Exhale 4s / Hold 4s - Releases tension while maintaining clear focus.</span>';
                }
            }
            descEl.innerHTML = desc;
        }
    };
    window.updateBreathPatternUI = updateBreathPatternUI;

    window.updateBreathGuideUI = function(enabled) {
        breathGuideEnabled = enabled;
        const chkBreath = document.getElementById('chk-breath');
        if (chkBreath) {
            chkBreath.checked = enabled;
        }
        const breathGuide = document.getElementById('breath-guide');
        if (breathGuide) {
            if (enabled && gameActive) {
                breathGuide.classList.add('visible');
            } else {
                breathGuide.classList.remove('visible');
            }
        }
        if (typeof updateBreathPatternUI === 'function') {
            updateBreathPatternUI();
        }
    };

    const chkBreath = document.getElementById('chk-breath');
    if (chkBreath) {
        chkBreath.checked = breathGuideEnabled;
        chkBreath.addEventListener('change', (e) => {
            updateBreathGuideUI(e.target.checked);
        });
    }

    const patternButtons = document.querySelectorAll('#breath-pattern-options .btn-option');
    patternButtons.forEach(btn => {
        const setPattern = () => {
            patternButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            breathPattern = btn.getAttribute('data-pattern');
            breathCycleTime = 0; // 切り替え時にサイクルを最初からやり直す
            breathState = ''; // ステート変更を強制トリガー
            updateBreathPatternUI();
        };
        btn.addEventListener('click', setPattern);
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            setPattern();
        }, { passive: false });
    });

    // 初期化時にUIを更新
    updateBreathPatternUI();
    
    // 音が鳴らない場合の案内ダイアログ制御
    const btnSoundGuideOpen = document.getElementById('btn-sound-guide-open');
    const btnSoundGuideClose = document.getElementById('btn-sound-guide-close');
    const soundGuideDialog = document.getElementById('sound-guide-dialog');
    
    if (btnSoundGuideOpen && soundGuideDialog) {
        btnSoundGuideOpen.addEventListener('click', (e) => {
            e.stopPropagation();
            soundGuideDialog.classList.add('active');
        });
    }
    if (btnSoundGuideClose && soundGuideDialog) {
        const closeGuide = () => {
            soundGuideDialog.classList.remove('active');
        };
        btnSoundGuideClose.addEventListener('click', closeGuide);
        btnSoundGuideClose.addEventListener('touchend', (e) => {
            e.preventDefault();
            closeGuide();
        }, { passive: false });
    }

    // ジャイロ許可の確認フロー（唐突な表示を防ぐためのクッションダイアログ）
    const handleGameStartWithGyroCheck = (startCallback) => {
        const needsPermissionPrompt = (
            typeof DeviceOrientationEvent !== 'undefined' && 
            typeof DeviceOrientationEvent.requestPermission === 'function' &&
            gyroEnabled && !gyroActive && !gyroPermissionRequested
        );

        if (needsPermissionPrompt) {
            const dialog = document.getElementById('gyro-confirm-dialog');
            const btnAllow = document.getElementById('btn-gyro-allow');
            const btnDeny = document.getElementById('btn-gyro-deny');
            
            if (dialog && btnAllow && btnDeny) {
                dialog.classList.add('active');
                
                const handleAllow = () => {
                    dialog.classList.remove('active');
                    initAudio(); // 許可タップのジェスチャで音声解除
                    requestGyroPermission();
                    gyroPermissionRequested = true;
                    cleanup();
                    startCallback();
                };
                
                const handleDeny = () => {
                    dialog.classList.remove('active');
                    initAudio(); // 拒否タップのジェスチャでも音声解除
                    gyroEnabled = false;
                    const chkGyro = document.getElementById('chk-gyro');
                    if (chkGyro) chkGyro.checked = false;
                    gyroPermissionRequested = true;
                    cleanup();
                    startCallback();
                };
                
                const onAllowTouch = (e) => {
                    e.preventDefault();
                    handleAllow();
                };
                
                const onDenyTouch = (e) => {
                    e.preventDefault();
                    handleDeny();
                };
                
                const cleanup = () => {
                    btnAllow.removeEventListener('click', handleAllow);
                    btnAllow.removeEventListener('touchend', onAllowTouch);
                    btnDeny.removeEventListener('click', handleDeny);
                    btnDeny.removeEventListener('touchend', onDenyTouch);
                };
                
                btnAllow.addEventListener('click', handleAllow);
                btnAllow.addEventListener('touchend', onAllowTouch, { passive: false });
                btnDeny.addEventListener('click', handleDeny);
                btnDeny.addEventListener('touchend', onDenyTouch, { passive: false });
                return;
            }
        }
        
        // ダイアログ不要（iOS以外、またはすでに選択済みなど）な場合はそのまま開始
        startCallback();
    };

    // モード開始ボタン（Play / Endless / Meditation）
    const bindModeStartButton = (btnId, setupFn) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        const start = () => {
            initAudio(); // 最初のジェスチャで音声解除（ジャイロ確認より先）
            handleGameStartWithGyroCheck(() => {
                initAudio();
                setupFn();
                const startOverlay = document.getElementById('start-overlay');
                if (startOverlay) startOverlay.classList.remove('active');
                startGame();
                Promise.resolve(initAudio()).then(() => ensureAmbientAfterUnlock());
            });
        };
        // touchstart / pointerdown の方が iOS の音声解除に有効
        btn.addEventListener('touchstart', () => { initAudio(); }, { passive: true });
        btn.addEventListener('pointerdown', () => { initAudio(); });
        btn.addEventListener('click', start);
    };

    bindModeStartButton('btn-play-normal', () => {
        meditationMode = false;
        infiniteMode = false;
        if (window.updatePopEffectUI) window.updatePopEffectUI('praise');
        if (window.updateBreathGuideUI) window.updateBreathGuideUI(false);
    });

    bindModeStartButton('btn-play-infinite', () => {
        meditationMode = false;
        infiniteMode = true;
        if (window.updatePopEffectUI) window.updatePopEffectUI('praise');
        if (window.updateBreathGuideUI) window.updateBreathGuideUI(false);
    });

    bindModeStartButton('btn-play-meditation', () => {
        meditationMode = true;
        infiniteMode = true;
        if (window.updatePopEffectUI) window.updatePopEffectUI('none');
        if (window.updateBreathGuideUI) window.updateBreathGuideUI(true);
    });

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
    
    // ページ復帰時: running 状態なら Ambient のみ再開（ジェスチャ外では resume しない）
    const handleVisibilityOrFocus = () => {
        if (gameActive && audioCtx) {
            if (audioCtx.state === 'running' && ambientOscs.length === 0) {
                startAmbientSound();
            }
        }
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            handleVisibilityOrFocus();
        }
    });
    window.addEventListener('focus', handleVisibilityOrFocus);

    // iOS: UIガードに遮られず解除できるよう capture で initAudio
    window.addEventListener('touchstart', initAudio, { capture: true });
    window.addEventListener('mousedown', initAudio, { capture: true });
    window.addEventListener('click', initAudio, { capture: true });
    window.addEventListener('touchend', initAudio, { capture: true });
    
    // iOS Safariでのマルチタッチによるピンチズーム（拡大・縮小操作）をJS側でも強制的に防止
    document.addEventListener('gesturestart', (e) => {
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('gesturechange', (e) => {
        e.preventDefault();
    }, { passive: false });
    document.addEventListener('gestureend', (e) => {
        e.preventDefault();
    }, { passive: false });
    
    // アニメーションループ開始（ゲーム待機中も背景アニメは動かす）
    requestAnimationFrame(mainLoop);

    // AudioContext は事前生成のみ。Play ボタンのジェスチャで resume する
    // （起動時に自動開始すると iOS では最初のタップまで無音・反応が不安定になる）
    initAudio({ resume: false });
}

function endGame(forceQuit = false) {
    // 無限モードかつ強制終了でない場合は何もしない
    // （ゲージのサイクルは incrementPopProgress() が担当するため、ここでのリセットは不要）
    if (infiniteMode && !forceQuit) {
        return;
    }

    gameActive = false;
    
    // クリア効果音の再生
    playClearSound();
    triggerHaptic('success');
    
    // アンビエント音を即座に停止（フェードアウトではなく即時消音）
    stopAmbientSound(true);
    
    // 統計情報の集計と表示
    const timeElapsed = ((performance.now() - gameStartTime) / 1000).toFixed(1);
    
    const reportTime = document.getElementById('report-time');
    if (reportTime) {
        reportTime.textContent = timeElapsed + 's';
    }
    const reportPops = document.getElementById('report-pops');
    if (reportPops) {
        reportPops.textContent = sessionPops;
    }
    const reportCombo = document.getElementById('report-combo');
    if (reportCombo) {
        reportCombo.textContent = maxComboCount;
    }
    
    const reportMsg = document.getElementById('report-msg');
    if (reportMsg) {
        const comments = {
            bilingual: [
                "あたまがサラッとクリアになりました。",
                "圧倒的な集中力とリズムがシンクロし、脳内が気持ちよくリセットされました！",
                "心地よいリズムに乗って、素晴らしいプレイです。心がすっと軽くなっています。",
                "時間を忘れて深くリラックスできたようです。上質な休息時間になりました。",
                "ゆったりとした時間を過ごすことで、脳の緊張が和らぎました。"
            ],
            en: [
                "Your mind feels clear and refreshed.",
                "Incredible focus and rhythm — your mind has been pleasantly reset!",
                "Riding a comfortable rhythm — wonderful play. Your heart feels light and free.",
                "You found deep relaxation, forgetting the time. A quality moment of rest.",
                "Taking it slow eased the tension in your mind."
            ]
        };

        let idx = 0;
        if (maxComboCount >= 70) idx = 1;
        else if (maxComboCount >= 40) idx = 2;
        else if (timeElapsed >= 90) idx = 3;
        else if (timeElapsed >= 40) idx = 4;

        const lang = (langMode === 'en') ? 'en' : 'bilingual';
        reportMsg.textContent = comments[lang][idx];
    }
    
    // リフレッシュ完了画面を表示
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) {
        overlay.classList.add('active');
    }
}

// 泡が弾ける「ピチョン」音を合成して再生（ディレイ・エコー付き）  プチッと弾ける破裂音レイヤー
let _lastPopSoundAt = 0;
let _popSoundBurst = 0;
function playPopSound(combo = 1, originX) {
    if (!audioCtx) {
        initAudio();
        return;
    }
    
    // ブラウザの自動再生ブロック対策（タップジェスチャ内なら解除を再試行）
    if (audioCtx.state !== 'running') {
        initAudio();
        if (audioCtx.state !== 'running') {
            // resume完了後に同じパラメータで1回だけ鳴らす
            const c = combo;
            const x = originX;
            Promise.resolve(audioResumePromise).then(() => {
                if (audioCtx && audioCtx.state === 'running') {
                    playPopSound(c, x);
                }
            }).catch(() => {});
            return;
        }
    }

    // 連鎖などで短時間に大量発火すると iOS が固まるため間引き
    const nowMs = performance.now();
    if (nowMs - _lastPopSoundAt < 45) {
        _popSoundBurst++;
        if (_popSoundBurst > 2) return;
    } else {
        _popSoundBurst = 0;
    }
    _lastPopSoundAt = nowMs;
    
    try {
        const now = audioCtx.currentTime;
        
        // SEボリュームが0なら再生しない
        if (volumeSE <= 0.001) return;
        
        // ベースのゲイン量設定
        const maxVol = 0.28 * volumeSE;
        
        // 美しいペンタトニックスケール (テーマに応じた調整)
        let popScale = [261.63, 311.13, 349.23, 392.00, 466.16]; // C4, Eb4, F4, G4, Bb4
        if (currentTheme === 'sakura') {
            popScale = [293.66, 329.63, 392.00, 440.00, 523.25]; // D4, E4, G4, A4, C5 (A major pentatonic)
        } else if (currentTheme === 'aurora') {
            popScale = [261.63, 293.66, 329.63, 392.00, 440.00]; // C4, D4, E4, G4, A4 (C major pentatonic)
        } else if (currentTheme === 'starry') {
            popScale = [329.63, 392.00, 440.00, 523.25, 587.33]; // E4, G4, A4, C5, D5 (Cosmic scale)
        }
        
        // 画面幅に対してX座標がどの位置にあるかで音程（インデックス）を決める
        const xRatio = (originX !== undefined && showerCanvas) 
            ? Math.max(0, Math.min(0.99, originX / viewW)) 
            : 0.5;
        const scaleIndex = Math.floor(xRatio * popScale.length);
        let baseFreq = popScale[scaleIndex];
        
        // コンボ数が上がると、オクターブが上昇する（4コンボごとに1オクターブ、最大2オクターブまでシフト）
        const octaveShift = Math.floor((combo - 1) / 4);
        baseFreq = baseFreq * Math.pow(2, Math.min(2, octaveShift));
        
        // 各種ノード初期化
        const soundGain = audioCtx.createGain();
        const delay = audioCtx.createDelay();
        const feedback = audioCtx.createGain();
        
        // 左右のパン設定（未対応端末はGainでフォールバック）
        let panner;
        if (typeof audioCtx.createStereoPanner === 'function') {
            panner = audioCtx.createStereoPanner();
            panner.pan.setValueAtTime((xRatio * 2) - 1, now);
        } else {
            panner = audioCtx.createGain();
        }
        panner.connect(audioCtx.destination);
        
        soundGain.connect(panner);
        soundGain.connect(delay);
        
        delay.delayTime.setValueAtTime(0.18, now);
        feedback.gain.setValueAtTime(0.22, now);
        // フィードバックを早めに切ってノード滞留を防ぐ
        feedback.gain.setValueAtTime(0.22, now + 0.2);
        feedback.gain.linearRampToValueAtTime(0, now + 0.4);
        
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(panner);
        
        let duration = 0.08 + Math.min(combo - 1, 5) * 0.006;
        
        soundGain.gain.setValueAtTime(0, now);
        soundGain.gain.linearRampToValueAtTime(maxVol, now + 0.003); // 3msアタック
        
        // --- 1. Water Droplet (メインの水滴音 - サイン波) ---
        const osc = audioCtx.createOscillator();
        osc.connect(soundGain);
        osc.type = 'sine';
        const targetFreq = baseFreq * 2.5; // より伸びやかなピチョン感を出すために2.2から2.5に引き上げ
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(targetFreq, now + duration * 0.85);
        
        soundGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        osc.start(now);
        osc.stop(now + duration + 0.05);

        // --- 1b. Warm Droplet Body (弾力感を持たせるふくよかなボディ音 - 三角波のブレンド) ---
        const oscBody = audioCtx.createOscillator();
        const bodyGain = audioCtx.createGain();
        oscBody.connect(bodyGain).connect(soundGain);
        oscBody.type = 'triangle';
        oscBody.frequency.setValueAtTime(baseFreq, now);
        oscBody.frequency.exponentialRampToValueAtTime(targetFreq * 0.78, now + duration * 0.85);
        
        bodyGain.gain.setValueAtTime(maxVol * 0.22, now); // サイン波ボディに対して22%ブレンドして豊かな丸みを出す
        bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        
        oscBody.start(now);
        oscBody.stop(now + duration + 0.05);
        
        // --- 2. Secondary Drip (跳ね返りの小水滴音 - ステレオ出力) ---
        // メイン音からわずかに遅れて、より高い音程の水滴が弾けることで、本物の水のような「ピチャン」感を引き立てる
        const secOsc = audioCtx.createOscillator();
        const secGain = audioCtx.createGain();
        secOsc.connect(secGain).connect(panner); // 直接パンナーに接続
        secOsc.type = 'sine';
        
        const secStart = now + 0.035; // 35ms遅らせて発音
        const secDuration = duration * 0.6; // 短く弾ける音
        const secBaseFreq = baseFreq * 1.6;
        const secTargetFreq = baseFreq * 3.5;
        
        secOsc.frequency.setValueAtTime(secBaseFreq, secStart);
        secOsc.frequency.exponentialRampToValueAtTime(secTargetFreq, secStart + secDuration * 0.85);
        
        secGain.gain.setValueAtTime(0, now);
        secGain.gain.setValueAtTime(0, secStart);
        secGain.gain.linearRampToValueAtTime(maxVol * 0.45, secStart + 0.002); // メイン音の45%の音量
        secGain.gain.exponentialRampToValueAtTime(0.0001, secStart + secDuration);
        
        secOsc.start(secStart);
        secOsc.stop(secStart + secDuration + 0.05);
        
        // --- 3. Click / Burst (膜がプチッと破れる瞬間の空気の抜け音 - 三角波) ---
        const clickOsc = audioCtx.createOscillator();
        const clickGain = audioCtx.createGain();
        clickOsc.connect(clickGain).connect(panner);
        
        clickOsc.type = 'triangle'; // より柔らかく抜け感のある波形
        const clickFreq = 2200 + Math.min(combo - 1, 8) * 150;
        clickOsc.frequency.setValueAtTime(clickFreq, now);
        // 急激にピッチを下げる（ピッチスイープ）ことで「プチッ」という空気の破裂感を生成
        clickOsc.frequency.exponentialRampToValueAtTime(clickFreq * 0.4, now + 0.012);
        
        clickGain.gain.setValueAtTime(0, now);
        clickGain.gain.linearRampToValueAtTime(0.14 * volumeSE, now + 0.001);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.015);
        
        clickOsc.start(now);
        clickOsc.stop(now + 0.03);

        // --- 4. Splash Fizz (みずみずしさを引き立てる水飛沫ノイズ) ---
        // バンドパスフィルターを通したホワイトノイズを重ねて、弾けた瞬間の微細な水飛沫（シュワッ）をシミュレート
        const noiseBufferSize = audioCtx.sampleRate * 0.04; // 40msのノイズバッファ
        const noiseBuffer = audioCtx.createBuffer(1, noiseBufferSize, audioCtx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBufferSize; i++) {
            noiseData[i] = Math.random() * 2 - 1;
        }
        
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = noiseBuffer;
        
        const noiseFilter = audioCtx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        const noiseFilterFreq = 3400 + Math.min(combo - 1, 8) * 120; // コンボ音程に追従する高周波
        noiseFilter.frequency.setValueAtTime(noiseFilterFreq, now);
        noiseFilter.Q.setValueAtTime(4.0, now); // Q値を少し高めにして金属質で涼しげな響きに
        
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0, now);
        noiseGain.gain.linearRampToValueAtTime(0.035 * volumeSE, now + 0.002);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
        
        noiseSource.connect(noiseFilter).connect(noiseGain).connect(panner);
        noiseSource.start(now);
        noiseSource.stop(now + 0.04);
        
        // クリーンアップ
        setTimeout(() => {
            try {
                osc.disconnect();
                soundGain.disconnect();
                oscBody.disconnect();
                bodyGain.disconnect();
                secOsc.disconnect();
                secGain.disconnect();
                clickOsc.disconnect();
                clickGain.disconnect();
                noiseSource.disconnect();
                noiseFilter.disconnect();
                noiseGain.disconnect();
                panner.disconnect();
                delay.disconnect();
                feedback.disconnect();
            } catch (e) {}
        }, 700);
        
    } catch (e) {
        console.warn("効果音再生エラー:", e);
    }
}


// フィーバー突入・花火連打時のチャイムスイープ音
function playFeverStartSound(originX) {
    if (!audioCtx) return;

    if (audioCtx.state !== 'running') return;
    
    try {
        const now = audioCtx.currentTime;
        const xRatio = (originX !== undefined && showerCanvas) 
            ? Math.max(0, Math.min(0.99, originX / viewW)) 
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
            ? Math.max(0, Math.min(0.99, originX / viewW)) 
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
    if (!audioCtx) return;

    if (audioCtx.state !== 'running') return;
    
    try {
        const now = audioCtx.currentTime;
        const notes = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
        
        notes.forEach((freq, index) => {
            const timeOffset = index * 0.07;
            
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + timeOffset);
            
            const duration = 0.22;
            gain.gain.setValueAtTime(0, now + timeOffset);
            gain.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.002);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + duration); // 謖焚貂幄｡ｰ
            
            const hitOsc = audioCtx.createOscillator();
            const hitGain = audioCtx.createGain();
            
            hitOsc.connect(hitGain);
            hitGain.connect(audioCtx.destination);
            
            hitOsc.type = 'sine';
            hitOsc.frequency.setValueAtTime(freq * 3.0, now + timeOffset);
            
            hitGain.gain.setValueAtTime(0, now + timeOffset);
            hitGain.gain.linearRampToValueAtTime(0.06, now + timeOffset + 0.001);
            hitGain.gain.exponentialRampToValueAtTime(0.0001, now + timeOffset + 0.015);
            
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
        console.warn("クリア音再生エラー:", e);
    }
}

// 流れるようなフロー環境音の開始（フェードイン／コーラス／リバーブ／LFO付き）
function startAmbientSound() {
    if (!gameActive) return; // ゲームがアクティブでない場合は開始しない
    if (!audioCtx) {
        pendingAmbientStart = true;
        return;
    }

    // AudioContextがrunning状態でなければ、解除完了後に開始するよう予約する
    // resume()はユーザージェスチャ内の initAudio() のみが担当する
    if (audioCtx.state !== 'running') {
        pendingAmbientStart = true;
        return;
    }

    pendingAmbientStart = false;
    
    // すでに再生中の場合は何もしない
    if (ambientOscs.length > 0) return;
    
    try {
        const now = audioCtx.currentTime;
        
        ambientFilter = audioCtx.createBiquadFilter();
        ambientFilter.type = 'lowpass';
        ambientFilter.frequency.setValueAtTime(320, now);
        ambientNodes.push(ambientFilter);
        
        ambientLFO = audioCtx.createOscillator();
        ambientLFO.frequency.setValueAtTime(0.04, now);
        const lfoGain = audioCtx.createGain();
        lfoGain.gain.setValueAtTime(100, now);
        
        ambientLFO.connect(lfoGain);
        lfoGain.connect(ambientFilter.frequency);
        ambientLFO.start(now);
        
        ambientOscs.push(ambientLFO);
        ambientNodes.push(lfoGain);
        
        const chorusDelay = audioCtx.createDelay();
        chorusDelay.delayTime.setValueAtTime(0.02, now);
        
        const chorusLFO = audioCtx.createOscillator();
        chorusLFO.frequency.setValueAtTime(0.45, now);
        chorusLFO.frequency.setValueAtTime(0.45, now);
        
        const chorusLFOGain = audioCtx.createGain();
        chorusLFOGain.gain.setValueAtTime(0.0045, now);
        
        chorusLFO.connect(chorusLFOGain);
        chorusLFOGain.connect(chorusDelay.delayTime);
        chorusLFO.start(now);
        
        ambientOscs.push(chorusLFO);
        ambientNodes.push(chorusDelay);
        ambientNodes.push(chorusLFOGain);
        
        const revDelay1 = audioCtx.createDelay();
        const revFeedback1 = audioCtx.createGain();
        const revDelay2 = audioCtx.createDelay();
        const revFeedback2 = audioCtx.createGain();
        
        revDelay1.delayTime.setValueAtTime(0.12, now); // 120ms delay
        revFeedback1.gain.setValueAtTime(0.70, now);
        revDelay2.delayTime.setValueAtTime(0.17, now); // 170ms delay
        revFeedback2.gain.setValueAtTime(0.65, now);
        
        revDelay1.connect(revFeedback1);
        revFeedback1.connect(revDelay1);
        revDelay2.connect(revFeedback2);
        revFeedback2.connect(revDelay2);
        
        const revMix = audioCtx.createGain();
        revMix.gain.setValueAtTime(0.80, now);
        
        ambientNodes.push(revDelay1, revFeedback1, revDelay2, revFeedback2, revMix);
        
        ambientGain = audioCtx.createGain();
        ambientGain.gain.setValueAtTime(0, now);
        ambientGain.gain.linearRampToValueAtTime(0.003, now + 3.5);
        ambientNodes.push(ambientGain);
        
        ambientFilter.connect(ambientGain);
        
        ambientFilter.connect(chorusDelay);
        chorusDelay.connect(ambientGain);
        
        ambientFilter.connect(revDelay1);
        ambientFilter.connect(revDelay2);
        revDelay1.connect(revMix);
        revDelay2.connect(revMix);
        revMix.connect(ambientGain);
        
        ambientGain.connect(audioCtx.destination);
        
        // 5. 浮遊感の極みとなる美しいテンション和音 (C4, G4, B4, D5, G5)
        const freqs = [261.63, 392.00, 493.88, 587.33, 783.99];
        
        freqs.forEach((freq, idx) => {
            const osc = audioCtx.createOscillator();
            osc.type = 'sine'; // 響きをまろやかにするためにサイン波を使用
            
            // わずかにチューンして、コーラスと合わさった極上のシャワー感を作る
            const detuneOffset = (idx % 2 === 0 ? 2 : -2) + (Math.random() - 0.5) * 1; // 約2セント
            osc.detune.setValueAtTime(detuneOffset, now);
            
            osc.frequency.setValueAtTime(freq, now);
            osc.connect(ambientFilter);
            osc.start(now);
            
            ambientOscs.push(osc);
        });

        // --- ソルフェジオ周波数 (528Hz / 396Hz) の追加 ---
        // 528Hz ゲインノード作成と初期フェードイン (528Hzは聴こえやすいため 0.006倍率)
        solfeggioGain528 = audioCtx.createGain();
        solfeggioGain528.gain.setValueAtTime(0, now);
        solfeggioGain528.gain.linearRampToValueAtTime(0.006 * volumeSolfeggio, now + 3.5);
        ambientNodes.push(solfeggioGain528);

        // 396Hz ゲインノード作成と初期フェードイン (396Hzは 0.009倍率でしっかりと)
        solfeggioGain396 = audioCtx.createGain();
        solfeggioGain396.gain.setValueAtTime(0, now);
        solfeggioGain396.gain.linearRampToValueAtTime(0.009 * volumeSolfeggio, now + 3.5);
        ambientNodes.push(solfeggioGain396);

        // ソルフェジオ専用の深リバーブ（ディレイフィードバック）回路の構築
        // 音を空間的にマイルドにするローパスフィルター（高音のキンキン感を和らげる）
        const solfeggioFilter = audioCtx.createBiquadFilter();
        solfeggioFilter.type = 'lowpass';
        solfeggioFilter.frequency.setValueAtTime(650, now); // 650Hz
        ambientNodes.push(solfeggioFilter);

        // 左右のステレオディレイ
        const solfeggioDelayL = audioCtx.createDelay();
        const solfeggioDelayR = audioCtx.createDelay();
        solfeggioDelayL.delayTime.setValueAtTime(0.28, now); // 280ms
        solfeggioDelayR.delayTime.setValueAtTime(0.38, now); // 380ms
        ambientNodes.push(solfeggioDelayL, solfeggioDelayR);

        // フィードバックゲイン (安全な減衰設計: 0.50)
        const solfeggioFeedbackL = audioCtx.createGain();
        const solfeggioFeedbackR = audioCtx.createGain();
        solfeggioFeedbackL.gain.setValueAtTime(0.50, now);
        solfeggioFeedbackR.gain.setValueAtTime(0.50, now);
        ambientNodes.push(solfeggioFeedbackL, solfeggioFeedbackR);

        // 交差フィードバック（ピンポンディレイ効果: 0.20）
        const solfeggioCrossL = audioCtx.createGain();
        const solfeggioCrossR = audioCtx.createGain();
        solfeggioCrossL.gain.setValueAtTime(0.20, now);
        solfeggioCrossR.gain.setValueAtTime(0.20, now);
        ambientNodes.push(solfeggioCrossL, solfeggioCrossR);

        // ソルフェジオ出力ミックスゲイン
        const solfeggioDirectGain = audioCtx.createGain();
        solfeggioDirectGain.gain.setValueAtTime(0.35, now); // 直接音は控えめ
        ambientNodes.push(solfeggioDirectGain);

        const solfeggioRevMix = audioCtx.createGain();
        solfeggioRevMix.gain.setValueAtTime(0.95, now); // リバーブ音を強めにかける (95%)
        ambientNodes.push(solfeggioRevMix);

        // 接続
        // 528Hz と 396Hz のゲインをフィルターへ
        solfeggioGain528.connect(solfeggioFilter);
        solfeggioGain396.connect(solfeggioFilter);

        // 直接音の接続
        solfeggioFilter.connect(solfeggioDirectGain);
        solfeggioDirectGain.connect(audioCtx.destination); // BGM音量に影響されず独立して出力

        // リバーブループ接続
        solfeggioFilter.connect(solfeggioDelayL);
        solfeggioFilter.connect(solfeggioDelayR);

        // Lチャンネルフィードバックループ
        solfeggioDelayL.connect(solfeggioFeedbackL);
        solfeggioFeedbackL.connect(solfeggioDelayL);

        // Rチャンネルフィードバックループ
        solfeggioDelayR.connect(solfeggioFeedbackR);
        solfeggioFeedbackR.connect(solfeggioDelayR);

        // 交差フィードバックループ (立体感を広げる)
        solfeggioDelayL.connect(solfeggioCrossL);
        solfeggioCrossL.connect(solfeggioDelayR);
        solfeggioDelayR.connect(solfeggioCrossR);
        solfeggioCrossR.connect(solfeggioDelayL);

        // リバーブミックス接続
        solfeggioDelayL.connect(solfeggioRevMix);
        solfeggioDelayR.connect(solfeggioRevMix);
        solfeggioRevMix.connect(audioCtx.destination); // 独立出力

        // 528Hz オシレーター (ピュアなサイン波)
        const osc528 = audioCtx.createOscillator();
        osc528.type = 'sine';
        osc528.frequency.setValueAtTime(528, now);
        osc528.connect(solfeggioGain528);
        osc528.start(now);
        solfeggioOscs.push(osc528);

        // 396Hz オシレーター (ピュアなサイン波)
        const osc396 = audioCtx.createOscillator();
        osc396.type = 'sine';
        osc396.frequency.setValueAtTime(396, now);
        osc396.connect(solfeggioGain396);
        osc396.start(now);
        solfeggioOscs.push(osc396);

    } catch (e) {
        console.warn("アンビエント音の開始エラー:", e);
    }
}

// 柔らかな環境背景音の停止（2秒のフェードアウト）
function stopAmbientSound(immediate = false) {
    if (ambientOscs.length === 0 && solfeggioOscs.length === 0) return;
    
    try {
        const now = audioCtx.currentTime;
        const fadeTime = immediate ? 0.05 : 0.5; // 即時なら50ms、通常は0.5秒で素早く消音
        
        if (ambientGain) {
            try {
                ambientGain.gain.cancelScheduledValues(now);
                const currentVal = Math.max(0, Math.min(0.003, ambientGain.gain.value));
                ambientGain.gain.setValueAtTime(currentVal, now);
                ambientGain.gain.linearRampToValueAtTime(0, now + fadeTime);
            } catch (err) {
                ambientGain.gain.setValueAtTime(0, now);
            }
        }

        if (solfeggioGain528) {
            try {
                solfeggioGain528.gain.cancelScheduledValues(now);
                const currentVal = Math.max(0, Math.min(0.015, solfeggioGain528.gain.value));
                solfeggioGain528.gain.setValueAtTime(currentVal, now);
                solfeggioGain528.gain.linearRampToValueAtTime(0, now + fadeTime);
            } catch (err) {
                solfeggioGain528.gain.setValueAtTime(0, now);
            }
        }

        if (solfeggioGain396) {
            try {
                solfeggioGain396.gain.cancelScheduledValues(now);
                const currentVal = Math.max(0, Math.min(0.015, solfeggioGain396.gain.value));
                solfeggioGain396.gain.setValueAtTime(currentVal, now);
                solfeggioGain396.gain.linearRampToValueAtTime(0, now + fadeTime);
            } catch (err) {
                solfeggioGain396.gain.setValueAtTime(0, now);
            }
        }
        
        const currentOscs = [...ambientOscs];
        const currentNodes = [...ambientNodes];
        const currentSolfeggioOscs = [...solfeggioOscs];
        
        ambientOscs = [];
        ambientNodes = [];
        solfeggioOscs = [];
        solfeggioGain528 = null;
        solfeggioGain396 = null;
        
        setTimeout(() => {
            // オシレーターの完全停止と接続解除
            currentOscs.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (e) {}
            });
            // ソルフェジオオシレーターの完全停止と接続解除
            currentSolfeggioOscs.forEach(osc => {
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
    if (!audioCtx) return;

    if (audioCtx.state !== 'running') return;
    
    try {
        const now = audioCtx.currentTime;
        
        // 発生元のX座標から基準定位（パン）を計算（画面の左端＝-1.0、右端＝+1.0）
        const basePan = (originX !== undefined && showerCanvas) 
            ? Math.max(-1.0, Math.min(1.0, (originX / viewW) * 2 - 1)) 
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
    if (!audioCtx) return;

    if (audioCtx.state !== 'running') return;
    
    try {
        const now = audioCtx.currentTime;
        
        // 発生元のX座標から基準定位（パン）を計算（画面の左端＝-1.0、右端＝+1.0）
        const basePan = (originX !== undefined && showerCanvas) 
            ? Math.max(-1.0, Math.min(1.0, (originX / viewW) * 2 - 1)) 
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
    if (!audioCtx) return;

    if (audioCtx.state !== 'running') return;

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
            ? Math.max(-1.0, Math.min(1.0, (originX / viewW) * 2 - 1)) 
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
    try {
        // フレームレート制限（モバイルは30fps、PCは60fps）
        const elapsed = timestamp - _lastFrameTime;
        if (elapsed < FRAME_INTERVAL) {
            requestAnimationFrame(mainLoop);
            return;
        }
        _lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
        const frameStart = performance.now();
        
        // iOSのツールバー伸縮で毎フレームリサイズしない（閾値付き）
        if (showerCanvas && (Math.abs(viewW - window.innerWidth) > 8 || Math.abs(viewH - window.innerHeight) > 8)) {
            resizeShowerCanvas();
        }
        
        // バックグラウンドのマインドシャワーの更新と描画（泡もここで描画される）
        updateShower();
        updateBubbles(timestamp);
        updateMeteors();
        updateBreathGuide(timestamp);
        
        drawShower();

        const frameCost = performance.now() - frameStart;
        if (frameCost > FRAME_INTERVAL * 1.35) {
            _heavyFrameStreak = Math.min(30, _heavyFrameStreak + 1);
        } else {
            _heavyFrameStreak = Math.max(0, _heavyFrameStreak - 1);
        }
    } catch (err) {
        console.warn('mainLoop error:', err);
    }
    requestAnimationFrame(mainLoop);
}

// リフレッシュゲージの進行管理（通常プレイ・エンドレスプレイの両方に対応）
function incrementPopProgress() {
    totalPops++;
    sessionPops++;
    if (infiniteMode && totalPops >= REFRESH_TARGET) {
        // 無限モード時の満タンイベント：
        // ゲージを一瞬100%にしてから、お祝いの音を鳴らしてリセットする
        refreshProgress = 1;
        updateRefreshGauge();
        
        playClearSound();
        triggerHaptic('success');
        
        totalPops = 0;
        setTimeout(() => {
            if (gameActive && infiniteMode) {
                refreshProgress = Math.min(1, totalPops / REFRESH_TARGET);
                updateRefreshGauge();
            }
        }, 1000);
    } else {
        refreshProgress = Math.min(1, totalPops / REFRESH_TARGET);
        updateRefreshGauge();
    }
}

// 連鎖バブルがタップされた際に、周囲の泡を巻き込んで連鎖爆発させる
function triggerChainReaction(parentBubble) {
    if (!parentBubble) return;

    const chainRadius = 500; // 連鎖する判定半径（500px）
    const nowReserve = performance.now();

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
            b.reservedAt = nowReserve;
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
            if (!gameActive) {
                b.reserved = false;
                b.reservedAt = 0;
                return;
            }
            // ユーザーが先にタップして破裂済みなら二重処理しない
            if (b.popping || b.popTriggered) {
                b.reserved = false;
                b.reservedAt = 0;
                return;
            }

            b.reserved = false;
            b.reservedAt = 0;
            // 時間差の番が来たらポップアニメーションを開始する
            b.popping = true;

            // 巻き込まれたバブルのポップトリガー処理
            if (!b.popTriggered) {
                b.popTriggered = true;
                
                // コンボをさらにアップして上昇アルペジオにする
                comboCount++;
                if (comboCount > maxComboCount) {
                    maxComboCount = comboCount;
                }
                
                // ポップ音とエフェクトの再生（連打時は間引き）
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
                const particleCount = IS_MOBILE ? 10 : (14 + Math.min(comboCount, 12) * 3);
                const rippleSpeed = 2.5 + Math.min(comboCount, 12) * 0.25;

                createShowerRipple(b.x, b.y, rippleSize, rippleSpeed, b.hue);
                createChainSmoke(b.x, b.y, particleCount, b.hue);
                
                // リフレッシュゲージも進行
                incrementPopProgress();
                
                if (comboCount >= 2) {
                    showCombo(comboCount);
                }
                
                if (!infiniteMode && refreshProgress >= 1) {
                    setTimeout(() => {
                        endGame();
                    }, 600);
                }
            }
        }, delayTime);
    });

    // 連鎖バブル中心部にエネルギー放出の追加特殊波紋（半径500pxの白銀波紋）
    createShowerRipple(parentBubble.x, parentBubble.y, 500, 4.2, 210); // 白銀の特大波紋
    createChainSmoke(parentBubble.x, parentBubble.y, IS_MOBILE ? 24 : 40, 210);
}

// 泡をタップしてポップする（ヒット判定）
function tryPopBubble(clientX, clientY) {
    if (!gameActive) return false;
    
    // 手前（後から描画された）泡から判定
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.popping) continue; // ポップ中のみ除外（連鎖予約中はタップで即ポップ可）
        
        // ジャイロ視差と同じ座標ズレを加味して判定する
        const bOffsetX = currentGyroX * 0.4 * b.radius;
        const bOffsetY = currentGyroY * 0.4 * b.radius;
        const dx = clientX - (b.x + bOffsetX);
        const dy = clientY - (b.y + bOffsetY);
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // 半径の1.55倍＋最小サイズ保証（スマホではさらに余裕を持たせる）
        const minHit = IS_MOBILE ? 44 : 32;
        const hitRadius = Math.max(b.radius * (IS_MOBILE ? 1.55 : 1.4), minHit);
        if (dist <= hitRadius) {
            // 連鎖予約中の泡をタップしたら予約を解除して即ポップ
            b.reserved = false;
            b.reservedAt = 0;
            b.popping = true;
            
            // 瞑想モード時の静かなタップ処理
            if (meditationMode) {
                playPopSound(1, b.x); // 音階上昇させずに基本音階で穏やかに鳴らす
                triggerHaptic('light');
                
                // ガイドテキストを消す（初回タップ後）
                if (!guideHidden) {
                    guideHidden = true;
                    const guide = document.getElementById('guide-text');
                    if (guide) {
                        guide.style.opacity = '0';
                    }
                }
                return true;
            }
            
            // コンボ管理
            const now = performance.now();
            if (now - lastPopTime < COMBO_WINDOW) {
                comboCount++;
            } else {
                comboCount = 1;
            }
            lastPopTime = now;
            if (comboCount > maxComboCount) {
                maxComboCount = comboCount;
            }
            
            // 特殊泡またはフィーバーに応じた効果音再生
            if (b.type === 'silver') {
                feverActive = true;
                feverEndTime = now + 8000; // フィーバータイムは8秒間
                playFeverStartSound(b.x);
                playCarbonatedBubbleSound(b.x);
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
                let hasConsecutiveSame = false;
                for (let j = 0; j < 9; j++) {
                    if (popColorHistory[j] === popColorHistory[j + 1]) {
                        hasConsecutiveSame = true;
                        break;
                    }
                }
                
                if (!hasConsecutiveSame) {
                    const first5 = popColorHistory.slice(0, 5);
                    const last5 = popColorHistory.slice(5, 10);
                    
                    const first5Unique = new Set(first5).size === 5;
                    const last5Unique = new Set(last5).size === 5;
                    
                    if (first5Unique && last5Unique) {
                        triggerMeteorBigExplosion(b.x, b.y);
                        popColorHistory = [];
                        tappedColorHistory = [];
                    }
                }
            }
            
            incrementPopProgress();
            
            if (comboCount >= 2) {
                showCombo(comboCount);
            }
            
            if (!guideHidden) {
                guideHidden = true;
                const guide = document.getElementById('guide-text');
                if (guide) {
                    guide.style.opacity = '0';
                }
            }
            
            if (!infiniteMode && refreshProgress >= 1) {
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
// 4. UI更新
// =============================================================

// 褒める言葉の定義（日本語＋英語）
const COMBO_PRAISES = [
    { jp: "スッキリ!", en: "Clear" },
    { jp: "快感!", en: "Pleasure!" },
    { jp: "気持ちいい!", en: "Feels great" },
    { jp: "そっと!", en: "Softly" },
    { jp: "やさしい!", en: "Gentle" },
    { jp: "とろける!", en: "Melt away" },
    { jp: "落ちつく!", en: "Calming" },
    { jp: "爽快!", en: "Refreshing" },
    { jp: "癒やされる!", en: "Feeling healed" }
];

const SPECIAL_PRAISES = [
    { jp: "あたまスッキリ!", en: "Clear mind" },
    { jp: "超リフレッシュ!", en: "Mind and body feeling lighter" },
    { jp: "ホッと一息!", en: "Take a breath!" },
    { jp: "心地よい広がり!", en: "Soothing spread" },
    { jp: "超リラックス!", en: "Ultimate relaxation" }
];

const RESET_WORDS = [
    { jp: "そよ風", en: "breeze" },
    { jp: "こもれび", en: "sunbeams" },
    { jp: "小川", en: "brook" },
    { jp: "ひだまり", en: "sunny spot" },
    { jp: "ねこ", en: "kitty" },
    { jp: "さくら", en: "cherry blossoms" },
    { jp: "波音", en: "surf waves" },
    { jp: "静寂", en: "silence" },
    { jp: "水滴", en: "waterdrop" },
    { jp: "白い雲", en: "white cloud" },
    { jp: "星屑", en: "stardust" },
    { jp: "ことり", en: "little bird" },
    { jp: "落ち葉", en: "fallen leaves" },
    { jp: "雪の結晶", en: "snow crystal" },
    { jp: "せせらぎ", en: "stream murmur" }
];

const ABSTRACT_PATTERNS = [
    "✦", "✧", "❈", "❊", "❃", "✿", "❂", "❀", "❉", "❋"
];

let lastPraiseIdx = -1;
let lastSpecialPraiseIdx = -1;

// コンボ数に応じて褒める言葉（日本語＋英語）または記号・やわらかコメントを画面中央に表示
function showCombo(count) {
    if (meditationMode) return;
    const el = document.getElementById('combo-display');
    if (!el) return;
    
    if (popEffectMode === 'none') {
        el.classList.remove('show');
        return;
    }
    
    let praise = null;
    let isSpecial = (count % 10 === 0);
    
    if (popEffectMode === 'praise') {
        if (isSpecial) {
            let idx;
            do {
                idx = Math.floor(Math.random() * SPECIAL_PRAISES.length);
            } while (idx === lastSpecialPraiseIdx && SPECIAL_PRAISES.length > 1);
            
            lastSpecialPraiseIdx = idx;
            praise = SPECIAL_PRAISES[idx];
            el.classList.add('special');
        } else {
            let idx;
            do {
                idx = Math.floor(Math.random() * COMBO_PRAISES.length);
            } while (idx === lastPraiseIdx && COMBO_PRAISES.length > 1);
            
            lastPraiseIdx = idx;
            praise = COMBO_PRAISES[idx];
            el.classList.remove('special');
        }
    } else if (popEffectMode === 'reset') {
        let idx;
        do {
            idx = Math.floor(Math.random() * RESET_WORDS.length);
        } while (idx === lastPraiseIdx && RESET_WORDS.length > 1);
        
        lastPraiseIdx = idx;
        praise = RESET_WORDS[idx];
        if (isSpecial) {
            el.classList.add('special');
        } else {
            el.classList.remove('special');
        }
    } else if (popEffectMode === 'pattern') {
        let idx = Math.floor(Math.random() * ABSTRACT_PATTERNS.length);
        const symbol = ABSTRACT_PATTERNS[idx];
        praise = { jp: symbol, en: "" };
        if (isSpecial) {
            el.classList.add('special');
        } else {
            el.classList.remove('special');
        }
    }
    
    // セキュアなDOM APIで組み立て
    el.replaceChildren();
    
    const jpDiv = document.createElement('div');
    jpDiv.className = 'combo-jp';
    if (popEffectMode === 'pattern') {
        jpDiv.classList.add('pattern-symbol');
    }
    jpDiv.textContent = praise.jp;
    el.appendChild(jpDiv);
    
    let enDiv = null;
    if (praise.en) {
        enDiv = document.createElement('div');
        enDiv.className = 'combo-en';
        enDiv.textContent = praise.en;
        el.appendChild(enDiv);
    }
    
    // モバイル画面（幅600px以下）の場合のみ、文字数に応じてフォントサイズを動的に調整する
    if (window.innerWidth <= 600) {
        if (popEffectMode === 'pattern') {
            jpDiv.style.fontSize = '8vw';
        } else {
            const fsJp = Math.min(3.8, 50 / praise.jp.length);
            jpDiv.style.fontSize = fsJp + 'vw';
            if (enDiv) {
                const fsEn = Math.min(2.4, 55 / praise.en.length);
                enDiv.style.fontSize = fsEn + 'vw';
            }
        }
    } else {
        // デスクトップサイズ時はインラインスタイルをクリアしてCSS定義に委ねる
        jpDiv.style.fontSize = '';
        if (enDiv) enDiv.style.fontSize = '';
    }
    
    el.classList.remove('show');
    // リフローを強制してアニメーションを再トリガー
    void el.offsetWidth;
    el.classList.add('show');
}

let lastBreathUpdateTime = 0;
function updateBreathGuide(timestamp) {
    const breathGuide = document.getElementById('breath-guide');
    if (!breathGuide) return;
    
    if (!gameActive || !breathGuideEnabled) {
        breathGuide.classList.remove('visible');
        return;
    }
    
    breathGuide.classList.add('visible');
    
    if (!lastBreathUpdateTime) {
        lastBreathUpdateTime = timestamp;
    }
    const dt = timestamp - lastBreathUpdateTime;
    lastBreathUpdateTime = timestamp;
    
    let cycleDuration = 10000; // デフォルト (coherent)
    if (breathPattern === '478') {
        cycleDuration = 19000;
    } else if (breathPattern === 'box') {
        cycleDuration = 16000;
    }

    breathCycleTime = (breathCycleTime + dt) % cycleDuration;
    
    const ring = document.querySelector('.breath-ring');
    const ringInner = document.querySelector('.breath-ring-inner');
    const textEl = document.getElementById('breath-text');
    
    let scale = 1.0;
    let state = 'inhale';
    let labelJp = '';
    let labelEn = '';
    let progress = 0;
    
    // パターンごとのステートとスケール判定
    if (breathPattern === '478') {
        if (breathCycleTime < 4000) {
            state = 'inhale';
            progress = breathCycleTime / 4000;
            scale = 0.9 + (1.6 - 0.9) * easeInOutQuad(progress);
            labelJp = '息を吸って';
            labelEn = 'Inhale';
        } else if (breathCycleTime < 11000) {
            state = 'hold';
            progress = (breathCycleTime - 4000) / 7000;
            scale = 1.6;
            labelJp = '止めて';
            labelEn = 'Hold';
        } else {
            state = 'exhale';
            progress = (breathCycleTime - 11000) / 8000;
            scale = 1.6 - (1.6 - 0.9) * easeInOutQuad(progress);
            labelJp = '吐いて';
            labelEn = 'Exhale';
        }
    } else if (breathPattern === 'box') {
        if (breathCycleTime < 4000) {
            state = 'inhale';
            progress = breathCycleTime / 4000;
            scale = 0.9 + (1.6 - 0.9) * easeInOutQuad(progress);
            labelJp = '息を吸って';
            labelEn = 'Inhale';
        } else if (breathCycleTime < 8000) {
            state = 'hold'; // 満ちた状態でのキープ
            progress = (breathCycleTime - 4000) / 4000;
            scale = 1.6;
            labelJp = '止めて';
            labelEn = 'Hold';
        } else if (breathCycleTime < 12000) {
            state = 'exhale';
            progress = (breathCycleTime - 8000) / 4000;
            scale = 1.6 - (1.6 - 0.9) * easeInOutQuad(progress);
            labelJp = '吐いて';
            labelEn = 'Exhale';
        } else {
            state = 'hold-empty'; // 空の状態でのキープ
            progress = (breathCycleTime - 12000) / 4000;
            scale = 0.9;
            labelJp = '止めて';
            labelEn = 'Hold';
        }
    } else { // coherent
        if (breathCycleTime < 5000) {
            state = 'inhale';
            progress = breathCycleTime / 5000;
            scale = 0.9 + (1.6 - 0.9) * easeInOutQuad(progress);
            labelJp = '息を吸って';
            labelEn = 'Inhale';
        } else {
            state = 'exhale';
            progress = (breathCycleTime - 5000) / 5000;
            scale = 1.6 - (1.6 - 0.9) * easeInOutQuad(progress);
            labelJp = '吐いて';
            labelEn = 'Exhale';
        }
    }
    
    // Smooth color interpolation between states:
    // Inhale (Teal: 45, 212, 191)
    // Hold (Amber: 251, 191, 36)
    // Exhale (Indigo: 99, 102, 241)
    // Hold-Empty (Purple/Dark Indigo: 139, 92, 246)
    let r = 129, g = 195, b = 215;
    let fill = 0.05;
    let glow = 0.1;
    
    if (state === 'inhale') {
        fill = 0.02 + 0.16 * easeInOutQuad(progress);
        glow = 0.1 + scale * 0.15;
        // 前の状態からTealへの変化
        const startColor = breathPattern === 'box' ? {r: 139, g: 92, b: 246} : {r: 99, g: 102, b: 241};
        r = Math.round(startColor.r + (45 - startColor.r) * progress);
        g = Math.round(startColor.g + (212 - startColor.g) * progress);
        b = Math.round(startColor.b + (191 - startColor.b) * progress);
    } else if (state === 'hold') {
        fill = 0.18;
        glow = 0.35;
        r = 251;
        g = 191;
        b = 36;
    } else if (state === 'exhale') {
        fill = 0.18 - 0.16 * easeInOutQuad(progress);
        glow = 0.05 + scale * 0.2;
        // AmberからIndigoへの変化
        const startColor = (breathPattern === 'coherent') ? {r: 45, g: 212, b: 191} : {r: 251, g: 191, b: 36};
        r = Math.round(startColor.r + (99 - startColor.r) * progress);
        g = Math.round(startColor.g + (102 - startColor.g) * progress);
        b = Math.round(startColor.b + (241 - startColor.b) * progress);
    } else if (state === 'hold-empty') {
        fill = 0.02;
        glow = 0.08;
        // IndigoからPurpleへの変化
        r = Math.round(99 + (139 - 99) * progress);
        g = Math.round(102 + (92 - 102) * progress);
        b = Math.round(241 + (246 - 241) * progress);
    }
    
    if (ring) {
        ring.style.transform = `scale(${scale})`;
        ring.style.setProperty('--breath-color', `${r}, ${g}, ${b}`);
        ring.style.setProperty('--breath-fill', fill);
        ring.style.setProperty('--breath-glow', glow);
        ring.style.boxShadow = `0 0 ${25 + scale * 20}px rgba(${r}, ${g}, ${b}, ${glow})`;
    }
    if (ringInner) {
        ringInner.style.transform = `scale(${scale * 0.95}) rotate(${timestamp * 0.0005}rad)`;
        ringInner.style.borderColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
    }
    if (textEl && breathState !== state) {
        breathState = state;

        // 言語モードに合わせてテキストを構築
        let breathHtml = '';
        if (langMode === 'en') {
            // 英語のみ: en-sub を大きく表示するため span を使わず直接
            breathHtml = `<span class="en-sub">${labelEn}</span>`;
        } else if (langMode === 'ja') {
            // 日本語のみ
            breathHtml = `<span class="ja-only">${labelJp}</span>`;
        } else {
            // Bilingual (デフォルト)
            breathHtml = `<span class="ja-only">${labelJp}</span><br><span class="en-sub">${labelEn}</span>`;
        }
        textEl.innerHTML = breathHtml;

        textEl.style.transition = 'none';
        textEl.style.opacity = '0';
        void textEl.offsetWidth; // reflow
        textEl.style.transition = 'opacity 0.5s ease';
        textEl.style.opacity = '1';
    }
}

function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function updateRefreshGauge() {
    const fill = document.getElementById('refresh-gauge-fill');
    if (fill) {
        fill.style.width = (refreshProgress * 100) + '%';
    }
    
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
// 5. ゲーム開始 / 終了
// =============================================================

function startGame() {
    bubbles = [];
    meteors = [];
    tappedColorHistory = [];
    popColorHistory = [];
    comboCount = 0;
    maxComboCount = 0;
    lastPopTime = 0;
    totalPops = 0;
    sessionPops = 0;
    refreshProgress = 0;
    gameStartTime = performance.now();
    gameActive = true;
    guideHidden = false;
    nextSpawnTime = performance.now() + 400; // 間隔を置いて開始させる
    pendingAmbientStart = true; // resume 完了待ちでも確実に音を開始する
    
    // UI初期化
    updateRefreshGauge();
    
    // プレイモード表示の更新
    const modeBadge = document.getElementById('play-mode-badge');
    if (modeBadge) {
        if (meditationMode) {
            if (langMode === 'en') modeBadge.innerHTML = '🧘 <span>Meditation</span>';
            else if (langMode === 'ja') modeBadge.innerHTML = '🧘 <span>瞑想</span>';
            else modeBadge.innerHTML = '🧘 <span>Meditation / 瞑想</span>';
            modeBadge.className = 'play-mode-badge mode-meditation';
        } else if (infiniteMode) {
            if (langMode === 'en') modeBadge.innerHTML = '∞ <span>Endless</span>';
            else if (langMode === 'ja') modeBadge.innerHTML = '∞ <span>エンドレス</span>';
            else modeBadge.innerHTML = '∞ <span>Endless / エンドレス</span>';
            modeBadge.className = 'play-mode-badge mode-infinite';
        } else {
            if (langMode === 'en') modeBadge.innerHTML = '✦ <span>Play</span>';
            else if (langMode === 'ja') modeBadge.innerHTML = '✦ <span>通常プレイ</span>';
            else modeBadge.innerHTML = '✦ <span>Play / 通常</span>';
            modeBadge.className = 'play-mode-badge mode-normal';
        }
    }
    
    const guide = document.getElementById('guide-text');
    if (guide) {
        guide.style.opacity = '';
        guide.replaceChildren();
        if (meditationMode) {
            if (langMode === 'en') {
                const enSpan = document.createElement("span");
                enSpan.className = "en-text";
                enSpan.textContent = "Slowly breathe in and out with the guide";
                guide.appendChild(enSpan);
            } else if (langMode === 'ja') {
                const jpText = document.createTextNode("ガイドに合わせてゆっくりと呼吸をしてみてください");
                guide.appendChild(jpText);
            } else {
                const jpText = document.createTextNode("ガイドに合わせてゆっくりと呼吸をしてみてください");
                guide.appendChild(jpText);
                const br = document.createElement("br");
                guide.appendChild(br);
                const enSpan = document.createElement("span");
                enSpan.className = "en-text";
                enSpan.textContent = "Slowly breathe in and out with the guide";
                guide.appendChild(enSpan);
            }
        } else {
            if (langMode === 'en') {
                const enSpan = document.createElement("span");
                enSpan.className = "en-text";
                enSpan.textContent = "Gently tap while watching the swaying spheres";
                guide.appendChild(enSpan);
            } else if (langMode === 'ja') {
                const jpText = document.createTextNode("揺れる球をながめながらゆっくりとタップしてみてください");
                guide.appendChild(jpText);
            } else {
                const jpText = document.createTextNode("揺れる球をながめながらゆっくりとタップしてみてください");
                guide.appendChild(jpText);
                const br = document.createElement("br");
                guide.appendChild(br);
                const enSpan = document.createElement("span");
                enSpan.className = "en-text";
                enSpan.textContent = "Gently tap while watching the swaying spheres";
                guide.appendChild(enSpan);
            }
        }
    }

    const refreshGauge = document.getElementById('refresh-gauge');
    if (refreshGauge) {
        if (meditationMode) {
            refreshGauge.style.display = 'none';
        } else {
            refreshGauge.style.display = '';
        }
    }
    
    if (meditationMode) {
        if (window.updateBreathGuideUI) window.updateBreathGuideUI(true);
    } else {
        if (window.updateBreathGuideUI) window.updateBreathGuideUI(breathGuideEnabled);
    }
    


    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
        comboEl.classList.remove('show');
    }
    
    const overlay = document.getElementById('gameover-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
    
    // 最初の柔らかなアンビエント音を開始
    startAmbientSound();

    // 開始直後からタップできるように泡を先出し（スポーン待ちで無反応に見えないようにする）
    if (meditationMode) {
        createBubble('silver');
    } else {
        createBubble();
        createBubble();
        createBubble();
        nextSpawnTime = performance.now() + 350;
    }
}


// iPhone マルチファイル起動失敗検知用（index.html の案内バナーが参照）
window.__BRAIN_REFLEXO_OK = true;

// ページ全体（スタイルシートやレイアウト含む）の読み込み完了後に初期化を実行（レイアウト確定後にサイズ取得するため）
if (document.readyState === 'complete') {
    initApp();
} else {
    window.addEventListener('load', initApp);
}
