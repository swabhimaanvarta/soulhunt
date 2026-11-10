"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  Rocket,
  Download,
  Users,
  CheckCircle2,
  FileText,
  Volume2,
} from "lucide-react";
import { sfx } from "@/lib/audio/sfx";

interface SlideData {
  id: number;
  section: string;
  category: string;
  title: string;
  subtitle: string;
  keyMetrics?: Array<{ label: string; value: string; color?: string }>;
  cards: Array<{
    title: string;
    badge?: string;
    color: string;
    bullets: string[];
  }>;
  speakerNotes: string;
}

const SLIDES: SlideData[] = [
  {
    id: 1,
    section: "VENTURE OVERVIEW",
    category: "PITCH IT! ARENA 2026",
    title: "AIEM HUNT",
    subtitle: "Autonomous Campus Asset Recovery & Gamified Micro-Logistics Platform",
    keyMetrics: [
      { label: "Target Market", value: "₹2,400 Cr", color: "text-amber-400" },
      { label: "Baseline Recovery", value: "<14%", color: "text-rose-400" },
      { label: "Hunt Pilot Target", value: "65%+", color: "text-emerald-400" },
      { label: "Platform Status", value: "100% Ready", color: "text-cyan-400" },
    ],
    cards: [
      {
        title: "The Venture Tagline",
        color: "border-cyan-500/40 bg-cyan-950/20",
        bullets: [
          "“Turning Campus Vigilance into Verified Asset Recovery”",
          "Solving the ₹20L/year campus lost-item crisis through physical Safe-Desk custody, crowd incentives, and B2B SaaS scalability.",
        ],
      },
      {
        title: "Venture Submission Details",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "Track: Smart Campus SaaS & B2B Facility Automation",
          "Institution: Agnel Institute of Engineering and Management (AIEM), Assagao, Goa",
          "Presentation Model: 7-Minute Pitch + 3-Minute Judge Q&A Format",
        ],
      },
    ],
    speakerNotes:
      "Good morning, esteemed judges and sharks. Today, we are presenting AIEM Hunt. Every single semester, thousands of valuable belongings are lost on our campus with less than 14% ever recovered. We built AIEM Hunt to turn campus vigilance into verified recovery through decentralized safe desks, cryptographic handovers, and gamified student incentives.",
  },
  {
    id: 2,
    section: "1. PROBLEM STATEMENT",
    category: "MANDATORY SECTION 1",
    title: "The Broken Reality: Chaos, Theft & The 'Dusty Box'",
    subtitle: "Current campus lost-and-found systems fail because of friction, privacy leaks, and zero finder incentives.",
    keyMetrics: [
      { label: "Annual Lost Assets", value: "₹15–20 Lakhs", color: "text-amber-400" },
      { label: "Traditional Recovery", value: "11%–14%", color: "text-rose-400" },
      { label: "Claim Fraud Rate", value: "High / Untracked", color: "text-rose-300" },
    ],
    cards: [
      {
        title: "Dusty Cardboard Box Syndrome",
        badge: "Inconvenient",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "A single physical security cabin at the campus perimeter is too inconvenient for finders across multi-story department blocks.",
          "Valuables sit in back-office drawers for weeks while owners assume they are permanently stolen.",
          "Loss of exam essentials (hall tickets, calculators, journals) causes acute student panic.",
        ],
      },
      {
        title: "WhatsApp & Social Media Chaos",
        badge: "Severe Risk",
        color: "border-rose-500/40 bg-rose-950/20",
        bullets: [
          "Unmonitored group chats get buried under conversational chatter within minutes.",
          "Zero Custody Chain: Nobody knows who currently holds the item physically.",
          "Privacy Violations: Students post unblurred photos of ID cards with personal phone numbers on public stories.",
        ],
      },
      {
        title: "The Complete Incentive Void",
        badge: "Human Behavior",
        color: "border-cyan-500/40 bg-cyan-950/20",
        bullets: [
          "Walking 15 minutes to turn in a found item takes effort with zero acknowledgment or gratitude.",
          "Rampant Claim Fraud: Anyone can claim generic items (black umbrellas, Casio calculators) without verifiable proof.",
        ],
      },
    ],
    speakerNotes:
      "Let's look at the problem. Across Indian universities, over ₹15 to ₹20 Lakhs in personal belongings are lost annually per campus. The current solutions are a dusty box in a security office or chaotic WhatsApp groups where private student IDs and phone numbers are exposed. Finders have zero incentive to walk across campus, and anyone can fraudulently claim items without proof.",
  },
  {
    id: 3,
    section: "2. THE SOLUTION",
    category: "MANDATORY SECTION 2",
    title: "The AIEM Hunt Dual Engine: Custody + Play",
    subtitle: "A decentralized physical custody network backed by cryptographic verification and live-ops ARG micro-incentives.",
    cards: [
      {
        title: "1. Safe-Desk Custody Network",
        badge: "Physical Grounding",
        color: "border-emerald-500/40 bg-emerald-950/20",
        bullets: [
          "Authorized Kiosks: Central Library, Canteen Cashier, Department Staff Rooms, and Security Gates act as verified drop points.",
          "Single-Use Bcrypt Handover PIN: Claimant generates a time-limited OTP; staff verifies and releases custody digitally. Zero plaintext leaks.",
          "Immutable Audit Trail: Every handover logged in an operations ledger with timestamped dual-party signatures.",
        ],
      },
      {
        title: "2. Gamified Micro-Incentives",
        badge: "Live-Ops Engagement",
        color: "border-cyan-500/40 bg-cyan-950/20",
        bullets: [
          "Rush Hour Recon: 08:30–09:30 & 16:30–17:30 IST grant 1.5x XP Boost and +20 bonus coins to align with peak student movement.",
          "Tactical Syndicate Weekends: 2.0x Squad XP multiplier for cooperative campus mystery recovery sweeps.",
          "Vanity Economy: Starter cosmetics free; vanity sinks (animated avatar shaders, sound effects) drive ethical engagement without paywalls.",
        ],
      },
      {
        title: "3. Course-Aligned AI Quests",
        badge: "Academic Value",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "AI Game Master transforms unclaimed items into educational deduction quests grounded in university syllabus.",
          "HMAC Cryptographic Clue Seeding personalizes clue variants per hunter to prevent answer copying.",
        ],
      },
      {
        title: "4. Verified Working Prototype",
        badge: "Execution Ready",
        color: "border-violet-500/40 bg-violet-950/20",
        bullets: [
          "Full-stack Next.js 15, React 19, MongoDB, and procedural Web Audio API SFX engine already built and certified.",
          "74 production routes with 100% test pass rate across 16 automated test suites (430+ assertions).",
        ],
      },
    ],
    speakerNotes:
      "Our solution is the AIEM Hunt Dual Engine. First, the physical layer: decentralized Safe Desks at libraries, canteens, and staff rooms. Handover is protected by single-use bcrypt-hashed PINs—no plaintext leaks. Second, the gamification layer: during peak arrival and departure times, our 'Rush Hour Recon' gives students 1.5x XP and bonus coins for checking items in. We turn unclaimed items into curriculum-aligned deduction quests.",
  },
  {
    id: 4,
    section: "3. MARKET ANALYSIS",
    category: "MANDATORY SECTION 3",
    title: "Capturing the ₹2,400 Crore Smart Campus Market",
    subtitle: "Large addressable market in Indian higher education facilities and corporate tech parks.",
    keyMetrics: [
      { label: "TAM (All Higher Ed)", value: "₹2,400 Cr", color: "text-amber-400" },
      { label: "SAM (Professional)", value: "₹350 Cr", color: "text-cyan-400" },
      { label: "SOM (24-Month)", value: "₹3.6 Cr", color: "text-emerald-400" },
      { label: "Colleges in India", value: "43,000+", color: "text-white" },
    ],
    cards: [
      {
        title: "Market Sizing Breakdown",
        badge: "Opportunity",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "TAM: ₹2,400 Crore ($290M) across 43,000+ colleges and 1,100+ universities in India, plus enterprise IT tech parks.",
          "SAM: ₹350 Crore ($42M) across 4,500+ accredited engineering, management, and medical campuses with high personal asset density.",
          "SOM: ₹3.6 Crore ($430K ARR) capturing 60 campuses across Goa, Pune, Mumbai, and Bengaluru in the first 24 months.",
        ],
      },
      {
        title: "Competitive Landscape & Moat",
        badge: "Strategic Advantage",
        color: "border-emerald-500/40 bg-emerald-950/20",
        bullets: [
          "WhatsApp Groups: Free, but zero chain of custody, severe privacy violations, and 85%+ failure rate.",
          "Foreign Enterprise SaaS (Crowdfind, Boomerang): Cost $3,000–$10,000/yr, sterile UI, zero student adoption in India.",
          "AIEM Hunt Moat: Student-first ARG gamification + physical safe-desk verification + AI quest deductions at 10x lower SaaS cost.",
        ],
      },
    ],
    speakerNotes:
      "Now looking at the market: There are over 43,000 colleges in India, representing a ₹2,400 Crore Smart Campus facility market. Our serviceable market is 4,500 engineering and management colleges worth ₹350 Crore. Our 24-month target is 60 colleges in Western India for ₹3.6 Crore ARR. Unlike US enterprise tools that charge $5,000 a year with zero student adoption, AIEM Hunt is student-centric and priced for Indian university budgets.",
  },
  {
    id: 5,
    section: "4. REVENUE MODEL",
    category: "MANDATORY SECTION 4",
    title: "B2B SaaS, Merchant Perks & Outstanding Unit Economics",
    subtitle: "High-margin recurring software licenses complemented by campus merchant coin partnerships.",
    keyMetrics: [
      { label: "Gross Margin", value: "84%+", color: "text-emerald-400" },
      { label: "Est. CAC", value: "₹12,000", color: "text-cyan-400" },
      { label: "Est. LTV (3-Yr)", value: "₹2,50,000", color: "text-amber-400" },
      { label: "LTV / CAC Ratio", value: ">15 : 1", color: "text-emerald-300" },
    ],
    cards: [
      {
        title: "1. B2B Institutional SaaS (Core)",
        badge: "Recurring ARR",
        color: "border-emerald-500/40 bg-emerald-950/20",
        bullets: [
          "Standard Campus Tier: ₹49,000 / year (Up to 2,500 students, 3 Safe Desks, custody directory).",
          "Enterprise Campus Tier: ₹99,000 / year (Unlimited students, all Safe Desks, AI Quests, custom leaderboards, administrative audit logs).",
          "Multi-Campus Consortium: ₹1,80,000 / year for university-wide multi-campus deployments.",
        ],
      },
      {
        title: "2. Hyperlocal Merchant Partnerships",
        badge: "Secondary Stream",
        color: "border-cyan-500/40 bg-cyan-950/20",
        bullets: [
          "Campus canteens, stationery stores, and local cafes partner as 'Hunter Outposts'.",
          "Students redeem earned Hunter Coins for 10% food/beverage discounts; merchants pay ₹1,500/month listing or 5% lead fee.",
        ],
      },
      {
        title: "3. Enterprise & Tech Park Expansion",
        badge: "High Ticket",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "White-label corporate facility deployment for IT tech parks (Infosys, TCS, Mindspace) and co-working chains at ₹2,50,000+/year.",
        ],
      },
    ],
    speakerNotes:
      "Our business model is high-margin B2B SaaS. We charge colleges ₹49,000 for standard or ₹99,000 per year for enterprise with unlimited Safe Desks and AI Quests. Cloud serverless costs are under ₹8,000 per college, giving us an 84% gross margin. With student council ambassador blitzes, our Customer Acquisition Cost is just ₹12,000 against a 3-year LTV of ₹2.5 Lakhs—an extraordinary LTV to CAC ratio of over 15 to 1.",
  },
  {
    id: 6,
    section: "5. CHALLENGES & MITIGATIONS",
    category: "MANDATORY SECTION 5",
    title: "Operational Risks Managed by Technical Safeguards",
    subtitle: "Addressing physical fraud, reward farming, adoption decay, and administrative bureaucracy.",
    cards: [
      {
        title: "Risk 1: False Claims & Theft",
        badge: "Solved",
        color: "border-emerald-500/40 bg-emerald-950/20",
        bullets: [
          "The Threat: Students claiming items that don't belong to them.",
          "Technical Shield: Single-use bcrypt-hashed PIN verified by authorized safe-desk staff; blurred public image previews; mandatory hidden verification questionnaires.",
        ],
      },
      {
        title: "Risk 2: Reward Farming & Collusion",
        badge: "Solved",
        color: "border-cyan-500/40 bg-cyan-950/20",
        bullets: [
          "The Threat: Two friends repeatedly reporting and returning the same item to farm coins.",
          "Technical Shield: checkPairCollusion algorithm automatically halts rewards and alerts moderators if a pair exceeds 2 handovers in 30 days.",
        ],
      },
      {
        title: "Risk 3: Adoption Fatigue",
        badge: "Solved",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "The Threat: Students losing interest after the first week.",
          "Technical Shield: Daily quest rotation tied to Asia/Kolkata midnight reset, Rush Hour Recon, seasonal league prestige, and squad hunts.",
        ],
      },
      {
        title: "Risk 4: Institutional Sales Cycles",
        badge: "Solved",
        color: "border-violet-500/40 bg-violet-950/20",
        bullets: [
          "The Threat: University purchase orders take 3 to 6 months.",
          "Technical Shield: Bottom-up student council adoption; offer a free 60-day pilot that proves recovery metrics before administrative sign-off.",
        ],
      },
    ],
    speakerNotes:
      "Judges often ask: What about fraud and reward gaming? We anticipated this. First, false claims are prevented by single-use bcrypt OTPs and staff verification. Second, our checkPairCollusion algorithm detects if two users repeatedly return items between each other. Third, student adoption is sustained through Asia/Kolkata daily quest turnovers and Rush Hour multipliers. And we bypass slow college sales cycles with free 60-day Student Council pilots.",
  },
  {
    id: 7,
    section: "6. FUTURE SCOPE & ROADMAP",
    category: "MANDATORY SECTION 6",
    title: "Scaling from College Prototype to National Standard",
    subtitle: "A 3-year phased expansion across higher education, IoT hardware, and corporate enterprise.",
    cards: [
      {
        title: "Phase 1: Pilot & Validation (Months 1–6)",
        badge: "Immediate",
        color: "border-emerald-500/40 bg-emerald-950/20",
        bullets: [
          "Deploy live pilot across AIEM and 5 neighboring engineering colleges in Goa.",
          "Validate core KPIs: Achieve 65%+ verified recovery rate and <4 hour turnaround.",
          "Integrate campus smart ID card and library databases.",
        ],
      },
      {
        title: "Phase 2: Scale & IoT Lockers (Months 7–18)",
        badge: "Expansion",
        color: "border-cyan-500/40 bg-cyan-950/20",
        bullets: [
          "Expand to 50+ campuses across Western India (Goa, Pune, Mumbai, Bengaluru).",
          "Deploy 'Smart Safe-Desk Dropboxes': IoT physical lockers with RFID and QR scanners for 24/7 unstaffed item deposit.",
          "Launch Computer Vision Image Matching to automatically match uploaded photos with lost reports.",
        ],
      },
      {
        title: "Phase 3: Enterprise & National TAM (Months 19–36)",
        badge: "Enterprise",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "Launch 'Workplace Hunt' for IT tech parks, transit hubs, and airports.",
          "Target ₹10+ Crore ARR with 200+ institutional clients nationwide.",
          "Partner with NAAC and NIRF accreditation bodies to include recovery rate as an audited student welfare metric.",
        ],
      },
    ],
    speakerNotes:
      "Our roadmap is focused and practical. Phase 1 validates the model across 5 Goa colleges to demonstrate a 65%+ recovery rate. Phase 2 scales to 50 campuses and introduces 24/7 IoT smart dropboxes with RFID scanners. Phase 3 expands into IT tech parks and transit hubs under 'Workplace Hunt', targeting ₹10 Crore ARR in 36 months.",
  },
  {
    id: 8,
    section: "WHY WE WIN & THE ASK",
    category: "PITCH CONCLUSION",
    title: "Practical Feasibility, Certified Code & The Ask",
    subtitle: "A production-ready platform built by students, tested rigorously, ready for campus rollout.",
    keyMetrics: [
      { label: "Built Codebase", value: "74 Routes", color: "text-emerald-400" },
      { label: "Test Pass Rate", value: "100% (430+)", color: "text-cyan-400" },
      { label: "The Seed Ask", value: "₹50,000", color: "text-amber-400" },
    ],
    cards: [
      {
        title: "Why AIEM Hunt is 100% Feasible",
        badge: "Zero Vaporware",
        color: "border-emerald-500/40 bg-emerald-950/20",
        bullets: [
          "Not just an idea on paper: A fully responsive Next.js 15 PWA already operational on campus devices.",
          "16 automated test suites covering bcrypt auth, concurrency locks, and 320px–1920px viewports.",
          "Zero hardware dependency to start: Works instantly on any student phone or librarian laptop.",
        ],
      },
      {
        title: "The Ask & Next Steps",
        badge: "Ready to Deploy",
        color: "border-amber-500/40 bg-amber-950/20",
        bullets: [
          "Seeking ₹50,000 pilot grant and incubation mentorship.",
          "Funds will cover Safe-Desk hardware signage, staff orientation, and pilot rollout across 3 colleges.",
          "Join us in making lost-item anxiety a thing of the past. Thank you, and we welcome your questions!",
        ],
      },
    ],
    speakerNotes:
      "To conclude: AIEM Hunt is not a theoretical slide deck. It is a certified, fully functional application built right here on our campus, verified across 74 routes with 100% test pass rate. We are asking for ₹50,000 in pilot grant support and incubation mentorship to launch across 3 campuses this semester. Thank you, sharks—we are ready for your questions!",
  },
];

