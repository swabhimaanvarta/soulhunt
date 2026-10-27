import fs from "fs";
import path from "path";
import sharp from "sharp";
import bcrypt from "bcryptjs";
import { connectDB } from "../lib/db";
import {
  LostItem,
  FoundItem,
  CampusLocation,
  User,
  ClaimRequest,
  EvidenceRecord,
} from "../models";

// SVG Graphic Generators for realistic campus belongings
const ITEM_SVGS: Record<string, string> = {
  // 1. Casio FX-991EX Scientific Calculator
  "calc-fx991": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b1120"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="c_body" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="c_screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="solar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#451a03"/><stop offset="50%" stop-color="#78350f"/><stop offset="100%" stop-color="#451a03"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg1)"/>
  <circle cx="400" cy="300" r="220" fill="#0284c7" opacity="0.12"/>
  <!-- Calculator Body -->
  <rect x="250" y="60" width="300" height="480" rx="36" fill="url(#c_body)" stroke="#475569" stroke-width="4"/>
  <!-- Solar Panel -->
  <rect x="430" y="90" width="85" height="18" rx="4" fill="url(#solar)" stroke="#b45309" stroke-width="1"/>
  <!-- Screen -->
  <rect x="280" y="125" width="240" height="95" rx="12" fill="url(#c_screen)" stroke="#0284c7" stroke-width="2"/>
  <text x="295" y="155" font-family="monospace" font-size="14" fill="#38bdf8" font-weight="bold">CASIO fx-991EX CLASSWIZ</text>
  <text x="295" y="195" font-family="monospace" font-size="22" fill="#38bdf8" font-weight="bold">f(x) = ∫ sin(x)dx = 0.54</text>
  <!-- D-Pad -->
  <circle cx="400" cy="255" r="28" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
  <circle cx="400" cy="255" r="14" fill="#0f172a"/>
  <!-- Upper Function Keys -->
  <rect x="285" y="240" width="36" height="20" rx="6" fill="#f59e0b"/>
  <rect x="330" y="240" width="36" height="20" rx="6" fill="#ec4899"/>
  <rect x="435" y="240" width="36" height="20" rx="6" fill="#475569"/>
  <rect x="480" y="240" width="36" height="20" rx="6" fill="#475569"/>
  <!-- Scientific Keys Matrix -->
  <g fill="#1e293b" stroke="#334155" stroke-width="1.5">
    <rect x="285" y="295" width="45" height="26" rx="6"/><rect x="345" y="295" width="45" height="26" rx="6"/><rect x="405" y="295" width="45" height="26" rx="6"/><rect x="465" y="295" width="45" height="26" rx="6"/>
    <rect x="285" y="335" width="45" height="26" rx="6"/><rect x="345" y="335" width="45" height="26" rx="6"/><rect x="405" y="335" width="45" height="26" rx="6"/><rect x="465" y="335" width="45" height="26" rx="6"/>
    <rect x="285" y="375" width="45" height="26" rx="6"/><rect x="345" y="375" width="45" height="26" rx="6"/><rect x="405" y="375" width="45" height="26" rx="6"/><rect x="465" y="375" width="45" height="26" rx="6"/>
  </g>
  <!-- Number Keys -->
  <g fill="#f8fafc" opacity="0.9">
    <rect x="285" y="420" width="45" height="30" rx="6" fill="#334155"/><rect x="345" y="420" width="45" height="30" rx="6" fill="#334155"/><rect x="405" y="420" width="45" height="30" rx="6" fill="#334155"/><rect x="465" y="420" width="45" height="30" rx="6" fill="#e11d48"/>
    <rect x="285" y="465" width="45" height="30" rx="6" fill="#334155"/><rect x="345" y="465" width="45" height="30" rx="6" fill="#334155"/><rect x="405" y="465" width="45" height="30" rx="6" fill="#334155"/><rect x="465" y="465" width="45" height="30" rx="6" fill="#e11d48"/>
  </g>
</svg>`,

  // 2. Apple AirPods Pro (2nd Gen)
  "airpods-pro": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
    <linearGradient id="case" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient>
    <linearGradient id="inner" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#94a3b8"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg2)"/>
  <ellipse cx="400" cy="320" rx="200" ry="140" fill="#6366f1" opacity="0.15"/>
  <!-- Open Case Body -->
  <rect x="270" y="240" width="260" height="200" rx="60" fill="url(#case)" stroke="#cbd5e1" stroke-width="3"/>
  <rect x="285" y="240" width="230" height="50" rx="20" fill="url(#inner)"/>
  <ellipse cx="340" cy="255" rx="30" ry="18" fill="#475569"/>
  <ellipse cx="460" cy="255" rx="30" ry="18" fill="#475569"/>
  <!-- Open Lid (Tilted Up) -->
  <path d="M 270 240 C 270 140, 530 140, 530 240 Z" fill="url(#case)" stroke="#cbd5e1" stroke-width="3"/>
  <!-- Status LED -->
  <circle cx="400" cy="330" r="4" fill="#22c55e"/>
  <circle cx="400" cy="330" r="8" fill="#22c55e" opacity="0.4"/>
  <!-- Left AirPod -->
  <g transform="translate(320, 160)">
    <circle cx="20" cy="30" r="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="14" y="45" width="12" height="55" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <ellipse cx="32" cy="30" rx="12" ry="16" fill="#e2e8f0"/>
    <rect x="14" y="94" width="12" height="6" fill="#94a3b8"/>
  </g>
  <!-- Right AirPod -->
  <g transform="translate(440, 160)">
    <circle cx="20" cy="30" r="24" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <rect x="14" y="45" width="12" height="55" rx="6" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <ellipse cx="8" cy="30" rx="12" ry="16" fill="#e2e8f0"/>
    <rect x="14" y="94" width="12" height="6" fill="#94a3b8"/>
  </g>
  <!-- Lanyard Loop -->
  <rect x="525" y="325" width="8" height="24" rx="4" fill="#94a3b8"/>
</svg>`,

  // 3. AIEM Student Identity Card & Blue Lanyard
  "student-id": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#090d16"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="lanyard" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1d4ed8"/><stop offset="100%" stop-color="#1e40af"/></linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#f1f5f9"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg3)"/>
  <!-- Lanyard Straps -->
  <path d="M 330 0 L 370 200 L 410 200 L 450 0" fill="none" stroke="url(#lanyard)" stroke-width="32" stroke-linecap="round"/>
  <path d="M 330 0 L 370 200 L 410 200 L 450 0" fill="none" stroke="#60a5fa" stroke-width="2" stroke-dasharray="8 8"/>
  <!-- Clip & Swivel -->
  <rect x="385" y="195" width="30" height="25" rx="6" fill="#94a3b8" stroke="#64748b" stroke-width="2"/>
  <circle cx="400" cy="225" r="10" fill="none" stroke="#94a3b8" stroke-width="4"/>
  <rect x="390" y="235" width="20" height="20" rx="4" fill="#cbd5e1"/>
  <!-- ID Card (Hanging) -->
  <rect x="260" y="250" width="280" height="330" rx="20" fill="url(#card)" stroke="#cbd5e1" stroke-width="3" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.5))"/>
  <!-- ID Slot Punch -->
  <rect x="375" y="262" width="50" height="10" rx="5" fill="#475569"/>
  <!-- College Header -->
  <rect x="260" y="285" width="280" height="50" fill="#1e3a8a"/>
  <text x="400" y="308" font-family="sans-serif" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="middle" letter-spacing="1">AGNEL INSTITUTE OF TECHNOLOGY</text>
  <text x="400" y="324" font-family="sans-serif" font-size="11" fill="#93c5fd" font-weight="bold" text-anchor="middle">AND DESIGN • GOA</text>
  <!-- Photo Box -->
  <rect x="285" y="350" width="85" height="105" rx="10" fill="#e2e8f0" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="327" cy="385" r="22" fill="#64748b"/>
  <path d="M 300 445 C 300 415, 355 415, 355 445 Z" fill="#64748b"/>
  <!-- Student Details -->
  <text x="385" y="375" font-family="sans-serif" font-size="14" fill="#0f172a" font-weight="bold">STUDENT ID</text>
  <text x="385" y="398" font-family="sans-serif" font-size="12" fill="#2563eb" font-weight="bold">COMPUTER ENGG</text>
  <text x="385" y="418" font-family="sans-serif" font-size="11" fill="#475569">BATCH 2024 - 2028</text>
  <rect x="385" y="430" width="70" height="20" rx="4" fill="#22c55e" opacity="0.2"/>
  <text x="420" y="444" font-family="monospace" font-size="11" fill="#15803d" font-weight="bold" text-anchor="middle">ACTIVE</text>
  <!-- Barcode -->
  <g fill="#0f172a">
    <rect x="290" y="480" width="4" height="40"/><rect x="298" y="480" width="8" height="40"/><rect x="310" y="480" width="2" height="40"/><rect x="316" y="480" width="6" height="40"/>
    <rect x="326" y="480" width="10" height="40"/><rect x="340" y="480" width="4" height="40"/><rect x="348" y="480" width="6" height="40"/><rect x="358" y="480" width="2" height="40"/>
    <rect x="364" y="480" width="8" height="40"/><rect x="376" y="480" width="4" height="40"/><rect x="384" y="480" width="10" height="40"/><rect x="398" y="480" width="4" height="40"/>
    <rect x="406" y="480" width="6" height="40"/><rect x="416" y="480" width="4" height="40"/><rect x="424" y="480" width="8" height="40"/><rect x="436" y="480" width="2" height="40"/>
    <rect x="442" y="480" width="10" height="40"/><rect x="456" y="480" width="6" height="40"/><rect x="466" y="480" width="4" height="40"/><rect x="474" y="480" width="8" height="40"/>
  </g>
  <text x="400" y="540" font-family="monospace" font-size="12" fill="#64748b" text-anchor="middle">|||||||||||||||||||||||||||||||||</text>
