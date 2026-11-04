"use client";

import React, { useRef, useEffect, useState } from "react";

export type KineticEffectType =
  | "none"
  | "ember-drifter"
  | "ion-arc"
  | "void-singularity"
  | "solar-corona"
  | "holo-glitch";

export interface KineticAvatarFXProps {
  streak?: number;
  effectId?: string;
  frameId?: string;
  size?: number; // width & height in px, default 96 (w-24)
  shape?: "square" | "circle";
  className?: string;
}

/**
 * Determine the active particle shader effect based on streak length or cosmetic override.
 */
export function getKineticEffectForStreak(streak = 0, effectId?: string): KineticEffectType {
  if (effectId === "effect-glitch" || effectId === "holo-glitch") {
    return "holo-glitch";
  }
  if (effectId === "effect-ember") {
    return "ember-drifter";
  }
  if (effectId === "effect-void") {
    return "void-singularity";
  }
  if (effectId === "effect-solar") {
    return "solar-corona";
  }

  if (streak >= 30) return "solar-corona";
  if (streak >= 15) return "void-singularity";
  if (streak >= 7) return "ion-arc";
  if (streak >= 3) return "ember-drifter";

  return "none";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  color: string;
  life: number;
  maxLife: number;
  angle?: number;
  radius?: number;
  speed?: number;
}

