// 主程序：摄像头接入 -> 手势驱动皮影影人 -> 渲染循环（宣纸白幕风格）
(function () {
  var cv = document.getElementById('stage');
  var ctx = cv.getContext('2d');
  var video = document.getElementById('video');
  var overlay = document.getElementById('overlay');
  var msg = document.getElementById('overlay-msg');
  var statusEl = document.getElementById('status');
  var handTip = document.getElementById('hand-tip');

  var W = 0, H = 0, VW = 1280, VH = 720;
  var latest = null;
  var handleLast = 0, drawLast = 0;
  var fps = 0, fpsT = 0, fpsN = 0;
  var ultCd = 0, crossCd = 0;
  var lastHandSeen = 0;
  var paperGrad = null;

  var fx = new CSP.FX();
  // 左手 = 红衣旦角，右手 = 提灯仕女；九种手势各配专属造型
  var puppetL = new CSP.SpritePuppet({
    id: 'L', fxColor: '#9e3b2c',
    frames: {
      IDLE: 'assets/img/puppet-dan-red-stand.png',
      FIST: 'assets/img/puppet-dan-red-leap.png',
      PALM: 'assets/img/puppet-dan-red-open.png',
      PINCH: 'assets/img/puppet-dan-red-spin.png',
      PEACE: 'assets/img/puppet-dan-red-glance.png',
      HORNS: 'assets/img/puppet-dan-red-reach.png',
      THREE: 'assets/img/puppet-dan-red-sleeve.png',
      THUMB: 'assets/img/puppet-dan-red-pose.png',
      OK: 'assets/img/puppet-dan-red-pose.png'
    }
  });
  var puppetR = new CSP.SpritePuppet({
    id: 'R', fxColor: '#a67c00',
    frames: {
      IDLE: 'assets/img/puppet-lantern-gold-walk.png',
      FIST: 'assets/img/puppet-lantern-gold-front.png',
      PALM: 'assets/img/puppet-lantern-gold-side.png',
      PINCH: 'assets/img/puppet-lantern-gold-chest.png',
      PEACE: 'assets/img/puppet-lantern-gold-front2.png',
      HORNS: 'assets/img/puppet-lantern-gold-lean.png',
      THREE: 'assets/img/puppet-lantern-gold-low.png',
      THUMB: 'assets/img/puppet-lantern-gold-hoist.png',
      OK: 'assets/img/puppet-lantern-gold-front.png'
    }
  });
  var stabL = new CSP.Stab(), stabR = new CSP.Stab();
  var hsL = { prev: 'IDLE', charge: 0 }, hsR = { prev: 'IDLE', charge: 0 };
  var poseL = 'IDLE', poseR = 'IDLE';

  var POSE_ZH = {
    FIST: '斩', PALM: '术', PINCH: '弹',
    PEACE: '书', HORNS: '雷', THREE: '扇', THUMB: '揖', OK: '印', IDLE: '待'
  };

  function resize() {
    W = cv.width = innerWidth;
    H = cv.height = innerHeight;
    // 宣纸底（与甬上四季同款）
    paperGrad = ctx.createLinearGradient(0, 0, 0, H);
    paperGrad.addColorStop(0, '#f5efe4');
    paperGrad.addColorStop(1, '#eee6d7');
  }
  addEventListener('resize', resize);
  resize();

  // ---------- 合成音效（无需音频素材） ----------
  var actx = null;
  function initAudio() {
    if (!actx) {
      try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
    }
  }
  function tone(type, f0, f1, dur, vol) {
    if (!actx) return;
    var t = actx.currentTime;
    var o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  var swish = function () { tone('sawtooth', 300, 2400, 0.18, 0.12); };
  var zap = function () { tone('square', 1200, 120, 0.25, 0.15); };
  var chime = function () {
    tone('sine', 880, 880, 0.3, 0.12);
    setTimeout(function () { tone('sine', 1318, 1318, 0.4, 0.1); }, 90);
  };
  var gong = function () { tone('sine', 90, 55, 2.2, 0.5); tone('triangle', 180, 100, 1.2, 0.2); };
  // 噪声爆发（雷声、风声）
  function noiseBurst(dur, freq, vol) {
    if (!actx) return;
    var t = actx.currentTime;
    var n = Math.floor(actx.sampleRate * dur);
    var buf = actx.createBuffer(1, n, actx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = actx.createBufferSource(); src.buffer = buf;
    var f = actx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(80, t + dur);
    var g = actx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(actx.destination);
    src.start(t);
  }
  var thunder = function () { noiseBurst(1.2, 900, 0.5); };
  var stampSnd = function () { tone('square', 220, 110, 0.18, 0.25); };
  var fanWhoosh = function () { tone('sawtooth', 150, 1800, 0.3, 0.1); noiseBurst(0.3, 2200, 0.08); };
  var bless = function () {
    tone('sine', 660, 660, 0.4, 0.1);
    setTimeout(function () { tone('sine', 990, 990, 0.5, 0.08); }, 120);
  };
  // 锣鼓点：鼓（咚）、镲（锵）、印（闷响）
  var drum = function () { tone('sine', 150, 55, 0.28, 0.5); noiseBurst(0.08, 400, 0.15); };
  var cymbal = function () { noiseBurst(0.35, 6000, 0.22); tone('square', 3000, 2000, 0.1, 0.03); };
  var sealSnd = function () {
    tone('triangle', 330, 330, 0.45, 0.18);
    setTimeout(function () { tone('triangle', 495, 495, 0.5, 0.12); }, 110);
  };

  // ---------- 背景音乐（本地 BGM 素材） ----------
  var bgm = null;
  function startBgm() {
    if (bgm) return;
    bgm = new Audio('assets/audio/bgm.mp3');
    bgm.loop = true;
    bgm.volume = 0.35;
    bgm.play().catch(function () { });
  }
  var bgmBtn = document.getElementById('btn-bgm');
  bgmBtn.addEventListener('click', function () {
    if (!bgm) { startBgm(); bgm.muted = false; }
    else bgm.muted = !bgm.muted;
    bgmBtn.textContent = bgm.muted ? '♫ 音乐·关' : '♫ 音乐·开';
  });

  // ---------- 坐标映射（视频画面 cover 铺满画布 + 镜像） ----------
  function coverMap() {
    var s = Math.max(W / VW, H / VH);
    return { s: s, dx: (W - VW * s) / 2, dy: (H - VH * s) / 2 };
  }

  // ---------- MediaPipe 回调（tasks-vision HandLandmarker） ----------
  // hands: [{ lm: [21个归一化关键点], side: 'L'|'R' }]，side 按画布中手掌位置分配
  function handleHands(hands) {
    var now = performance.now();
    var dt = Math.min(0.05, (now - handleLast) / 1000);
    handleLast = now;

    // 按画布中手掌位置分配左右影人；同侧冲突时把第二只挤到另一侧
    var slots = { L: null, R: null };
    hands.forEach(function (h) {
      var m0 = coverMap();
      var wx = (1 - h.lm[0].x) * VW * m0.s + m0.dx;
      var side = wx < W / 2 ? 'L' : 'R';
      if (side === 'L' && slots.L) side = 'R';
      else if (side === 'R' && slots.R) side = 'L';
      h.side = side;
      slots[side] = h;
    });

    ultCd = Math.max(0, ultCd - dt);
    crossCd = Math.max(0, crossCd - dt);
    poseL = 'IDLE'; poseR = 'IDLE';

    if (hands.length) lastHandSeen = now;

    [
      ['L', slots.L, puppetL, stabL, hsL],
      ['R', slots.R, puppetR, stabR, hsR]
    ].forEach(function (row) {
      var side = row[0], h = row[1], pup = row[2], stab = row[3], st = row[4];
      if (!h) {
        pup.fadeOut(dt);
        if (pup.alpha <= 0) pup.entered = false;   // 完全退场后，下次登场再打锣鼓
        st.prev = 'IDLE'; st.charge = 0;
        fx.setOrb(side, null, 0);
        return;
      }
      var m = coverMap();
      var pts = h.lm.map(function (p) {
        return { x: (1 - p.x) * VW * m.s + m.dx, y: p.y * VH * m.s + m.dy };
      });
      pup.update(pts, dt, W, H);

      var r = stab.push(CSP.classify(h.lm));
      var pose = r.pose;
      pup.setPose(pose);
      if (side === 'L') poseL = pose; else poseR = pose;

      // 影人首次登场：锣鼓点迎接
      if (!pup.entered) {
        pup.entered = true;
        drum(); setTimeout(cymbal, 140);
      }

      // 手势边沿触发
      if (pose !== st.prev) {
        if (pose === 'FIST') {
          fx.slash(pup.palm.x, pup.palm.y, pup.dir, pup.fxColor);
          drum(); swish();
        } else if (pose === 'PALM') {
          fx.cast(pup.palm.x, pup.palm.y, pup.fxColor);
          chime();
        } else if (pose === 'PINCH') {
          st.charge = 0.0001;
        } else if (pose === 'PEACE') {
          fx.stamp(pup.palm.x, pup.palm.y, side === 'L' ? '影' : '灯');
          stampSnd();
        } else if (pose === 'HORNS') {
          fx.boltAt(pup.palm.x, pup.palm.y);
          thunder(); cymbal();
        } else if (pose === 'THREE') {
          fx.wind(pup.palm.x, pup.palm.y, pup.dir);
          drum(); fanWhoosh();
        } else if (pose === 'THUMB') {
          fx.halo(pup.palm.x, pup.palm.y);
          bless();
        } else if (pose === 'OK') {
          fx.seal(pup.palm.x, pup.palm.y, pup.fxColor);
          sealSnd();
        }
        if (st.prev === 'PINCH' && pose !== 'PINCH' && st.charge > 0.15) {
          fx.fire(pup.palm.x, pup.palm.y, pup.dir, pup.fxColor);
          fx.burst(pup.palm.x, pup.palm.y, pup.fxColor, 10, 200);
          zap();
        }
        if (pose !== 'PINCH') st.charge = 0;
        st.prev = pose;
      }

      // 蓄力球跟随拇指尖与食指尖中点
      if (pose === 'PINCH') {
        st.charge += dt;
        fx.setOrb(side, { x: (pts[4].x + pts[8].x) / 2, y: (pts[4].y + pts[8].y) / 2 }, st.charge);
      } else {
        fx.setOrb(side, null, 0);
      }
    });

    // 合璧技：双掌同张
    if (poseL === 'PALM' && poseR === 'PALM' && ultCd <= 0) {
      ultCd = 6;
      fx.ultimate(W, H);
      gong();
    }

    // 隐藏组合：双拳合斩（交叉巨刃）
    if (poseL === 'FIST' && poseR === 'FIST' && crossCd <= 0 && slots.L && slots.R) {
      crossCd = 2.5;
      var p1 = puppetL.palm, p2 = puppetR.palm;
      var mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      var ddx = p2.x - p1.x, ddy = p2.y - p1.y;
      var dn = Math.hypot(ddx, ddy) || 1;
      fx.cross(mx, my, { x: ddx / dn, y: ddy / dn }, '#2e2923');
      swish(); thunder();
    }
  }

  // ---------- 宣纸背景 ----------
  function drawBackdrop() {
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- 渲染循环 ----------
  function draw() {
    var now = performance.now();
    var dt = Math.min(0.05, (now - drawLast) / 1000);
    drawLast = now;
    fpsN++;
    if (now - fpsT > 500) {
      fps = Math.round(fpsN * 1000 / (now - fpsT));
      fpsT = now; fpsN = 0;
    }

    fx.update(dt, W, H);
    drawBackdrop();

    // 右下角摄像头回显（镜像小窗）
    if (camOn && video.readyState >= 2 && video.videoWidth) {
      var pw = Math.round(W * 0.15);
      var ph = Math.round(pw * video.videoHeight / video.videoWidth);
      var px = W - pw - 20, py = H - ph - 20;
      ctx.save();
      ctx.translate(px + pw, py);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, pw, ph);
      ctx.restore();
      ctx.strokeStyle = 'rgba(46,41,35,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px, py, pw, ph);
      ctx.font = '11px Consolas, monospace';
      ctx.fillStyle = 'rgba(46,41,35,0.6)';
      ctx.textAlign = 'right';
      ctx.fillText('CAM', px + pw - 6, py + 16);
    }

    ctx.save();
    if (fx.shake > 0) {
      ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
    }
    puppetL.draw(ctx, W, H);
    puppetR.draw(ctx, W, H);
    fx.draw(ctx);
    ctx.restore();

    // 淡墨闪屏（合璧技）
    if (fx.flash > 0) {
      ctx.globalAlpha = fx.flash * 0.45;
      ctx.fillStyle = '#2e2923';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    statusEl.textContent =
      '左·' + POSE_ZH[poseL] + '  右·' + POSE_ZH[poseR] + '  ·  ' + fps + ' FPS';

    // 丢手提醒：摄像头开着但 1.5 秒没见手，给出中文提示（含暗光场景）
    handTip.classList.toggle('show',
      camOn && now - lastHandSeen > 1500);
  }
  requestAnimationFrame(function loop() { draw(); requestAnimationFrame(loop); });

  // ---------- 开场：本地 MediaPipe + 摄像头 ----------
  var landmarker = null;
  var lastVideoTime = -1;
  var camOn = false;

  function tasksToHands(res) {
    var out = [];
    var lms = res && res.landmarks;
    if (lms) {
      lms.forEach(function (l) {
        if (l && l.length === 21) out.push({ lm: l });
      });
    }
    return out;
  }

  function detectLoop() {
    if (landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      if (video.videoWidth) { VW = video.videoWidth; VH = video.videoHeight; }
      var res;
      try { res = landmarker.detectForVideo(video, performance.now()); } catch (e) { res = null; }
      if (res) handleHands(tasksToHands(res));
    }
    requestAnimationFrame(detectLoop);
  }
  requestAnimationFrame(detectLoop);

  document.getElementById('btn-start').addEventListener('click', function () {
    initAudio();
    startBgm();
    this.disabled = true;
    msg.textContent = '正在加载手势库……';
    var stream;
    var importLib;
    try { importLib = import('../vendor/mediapipe/vision_bundle.mjs'); } catch (e) { importLib = Promise.reject(e); }
    importLib.then(function (lib) {
      if (!lib.FilesetResolver || !lib.HandLandmarker) throw new Error('vision_bundle.mjs 缺少必要导出');
      msg.textContent = '正在加载识别模型……';
      return lib.FilesetResolver.forVisionTasks('vendor/mediapipe/wasm').then(function (fileset) {
        return lib.HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: 'vendor/models/hand_landmarker.task', delegate: 'GPU' },
          runningMode: 'VIDEO',
          numHands: 2
        });
      });
    }).then(function (lm) {
      landmarker = lm;
      msg.textContent = '正在开启摄像头……';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持摄像头访问');
      }
      return navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: false
      });
    }).then(function (s) {
      stream = s;
      video.srcObject = stream;
      return video.play();
    }).then(function () {
      camOn = true;
      overlay.classList.add('hide');
    }).catch(function (e) {
      if (stream) { try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (x) { } }
      // 摄像头报错中文化
      var zhMap = {
        NotAllowedError: '摄像头权限被拒绝——请点击地址栏的摄像头图标，允许访问后重试',
        PermissionDeniedError: '摄像头权限被拒绝——请在浏览器设置中允许摄像头访问',
        NotFoundError: '未找到可用摄像头——请检查设备是否连接',
        NotReadableError: '摄像头被其他程序占用——请关闭占用摄像头的软件后重试',
        OverconstrainedError: '摄像头不支持所选分辨率——请换一台设备试试'
      };
      var name = e && e.name;
      msg.textContent = '启动失败：' + (zhMap[name] || (e && e.message ? e.message : e));
      document.getElementById('btn-start').disabled = false;
    });
  });
})();
