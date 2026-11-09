// 特效模块：粒子、刀光、法环、符文、光弹、闪电、蓄力球、震屏与白闪
window.CSP = window.CSP || {};
(function () {
  var R = Math.random;
  var TAU = Math.PI * 2;
  var RUNES = ['影', '光', '电', '魂', '咒', '雷', '闪', '玄'];

  function Particle(x, y, color, sp) {
    var a = R() * TAU;
    this.x = x; this.y = y;
    this.vx = Math.cos(a) * sp * (0.3 + R());
    this.vy = Math.sin(a) * sp * (0.3 + R());
    this.max = this.life = 0.5 + R() * 0.7;
    this.color = color;
    this.r = 1.5 + R() * 2.5;
  }
  Particle.prototype.update = function (dt) {
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.97; this.vy *= 0.97;
    this.life -= dt;
    return this.life > 0;
  };
  Particle.prototype.draw = function (ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fillStyle = this.color; ctx.fill();
  };

  // 环境浮尘（氛围）
  function Dust(W, H) {
    this.x = R() * W; this.y = H + 10;
    this.vy = -(20 + R() * 40); this.vx = (R() - 0.5) * 15;
    this.r = 0.8 + R() * 1.6;
    this.max = this.life = 6 + R() * 6;
    this.color = R() < 0.5 ? 'rgba(46,41,35,0.35)' : 'rgba(158,59,44,0.35)';
  }
  Dust.prototype.update = function (dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
    return this.life > 0 && this.y > -20;
  };
  Dust.prototype.draw = function (ctx) {
    ctx.globalAlpha = Math.min(1, this.life / 2) * 0.6;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.fillStyle = this.color; ctx.fill();
  };

  // 刀光弧
  function Slash(x, y, dir, color) {
    this.x = x; this.y = y; this.color = color;
    this.ang = Math.atan2(dir.y, dir.x);
    this.t = 0; this.dur = 0.28;
  }
  Slash.prototype.update = function (dt) { this.t += dt; return this.t < this.dur; };
  Slash.prototype.draw = function (ctx) {
    var p = this.t / this.dur;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 22;
    ctx.lineWidth = 14 * (1 - p) + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 40 + p * 190, this.ang - 0.9, this.ang + 0.9);
    ctx.stroke();
    ctx.restore();
  };

  // 法术扩散环
  function Ring(x, y, color) {
    this.x = x; this.y = y; this.r = 10; this.color = color;
    this.t = 0; this.dur = 0.7;
  }
  Ring.prototype.update = function (dt) {
    this.t += dt; this.r += dt * 320;
    return this.t < this.dur;
  };
  Ring.prototype.draw = function (ctx) {
    ctx.globalAlpha = 1 - this.t / this.dur;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, TAU);
    ctx.strokeStyle = this.color; ctx.lineWidth = 3;
    ctx.shadowColor = this.color; ctx.shadowBlur = 15; ctx.stroke();
  };

  // 上浮符文汉字
  function Rune(x, y, color, ch, size) {
    this.x = x + (R() - 0.5) * 80;
    this.y = y + (R() - 0.5) * 40;
    this.ch = ch || RUNES[(R() * RUNES.length) | 0];
    this.size = size || (18 + R() * 20);
    this.vy = -40 - R() * 50;
    this.t = 0; this.dur = 1.4; this.color = color;
  }
  Rune.prototype.update = function (dt) {
    this.y += this.vy * dt; this.t += dt;
    return this.t < this.dur;
  };
  Rune.prototype.draw = function (ctx) {
    ctx.globalAlpha = 1 - this.t / this.dur;
    ctx.font = this.size + 'px "Noto Serif SC","KaiTi",serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 16;
    ctx.fillText(this.ch, this.x, this.y);
  };

  // 光弹（带拖尾）
  function Projectile(x, y, dir, color) {
    this.x = x; this.y = y; this.color = color;
    var sp = 850;
    this.vx = dir.x * sp; this.vy = dir.y * sp;
    this.t = 0; this.dur = 1.6;
    this.trail = [];
  }
  Projectile.prototype.update = function (dt) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.t += dt;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.shift();
    return this.t < this.dur;
  };
  Projectile.prototype.draw = function (ctx) {
    var self = this;
    this.trail.forEach(function (p, i) {
      ctx.globalAlpha = i / self.trail.length * 0.7;
      ctx.beginPath(); ctx.arc(p.x, p.y, 3 + i * 0.5, 0, TAU);
      ctx.fillStyle = self.color; ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(this.x, this.y, 8, 0, TAU);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color; ctx.shadowBlur = 25; ctx.fill();
  };

  // 落雷
  function Bolt(x1, y1, x2, y2) {
    this.pts = [];
    var n = 8;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var jit = (i > 0 && i < n);
      this.pts.push({
        x: x1 + (x2 - x1) * t + (jit ? (R() - 0.5) * 70 : 0),
        y: y1 + (y2 - y1) * t + (jit ? (R() - 0.5) * 40 : 0)
      });
    }
    this.t = 0; this.dur = 0.35;
  }
  Bolt.prototype.update = function (dt) { this.t += dt; return this.t < this.dur; };
  Bolt.prototype.draw = function (ctx) {
    ctx.globalAlpha = 1 - this.t / this.dur;
    ctx.beginPath();
    this.pts.forEach(function (p, i) {
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    });
    ctx.strokeStyle = '#9e3b2c'; ctx.lineWidth = 3;
    ctx.shadowColor = '#9e3b2c'; ctx.shadowBlur = 25; ctx.stroke();
  };

  // 题字盖印：朱砂印底 + 大字 + 笔锋
  function InkStamp(x, y, ch) {
    this.x = x; this.y = y; this.ch = ch;
    this.t = 0; this.dur = 2.2;
  }
  InkStamp.prototype.update = function (dt) { this.t += dt; return this.t < this.dur; };
  InkStamp.prototype.draw = function (ctx) {
    var p = this.t / this.dur;
    var a = p < 0.15 ? p / 0.15 : (p > 0.75 ? (1 - p) / 0.25 : 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(this.x, this.y - 60);
    var s = 130;
    ctx.fillStyle = 'rgba(158,59,44,0.16)';
    ctx.strokeStyle = 'rgba(158,59,44,0.85)';
    ctx.lineWidth = 2;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.fillStyle = '#2e2923';
    ctx.font = '92px "Noto Serif SC","KaiTi",serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.ch, 0, 6);
    // 笔锋两划
    ctx.strokeStyle = 'rgba(46,41,35,0.7)';
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s / 2 - 14, -s / 2 - 6); ctx.quadraticCurveTo(-s / 2 - 2, -s / 2 - 14, s / 2 + 8, -s / 2 - 6); ctx.stroke();
    ctx.restore();
  };

  // 扇形风刃：三道扇面弧 + 风痕
  function WindSlash(x, y, dir) {
    this.x = x; this.y = y;
    this.ang = Math.atan2(dir.y, dir.x);
    this.t = 0; this.dur = 0.5;
  }
  WindSlash.prototype.update = function (dt) { this.t += dt; return this.t < this.dur; };
  WindSlash.prototype.draw = function (ctx) {
    var p = this.t / this.dur;
    var r = 50 + p * 280;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = '#2e2923';
    ctx.shadowColor = 'rgba(46,41,35,0.6)'; ctx.shadowBlur = 10;
    ctx.lineCap = 'round';
    [-0.55, 0, 0.55].forEach(function (off, i) {
      ctx.lineWidth = (14 - i * 3) * (1 - p) + 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r - i * 16, this.ang - 0.55 + off, this.ang + 0.55 + off);
      ctx.stroke();
    }, this);
    ctx.restore();
  };

  // 结印法阵：旋转双环 + 八方阵线 + 中「印」字
  function Seal(x, y, color) {
    this.x = x; this.y = y; this.color = color || '#9e3b2c';
    this.t = 0; this.dur = 1.6;
  }
  Seal.prototype.update = function (dt) { this.t += dt; return this.t < this.dur; };
  Seal.prototype.draw = function (ctx) {
    var p = this.t / this.dur;
    var a = p < 0.12 ? p / 0.12 : (p > 0.7 ? (1 - p) / 0.3 : 1);
    var r = 30 + p * 90;
    ctx.save();
    ctx.globalAlpha = a * 0.9;
    ctx.translate(this.x, this.y);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.shadowColor = this.color; ctx.shadowBlur = 12;
    ctx.rotate(this.t * 1.5);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, TAU); ctx.stroke();
    for (var i = 0; i < 8; i++) {
      var an = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(an) * r * 0.7, Math.sin(an) * r * 0.7);
      ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r);
      ctx.stroke();
    }
    ctx.rotate(-this.t * 3);
    ctx.fillStyle = this.color;
    ctx.font = '28px "Noto Serif SC","KaiTi",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('印', 0, 0);
    ctx.restore();
  };

  function FX() {
    this.parts = []; this.slashes = []; this.rings = []; this.runes = [];
    this.projectiles = []; this.bolts = []; this.stamps = []; this.winds = []; this.seals = [];
    this.orbs = {};              // 蓄力球，按手侧 'L'/'R' 键存
    this.shake = 0; this.flash = 0;
    this.ambientT = 0;
  }
  FX.prototype.burst = function (x, y, color, n, sp) {
    for (var i = 0; i < n; i++) this.parts.push(new Particle(x, y, color, sp || 260));
  };
  FX.prototype.slash = function (x, y, dir, color) {
    this.slashes.push(new Slash(x, y, dir, color));
    this.burst(x, y, color, 14, 320);
  };
  FX.prototype.cast = function (x, y, color) {
    this.rings.push(new Ring(x, y, color));
    this.rings.push(new Ring(x, y, '#a67c00'));
    for (var i = 0; i < 5; i++) this.runes.push(new Rune(x, y, color));
  };
  FX.prototype.fire = function (x, y, dir, color) {
    this.projectiles.push(new Projectile(x, y, dir, color));
  };
  FX.prototype.stamp = function (x, y, ch) {
    this.stamps.push(new InkStamp(x, y, ch));
  };
  FX.prototype.wind = function (x, y, dir) {
    this.winds.push(new WindSlash(x, y, dir));
  };
  // 结印法阵
  FX.prototype.seal = function (x, y, color) {
    this.seals.push(new Seal(x, y, color));
  };
  // 金光福泽：金环 + 金屑 + 「福」字
  FX.prototype.halo = function (x, y) {
    this.rings.push(new Ring(x, y, '#a67c00'));
    this.rings.push(new Ring(x, y, '#c9a227'));
    for (var i = 0; i < 16; i++) {
      this.parts.push(new Particle(x, y, '#c9a227', 140));
    }
    this.runes.push(new Rune(x, y - 30, '#a67c00', '福', 40));
  };
  // 定点落雷：从天而降劈到掌心
  FX.prototype.boltAt = function (x, y) {
    this.bolts.push(new Bolt(x + (R() - 0.5) * 60, 0, x, y));
    this.burst(x, y, '#9e3b2c', 12, 260);
    this.flash = 0.3; this.shake = 10;
  };
  // 双拳合斩：交叉巨刃
  FX.prototype.cross = function (x, y, dir, color) {
    this.slashes.push(new Slash(x, y, dir, color));
    this.slashes.push(new Slash(x, y, { x: -dir.x, y: -dir.y }, color));
    this.burst(x, y, color, 26, 380);
    this.shake = 9;
  };
  FX.prototype.ultimate = function (W, H) {
    this.flash = 0.75; this.shake = 16;
    for (var i = 0; i < 6; i++) {
      this.bolts.push(new Bolt(R() * W, 0, R() * W, H * (0.55 + R() * 0.3)));
    }
    for (var j = 0; j < 10; j++) {
      this.runes.push(new Rune(W / 2 + (R() - 0.5) * W * 0.5, H * 0.4 + (R() - 0.5) * H * 0.2, '#9e3b2c'));
    }
    this.runes.push(new Rune(W / 2, H * 0.35, '#9e3b2c', '灭', 90));
  };
  FX.prototype.setOrb = function (key, pos, charge) {
    if (pos && charge > 0) {
      this.orbs[key] = { x: pos.x, y: pos.y, c: charge };
    } else {
      delete this.orbs[key];
    }
  };
  FX.prototype.update = function (dt, W, H) {
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.ambientT += dt;
    if (this.ambientT > 0.12) {
      this.ambientT = 0;
      this.parts.push(new Dust(W, H));
    }
    var self = this;
    var alive = function (arr) {
      return arr.filter(function (o) { return o.update(dt); });
    };
    this.parts = alive(this.parts);
    this.slashes = alive(this.slashes);
    this.rings = alive(this.rings);
    this.runes = alive(this.runes);
    this.projectiles = alive(this.projectiles);
    this.bolts = alive(this.bolts);
    this.stamps = alive(this.stamps);
    this.winds = alive(this.winds);
    this.seals = alive(this.seals);
    Object.keys(this.orbs).forEach(function (k) { self.orbs[k].c += dt; });
  };
  FX.prototype.draw = function (ctx) {
    var self = this;
    this.parts.forEach(function (p) { p.draw(ctx); });
    this.rings.forEach(function (r) { r.draw(ctx); });
    this.slashes.forEach(function (s) { s.draw(ctx); });
    this.projectiles.forEach(function (p) { p.draw(ctx); });
    this.runes.forEach(function (r) { r.draw(ctx); });
    this.bolts.forEach(function (b) { b.draw(ctx); });
    this.stamps.forEach(function (s) { s.draw(ctx); });
    this.winds.forEach(function (w) { w.draw(ctx); });
    this.seals.forEach(function (s) { s.draw(ctx); });
    // 蓄力球
    Object.keys(this.orbs).forEach(function (k) {
      var o = self.orbs[k];
      var r = 6 + Math.min(2.2, o.c) * 16 + Math.sin(o.c * 12) * 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(o.x, o.y, r, 0, TAU);
      ctx.fillStyle = '#9e3b2c';
      ctx.shadowColor = '#a67c00'; ctx.shadowBlur = 30; ctx.fill();
      ctx.beginPath(); ctx.arc(o.x, o.y, r * 1.7, 0, TAU);
      ctx.strokeStyle = 'rgba(158,59,44,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  };

  window.CSP.FX = FX;
})();
