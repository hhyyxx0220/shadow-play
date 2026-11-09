// 手势识别模块：从 MediaPipe 21 个手部关键点判断手势，并做防抖
window.CSP = window.CSP || {};
(function () {
  var dist = function (a, b) { return Math.hypot(a.x - b.x, a.y - b.y); };

  // 返回 'FIST' | 'PINCH' | 'PALM' | 'PEACE' | 'HORNS' | 'THREE' | 'THUMB' | 'OK' | 'IDLE'
  function classify(lm) {
    var w = lm[0];
    // 手指伸直判定：指尖离手腕比第二关节更远
    var up = function (tip, pip) { return dist(lm[tip], w) > dist(lm[pip], w) * 1.05; };
    var idx = up(8, 6), mid = up(12, 10), rng = up(16, 14), pky = up(20, 18);
    var count = [idx, mid, rng, pky].filter(Boolean).length;
    var handSize = dist(lm[0], lm[9]) || 1;   // 手掌尺寸作为比例基准
    var pd = dist(lm[4], lm[8]);              // 拇指尖与食指尖距离
    var thumbUp = lm[4].y < lm[0].y - 0.08;   // 拇指竖起（指尖明显高于腕）
    // 捏合判据：拇指食指尖贴近，且拇指离开掌心（握拳时拇指贴在掌心，以此区分）
    var pinchLike = pd < handSize * 0.42 && dist(lm[4], lm[9]) > handSize * 0.30;

    // 捏合优先于握拳判定，修复"捏合被误判成握拳"的问题
    if (pinchLike) return count >= 3 ? 'OK' : 'PINCH';  // 拇指食指圈起+三指张开 = OK 结印
    if (thumbUp && count === 0) return 'THUMB';          // 竖拇指
    if (idx && mid && !rng && !pky) return 'PEACE';      // 双指（剪刀）
    if (idx && pky && !mid && !rng) return 'HORNS';      // 食指+小指（摇滚）
    if (idx && mid && rng && !pky) return 'THREE';       // 三指
    if (count >= 4) return 'PALM';                       // 四指以上伸直 -> 张掌
    if (count === 0) return 'FIST';                      // 五指收拢 -> 握拳
    return 'IDLE';
  }

  // 防抖器：连续 N 帧相同判定才切换状态，避免手势抖动
  function Stab(need) {
    this.need = need || 3;
    this.cur = 'IDLE';
    this.cand = 'IDLE';
    this.c = 0;
  }
  Stab.prototype.push = function (g) {
    if (g === this.cand) { this.c++; } else { this.cand = g; this.c = 1; }
    if (this.c >= this.need && g !== this.cur) {
      this.cur = g;
      return { changed: true, pose: g };
    }
    return { changed: false, pose: this.cur };
  };

  window.CSP.classify = classify;
  window.CSP.Stab = Stab;
})();
