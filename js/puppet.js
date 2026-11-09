// 皮影角色模块：使用真实皮影图片（已抠底），手部驱动位置、缩放与造型切换
window.CSP = window.CSP || {};
(function () {
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // opts: { id, fxColor, frames: { IDLE, FIST, PALM, PINCH } }
  function SpritePuppet(opts) {
    var self = this;
    this.id = opts.id;
    this.fxColor = opts.fxColor;
    this.frames = {};
    this.loaded = {};
    Object.keys(opts.frames).forEach(function (pose) {
      var img = new Image();
      img.src = opts.frames[pose];
      self.frames[pose] = img;
      self.loaded[pose] = false;
      img.onload = function () { self.loaded[pose] = true; };
    });
    this.pose = 'IDLE';
    this.cx = null; this.cy = null;   // 影人胸口锚点（缓动）
    this.alpha = 0;
    this.t = Math.random() * 10;
    this.palm = { x: 0, y: 0 };
    this.dir = { x: 0, y: -1 };       // 腕->掌心方向
    this.lean = 0;
    this.sizeFactor = 1;
    this.swing = 0; this.swingV = 0;   // 提杆摆动（钟摆物理）
    this.poseT = 0;                    // 换造型后的弹跳计时
  }

  SpritePuppet.prototype.setPose = function (pose) {
    if (this.frames[pose] && pose !== this.pose) {
      this.pose = pose;
      this.poseT = 0;   // 触发换装弹跳
    }
  };

  // 手消失时缓慢淡出
  SpritePuppet.prototype.fadeOut = function (dt) {
    this.alpha = Math.max(0, this.alpha - dt * 2);
  };

  // pts: 已映射到画布坐标的 21 个关键点
  SpritePuppet.prototype.update = function (pts, dt, W, H) {
    this.t += dt;
    this.poseT += dt;
    var wr = pts[0];
    var palm = { x: 0, y: 0 };
    [0, 5, 9, 13, 17].forEach(function (i) {
      palm.x += pts[i].x / 5; palm.y += pts[i].y / 5;
    });

    // 影人胸口悬在手掌下方，像被操纵杆提着
    var k = Math.min(1, dt * 6);
    var tx = palm.x, ty = palm.y + H * 0.10;
    var prevX = this.cx;
    if (this.cx === null) { this.cx = tx; this.cy = ty; prevX = tx; }
    else {
      this.cx += (tx - this.cx) * k;
      this.cy += (ty - this.cy) * k;
    }
    this.alpha = Math.min(1, this.alpha + dt * 3);
    this.palm = palm;

    // 提杆摆动：影人移动越快，摆动越大，像被杆子甩着走（钟摆+阻尼）
    var vx = (this.cx - prevX) / Math.max(dt, 0.001);
    this.swingV += (-this.swing * 40 - vx * 0.00055) * dt;
    this.swingV *= Math.pow(0.88, dt * 60);
    this.swing = clamp(this.swing + this.swingV * dt, -0.3, 0.3);

    var dx = palm.x - wr.x, dy = palm.y - wr.y;
    var n = Math.hypot(dx, dy) || 1;
    this.dir = { x: dx / n, y: dy / n };

    // 身体随手的位置轻微倾斜 + 呼吸摆动
    var targetLean = clamp((palm.x - this.cx) * 0.0012, -0.12, 0.12);
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 5);

    // 手掌大小决定影人远近
    var hs = Math.hypot(pts[9].x - wr.x, pts[9].y - wr.y);
    this.sizeFactor = clamp(hs / (H * 0.16), 0.8, 1.25);
  };

  SpritePuppet.prototype.draw = function (ctx, W, H) {
    if (this.alpha <= 0 || this.cx === null) return;
    var img = this.frames[this.pose];
    if (!img || !this.loaded[this.pose]) return;

    var targetH = H * 0.68 * this.sizeFactor;
    // 换造型瞬间的弹跳（先放大再回落，让动作更"脆"）
    var pop = 1 + 0.06 * Math.exp(-this.poseT * 10);
    var s = targetH * pop / img.height;
    var w = img.width * s, h = img.height * s;

    // 操纵杆（淡墨，从幕底连到手中）
    ctx.beginPath();
    ctx.moveTo(this.palm.x, H + 10);
    ctx.quadraticCurveTo(
      (this.palm.x + this.cx) / 2 + (this.id === 'L' ? 30 : -30), (H + this.cy) / 2,
      this.palm.x, this.palm.y
    );
    ctx.strokeStyle = 'rgba(46,41,35,0.35)'; ctx.lineWidth = 2; ctx.stroke();

    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.cx, this.cy);
    ctx.rotate(this.lean + this.swing + Math.sin(this.t * 1.2) * 0.012);
    // 纸上投影（像皮影贴在白色影窗上）
    ctx.shadowColor = 'rgba(46,41,35,0.30)';
    ctx.shadowOffsetX = 12; ctx.shadowOffsetY = 8; ctx.shadowBlur = 16;
    // 锚点：胸口（横向 50%、纵向 42% 处）对准 cx, cy
    ctx.drawImage(img, -w * 0.5, -h * 0.42, w, h);
    ctx.restore();
  };

  window.CSP.SpritePuppet = SpritePuppet;
})();