</svg>`,

  // 4. Wildcraft Campus Backpack
  "backpack": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg4" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#134e4a"/></linearGradient>
    <linearGradient id="bp_body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="bp_accent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0d9488"/><stop offset="100%" stop-color="#0f766e"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg4)"/>
  <circle cx="400" cy="300" r="220" fill="#14b8a6" opacity="0.12"/>
  <!-- Top Handle -->
  <path d="M 360 120 C 360 80, 440 80, 440 120" fill="none" stroke="#334155" stroke-width="14" stroke-linecap="round"/>
  <!-- Main Backpack Contour -->
  <path d="M 300 160 C 300 110, 500 110, 500 160 L 530 460 C 530 500, 270 500, 270 460 Z" fill="url(#bp_body)" stroke="#475569" stroke-width="4"/>
  <!-- Front Teal Panel -->
  <path d="M 320 220 C 320 180, 480 180, 480 220 L 490 440 C 490 470, 310 470, 310 440 Z" fill="url(#bp_accent)" stroke="#14b8a6" stroke-width="2"/>
  <!-- Zippers -->
  <path d="M 320 220 C 320 180, 480 180, 480 220" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-dasharray="6 4"/>
  <path d="M 330 310 L 470 310" fill="none" stroke="#e2e8f0" stroke-width="4" stroke-dasharray="6 4"/>
  <!-- Pull Tabs -->
  <circle cx="395" cy="310" r="6" fill="#f8fafc"/>
  <!-- Reflective Chevron -->
  <polygon points="400,380 370,410 380,410 400,390 420,410 430,410" fill="#f8fafc" opacity="0.9"/>
  <!-- Water Bottle Side Pocket -->
  <rect x="250" y="320" width="30" height="120" rx="10" fill="#334155" stroke="#64748b" stroke-width="2"/>
  <rect x="258" y="270" width="16" height="60" rx="4" fill="#0284c7" opacity="0.8"/>
  <!-- Brand Badge -->
  <rect x="360" y="250" width="80" height="24" rx="6" fill="#0f172a" stroke="#14b8a6" stroke-width="1.5"/>
  <text x="400" y="266" font-family="sans-serif" font-size="11" fill="#f8fafc" font-weight="bold" text-anchor="middle" letter-spacing="1">WILDCRAFT</text>
</svg>`,

  // 5. Boat Rockerz 450 Bluetooth Headphones
  "headphones": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="hp_band" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#334155"/><stop offset="50%" stop-color="#64748b"/><stop offset="100%" stop-color="#334155"/></linearGradient>
    <linearGradient id="cup" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg5)"/>
  <circle cx="400" cy="300" r="220" fill="#06b6d4" opacity="0.12"/>
  <!-- Headband Arch -->
  <path d="M 270 320 C 270 120, 530 120, 530 320" fill="none" stroke="url(#hp_band)" stroke-width="32" stroke-linecap="round"/>
  <path d="M 290 300 C 290 150, 510 150, 510 300" fill="none" stroke="#0f172a" stroke-width="16" stroke-linecap="round"/>
  <!-- Headband Cushion -->
  <path d="M 330 180 C 350 160, 450 160, 470 180" fill="none" stroke="#06b6d4" stroke-width="10" stroke-linecap="round" opacity="0.8"/>
  <!-- Left Earcup -->
  <g transform="translate(230, 280)">
    <rect x="0" y="0" width="60" height="110" rx="30" fill="url(#cup)" stroke="#475569" stroke-width="3"/>
    <ellipse cx="30" cy="55" rx="20" ry="40" fill="#06b6d4" opacity="0.85"/>
    <ellipse cx="30" cy="55" rx="10" ry="25" fill="#0f172a"/>
  </g>
  <!-- Right Earcup -->
  <g transform="translate(510, 280)">
    <rect x="0" y="0" width="60" height="110" rx="30" fill="url(#cup)" stroke="#475569" stroke-width="3"/>
    <ellipse cx="30" cy="55" rx="20" ry="40" fill="#06b6d4" opacity="0.85"/>
    <ellipse cx="30" cy="55" rx="10" ry="25" fill="#0f172a"/>
  </g>
  <!-- Control Buttons Indicator -->
  <circle cx="560" cy="360" r="4" fill="#22c55e"/>
  <text x="400" y="470" font-family="sans-serif" font-size="14" fill="#94a3b8" font-weight="bold" text-anchor="middle" letter-spacing="2">BOAT ROCKERZ 450</text>
</svg>`,

  // 6. Fastrack Reflex Play Smartwatch
  "smartwatch": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg6" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
    <linearGradient id="strap" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg6)"/>
  <circle cx="400" cy="300" r="200" fill="#06b6d4" opacity="0.15"/>
  <!-- Top Strap -->
  <rect x="350" y="50" width="100" height="170" rx="12" fill="url(#strap)" stroke="#334155" stroke-width="2"/>
  <line x1="360" y1="90" x2="440" y2="90" stroke="#475569" stroke-width="3"/>
  <line x1="360" y1="120" x2="440" y2="120" stroke="#475569" stroke-width="3"/>
  <line x1="360" y1="150" x2="440" y2="150" stroke="#475569" stroke-width="3"/>
  <!-- Bottom Strap -->
  <rect x="350" y="380" width="100" height="170" rx="12" fill="url(#strap)" stroke="#334155" stroke-width="2"/>
  <circle cx="400" cy="420" r="6" fill="#0f172a" stroke="#475569" stroke-width="2"/>
  <circle cx="400" cy="460" r="6" fill="#0f172a" stroke="#475569" stroke-width="2"/>
  <circle cx="400" cy="500" r="6" fill="#0f172a" stroke="#475569" stroke-width="2"/>
  <!-- Watch Case (Square with rounded corners) -->
  <rect x="310" y="190" width="180" height="220" rx="42" fill="#0f172a" stroke="#64748b" stroke-width="4" filter="drop-shadow(0 15px 30px rgba(0,0,0,0.6))"/>
  <!-- Crown Button -->
  <rect x="490" y="270" width="12" height="36" rx="4" fill="#94a3b8" stroke="#475569" stroke-width="1.5"/>
  <!-- Screen OLED -->
  <rect x="325" y="205" width="150" height="190" rx="30" fill="#020617" stroke="#06b6d4" stroke-width="2"/>
  <!-- UI Clock -->
  <text x="400" y="270" font-family="monospace" font-size="38" fill="#f8fafc" font-weight="bold" text-anchor="middle">11:42</text>
  <text x="400" y="295" font-family="sans-serif" font-size="12" fill="#38bdf8" font-weight="bold" text-anchor="middle">MON, 27 OCT</text>
  <!-- Activity Ring / Pulse -->
  <path d="M 350 335 L 370 335 L 380 315 L 390 350 L 400 325 L 410 335 L 450 335" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round"/>
  <text x="400" y="375" font-family="monospace" font-size="14" fill="#22c55e" font-weight="bold" text-anchor="middle">♥ 74 BPM • 4,820 steps</text>
</svg>`,

  // 7. Engineering Mini-Drafter
  "mini-drafter": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg7" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0b0f19"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#94a3b8"/><stop offset="50%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#64748b"/></linearGradient>
    <linearGradient id="acrylic" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="100%" stop-color="#e0f2fe" stop-opacity="0.7"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg7)"/>
  <!-- Desk Mounting Clamp -->
  <rect x="150" y="100" width="60" height="70" rx="8" fill="#334155" stroke="#64748b" stroke-width="2"/>
  <circle cx="180" cy="80" r="14" fill="url(#steel)"/>
  <!-- Articulated Arms (Parallel Bars) -->
  <line x1="180" y1="135" x2="350" y2="230" stroke="url(#steel)" stroke-width="8"/>
  <line x1="195" y1="145" x2="365" y2="240" stroke="url(#steel)" stroke-width="8"/>
  <circle cx="355" cy="235" r="12" fill="#475569" stroke="#94a3b8" stroke-width="2"/>
  <line x1="355" y1="235" x2="480" y2="350" stroke="url(#steel)" stroke-width="8"/>
  <line x1="370" y1="245" x2="495" y2="360" stroke="url(#steel)" stroke-width="8"/>
  <!-- Circular Protractor Head -->
  <circle cx="490" cy="355" r="50" fill="#0f172a" stroke="#38bdf8" stroke-width="3"/>
  <circle cx="490" cy="355" r="30" fill="#1e293b" stroke="#64748b" stroke-width="2"/>
  <!-- Degree Ticks -->
  <line x1="490" y1="310" x2="490" y2="320" stroke="#f8fafc" stroke-width="2"/>
  <line x1="535" y1="355" x2="525" y2="355" stroke="#f8fafc" stroke-width="2"/>
  <line x1="490" y1="400" x2="490" y2="390" stroke="#f8fafc" stroke-width="2"/>
  <line x1="445" y1="355" x2="455" y2="355" stroke="#f8fafc" stroke-width="2"/>
  <!-- Tightening Knob -->
  <circle cx="490" cy="355" r="14" fill="#0284c7" stroke="#ffffff" stroke-width="2"/>
  <!-- L-Scale (Horizontal Ruler) -->
  <rect x="490" y="340" width="220" height="30" rx="3" fill="url(#acrylic)" stroke="#38bdf8" stroke-width="2"/>
  <!-- L-Scale (Vertical Ruler) -->
  <rect x="475" y="355" width="30" height="180" rx="3" fill="url(#acrylic)" stroke="#38bdf8" stroke-width="2"/>
  <!-- Millimeter Markings -->
  <g stroke="#e11d48" stroke-width="1.5">
    <line x1="520" y1="340" x2="520" y2="350"/><line x1="540" y1="340" x2="540" y2="350"/><line x1="560" y1="340" x2="560" y2="355"/><line x1="580" y1="340" x2="580" y2="350"/><line x1="600" y1="340" x2="600" y2="350"/><line x1="620" y1="340" x2="620" y2="355"/><line x1="640" y1="340" x2="640" y2="350"/><line x1="660" y1="340" x2="660" y2="350"/><line x1="680" y1="340" x2="680" y2="355"/>
    <line x1="495" y1="380" x2="505" y2="380"/><line x1="495" y1="400" x2="505" y2="400"/><line x1="490" y1="420" x2="505" y2="420"/><line x1="495" y1="440" x2="505" y2="440"/><line x1="495" y1="460" x2="505" y2="460"/><line x1="490" y1="480" x2="505" y2="480"/><line x1="495" y1="500" x2="505" y2="500"/>
  </g>
