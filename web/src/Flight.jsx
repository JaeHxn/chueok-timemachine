import { useEffect, useRef } from "react";
import { playWarp } from "./warp.js";

// 행성 사이 비행 연출: 우주선이 곡선(2차 베지어)을 따라 날아가며, 뒤로 별빛 터널이 흐른다.
// from/to는 화면 비율(%) 좌표. skipRef.current를 true로 바꾸면 즉시 끝난다.
export default function Flight({ from, to, color, skipRef, onDone, duration = 1800 }) {
  const cv = useRef(null);
  const ship = useRef(null);

  useEffect(() => {
    let raf = 0;
    let t0 = null;
    let finished = false;
    // 곡선의 조절점: 두 점 사이 중간에서 수직 방향으로 휘어지게
    const ctrl = {
      x: (from.x + to.x) / 2 + (to.y - from.y) * 0.35,
      y: (from.y + to.y) / 2 - (to.x - from.x) * 0.35,
    };
    const finish = () => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      onDone();
    };
    if (cv.current) playWarp(cv.current, duration);

    const step = (now) => {
      if (t0 === null) t0 = now;
      const t = Math.min(1, (now - t0) / duration);
      if (skipRef.current) { skipRef.current = false; finish(); return; }
      // 가속 후 감속 (ease-in-out)
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * ctrl.x + e * e * to.x;
      const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * ctrl.y + e * e * to.y;
      // 진행 방향(접선)으로 우주선 회전
      const dx = 2 * (1 - e) * (ctrl.x - from.x) + 2 * e * (to.x - ctrl.x);
      const dy = 2 * (1 - e) * (ctrl.y - from.y) + 2 * e * (to.y - ctrl.y);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      if (ship.current) {
        ship.current.style.left = `${x}%`;
        ship.current.style.top = `${y}%`;
        ship.current.style.transform = `translate(-50%,-50%) rotate(${deg}deg)`;
      }
      if (t < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    return () => { finished = true; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flight" aria-hidden="true">
      <canvas ref={cv} className="warp on" />
      <div ref={ship} className="ship" style={{ left: `${from.x}%`, top: `${from.y}%`, "--c": color }}>🚀</div>
    </div>
  );
}
