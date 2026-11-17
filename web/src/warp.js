// 행성 간 워프 연출: 캔버스 별빛 터널. 외부 라이브러리 없음.
// 호출하면 durationMs 동안 재생하고 끝나면 resolve.
export function playWarp(canvas, durationMs = 1400) {
  return new Promise((resolve) => {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = (canvas.width = canvas.clientWidth * dpr);
    const h = (canvas.height = canvas.clientHeight * dpr);
    const stars = Array.from({ length: 220 }, () => ({
      a: Math.random() * Math.PI * 2,
      r: Math.random() * 0.2,
      s: 0.02 + Math.random() * 0.05,
    }));
    const t0 = performance.now();

    function frame(now) {
      const t = (now - t0) / durationMs;
      ctx.fillStyle = "rgba(7,13,22,0.35)";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      for (const st of stars) {
        st.r += st.s * (1 + t * 14);
        const x = cx + Math.cos(st.a) * st.r * w;
        const y = cy + Math.sin(st.a) * st.r * h;
        const len = 1 + t * 22;
        ctx.strokeStyle = `rgba(255,236,200,${Math.min(1, st.r * 2)})`;
        ctx.lineWidth = (1 + st.r * 4) * dpr;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(cx + Math.cos(st.a) * (st.r * w - len * dpr), cy + Math.sin(st.a) * (st.r * h - len * dpr));
        ctx.stroke();
        if (st.r > 0.9) { st.r = Math.random() * 0.1; st.a = Math.random() * Math.PI * 2; }
      }
      if (t < 1) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, w, h); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}