</svg>`,

  // 8. Microprocessor 8086 Lab Record
  "lab-record": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg8" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
    <linearGradient id="book" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg8)"/>
  <!-- Book Body -->
  <rect x="250" y="80" width="340" height="440" rx="16" fill="url(#book)" stroke="#38bdf8" stroke-width="3" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Spiral Wire Holes -->
  <g fill="#94a3b8" stroke="#334155" stroke-width="2">
    <circle cx="270" cy="110" r="8"/><circle cx="270" cy="145" r="8"/><circle cx="270" cy="180" r="8"/><circle cx="270" cy="215" r="8"/>
    <circle cx="270" cy="250" r="8"/><circle cx="270" cy="285" r="8"/><circle cx="270" cy="320" r="8"/><circle cx="270" cy="355" r="8"/>
    <circle cx="270" cy="390" r="8"/><circle cx="270" cy="425" r="8"/><circle cx="270" cy="460" r="8"/><circle cx="270" cy="495" r="8"/>
  </g>
  <!-- Label Patch -->
  <rect x="305" y="140" width="250" height="200" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <rect x="305" y="140" width="250" height="30" rx="6" fill="#1e40af"/>
  <text x="430" y="160" font-family="sans-serif" font-size="11" fill="#ffffff" font-weight="bold" text-anchor="middle" letter-spacing="1">AGNEL INSTITUTE OF TECH &amp; DESIGN</text>
  <text x="430" y="200" font-family="sans-serif" font-size="14" fill="#0f172a" font-weight="bold" text-anchor="middle">MICROPROCESSOR LAB</text>
  <text x="430" y="222" font-family="monospace" font-size="12" fill="#2563eb" font-weight="bold" text-anchor="middle">8085 / 8086 INSTRUCTION SET</text>
  <line x1="325" y1="240" x2="535" y2="240" stroke="#cbd5e1" stroke-width="1.5"/>
  <text x="330" y="265" font-family="sans-serif" font-size="11" fill="#475569">NAME: RAHUL SHARMA</text>
  <text x="330" y="285" font-family="sans-serif" font-size="11" fill="#475569">ROLL NO: 23COMP042</text>
  <text x="330" y="305" font-family="sans-serif" font-size="11" fill="#475569">BATCH: B2 • SEM V</text>
  <!-- Red Faculty Stamp -->
  <rect x="420" y="380" width="130" height="70" rx="8" fill="none" stroke="#e11d48" stroke-width="3" transform="rotate(-10 480 415)"/>
  <text x="485" y="410" font-family="sans-serif" font-size="13" fill="#e11d48" font-weight="bold" text-anchor="middle" transform="rotate(-10 480 415)">VERIFIED &amp; SIGNED</text>
  <text x="485" y="430" font-family="sans-serif" font-size="10" fill="#e11d48" font-weight="bold" text-anchor="middle" transform="rotate(-10 480 415)">EXP 1 TO 6 • PASS</text>
</svg>`,

  // 9. AIEM Embroidered Lab Coat
  "lab-coat": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg9" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="coat" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg9)"/>
  <!-- Wooden Hanger -->
  <path d="M 400 80 C 390 60, 410 40, 400 30" fill="none" stroke="#94a3b8" stroke-width="6"/>
  <path d="M 280 120 L 400 80 L 520 120" fill="none" stroke="#b45309" stroke-width="12" stroke-linecap="round"/>
  <!-- Lab Coat Body -->
  <path d="M 330 110 L 250 250 L 290 270 L 330 200 L 320 540 L 480 540 L 470 200 L 510 270 L 550 250 L 470 110 Z" fill="url(#coat)" stroke="#cbd5e1" stroke-width="3"/>
  <!-- Lapel Collars -->
  <path d="M 350 110 L 370 240 L 400 240 L 400 110" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <path d="M 450 110 L 430 240 L 400 240 L 400 110" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2"/>
  <!-- Buttons -->
  <circle cx="400" cy="280" r="7" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="400" cy="340" r="7" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="400" cy="400" r="7" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="400" cy="460" r="7" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"/>
  <!-- Chest Pocket with College Crest -->
  <rect x="335" y="270" width="50" height="65" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
  <circle cx="360" cy="295" r="14" fill="#1e3a8a"/>
  <text x="360" y="300" font-family="sans-serif" font-size="10" fill="#ffffff" font-weight="bold" text-anchor="middle">AITD</text>
  <!-- Pens in Pocket -->
  <rect x="345" y="240" width="6" height="35" rx="2" fill="#2563eb"/>
  <rect x="355" y="245" width="6" height="30" rx="2" fill="#dc2626"/>
</svg>`,

  // 10. Milton Thermosteel Water Bottle
  "water-bottle": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg10" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#0c4a6e"/></linearGradient>
    <linearGradient id="bottle" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#0369a1"/><stop offset="40%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0c4a6e"/></linearGradient>
    <linearGradient id="cap" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#94a3b8"/><stop offset="50%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#64748b"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg10)"/>
  <circle cx="400" cy="300" r="200" fill="#0284c7" opacity="0.15"/>
  <!-- Carry Loop Handle -->
  <path d="M 370 120 C 370 70, 430 70, 430 120" fill="none" stroke="#334155" stroke-width="14" stroke-linecap="round"/>
  <!-- Cap -->
  <rect x="365" y="110" width="70" height="40" rx="8" fill="url(#cap)" stroke="#475569" stroke-width="2"/>
  <rect x="375" y="150" width="50" height="20" rx="4" fill="#334155"/>
  <!-- Bottle Body -->
  <path d="M 350 170 L 450 170 L 460 210 L 460 500 C 460 520, 340 520, 340 500 L 340 210 Z" fill="url(#bottle)" stroke="#0284c7" stroke-width="3"/>
  <!-- Insulated Groove Rings -->
  <line x1="340" y1="230" x2="460" y2="230" stroke="#0284c7" stroke-width="2"/>
  <line x1="340" y1="470" x2="460" y2="470" stroke="#0284c7" stroke-width="2"/>
  <!-- Laser Brand Engraving -->
  <text x="400" y="340" font-family="sans-serif" font-size="18" fill="#f8fafc" font-weight="bold" text-anchor="middle" letter-spacing="4" transform="rotate(-90 400 340)">MILTON 1000ml</text>
</svg>`,

  // 11. Brown Leather Wallet
  "leather-wallet": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg11" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0f172a"/><stop offset="100%" stop-color="#451a03"/></linearGradient>
    <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#78350f"/><stop offset="100%" stop-color="#451a03"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg11)"/>
  <circle cx="400" cy="300" r="200" fill="#b45309" opacity="0.15"/>
  <!-- Wallet Body -->
  <rect x="240" y="170" width="320" height="260" rx="24" fill="url(#leather)" stroke="#92400e" stroke-width="4" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Stitching -->
  <rect x="250" y="180" width="300" height="240" rx="18" fill="none" stroke="#fef3c7" stroke-width="2" stroke-dasharray="6 4" opacity="0.8"/>
  <!-- Center Bifold Seam -->
  <line x1="400" y1="170" x2="400" y2="430" stroke="#292524" stroke-width="5"/>
  <!-- Credit Card Pocket Slots -->
  <rect x="260" y="240" width="125" height="15" rx="3" fill="#292524"/>
  <rect x="260" y="275" width="125" height="15" rx="3" fill="#292524"/>
  <rect x="260" y="310" width="125" height="15" rx="3" fill="#292524"/>
  <!-- Card Edge Peeking Out -->
  <rect x="270" y="225" width="105" height="25" rx="4" fill="#0284c7" stroke="#38bdf8" stroke-width="1.5"/>
  <circle cx="285" cy="237" r="4" fill="#f59e0b"/>
  <!-- Metal Crest Logo -->
  <rect x="500" y="370" width="35" height="35" rx="6" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
  <text x="517" y="393" font-family="sans-serif" font-size="14" fill="#78350f" font-weight="bold" text-anchor="middle">H</text>
