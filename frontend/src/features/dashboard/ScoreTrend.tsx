import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";

export interface TrendPoint {
  id: string;
  score: number;
  date: string;
  roleEn: string;
  roleAr: string;
}

const H = 220;
const PAD = { top: 16, bottom: 28, side: 36 };

/** Single-series score line (0-100). Time runs in reading direction, so it mirrors in RTL. */
export function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const { lang, dir, formatDate, d } = useI18n();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rtl = dir === "rtl";
  const plotW = Math.max(10, width - PAD.side * 2);
  const plotH = H - PAD.top - PAD.bottom;
  const xAt = (i: number) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    return PAD.side + (rtl ? 1 - t : t) * plotW;
  };
  const yAt = (score: number) => PAD.top + (1 - score / 100) * plotH;
  const path = points.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(p.score).toFixed(1)}`).join(" ");

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let best = 0;
    points.forEach((_, i) => {
      if (Math.abs(xAt(i) - x) < Math.abs(xAt(best) - x)) best = i;
    });
    setHover(best);
  }

  const active = hover != null ? points[hover] : null;
  const gridSide = rtl ? PAD.side + plotW : PAD.side;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0" style={{ height: H }}>
      {width > 0 && (
      <>
      <svg
        width={width}
        height={H}
        className="block touch-none select-none"
        // Positions are computed physically (mirrored for RTL), so keep SVG text anchors physical too.
        style={{ direction: "ltr" }}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => active && navigate(`/interviews/${active.id}/report`)}
        role="img"
        aria-label={d.dashboard.trendTitle}
      >
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={PAD.side} x2={PAD.side + plotW} y1={yAt(v)} y2={yAt(v)} stroke="var(--border)" strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={rtl ? gridSide + 10 : gridSide - 10} y={yAt(v)} dy="0.32em" textAnchor={rtl ? "start" : "end"} className="fill-subtle text-[11px] tabular-nums">
              {v}
            </text>
          </g>
        ))}
        {active && hover != null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--border-strong)" />}
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={p.id} cx={xAt(i)} cy={yAt(p.score)} r={hover === i ? 5.5 : 4} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
        ))}
        {/* first / last date labels only */}
        {points.length > 0 && (
          <>
            <text x={xAt(0)} y={H - 6} textAnchor={points.length === 1 ? "middle" : rtl ? "end" : "start"} className="fill-subtle text-[11px]">
              {formatDate(points[0].date)}
            </text>
            {points.length > 1 && (
              <text x={xAt(points.length - 1)} y={H - 6} textAnchor={rtl ? "start" : "end"} className="fill-subtle text-[11px]">
                {formatDate(points.at(-1)!.date)}
              </text>
            )}
          </>
        )}
      </svg>

      {active && hover != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max max-w-52 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(Math.max(xAt(hover) - 80, 0), width - 160) }}
        >
          <p className="text-base font-semibold tabular-nums">{active.score}</p>
          <p className="text-muted">{lang === "ar" ? active.roleAr : active.roleEn}</p>
          <p className="text-subtle">{formatDate(active.date)}</p>
        </div>
      )}

      </>
      )}
      <table className="sr-only">
        <caption>{d.dashboard.trendTitle}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.id}>
              <td>{formatDate(p.date)}</td>
              <td>{lang === "ar" ? p.roleAr : p.roleEn}</td>
              <td>{p.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
