/**
 * Motion system. One place for timing, easing and the few reusable patterns the product uses:
 * page entrance, section reveal, staggered lists, count-up numbers. Everything is short (150-350ms)
 * and respects prefers-reduced-motion (MotionConfig reducedMotion="user" + the hooks below).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LazyMotion, MotionConfig, useInView, type Variants } from "motion/react";
import * as m from "motion/react-m";

export { m };
export { AnimatePresence } from "motion/react";

export const EASE = [0.2, 0.7, 0.2, 1] as const;
export const DUR = { fast: 0.15, base: 0.25, slow: 0.35 } as const;

const loadFeatures = () => import("./motion-features").then((r) => r.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    // Features load asynchronously so the first paint doesn't wait for the animation engine.
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: DUR.base, ease: EASE }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Fade + small rise. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DUR.slow, ease: EASE } },
};

/** Parent that staggers fadeUp children. */
export const stagger = (gap = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Section reveal: plays once when scrolled into view. */
export function Reveal({ children, className, delay = 0, as = "div" }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" }) {
  const Comp = m[as];
  return (
    <Comp className={className} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-8% 0px" }} variants={fadeUp} transition={{ delay }}>
      {children}
    </Comp>
  );
}

/**
 * Animates a number from 0 to `value` once it is on screen (ease-out, ~0.7s).
 * Reduced motion: shows the final value immediately.
 */
export function useCountUp(value: number | null | undefined, { duration = 700, delay = 0 } = {}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-5% 0px" });
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? (value ?? 0) : 0));

  useEffect(() => {
    if (value == null || !inView) return;
    if (prefersReducedMotion()) return setShown(value);
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, inView, duration, delay]);

  return { ref, value: value == null ? null : shown };
}

export function CountUp({ value, className, duration, delay, format }: { value: number; className?: string; duration?: number; delay?: number; format?: (n: number) => string }) {
  const { ref, value: v } = useCountUp(value, { duration, delay });
  return (
    <span ref={ref} className={className}>
      {format ? format(v ?? 0) : v}
    </span>
  );
}