</svg>`,

  // 12. Set of 3 Brass Keys
  "brass-keys": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg12" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="50%" stop-color="#eab308"/><stop offset="100%" stop-color="#a16207"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg12)"/>
  <circle cx="400" cy="300" r="200" fill="#eab308" opacity="0.12"/>
  <!-- Keyring Split Ring -->
  <circle cx="340" cy="200" r="60" fill="none" stroke="#94a3b8" stroke-width="10"/>
  <circle cx="340" cy="200" r="60" fill="none" stroke="#cbd5e1" stroke-width="3"/>
  <!-- AIEM Acrylic Keychain Fob -->
  <polygon points="260,180 200,280 230,360 300,340 310,230" fill="#0284c7" stroke="#38bdf8" stroke-width="3" opacity="0.85"/>
  <text x="245" y="300" font-family="monospace" font-size="18" fill="#f8fafc" font-weight="bold" transform="rotate(-30 245 300)">AIEM</text>
  <!-- Key 1 (Long Godrej Locker Key) -->
  <g transform="translate(350, 200) rotate(25)">
    <circle cx="0" cy="0" r="30" fill="url(#brass)" stroke="#713f12" stroke-width="2"/>
    <circle cx="0" cy="0" r="12" fill="#020617"/>
    <rect x="-8" y="30" width="16" height="180" rx="3" fill="url(#brass)" stroke="#713f12" stroke-width="2"/>
    <rect x="8" y="160" width="22" height="10" rx="2" fill="url(#brass)"/>
    <rect x="8" y="180" width="16" height="10" rx="2" fill="url(#brass)"/>
    <rect x="8" y="200" width="26" height="10" rx="2" fill="url(#brass)"/>
  </g>
  <!-- Key 2 (Yale Brass Key) -->
  <g transform="translate(360, 210) rotate(55)">
    <circle cx="0" cy="0" r="26" fill="url(#brass)" stroke="#713f12" stroke-width="2"/>
    <circle cx="0" cy="0" r="10" fill="#020617"/>
    <rect x="-7" y="26" width="14" height="150" rx="3" fill="url(#brass)" stroke="#713f12" stroke-width="2"/>
    <rect x="7" y="120" width="18" height="8" rx="2" fill="url(#brass)"/>
    <rect x="7" y="140" width="24" height="8" rx="2" fill="url(#brass)"/>
    <rect x="7" y="160" width="14" height="8" rx="2" fill="url(#brass)"/>
  </g>
  <!-- Key 3 (Bike Key with Black Plastic Grip) -->
  <g transform="translate(330, 220) rotate(-15)">
    <rect x="-24" y="-24" width="48" height="48" rx="10" fill="#0f172a" stroke="#475569" stroke-width="3"/>
    <circle cx="0" cy="-6" r="8" fill="#94a3b8"/>
    <rect x="-6" y="24" width="12" height="130" rx="2" fill="#cbd5e1" stroke="#64748b" stroke-width="2"/>
    <path d="M 6 100 L 16 100 L 16 108 L 6 108 Z" fill="#cbd5e1"/>
    <path d="M 6 120 L 20 120 L 20 128 L 6 128 Z" fill="#cbd5e1"/>
  </g>
</svg>`,

  // 13. Logitech MX Master 3S Mouse
  "mx-master": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg13" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="mouse" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#64748b"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg13)"/>
  <circle cx="400" cy="300" r="200" fill="#06b6d4" opacity="0.12"/>
  <!-- Ergonomic Sculpted Body -->
  <path d="M 330 140 C 360 90, 440 90, 470 140 L 500 380 C 500 480, 310 480, 270 380 C 250 320, 250 250, 300 240 Z" fill="url(#mouse)" stroke="#475569" stroke-width="3" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Thumb Rest Wing -->
  <path d="M 270 340 C 240 320, 220 380, 260 410 C 280 425, 300 420, 300 380 Z" fill="#1e293b" stroke="#334155" stroke-width="2"/>
  <circle cx="260" cy="375" r="4" fill="#06b6d4"/>
  <!-- Thumb Scroll Wheel -->
  <rect x="290" y="270" width="12" height="40" rx="4" fill="url(#metal)" stroke="#334155" stroke-width="1"/>
  <!-- Main Scroll Wheel (MagSpeed Metal) -->
  <rect x="388" y="130" width="24" height="65" rx="8" fill="url(#metal)" stroke="#1e293b" stroke-width="2"/>
  <line x1="388" y1="150" x2="412" y2="150" stroke="#1e293b" stroke-width="2"/>
  <line x1="388" y1="170" x2="412" y2="170" stroke="#1e293b" stroke-width="2"/>
  <!-- Center Click Split -->
  <line x1="400" y1="95" x2="400" y2="125" stroke="#1e293b" stroke-width="3"/>
  <line x1="400" y1="200" x2="400" y2="250" stroke="#1e293b" stroke-width="2"/>
  <!-- DPI Shift Button -->
  <rect x="393" y="210" width="14" height="24" rx="4" fill="#475569"/>
</svg>`,

  // 14. Titan Neo Stainless Steel Watch
  "titan-watch": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg14" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
    <linearGradient id="steel_band" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#64748b"/><stop offset="50%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#475569"/></linearGradient>
    <linearGradient id="dial" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#090d16"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg14)"/>
  <!-- Metal Link Bracelet (Top) -->
  <rect x="355" y="40" width="90" height="180" rx="10" fill="url(#steel_band)" stroke="#475569" stroke-width="2"/>
  <line x1="355" y1="80" x2="445" y2="80" stroke="#334155" stroke-width="3"/>
  <line x1="355" y1="120" x2="445" y2="120" stroke="#334155" stroke-width="3"/>
  <line x1="355" y1="160" x2="445" y2="160" stroke="#334155" stroke-width="3"/>
  <!-- Metal Link Bracelet (Bottom) -->
  <rect x="355" y="380" width="90" height="180" rx="10" fill="url(#steel_band)" stroke="#475569" stroke-width="2"/>
  <line x1="355" y1="420" x2="445" y2="420" stroke="#334155" stroke-width="3"/>
  <line x1="355" y1="460" x2="445" y2="460" stroke="#334155" stroke-width="3"/>
  <line x1="355" y1="500" x2="445" y2="500" stroke="#334155" stroke-width="3"/>
  <!-- Watch Bezel -->
  <circle cx="400" cy="300" r="115" fill="url(#steel_band)" stroke="#94a3b8" stroke-width="4" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Sunray Blue Dial -->
  <circle cx="400" cy="300" r="95" fill="url(#dial)" stroke="#38bdf8" stroke-width="2"/>
  <!-- Hour Markers -->
  <line x1="400" y1="215" x2="400" y2="230" stroke="#ffffff" stroke-width="4"/>
  <line x1="485" y1="300" x2="470" y2="300" stroke="#ffffff" stroke-width="4"/>
  <line x1="400" y1="385" x2="400" y2="370" stroke="#ffffff" stroke-width="4"/>
  <line x1="315" y1="300" x2="330" y2="300" stroke="#ffffff" stroke-width="4"/>
  <!-- Brand Name -->
  <text x="400" y="260" font-family="sans-serif" font-size="12" fill="#cbd5e1" font-weight="bold" text-anchor="middle" letter-spacing="2">TITAN</text>
  <text x="400" y="275" font-family="sans-serif" font-size="9" fill="#93c5fd" font-weight="bold" text-anchor="middle">QUARTZ</text>
  <!-- Date Window -->
  <rect x="440" y="290" width="22" height="20" rx="3" fill="#ffffff" stroke="#94a3b8" stroke-width="1"/>
  <text x="451" y="305" font-family="monospace" font-size="11" fill="#0f172a" font-weight="bold" text-anchor="middle">27</text>
  <!-- Watch Hands -->
  <line x1="400" y1="300" x2="360" y2="260" stroke="#f8fafc" stroke-width="5" stroke-linecap="round"/>
  <line x1="400" y1="300" x2="445" y2="250" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
  <line x1="400" y1="300" x2="400" y2="360" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
  <circle cx="400" cy="300" r="6" fill="#f8fafc"/>
  <!-- Crown Button -->
  <rect x="515" y="288" width="12" height="24" rx="4" fill="url(#steel_band)"/>
</svg>`,

  // 15. SanDisk Extreme 1TB Rugged Portable SSD
  "sandisk-ssd": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg15" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="ssd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg15)"/>
  <circle cx="400" cy="300" r="200" fill="#f97316" opacity="0.12"/>
  <!-- SSD Body with Orange Corner Cutout -->
  <rect x="290" y="120" width="220" height="360" rx="36" fill="url(#ssd)" stroke="#ea580c" stroke-width="4" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Corner Carabiner Loop (Orange rubber insert) -->
  <rect x="420" y="135" width="70" height="70" rx="20" fill="#ea580c"/>
  <circle cx="455" cy="170" r="18" fill="#020617"/>
  <!-- Dimpled Texture Pattern -->
  <g fill="#475569" opacity="0.6">
    <circle cx="330" cy="240" r="3"/><circle cx="360" cy="240" r="3"/><circle cx="390" cy="240" r="3"/><circle cx="420" cy="240" r="3"/>
    <circle cx="330" cy="270" r="3"/><circle cx="360" cy="270" r="3"/><circle cx="390" cy="270" r="3"/><circle cx="420" cy="270" r="3"/>
    <circle cx="330" cy="300" r="3"/><circle cx="360" cy="300" r="3"/><circle cx="390" cy="300" r="3"/><circle cx="420" cy="300" r="3"/>
    <circle cx="330" cy="330" r="3"/><circle cx="360" cy="330" r="3"/><circle cx="390" cy="330" r="3"/><circle cx="420" cy="330" r="3"/>
  </g>
  <!-- Red Brand Banner -->
  <text x="400" y="400" font-family="sans-serif" font-size="20" fill="#ef4444" font-weight="bold" text-anchor="middle" letter-spacing="2">SanDisk</text>
  <text x="400" y="425" font-family="sans-serif" font-size="12" fill="#cbd5e1" font-weight="bold" text-anchor="middle">EXTREME PORTABLE 1TB</text>
  <!-- USB-C Port -->
  <rect x="375" y="475" width="50" height="10" rx="4" fill="#020617" stroke="#ea580c" stroke-width="2"/>
