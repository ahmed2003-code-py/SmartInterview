import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { m, EASE } from "@/lib/motion";

export interface TrendPoint {
  id: string;
  score: number;
  date: string;
  roleEn: string;
  roleAr: string;
}

const PAD = { top: 14, bottom: 26, side: 30 };

/**
 * Overall score over recent interviews: a single area/line series on one 0-100 axis.
 * The line draws in once; hovering (or touching) shows date, role and score. Time follows the reading
 * direction, so the chart mirrors in RTL. A table copy is kept for screen readers.
 */
export function ScoreTrend({ points, height = 220 }: { points: TrendPoint[]; height?: number }) {
  const { lang, dir, formatDate, d } = useI18n();
  const navigate = useNavigate();
  const gradId = useId();
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
  const H = height;
  const plotW = Math.max(10, width - PAD.side * 2);
  const plotH = H - PAD.top - PAD.bottom;
  const xAt = (i: number) => {
    const t = points.length === 1 ? 0.5 : i / (points.length - 1);
    return PAD.side + (rtl ? 1 - t : t) * plotW;
  };
  const yAt = (score: number) => PAD.top + (1 - score / 100) * plotH;
  // Gentle monotone-ish curve (cardinal-like) so the line reads as progress, not noise.
  const pts = points.map((p, i) => [xAt(i), yAt(p.score)] as const);
  const line = pts
    .map(([x, y], i) => {
      if (i === 0) return `M${x.toFixed(1)},${y.toFixed(1)}`;
      const [px, py] = pts[i - 1];
      const cx = (px + x) / 2;
      return `C${cx.toFixed(1)},${py.toFixed(1)} ${cx.toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const base = yAt(0);
  const area = pts.length ? `${line} L${pts.at(-1)![0].toFixed(1)},${base} L${pts[0][0].toFixed(1)},${base} Z` : "";

  function pick(clientX: number, rect: DOMRect) {
    const x = clientX - rect.left;
    let best = 0;
    pts.forEach(([px], i) => {
      if (Math.abs(px - x) < Math.abs(pts[best][0] - x)) best = i;
    });
    setHover(best);
  }

  const active = hover != null ? points[hover] : null;
  const labelX = rtl ? PAD.side + plotW + 8 : PAD.side - 8;

  return (
    <div ref={wrapRef} className="relative w-full min-w-0" style={{ height: H }}>
      {width > 0 && (
        <svg
          width={width}
          height={H}
          className="block touch-pan-y select-none"
          // Positions are physical (mirrored for RTL), so keep SVG text anchors physical too.
          style={{ direction: "ltr" }}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          onClick={() => active && navigate(`/interviews/${active.id}/report`)}
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--primary)" stopOpacity="0.18" />
              <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.side} x2={PAD.side + plotW} y1={yAt(v)} y2={yAt(v)} stroke="var(--border)" strokeDasharray={v === 0 ? undefined : "2 5"} />
              <text x={labelX} y={yAt(v)} dy="0.32em" textAnchor={rtl ? "start" : "end"} className="fill-subtle text-[10.5px] tabular-nums">
                {v}
              </text>
            </g>
          ))}
          <m.path d={area} fill={`url(#${gradId})`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.35 }} />
          <m.path
            d={line}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE }}
          />
          {active && hover != null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PAD.top} y2={base} stroke="var(--border-strong)" strokeDasharray="3 3" />}
          {pts.map(([x, y], i) => (
            <m.circle
              key={points[i].id}
              cx={x}
              cy={y}
              r={hover === i ? 5.5 : i === pts.length - 1 ? 4.5 : 3.5}
              fill={i === pts.length - 1 || hover === i ? "var(--primary)" : "var(--surface)"}
              stroke="var(--primary)"
              strokeWidth={2}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.2, delay: 0.25 + (0.6 * i) / Math.max(1, pts.length - 1) }}
            />
          ))}
          {points.length > 1 && (
            <>
              <text x={xAt(0)} y={H - 6} textAnchor={rtl ? "end" : "start"} className="fill-subtle text-[10.5px]">
                {formatDate(points[0].date)}
              </text>
              <text x={xAt(points.length - 1)} y={H - 6} textAnchor={rtl ? "start" : "end"} className="fill-subtle text-[10.5px]">
                {formatDate(points.at(-1)!.date)}
              </text>
            </>
          )}
        </svg>
      )}

      {active && hover != null && (
        <div
          className="pointer-events-none absolute z-10 w-max max-w-56 animate-pop-in rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-md"
          style={{ left: Math.min(Math.max(pts[hover][0] - 70, 0), width - 150), top: Math.max(0, pts[hover][1] - 74) }}
        >
          <p className="text-base leading-none font-semibold tabular-nums">{active.score}</p>
          <p className="mt-1 truncate text-muted">{lang === "ar" ? active.roleAr : active.roleEn}</p>
          <p className="text-subtle">{formatDate(active.date)}</p>
        </div>
      )}

      {/* Tables ignore sr-only's 1px width, so the wrapper is what hides it. */}
      <div className="sr-only">
      <table>
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
    </div>
  );
}