export default function PitchDeckPage() {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [showNotes, setShowNotes] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(7 * 60); // 7 minutes
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  const slide = SLIDES[currentSlideIndex];

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1));
        sfx.playRadarPing(1400, 0.15);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
        sfx.playRadarPing(1000, 0.15);
      } else if (e.key.toLowerCase() === "s") {
        setShowNotes((prev) => !prev);
      } else if (e.key.toLowerCase() === "f") {
        toggleFullscreen();
      }
    },
    []
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // 7-minute pitch timer
  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          setIsTimerRunning(false);
          sfx.playSafeDeskStamp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const timerColor =
    timerSeconds <= 60
      ? "text-rose-400 border-rose-500/50 bg-rose-950/40 animate-pulse"
      : timerSeconds <= 120
      ? "text-amber-400 border-amber-500/50 bg-amber-950/40"
      : "text-emerald-400 border-emerald-500/50 bg-emerald-950/40";

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-black">
      {/* Top HUD Controls Bar */}
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-mono font-bold text-slate-400 hover:text-emerald-400 transition-colors"
          >
            ← AIEM HUNT HQ
          </Link>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest hidden sm:inline">
            PITCH IT! ARENA 2026 // SLIDE {slide.id} OF {SLIDES.length}
          </span>
        </div>

        {/* Center: 7-Minute Pitch Timer */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTimerRunning((prev) => !prev)}
            type="button"
            className={`flex items-center gap-2 px-3 py-1 rounded-xl border text-xs font-mono font-bold transition-all ${timerColor}`}
            title="Click to start/pause 7-minute pitch timer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{formatTimer(timerSeconds)}</span>
            <span className="text-[10px] text-slate-400 uppercase">
              {isTimerRunning ? "PAUSE" : "START"}
            </span>
          </button>
          <button
            onClick={() => {
              setIsTimerRunning(false);
              setTimerSeconds(7 * 60);
            }}
            type="button"
            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 px-1.5 py-1"
            title="Reset timer to 7:00"
          >
            RESET
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotes((prev) => !prev)}
            type="button"
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
              showNotes
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-slate-900 border-white/10 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes (S)</span>
          </button>

          <button
            onClick={toggleFullscreen}
            type="button"
            aria-label="Toggle Fullscreen"
            className="p-1.5 rounded-lg bg-slate-900 border border-white/10 text-slate-300 hover:bg-slate-800"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <a
            href="/AIEM_Hunt_Pitch_Deck.pptx"
            download="AIEM_Hunt_Pitch_Deck.pptx"
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold transition-all"
            title="Download PowerPoint Presentation"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PPTX</span>
          </a>
        </div>
      </header>

      {/* Main Slide Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {/* Slide Category & Section */}
        <div className="flex items-center gap-3 mb-2">
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-widest">
            {slide.category}
          </span>
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
            {slide.section}
          </span>
        </div>

        {/* Slide Titles */}
        <div className="mb-6">
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            {slide.title}
          </h1>
          <p className="text-sm sm:text-lg text-slate-400 font-mono mt-2 max-w-4xl">
            {slide.subtitle}
          </p>
        </div>

        {/* Key Metrics Banner (if present) */}
        {slide.keyMetrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {slide.keyMetrics.map((m, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col"
              >
                <span className="text-[11px] font-mono text-slate-400 uppercase">{m.label}</span>
                <span className={`text-2xl sm:text-3xl font-black font-mono mt-1 ${m.color || "text-white"}`}>
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Slide Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {slide.cards.map((c, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border backdrop-blur-xl flex flex-col justify-between transition-all hover:scale-[1.01] ${c.color}`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                    {c.title}
                  </h2>
                  {c.badge && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-slate-300 border border-white/10">
                      {c.badge}
                    </span>
                  )}
                </div>
                <ul className="space-y-2.5">
                  {c.bullets.map((b, bIdx) => (
                    <li key={bIdx} className="text-xs sm:text-sm text-slate-300 font-mono leading-relaxed flex items-start gap-2">
                      <span className="text-emerald-400 mt-1">▸</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Speaker Notes Drawer (Toggled by 'S' key or button) */}
        {showNotes && (
          <div className="mt-6 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200">
            <div className="flex items-center gap-2 mb-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                SPEAKER SCRIPT / NOTES FOR SLIDE {slide.id}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-mono leading-relaxed text-amber-100">
              {slide.speakerNotes}
            </p>
          </div>
        )}
      </main>

      {/* Bottom Navigation & Slide Selector Bar */}
      <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur-md px-4 py-3 flex items-center justify-between gap-4">
        {/* Previous Button */}
        <button
          onClick={() => {
            setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
            sfx.playRadarPing(1000, 0.15);
          }}
          disabled={currentSlideIndex === 0}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>PREV</span>
        </button>

        {/* Thumbnail Selector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {SLIDES.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => {
                setCurrentSlideIndex(idx);
                sfx.playRadarPing(1200, 0.15);
              }}
              type="button"
              className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all shrink-0 ${
                idx === currentSlideIndex
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              {s.id}. {s.section.split(".")[0]}
            </button>
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={() => {
            setCurrentSlideIndex((prev) => Math.min(SLIDES.length - 1, prev + 1));
            sfx.playRadarPing(1400, 0.15);
          }}
          disabled={currentSlideIndex === SLIDES.length - 1}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-mono font-bold hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <span>NEXT</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </footer>
    </div>
  );
}