</svg>`,

  // 16. Ray-Ban Matte Black Wayfarer Glasses & Leather Case
  "rayban-glasses": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg16" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#1e293b"/><stop offset="100%" stop-color="#020617"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg16)"/>
  <!-- Open Leather Case in Background -->
  <ellipse cx="400" cy="350" rx="260" ry="120" fill="#1c1917" stroke="#44403c" stroke-width="3"/>
  <circle cx="400" cy="420" r="10" fill="#f59e0b" stroke="#78350f" stroke-width="2"/>
  <!-- Left Lens & Frame -->
  <g transform="translate(250, 200)">
    <rect x="0" y="0" width="130" height="95" rx="28" fill="url(#lens)" stroke="#09090b" stroke-width="12"/>
    <ellipse cx="50" cy="35" rx="35" ry="15" fill="#ffffff" opacity="0.15" transform="rotate(-20 50 35)"/>
    <circle cx="15" cy="15" r="3" fill="#cbd5e1"/>
  </g>
  <!-- Bridge -->
  <path d="M 380 220 C 395 210, 405 210, 420 220" fill="none" stroke="#09090b" stroke-width="12" stroke-linecap="round"/>
  <!-- Right Lens & Frame -->
  <g transform="translate(420, 200)">
    <rect x="0" y="0" width="130" height="95" rx="28" fill="url(#lens)" stroke="#09090b" stroke-width="12"/>
    <ellipse cx="50" cy="35" rx="35" ry="15" fill="#ffffff" opacity="0.15" transform="rotate(-20 50 35)"/>
    <circle cx="115" cy="15" r="3" fill="#cbd5e1"/>
    <text x="90" y="24" font-family="sans-serif" font-size="9" fill="#ffffff" opacity="0.8" font-weight="bold">Ray-Ban</text>
  </g>
  <!-- Temples (Arms) Extending Back -->
  <path d="M 255 210 L 210 160" stroke="#09090b" stroke-width="10" stroke-linecap="round"/>
  <path d="M 545 210 L 590 160" stroke="#09090b" stroke-width="10" stroke-linecap="round"/>
</svg>`,

  // 17. Auto-Open Windproof Navy Umbrella
  "umbrella": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg17" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="canopy" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg17)"/>
  <!-- Ferrule / Tip -->
  <rect x="580" y="100" width="10" height="25" rx="3" fill="#d97706" transform="rotate(45 585 112)"/>
  <!-- Folded Umbrella Shaft & Canopy -->
  <path d="M 570 120 L 290 400 L 260 370 L 540 90 Z" fill="url(#canopy)" stroke="#3b82f6" stroke-width="2" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.5))"/>
  <!-- Wrap Strap -->
  <rect x="390" y="260" width="35" height="12" rx="3" fill="#1e40af" stroke="#60a5fa" stroke-width="1.5" transform="rotate(45 407 266)"/>
  <circle cx="407" cy="266" r="3" fill="#f8fafc"/>
  <!-- Metal Shaft -->
  <line x1="280" y1="410" x2="230" y2="460" stroke="#94a3b8" stroke-width="12" stroke-linecap="round"/>
  <!-- Wooden Crook Handle -->
  <path d="M 230 460 C 200 490, 160 480, 160 440 C 160 410, 190 410, 200 430" fill="none" stroke="#78350f" stroke-width="18" stroke-linecap="round"/>
</svg>`,

  // 18. Helix Oxford Geometry Instrument Tin
  "geometry-tin": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg18" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="tin" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1e3a8a"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg18)"/>
  <!-- Metal Tin Box -->
  <rect x="230" y="160" width="340" height="280" rx="20" fill="url(#tin)" stroke="#38bdf8" stroke-width="4" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Embossed Gold Seal -->
  <rect x="250" y="180" width="300" height="240" rx="14" fill="none" stroke="#eab308" stroke-width="2" stroke-dasharray="8 4"/>
  <circle cx="400" cy="270" r="45" fill="none" stroke="#eab308" stroke-width="3"/>
  <text x="400" y="265" font-family="sans-serif" font-size="14" fill="#fef08a" font-weight="bold" text-anchor="middle" letter-spacing="2">THE AIEM</text>
  <text x="400" y="285" font-family="sans-serif" font-size="18" fill="#fef08a" font-weight="bold" text-anchor="middle" letter-spacing="3">OXFORD</text>
  <text x="400" y="340" font-family="sans-serif" font-size="12" fill="#cbd5e1" font-weight="bold" text-anchor="middle">MATHEMATICAL INSTRUMENTS</text>
  <text x="400" y="365" font-family="monospace" font-size="11" fill="#38bdf8" text-anchor="middle">ENGINEERING SET • 9 PCS</text>
</svg>`,

  // 19. HP 65W USB-C Laptop Charger
  "hp-charger": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg19" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
    <linearGradient id="brick" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg19)"/>
  <circle cx="400" cy="300" r="180" fill="#0284c7" opacity="0.12"/>
  <!-- Heavy Power Brick -->
  <rect x="290" y="200" width="220" height="180" rx="24" fill="url(#brick)" stroke="#475569" stroke-width="3" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Circular HP Logo Recess -->
  <circle cx="400" cy="290" r="36" fill="#1e293b" stroke="#0284c7" stroke-width="2"/>
  <text x="400" y="302" font-family="sans-serif" font-size="28" fill="#f8fafc" font-weight="bold" text-anchor="middle" font-style="italic">hp</text>
  <text x="400" y="350" font-family="monospace" font-size="11" fill="#94a3b8" text-anchor="middle">65W FAST CHARGE TYPE-C</text>
  <!-- Braided Cord Output -->
  <path d="M 290 290 C 230 290, 210 380, 260 440 C 310 500, 490 500, 540 440 L 550 420" fill="none" stroke="#64748b" stroke-width="12" stroke-linecap="round"/>
  <!-- USB-C Metal Tip -->
  <rect x="545" y="405" width="22" height="12" rx="4" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" transform="rotate(-30 556 411)"/>
</svg>`,

  // 20. Goa University Examination Hall Ticket
  "hall-ticket": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg20" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e1b4b"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg20)"/>
  <!-- Laminated Document Sheet -->
  <rect x="240" y="80" width="320" height="440" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="3" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- University Header -->
  <rect x="240" y="80" width="320" height="55" rx="6" fill="#4338ca"/>
  <text x="400" y="105" font-family="sans-serif" font-size="13" fill="#ffffff" font-weight="bold" text-anchor="middle" letter-spacing="1">GOA UNIVERSITY • AIEM CENTER</text>
  <text x="400" y="123" font-family="sans-serif" font-size="10" fill="#c7d2fe" font-weight="bold" text-anchor="middle">B.E. SEMESTER EXAMINATION ADMIT CARD</text>
  <!-- Student Photo Box -->
  <rect x="440" y="150" width="90" height="110" rx="6" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/>
  <circle cx="485" cy="185" r="20" fill="#64748b"/>
  <path d="M 460 240 C 460 215, 510 215, 510 240 Z" fill="#64748b"/>
  <!-- Candidate Info -->
  <text x="265" y="170" font-family="sans-serif" font-size="11" fill="#0f172a" font-weight="bold">CANDIDATE: PRIYA MUKHERJEE</text>
  <text x="265" y="195" font-family="monospace" font-size="11" fill="#4338ca" font-weight="bold">SEAT NO: 2026-ENG-4912</text>
  <text x="265" y="220" font-family="sans-serif" font-size="10" fill="#475569">BRANCH: INFORMATION TECH</text>
  <text x="265" y="240" font-family="sans-serif" font-size="10" fill="#475569">EXAM CENTER: AIEM BLK-ADMIN</text>
  <!-- Exam Table Grid -->
  <rect x="260" y="275" width="280" height="130" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1"/>
  <line x1="260" y1="305" x2="540" y2="305" stroke="#cbd5e1" stroke-width="1"/>
  <text x="270" y="295" font-family="sans-serif" font-size="9" fill="#0f172a" font-weight="bold">DATE</text>
  <text x="340" y="295" font-family="sans-serif" font-size="9" fill="#0f172a" font-weight="bold">SUBJECT</text>
  <text x="480" y="295" font-family="sans-serif" font-size="9" fill="#0f172a" font-weight="bold">SIGN</text>
  <!-- Purple Controller Stamp -->
  <circle cx="340" cy="450" r="35" fill="none" stroke="#7e22ce" stroke-width="2.5" opacity="0.8"/>
  <text x="340" y="445" font-family="sans-serif" font-size="8" fill="#7e22ce" font-weight="bold" text-anchor="middle">CONTROLLER OF EXAMS</text>
  <text x="340" y="458" font-family="sans-serif" font-size="7" fill="#7e22ce" font-weight="bold" text-anchor="middle">GOA UNIVERSITY</text>
</svg>`,

  // 21. Anker PowerCore 20000mAh Power Bank
  "anker-powerbank": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg21" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
    <linearGradient id="pb_body" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#475569"/><stop offset="100%" stop-color="#0f172a"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg21)"/>
  <circle cx="400" cy="300" r="180" fill="#38bdf8" opacity="0.12"/>
  <!-- Power Bank Shell -->
  <rect x="270" y="130" width="260" height="340" rx="36" fill="url(#pb_body)" stroke="#64748b" stroke-width="3" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- 4 Glowing LED Battery Indicators -->
  <circle cx="340" cy="180" r="5" fill="#38bdf8"/>
  <circle cx="360" cy="180" r="5" fill="#38bdf8"/>
  <circle cx="380" cy="180" r="5" fill="#38bdf8"/>
  <circle cx="400" cy="180" r="5" fill="#38bdf8"/>
  <!-- Power Button -->
  <rect x="520" y="210" width="10" height="30" rx="3" fill="#64748b"/>
  <!-- Brand Header -->
  <text x="400" y="300" font-family="sans-serif" font-size="28" fill="#f8fafc" font-weight="bold" text-anchor="middle" letter-spacing="3">ANKER</text>
  <text x="400" y="325" font-family="monospace" font-size="12" fill="#38bdf8" font-weight="bold" text-anchor="middle">PowerCore 20,000mAh PD</text>
  <!-- Ports (Top Bevel) -->
  <rect x="330" y="140" width="30" height="12" rx="3" fill="#020617" stroke="#38bdf8" stroke-width="1.5"/>
  <rect x="385" y="140" width="30" height="12" rx="3" fill="#020617" stroke="#38bdf8" stroke-width="1.5"/>
  <rect x="440" y="142" width="20" height="8" rx="2" fill="#020617" stroke="#22c55e" stroke-width="1.5"/>