export default function KineticAvatarFX({
  streak = 0,
  effectId,
  frameId,
  size = 96,
  shape = "square",
  className = "",
}: KineticAvatarFXProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);

  const activeEffect = getKineticEffectForStreak(streak, effectId);

  // Check hardware capabilities and accessibility
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handleMotionChange);

    if (typeof navigator !== "undefined" && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
      setIsLowPower(true);
    }

    return () => {
      mq.removeEventListener?.("change", handleMotionChange);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion || isLowPower || activeEffect === "none") {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    const padding = 20;
    const width = size + padding * 2;
    const height = size + padding * 2;
    const center = width / 2;
    const baseRadius = size / 2;

    canvas.width = width;
    canvas.height = height;

    const colors = {
      "ember-drifter": ["#f59e0b", "#fbbf24", "#d97706", "#fef08a"],
      "ion-arc": ["#06b6d4", "#22d3ee", "#38bdf8", "#e0f2fe"],
      "void-singularity": ["#8b5cf6", "#a855f7", "#c084fc", "#6366f1"],
      "solar-corona": ["#f59e0b", "#f97316", "#ef4444", "#fef08a"],
      "holo-glitch": ["#06b6d4", "#ec4899", "#10b981", "#ffffff"],
    }[activeEffect] || ["#ffffff"];

    // Initialize particles for specific effect
    const spawnParticle = (): Particle => {
      const color = colors[Math.floor(Math.random() * colors.length)];

      if (activeEffect === "ember-drifter") {
        // Floating embers rising from bottom rim
        return {
          x: center + (Math.random() - 0.5) * (size * 0.9),
          y: center + size * 0.45 + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -(0.6 + Math.random() * 0.8),
          size: 1.5 + Math.random() * 2.2,
          alpha: 0.1,
          maxAlpha: 0.7 + Math.random() * 0.3,
          color,
          life: 0,
          maxLife: 45 + Math.random() * 30, // ~0.8 - 1.2s at 60fps
        };
      }

      if (activeEffect === "ion-arc") {
        // Sparks jumping along the perimeter
        const angle = Math.random() * Math.PI * 2;
        const r = baseRadius + (Math.random() - 0.5) * 6;
        return {
          x: center + Math.cos(angle) * r,
          y: center + Math.sin(angle) * r,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: 1 + Math.random() * 2,
          alpha: 0.2,
          maxAlpha: 0.9,
          color,
          life: 0,
          maxLife: 15 + Math.random() * 20,
        };
      }

      if (activeEffect === "void-singularity") {
        // Gravitational swirling accretion dots
        const angle = Math.random() * Math.PI * 2;
        const radius = baseRadius * 0.9 + Math.random() * 16;
        return {
          x: center + Math.cos(angle) * radius,
          y: center + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          size: 1.2 + Math.random() * 2.4,
          alpha: 0.2,
          maxAlpha: 0.85,
          color,
          life: 0,
          maxLife: 50 + Math.random() * 40,
          angle,
          radius,
          speed: 0.03 + Math.random() * 0.04,
        };
      }

      if (activeEffect === "solar-corona") {
        // Plasma prominence flares erupting outward
        const angle = Math.random() * Math.PI * 2;
        const r = baseRadius * 0.95;
        const outwardSpeed = 0.5 + Math.random() * 1.2;
        return {
          x: center + Math.cos(angle) * r,
          y: center + Math.sin(angle) * r,
          vx: Math.cos(angle) * outwardSpeed,
          vy: Math.sin(angle) * outwardSpeed,
          size: 2 + Math.random() * 3,
          alpha: 0.3,
          maxAlpha: 0.95,
          color,
          life: 0,
          maxLife: 35 + Math.random() * 25,
        };
      }

      // Holo-glitch
      return {
        x: center + (Math.random() - 0.5) * size,
        y: center + (Math.random() - 0.5) * size,
        vx: (Math.random() - 0.5) * 4,
        vy: 0,
        size: 1 + Math.random() * 3,
        alpha: 0.4,
        maxAlpha: 0.9,
        color,
        life: 0,
        maxLife: 10 + Math.random() * 15,
      };
    };

    // Pre-populate particles
    const maxParticles = {
      "ember-drifter": 16,
      "ion-arc": 20,
      "void-singularity": 24,
      "solar-corona": 28,
      "holo-glitch": 12,
    }[activeEffect] || 16;

    for (let i = 0; i < maxParticles; i++) {
      const p = spawnParticle();
      p.life = Math.random() * p.maxLife; // Stagger initial life
      particles.push(p);
    }

    let frameCount = 0;

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Render & update active particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.life++;

        // Life cycle alpha ramp in and out
        const progress = p.life / p.maxLife;
        if (progress < 0.2) {
          p.alpha = (progress / 0.2) * p.maxAlpha;
        } else if (progress > 0.7) {
          p.alpha = (1 - (progress - 0.7) / 0.3) * p.maxAlpha;
        } else {
          p.alpha = p.maxAlpha;
        }

        if (activeEffect === "void-singularity" && p.angle !== undefined && p.radius !== undefined && p.speed) {
          p.angle += p.speed;
          p.radius -= 0.12; // Inward gravitational pull
          p.x = center + Math.cos(p.angle) * p.radius;
          p.y = center + Math.sin(p.angle) * p.radius;
        } else {
          p.x += p.vx;
          p.y += p.vy;
        }

        // Draw particle
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;

        ctx.beginPath();
        if (activeEffect === "holo-glitch") {
          // Horizontal digital slivers
          ctx.rect(p.x, p.y, p.size * 3, p.size * 0.8);
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();

        // Respawn if expired
        if (p.life >= p.maxLife) {
          particles[i] = spawnParticle();
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [activeEffect, size, reducedMotion, isLowPower]);

  // If reduced motion or low power, provide an accessible static CSS glow
  if (reducedMotion || isLowPower) {
    if (activeEffect === "none") return null;

    const glowColor = {
      "ember-drifter": "ring-amber-500/50 shadow-amber-500/20",
      "ion-arc": "ring-cyan-500/50 shadow-cyan-500/20",
      "void-singularity": "ring-violet-500/50 shadow-violet-500/20",
      "solar-corona": "ring-amber-400/60 shadow-amber-400/30",
      "holo-glitch": "ring-cyan-400/50 shadow-pink-500/20",
    }[activeEffect] || "";

    return (
      <div
        className={`pointer-events-none absolute inset-0 rounded-2xl ring-2 ${glowColor} shadow-lg transition-all ${className}`}
        aria-hidden="true"
      />
    );
  }

  if (activeEffect === "none") {
    return null;
  }

  const padding = 20;
  const canvasSize = size + padding * 2;

  return (
    <div
      className={`pointer-events-none absolute flex items-center justify-center ${className}`}
      style={{
        width: `${canvasSize}px`,
        height: `${canvasSize}px`,
        top: `-${padding}px`,
        left: `-${padding}px`,
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: `${canvasSize}px`,
          height: `${canvasSize}px`,
        }}
      />
    </div>
  );
}
