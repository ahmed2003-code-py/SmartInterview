import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n";
import { LogoMark } from "@/components/layout/Logo";
import { Waveform } from "@/features/interview/Waveform";
import { AiOrb } from "@/features/interview/Conversation";
import { AnimatePresence, m, prefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";

// Timeline of the silent product demo (ms from loop start).
const STEPS = [0, 1700, 4300, 5500, 7100, 9000];
const LOOP = 13500;

/** Simulated mic levels for the demo waveform (no audio is used on the landing page). */
function useFakeLevels(active: boolean, bars = 28) {
  const [levels, setLevels] = useState<number[]>(() => Array(bars).fill(0.1));
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    if (!active) return;
    let t = 0;
    setTicks(0);
    const id = window.setInterval(() => {
      t += 1;
      setTicks(t);
      setLevels((prev) => [...prev.slice(1), 0.15 + 0.85 * Math.abs(Math.sin(t * 0.55) * Math.sin(t * 0.23 + 1)) * (0.6 + Math.random() * 0.4)]);
    }, 90);
    return () => window.clearInterval(id);
  }, [active]);
  return { levels, seconds: Math.floor(ticks * 0.09) };
}

/**
 * Landing hero visual: a looping, silent replica of the real interview room —
 * question → live waveform → transcript → thinking → follow-up → answer insight.
 * Pauses off-screen; reduced motion shows the final frame without animating.
 */
export function InterviewDemo() {
  const { d } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();
  const [step, setStep] = useState(reduced ? STEPS.length - 1 : 0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    const timers = STEPS.map((at, i) => window.setTimeout(() => setStep(i), at));
    const loop = window.setInterval(() => STEPS.forEach((at, i) => timers.push(window.setTimeout(() => setStep(i), at))), LOOP);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(loop);
    };
  }, [reduced, visible]);

  const { levels, seconds } = useFakeLevels(step === 1 && visible);
  const speaking = step === 0 || step === 4;

  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[30rem] select-none" aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        {/* header */}
        <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
          <LogoMark className="size-5" />
          <span className="min-w-0 truncate text-[13px] font-semibold">{d.landing.demoRole}</span>
          <span className="ms-auto flex items-center gap-1.5 text-[11px] font-medium text-rec">
            <span className="size-1.5 animate-pulse rounded-full bg-current" />
            {d.room.live}
          </span>
        </div>
        <div className="flex h-[3px] gap-px bg-border">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={cn("flex-1 transition-colors duration-500", i < 2 ? "bg-primary" : i === 2 ? "bg-primary/40" : "bg-surface-2")} />
          ))}
        </div>

        <div className="flex h-[23rem] flex-col gap-4 overflow-hidden px-4 pt-5 sm:px-5">
          <p className="text-[11px] text-subtle">{d.landing.demoMeta}</p>

          {/* Q1 */}
          <div className="flex gap-3">
            <AiOrb speaking={step === 0} size="sm" />
            <p className={cn("text-[15px] leading-snug font-medium transition-colors duration-500", step >= 4 ? "text-fg/55" : "text-fg")}>{d.landing.demoQ1}</p>
          </div>

          {/* Student */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <m.div key="rec" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="ms-8 flex items-center gap-3 rounded-xl bg-rec-soft px-3 py-2.5 ring-1 ring-rec/20">
                <span className="relative grid size-6 shrink-0 place-items-center">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-rec/30" />
                  <span className="size-2 rounded-full bg-rec" />
                </span>
                <Waveform levels={levels} bars={levels.length} className="h-6 min-w-0 flex-1 justify-between overflow-hidden text-rec/70" />
                <span className="text-[11px] font-medium text-rec tabular-nums" dir="ltr">
                  0:0{Math.min(9, seconds)}
                </span>
              </m.div>
            )}
            {step >= 2 && (
              <m.div key="answer" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ms-8 rounded-xl bg-surface-2 px-3.5 py-2.5">
                <p className="mb-0.5 text-[11px] text-subtle">{d.room.you}</p>
                <p className={cn("text-[13.5px] leading-relaxed transition-colors duration-500", step >= 4 ? "text-muted" : "text-fg")}>{d.landing.demoA1}</p>
              </m.div>
            )}
          </AnimatePresence>

          {/* Thinking → follow-up */}
          <AnimatePresence mode="wait">
            {step === 3 && (
              <m.div key="think" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3">
                <AiOrb thinking size="sm" />
                <span className="text-[13px] text-muted">{d.landing.demoThinking}</span>
              </m.div>
            )}
            {step >= 4 && (
              <m.div key="q2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <AiOrb speaking={speaking} size="sm" />
                <div>
                  <p className="text-[11px] font-medium text-primary">{d.room.followUp}</p>
                  <p className="mt-0.5 text-[16px] leading-snug font-semibold tracking-[-0.01em]">{d.landing.demoQ2}</p>
                </div>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Answer insight: floats over the card's corner */}
      <AnimatePresence>
        {step >= 5 && (
          <m.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.5 }}
            className="absolute -bottom-6 end-3 w-56 rounded-xl border border-border bg-surface p-3.5 shadow-lg sm:-end-6"
          >
            <p className="flex items-center justify-between text-[11px] font-semibold text-subtle">
              {d.landing.demoInsight}
              <span className="ai-text text-sm font-bold">82</span>
            </p>
            {[
              [d.criteria.relevance, 86],
              [d.criteria.clarity, 74],
            ].map(([label, v]) => (
              <div key={label} className="mt-2">
                <div className="flex justify-between text-[11px] text-muted">
                  <span>{label}</span>
                  <span className="font-semibold text-fg tabular-nums">{v}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-surface-2">
                  <m.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${v}%` }} transition={{ duration: 0.6, delay: 0.15 }} />
                </div>
              </div>
            ))}
            <p className="mt-2.5 rounded-md bg-warning-soft px-2 py-1 text-[11px] font-medium text-warning">→ {d.landing.demoTip}</p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