</svg>`,

  // 22. Vintage Casio A168 Gold Digital Watch
  "casio-gold": `
<svg width="800" height="600" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg22" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#020617"/><stop offset="100%" stop-color="#451a03"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#ca8a04"/><stop offset="50%" stop-color="#fef08a"/><stop offset="100%" stop-color="#a16207"/></linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg22)"/>
  <!-- Gold Link Band (Top) -->
  <rect x="360" y="40" width="80" height="160" rx="6" fill="url(#gold)" stroke="#854d0e" stroke-width="2"/>
  <line x1="360" y1="80" x2="440" y2="80" stroke="#713f12" stroke-width="2"/>
  <line x1="360" y1="120" x2="440" y2="120" stroke="#713f12" stroke-width="2"/>
  <line x1="360" y1="160" x2="440" y2="160" stroke="#713f12" stroke-width="2"/>
  <!-- Gold Link Band (Bottom) -->
  <rect x="360" y="400" width="80" height="160" rx="6" fill="url(#gold)" stroke="#854d0e" stroke-width="2"/>
  <line x1="360" y1="440" x2="440" y2="440" stroke="#713f12" stroke-width="2"/>
  <line x1="360" y1="480" x2="440" y2="480" stroke="#713f12" stroke-width="2"/>
  <line x1="360" y1="520" x2="440" y2="520" stroke="#713f12" stroke-width="2"/>
  <!-- Rectangular Gold Case -->
  <rect x="320" y="190" width="160" height="220" rx="20" fill="url(#gold)" stroke="#713f12" stroke-width="3" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  <!-- Dial Face Plate -->
  <rect x="335" y="210" width="130" height="180" rx="14" fill="#1e293b" stroke="#0f172a" stroke-width="2"/>
  <text x="400" y="235" font-family="sans-serif" font-size="11" fill="#fef08a" font-weight="bold" text-anchor="middle">CASIO</text>
  <text x="400" y="250" font-family="sans-serif" font-size="8" fill="#38bdf8" text-anchor="middle">ILLUMINATOR • WATER RESIST</text>
  <!-- LCD Screen -->
  <rect x="345" y="265" width="110" height="70" rx="6" fill="#fef9c3" stroke="#854d0e" stroke-width="2"/>
  <text x="400" y="312" font-family="monospace" font-size="28" fill="#0f172a" font-weight="bold" text-anchor="middle">10:58</text>
  <text x="440" y="290" font-family="monospace" font-size="12" fill="#0f172a" font-weight="bold">50</text>
  <!-- Buttons -->
  <rect x="312" y="230" width="8" height="20" rx="2" fill="url(#gold)"/>
  <rect x="312" y="310" width="8" height="20" rx="2" fill="url(#gold)"/>
  <rect x="480" y="310" width="8" height="20" rx="2" fill="url(#gold)"/>
</svg>`,
};

export async function seedRichItems() {
  await connectDB();
  console.log("🌱 Starting Rich Campus Items & Images Seed...");

  // Safety Guard: Ensure not in remote/atlas production
  const uri = process.env.MONGODB_URI || "";
  if (uri.toLowerCase().includes("atlas") || (process.env.NODE_ENV === "production" && !uri.includes("127.0.0.1"))) {
    throw new Error("🛑 SAFETY ABORT: Rich item seed strictly forbidden on remote or production databases.");
  }

  // Ensure storage directory
  const storageDir = path.join(process.cwd(), "storage", "evidence");
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // Retrieve base users & locations
  const users = await User.find({});
  const locations = await CampusLocation.find({});
  if (users.length === 0 || locations.length === 0) {
    console.error("Missing users or locations in database. Please run base seed first.");
    return;
  }

  const uMap: Record<string, any> = {};
  users.forEach((u) => {
    uMap[u.username] = u._id;
  });

  const locMap: Record<string, any> = {};
  locations.forEach((loc) => {
    locMap[loc.code] = loc._id;
  });

  const defaultUser = users[0]._id;
  const adminUser = uMap["commander_aiem"] || defaultUser;
  const modUser = uMap["warden_sen"] || defaultUser;
  const rahul = uMap["rahul_seeker"] || defaultUser;
  const vishnu = uMap["vishnu_trace"] || defaultUser;
  const aryan = uMap["aryan_falcon"] || defaultUser;
  const priya = uMap["priya_cipher"] || defaultUser;
  const vishnu07 = uMap["vishnugawas07"] || vishnu;

  const safeGate = locMap["SAFE-GATE"] || locations[0]._id;
  const safeLib = locMap["SAFE-LIB"] || locations[1]?._id || safeGate;
  const blkAdmin = locMap["BLK-ADMIN"] || locations[0]._id;
  const compAi = locMap["COMP-AI"] || locations[0]._id;
  const mechRobot = locMap["MECH-ROBOT"] || locations[0]._id;
  const libCentral = locMap["LIB-CENTRAL"] || locations[0]._id;
  const canteen = locMap["CANTEEN-01"] || locations[0]._id;
  const sports = locMap["SPORTS-ARENA"] || locations[0]._id;
  const eceG = locMap["ECE-G"] || locations[0]._id;

  // Helper to render SVG to WebP & save files
  async function generateWebPImages(key: string, uploaderId: any) {
    const svg = ITEM_SVGS[key];
    if (!svg) {
      return {
        photoUrl: "/placeholder-item.png",
        blurredPhotoUrl: "/placeholder-item.png",
      };
    }

    const filename = `ev_showcase_${key}.webp`;
    const blurFilename = `ev_showcase_${key}_blur.webp`;
    const targetPath = path.join(storageDir, filename);
    const blurTargetPath = path.join(storageDir, blurFilename);

    try {
      const normalBuf = await sharp(Buffer.from(svg))
        .webp({ quality: 85, effort: 4 })
        .toBuffer();

      const blurBuf = await sharp(Buffer.from(svg))
        .blur(18)
        .webp({ quality: 75, effort: 4 })
        .toBuffer();

      await fs.promises.writeFile(targetPath, normalBuf);
      await fs.promises.writeFile(blurTargetPath, blurBuf);

      // Register in EvidenceRecord
      await EvidenceRecord.findOneAndUpdate(
        { filename },
        { filename, uploadedBy: uploaderId },
        { upsert: true, new: true }
      );
      await EvidenceRecord.findOneAndUpdate(
        { filename: blurFilename },
        { filename: blurFilename, uploadedBy: uploaderId },
        { upsert: true, new: true }
      );

      return {
        photoUrl: `/api/evidence/${filename}`,
        blurredPhotoUrl: `/api/evidence/${blurFilename}`,
      };
    } catch (err) {
      console.error(`Error generating image for ${key}:`, err);
      return {
        photoUrl: "/placeholder-item.png",
        blurredPhotoUrl: "/placeholder-item.png",
      };
    }
  }

  // 12 Realistic Lost Items (Actively Missing Belongings)
  const lostItemsData = [
    {
      svgKey: "calc-fx991",
      title: "Casio FX-991EX Scientific Calculator",
      category: "ELECTRONICS",
      publicDescription: "Black ClassWiz scientific calculator with solar panel strip. Misplaced between Block B Digital Lab and the Canteen corridor.",
      secretIdentifiers: "Engraved initials 'P.M. IT-24' and small scratch on the back slide cover.",
      verificationQuestion: "What mathematical formula is written on the slide cover sticker?",
      verificationAnswer: "euler",
      reporterId: priya,
      lastKnownLocationId: compAi,
      spotDetails: "Room B-204 Digital Systems Lab Bench #7",
      rewardOffered: 25,
      status: "ACTIVE",
    },
    {
      svgKey: "airpods-pro",
      title: "Apple AirPods Pro 2nd Gen in MagSafe Case",
      category: "ELECTRONICS",
      publicDescription: "White wireless charging case with left and right earbuds. Left behind at the silent study desk in Central Library 2nd Floor.",
      secretIdentifiers: "Custom laser engraving letter 'R' centered on the front case.",
      verificationQuestion: "What initial is engraved on the front of the charging case?",
      verificationAnswer: "r",
      reporterId: rahul,
      lastKnownLocationId: libCentral,
      spotDetails: "Central Library 2nd Floor — Cubicle Row 3 Desk 14",
      rewardOffered: 35,
      status: "ACTIVE",
    },
    {
      svgKey: "student-id",
      title: "AIEM Student ID Card & Royal Blue Lanyard",
      category: "ID_CARDS_DOCS",
      publicDescription: "Official college ID card in a transparent sleeve attached to a blue Agnel Institute lanyard. Lost near Computer Dept stairwell.",
      secretIdentifiers: "Roll number 23COMP042, red blood group indicator A+ on reverse.",
      verificationQuestion: "What is the 3-letter department code printed above the photo?",
      verificationAnswer: "cse",
      reporterId: vishnu07,
      lastKnownLocationId: compAi,
      spotDetails: "Computer Department Corridor -> Ground Floor Stairs",
      rewardOffered: 15,
      status: "ACTIVE",
    },
    {
      svgKey: "backpack",
      title: "Wildcraft Cyber-Teal Campus Backpack",
      category: "BAGS_WALLETS",
      publicDescription: "Charcoal grey and teal water-resistant daypack with two compartments and mesh bottle sleeve. Forgotten on cafeteria bench.",
      secretIdentifiers: "Contains a blue spiral notebook and stainless steel geometry box in main compartment.",
      verificationQuestion: "What novel or textbook was in the front zippered pouch?",
      verificationAnswer: "algorithms",
      reporterId: aryan,
      lastKnownLocationId: canteen,
      spotDetails: "Cafeteria Outdoor Courtyard — Wooden Bench #4",
      rewardOffered: 20,
      status: "ACTIVE",
    },
    {
      svgKey: "headphones",
      title: "Boat Rockerz 450 Bluetooth On-Ear Headphones",
      category: "ELECTRONICS",
      publicDescription: "Matte black wireless headphones with cushioned ear cups and teal inner accents. Left on workbench in Mechanical Workshop.",
      secretIdentifiers: "Small chip on the left volume rocker button.",
      verificationQuestion: "What color is the silicone cushion on the inner headband?",
      verificationAnswer: "cyan",
      reporterId: rahul,
      lastKnownLocationId: mechRobot,
      spotDetails: "Mechanical Workshop Bay 2 — Lathe Section",
      rewardOffered: 20,
      status: "ACTIVE",
    },
    {
      svgKey: "smartwatch",
      title: "Fastrack Reflex Play Smartwatch (Matte Black)",
      category: "ACCESSORIES",
      publicDescription: "Square black AMOLED fitness watch with ribbed silicone sport band. Slipped off near the sports pavilion bleachers.",
      secretIdentifiers: "Scratch at bottom-right corner of glass face, battery at 88%.",
      verificationQuestion: "What wallpaper theme was set on the watch screen?",
      verificationAnswer: "matrix neon",
      reporterId: vishnu,
      lastKnownLocationId: sports,
      spotDetails: "Basketball Court Bleachers — Second Tier",
      rewardOffered: 25,
      status: "ACTIVE",
    },
    {
      svgKey: "mini-drafter",
      title: "Engineering Mini-Drafter with Clear Acrylic Scale",
      category: "LAB_GEAR",
      publicDescription: "Steel dual-arm mini-drafter tool with 360-degree protractor head. Misplaced after Machine Drawing practical in Admin Block.",
      secretIdentifiers: "Name 'A. Das' etched with compass tip near the mounting clamp.",
      verificationQuestion: "What color millimeter markings are on the transparent scale?",
      verificationAnswer: "red",
      reporterId: aryan,
      lastKnownLocationId: blkAdmin,
      spotDetails: "Admin Block 1st Floor — Drawing Hall B-102",
      rewardOffered: 15,
      status: "ACTIVE",
    },
    {
      svgKey: "lab-record",
      title: "Microprocessor 8086 Lab Record & Notes",
      category: "BOOKS_NOTES",
      publicDescription: "Thick spiral-bound blue engineering lab manual with handwritten 8086 assembly timing diagrams and faculty verification stamps.",
      secretIdentifiers: "Contains Experiment 6 signed in green ink by Prof. Sen.",
      verificationQuestion: "Which experiment was stamped with the faculty approval seal?",
      verificationAnswer: "experiment 4",
      reporterId: rahul,
      lastKnownLocationId: libCentral,
      spotDetails: "Central Library — IEEE Periodicals Shelf",
      rewardOffered: 20,
      status: "ACTIVE",
    },
    {
      svgKey: "lab-coat",
      title: "AIEM Embroidered Laboratory Coat (Size 38)",
      category: "LAB_GEAR",
      publicDescription: "White full-sleeve cotton lab coat with dark blue college crest embroidered on the chest pocket. Left in Chemistry wing.",
      secretIdentifiers: "Name written inside collar tag with permanent fabric marker.",
      verificationQuestion: "What two pens are kept in the front breast pocket?",
      verificationAnswer: "pilot blue and red",
      reporterId: priya,
      lastKnownLocationId: blkAdmin,
      spotDetails: "Basic Sciences Complex — Chemistry Lab 1 Hook #12",
      rewardOffered: 15,
      status: "ACTIVE",
    },
    {
      svgKey: "water-bottle",
      title: "Milton Thermosteel 1000ml Matte Blue Bottle",
      category: "OTHER",
      publicDescription: "Vacuum-insulated double-wall stainless steel flask in matte cobalt blue with brushed steel screw cap. Left in G-Block lecture hall.",
      secretIdentifiers: "Small dent on the bottom rim, 'Goa AIEM' hacker sticker.",
      verificationQuestion: "What sticker is near the base of the bottle?",
      verificationAnswer: "hackathon 2025",
      reporterId: vishnu07,
      lastKnownLocationId: eceG,
      spotDetails: "G-Block 1st Floor — Lecture Hall G-102 Row 5",
      rewardOffered: 10,
      status: "ACTIVE",
    },
    {
      svgKey: "leather-wallet",
      title: "Tommy Hilfiger Brown Leather Bifold Wallet",
      category: "BAGS_WALLETS",
      publicDescription: "Tan/brown genuine leather bifold wallet with contrast perimeter stitching. Slipped out of pocket near Admin staircase.",
      secretIdentifiers: "Contains Kadamba transport pass and college canteen meal coupons.",
      verificationQuestion: "What bus pass or card is in the top right window slot?",
      verificationAnswer: "kadamba",
      reporterId: aryan,
      lastKnownLocationId: blkAdmin,
      spotDetails: "Admin Block Central Stairwell — Landing between 1st & 2nd Floor",
      rewardOffered: 25,
      status: "ACTIVE",
    },
    {
      svgKey: "brass-keys",
      title: "Set of 3 Brass Keys on Agnel Assagao Ring",
      category: "KEYS",
      publicDescription: "Bunch containing two Godrej locker keys and one bike ignition key attached to a blue translucent AIEM acrylic teardrop fob.",
      secretIdentifiers: "Small red rubber O-ring around the ignition key head.",
      verificationQuestion: "How many locker keys versus ignition keys are on the ring?",
      verificationAnswer: "2 locker 1 bike",
      reporterId: vishnu,
      lastKnownLocationId: sports,
      spotDetails: "Sports Arena — North Pavillion Seating",
      rewardOffered: 15,
      status: "ACTIVE",
    },
  ];

  for (const item of lostItemsData) {
    const images = await generateWebPImages(item.svgKey, item.reporterId);
    const answerHash = await bcrypt.hash(item.verificationAnswer.toLowerCase().trim(), 10);

    await LostItem.findOneAndUpdate(
      { title: item.title },
      {
        ...item,
        verificationAnswerHash: answerHash,
        photoUrl: images.photoUrl,
        blurredPhotoUrl: images.blurredPhotoUrl,
        photos: [images.photoUrl],
        lostAt: new Date(Date.now() - Math.floor(Math.random() * 48 + 2) * 3600 * 1000),
        recoveryPreference: "HANDOVER_AT_SAFE_DESK",
        convertToQuest: false,
        stateHistory: [
          {
            state: "ACTIVE",
            actorId: item.reporterId,
            note: "Reported lost by student on campus",
            timestamp: new Date(),
          },
        ],
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Lost Item: "${item.title}" with WebP photo`);
  }

  // 6 Realistic Active Found Items (Turned in to Safe-Desks or Held by Finder)
  const foundItemsData = [
    {
      svgKey: "mx-master",
      title: "Logitech MX Master 3S Wireless Mouse (Graphite)",
      shortTitle: "Logitech MX Master 3S",
      category: "ELECTRONICS",
      publicDescription: "High-end ergonomic dark graphite mouse with machined steel MagSpeed wheel and thumb rest. Deposited with campus security.",
      finderId: modUser,
      foundLocationId: eceG,
      spotDetails: "ECE Block G-104 Embedded Systems Lab Bench 4",
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: safeGate,
      currentCustodyLocationId: safeGate,
      lockerReceiptCode: "LOCKER-GATE-014",
      status: "ACTIVE",
    },
    {
      svgKey: "titan-watch",
      title: "Titan Neo Stainless Steel Watch (Sunburst Blue)",
      shortTitle: "Titan Neo Blue Dial Watch",
      category: "ACCESSORIES",
      publicDescription: "Silver stainless steel analog wristwatch with sunburst blue dial and date aperture. Safely handed in to Central Library staff.",
      finderId: modUser,
      foundLocationId: libCentral,
      spotDetails: "Central Library 2nd Floor — Reading Hall Desk 8",
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: safeLib,
      currentCustodyLocationId: safeLib,
      lockerReceiptCode: "LOCKER-LIB-027",
      status: "ACTIVE",
    },
    {
      svgKey: "sandisk-ssd",
      title: "SanDisk Extreme 1TB Rugged Portable SSD",
      shortTitle: "SanDisk Extreme 1TB SSD",
      category: "ELECTRONICS",
      publicDescription: "Pocket-sized textured grey external solid state drive with bright orange perimeter bumper and corner loop. Kept safely by finder.",
      finderId: rahul,
      foundLocationId: compAi,
      spotDetails: "High-Performance Computing Lab — Workstation 12",
      custodyStatus: "HELD_BY_FINDER",
      status: "ACTIVE",
    },
    {
      svgKey: "rayban-glasses",
      title: "Ray-Ban Matte Black Wayfarer Glasses & Leather Case",
      shortTitle: "Ray-Ban Wayfarer Glasses",
      category: "ACCESSORIES",
      publicDescription: "Classic matte black prescription sunglasses inside a black textured snap case. Turned in to Library Safe-Desk.",
      finderId: vishnu07,
      foundLocationId: canteen,
      spotDetails: "Canteen Terrace Patio — Shaded Table #6",
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: safeLib,
      currentCustodyLocationId: safeLib,
      lockerReceiptCode: "LOCKER-LIB-031",
      status: "ACTIVE",
    },
    {
      svgKey: "umbrella",
      title: "Navy Blue Auto-Open Windproof Golf Umbrella",
      shortTitle: "Navy Blue Storm Umbrella",
      category: "OTHER",
      publicDescription: "Large navy blue canopy umbrella with wooden curved crook handle and brass ferrule. Handed in at Main Gate Checkpoint.",
      finderId: modUser,
      foundLocationId: blkAdmin,
      spotDetails: "Admin Complex Ground Floor Lobby Umbrella Stand",
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: safeGate,
      currentCustodyLocationId: safeGate,
      lockerReceiptCode: "LOCKER-GATE-019",
      status: "ACTIVE",
    },
    {
      svgKey: "geometry-tin",
      title: "Helix Oxford Mathematical Instruments Tin Box",
      shortTitle: "Helix Oxford Geometry Tin",
      category: "LAB_GEAR",
      publicDescription: "Navy blue vintage embossed geometry tin with compass, divider, and acrylic set squares. Currently held by student finder.",
      finderId: aryan,
      foundLocationId: mechRobot,
      spotDetails: "Mechanical CAD/CAM Lab — Drafting Table 3",
      custodyStatus: "HELD_BY_FINDER",
      status: "ACTIVE",
    },
  ];

  for (const item of foundItemsData) {
    const images = await generateWebPImages(item.svgKey, item.finderId);

    const doc = await FoundItem.findOneAndUpdate(
      { title: item.title },
      {
        ...item,
        photoUrl: images.photoUrl,
        blurredPhotoUrl: images.blurredPhotoUrl,
        rawPhotoUrl: images.photoUrl,
        foundAt: new Date(Date.now() - Math.floor(Math.random() * 36 + 4) * 3600 * 1000),
        stateHistory: [
          {
            state: "ACTIVE",
            actorId: item.finderId,
            note: item.custodyStatus === "SAFE_DESK" ? "Deposited at campus safe desk" : "Reported found by student",
            timestamp: new Date(),
          },
        ],
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Found Item: "${item.title}" with WebP photo`);

    // Setup an APPROVED active claim on Logitech Mouse so the user can test entering OTP!
    if (item.svgKey === "mx-master") {
      const pinHash = await bcrypt.hash("729415", 10);
      const claim = await ClaimRequest.findOneAndUpdate(
        { itemId: doc._id },
        {
          itemType: "FOUND",
          itemId: doc._id,
          claimantId: aryan,
          counterpartyUserId: modUser,
          submittedAnswer: "graphite wireless mouse",
          answerMatched: true,
          proofPhotoUrl: images.photoUrl,
          notes: "I forgot this mouse after completing my lab test in ECE Room 104.",
          handoverCodeHash: pinHash,
          handoverCodeExpiresAt: new Date(Date.now() + 24 * 3600 * 1000),
          status: "APPROVED",
        },
        { upsert: true, new: true }
      );
      await FoundItem.findByIdAndUpdate(doc._id, { currentClaimId: claim._id });
      console.log(`    ⭐ Created Active APPROVED Claim with Handover PIN (729415) for ${item.title}`);
    }

    // Setup a PENDING claim on SanDisk SSD so the user can test reviewing & approving!
    if (item.svgKey === "sandisk-ssd") {
      await ClaimRequest.findOneAndUpdate(
        { itemId: doc._id },
        {
          itemType: "FOUND",
          itemId: doc._id,
          claimantId: priya,
          counterpartyUserId: rahul,
          submittedAnswer: "1tb ssd with orange border",
          answerMatched: false,
          proofPhotoUrl: images.photoUrl,
          notes: "I was compiling Linux kernel images on Workstation 12 and left it plugged in.",
          status: "PENDING",
        },
        { upsert: true, new: true }
      );
      console.log(`    ⭐ Created Active PENDING Claim for ${item.title}`);
    }
  }

  // 4 Reunited & Completed Belongings (Display in Column 2 as Greyed Out Completed Recoveries)
  const completedItemsData = [
    {
      type: "FOUND",
      svgKey: "hp-charger",
      title: "HP 65W USB-C Laptop Charger Adapter",
      shortTitle: "HP 65W USB-C Charger",
      category: "ELECTRONICS",
      publicDescription: "Original HP Type-C power brick found in library quiet zone. Successfully reunited with student owner via Safe-Desk verification.",
      finderId: modUser,
      claimantId: vishnu07,
      foundLocationId: libCentral,
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: safeLib,
      status: "COMPLETED",
    },
    {
      type: "LOST",
      svgKey: "hall-ticket",
      title: "Goa University Examination Admit Card & Bus Pass",
      category: "ID_CARDS_DOCS",
      publicDescription: "Laminated examination admit card with photo and bus pass. Safely recovered and returned to candidate before examinations.",
      reporterId: priya,
      counterpartyId: modUser,
      lastKnownLocationId: blkAdmin,
      status: "RECOVERED",
      verificationAnswer: "exam admit card",
    },
    {
      type: "FOUND",
      svgKey: "anker-powerbank",
      title: "Anker PowerCore 20000mAh Power Bank (Space Grey)",
      shortTitle: "Anker PowerCore 20000mAh",
      category: "ELECTRONICS",
      publicDescription: "Space grey heavy-duty fast charging portable power bank. Returned to verified owner at Main Gate Security counter.",
      finderId: modUser,
      claimantId: rahul,
      foundLocationId: safeGate,
      custodyStatus: "SAFE_DESK",
      safeDeskLocationId: safeGate,
      status: "COMPLETED",
    },
    {
      type: "LOST",
      svgKey: "casio-gold",
      title: "Vintage Casio A168 Gold Digital Watch",
      category: "ACCESSORIES",
      publicDescription: "Golden stainless steel vintage digital watch with electro-luminescence backlight. Reunited with owner after being turned in.",
      reporterId: aryan,
      counterpartyId: vishnu,
      lastKnownLocationId: canteen,
      status: "RECOVERED",
      verificationAnswer: "gold casio digital",
    },
  ];

  for (const item of completedItemsData) {
    const images = await generateWebPImages(item.svgKey, item.finderId || item.reporterId);

    if (item.type === "FOUND") {
      const doc = await FoundItem.findOneAndUpdate(
        { title: item.title },
        {
          title: item.title,
          shortTitle: item.shortTitle,
          category: item.category,
          publicDescription: item.publicDescription,
          finderId: item.finderId,
          foundLocationId: item.foundLocationId,
          custodyStatus: item.custodyStatus,
          safeDeskLocationId: item.safeDeskLocationId,
          photoUrl: images.photoUrl,
          blurredPhotoUrl: images.blurredPhotoUrl,
          rawPhotoUrl: images.photoUrl,
          status: "COMPLETED",
          foundAt: new Date(Date.now() - 72 * 3600 * 1000),
          stateHistory: [
            { state: "ACTIVE", actorId: item.finderId, timestamp: new Date(Date.now() - 72 * 3600 * 1000) },
            { state: "CLAIMED", actorId: item.claimantId, timestamp: new Date(Date.now() - 48 * 3600 * 1000) },
            { state: "COMPLETED", actorId: item.finderId, note: "Handover completed successfully", timestamp: new Date(Date.now() - 24 * 3600 * 1000) },
          ],
        },
        { upsert: true, new: true }
      );

      // Create completed claim record
      await ClaimRequest.findOneAndUpdate(
        { itemId: doc._id },
        {
          itemType: "FOUND",
          itemId: doc._id,
          claimantId: item.claimantId,
          counterpartyUserId: item.finderId,
          submittedAnswer: "verified owner match",
          answerMatched: true,
          proofPhotoUrl: images.photoUrl,
          status: "HANDOVER_COMPLETE",
          settlementStatus: "COMPLETED",
        },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Completed Found Recovery: "${item.title}"`);
    } else {
      const answerHash = await bcrypt.hash(item.verificationAnswer || "verified", 10);
      const doc = await LostItem.findOneAndUpdate(
        { title: item.title },
        {
          title: item.title,
          category: item.category,
          publicDescription: item.publicDescription,
          reporterId: item.reporterId,
          lastKnownLocationId: item.lastKnownLocationId,
          verificationQuestion: "Describe unique marking or code",
          verificationAnswerHash: answerHash,
          secretIdentifiers: "Verified via matching documentation",
          photoUrl: images.photoUrl,
          blurredPhotoUrl: images.blurredPhotoUrl,
          photos: [images.photoUrl],
          status: "RECOVERED",
          lostAt: new Date(Date.now() - 96 * 3600 * 1000),
          stateHistory: [
            { state: "ACTIVE", actorId: item.reporterId, timestamp: new Date(Date.now() - 96 * 3600 * 1000) },
            { state: "RECOVERED", actorId: item.counterpartyId, note: "Physical belonging safely recovered", timestamp: new Date(Date.now() - 12 * 3600 * 1000) },
          ],
        },
        { upsert: true, new: true }
      );

      await ClaimRequest.findOneAndUpdate(
        { itemId: doc._id },
        {
          itemType: "LOST",
          itemId: doc._id,
          claimantId: item.counterpartyId,
          counterpartyUserId: item.reporterId,
          submittedAnswer: item.verificationAnswer,
          answerMatched: true,
          proofPhotoUrl: images.photoUrl,
          status: "HANDOVER_COMPLETE",
          settlementStatus: "COMPLETED",
        },
        { upsert: true, new: true }
      );
      console.log(`  ✓ Completed Lost Recovery: "${item.title}"`);
    }
  }

  // Clean up any test junk items (e.g. 'ddcvszcv', 'clip', 'pikachu keychain')
  await LostItem.deleteMany({ title: { $in: ["ddcvszcv", "pikachu keychain"] } });
  await FoundItem.deleteMany({ title: { $in: ["clip"] } });

  const totalLost = await LostItem.countDocuments({});
  const totalFound = await FoundItem.countDocuments({});
  const totalClaims = await ClaimRequest.countDocuments({});
  const totalEvidence = await EvidenceRecord.countDocuments({});

  console.log("\n========================================================");
  console.log("🎉 SEEDING COMPLETE! Website populated with rich campus data:");
  console.log(`   📦 Total Lost Items:   ${totalLost}`);
  console.log(`   📦 Total Found Items:  ${totalFound}`);
  console.log(`   🤝 Total Claims:       ${totalClaims}`);
  console.log(`   🖼️  Evidence Records:  ${totalEvidence}`);
  console.log("========================================================\n");
}

if (process.argv[1]?.includes("seed_rich_items")) {
  seedRichItems()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
