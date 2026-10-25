/**
 * AIEM Hunt — Deterministic Challenge Templates
 * 
 * High-quality, safety-verified campus mystery & riddle templates.
 * Operates with 100% reliability even if external AI APIs are unconfigured or offline.
 */

export interface ClueTemplate {
  stageOrder: number;
  title: string;
  clueText: string;
  verificationType: "TEXT_RIDDLE" | "LOCATION_CHECKIN" | "PASSCODE_QR" | "EVIDENCE_UPLOAD";
  expectedAnswer: string;
  hintText: string;
  hintCoinCost: number;
  unlockedBreadcrumbText: string;
}

export interface QuestTemplate {
  title: string;
  description: string;
  theme: string;
  questType: "CAMPUS_TREASURE" | "DAILY_HUNT" | "MYSTERY" | "LEGENDARY" | "SQUAD_HUNT" | "QUICK_FIND" | "INVESTIGATION";
  difficulty: number;
  locationCode: string; // matches CampusLocation.code e.g. "BLK-A", "LIB-01"
  xpReward: number;
  coinReward: number;
  squadXpReward: number;
  clues: ClueTemplate[];
}

export const CAMPUS_QUEST_TEMPLATES: QuestTemplate[] = [
  {
    title: "The Silicon Enigma: Logic in the Shadows",
    description: "An archived microcontroller testbench in Block B is pulsing a rhythmic LED beacon. Decode the logic stages to unseal the mystery.",
    theme: "ELECTRONICS_LOGIC",
    questType: "DAILY_HUNT",
    difficulty: 2,
    locationCode: "BLK-B",
    xpReward: 180,
    coinReward: 35,
    squadXpReward: 60,
    clues: [
      {
        stageOrder: 1,
        title: "Stage 1: The Binary Greeting",
        clueText: "A whiteboard outside Lab 204 reads: '01000001 01001001 01000101 01001101'. Convert these 8-bit ASCII bytes to letters.",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "AIEM",
        hintText: "Each 8-bit binary number corresponds to standard capital ASCII characters. 01000001 is 'A'.",
        hintCoinCost: 5,
        unlockedBreadcrumbText: "Hex decoded. Marker leads to the Microprocessor Display Case.",
      },
      {
        stageOrder: 2,
        title: "Stage 2: The Logic Gate Output",
        clueText: "Input A = 1, Input B = 0. They feed an XOR gate, whose output enters a NAND gate alongside 1. What is the final single-bit logic output?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "0",
        hintText: "1 XOR 0 is 1. Then 1 NAND 1 yields 0.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Gate verified: Logic low confirmed. The cache is located under Bench #4.",
      },
      {
        stageOrder: 3,
        title: "Stage 3: The Resistor Spectrum",
        clueText: "Identify the resistance value (in Ohms) of a 4-band resistor with bands: Brown, Black, Red, Gold.",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "1000",
        hintText: "Brown = 1, Black = 0, Red multiplier = 10^2 = 100. (10 * 100 = 1000 or 1k). Enter digits only.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Resistance locked: 1000 Ohms. The digital lock releases!",
      },
    ],
  },
  {
    title: "The Whispering Archives: Dewey's Lost Tome",
    description: "A mysterious bookplate left in the Central Library points to an uncatalogued Goan technological heritage manuscript.",
    theme: "LIBRARY_ARCHIVE",
    questType: "CAMPUS_TREASURE",
    difficulty: 3,
    locationCode: "LIB-01",
    xpReward: 240,
    coinReward: 50,
    squadXpReward: 75,
    clues: [
      {
        stageOrder: 1,
        title: "Stage 1: The Decimal Trail",
        clueText: "In the Dewey Decimal Classification system, which 3-digit number classifies Computer Science, Information & General Works?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "000",
        hintText: "It is the very first century category in the library catalog (three zeros).",
        hintCoinCost: 8,
        unlockedBreadcrumbText: "Classification 000 indexed: Proceed to Stack 3, Shelf B.",
      },
      {
        stageOrder: 2,
        title: "Stage 2: The Caesar's Ledger",
        clueText: "An engraved bookmark carries the cipher 'D L H P' with a shift of +3. What was the original word before the shift?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "AIEM",
        hintText: "Shift each letter backward by 3 steps in the alphabet: D-3=A, L-3=I, H-3=E, P-3=M.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Cipher broken. A hidden inscription indicates the Reading Hall Gallery.",
      },
      {
        stageOrder: 3,
        title: "Stage 3: The Archivist's Riddle",
        clueText: "I have no voice, but I speak to thousands. I have a spine, but no bones. I have leaves, but no branches. What am I?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "book",
        hintText: "Found in stacks and read cover to cover.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "The rare heritage folio is logged. Safe-Desk archival seal granted!",
      },
    ],
  },
  {
    title: "The Solar Array Frequency: Clean Kilowatts",
    description: "The campus solar rooftop in Block A has an uncalibrated telemetry node broadcasting an environmental trivia challenge.",
    theme: "SUSTAINABILITY",
    questType: "DAILY_HUNT",
    difficulty: 2,
    locationCode: "BLK-A",
    xpReward: 160,
    coinReward: 30,
    squadXpReward: 50,
    clues: [
      {
        stageOrder: 1,
        title: "Stage 1: The Photovoltaic Element",
        clueText: "Which chemical element with atomic number 14 is the primary semiconductor used in modern solar photovoltaic panels?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "silicon",
        hintText: "Symbol is Si, named after the famous tech valley.",
        hintCoinCost: 5,
        unlockedBreadcrumbText: "Material verified: Telemetry feeds into the rooftop monitoring logger.",
      },
      {
        stageOrder: 2,
        title: "Stage 2: The Power Equation",
        clueText: "If an array produces 250 Volts at 40 Amperes of direct current, what is the total power generated in Kilowatts (kW)?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "10",
        hintText: "Power = Volts * Amps. 250 * 40 = 10,000 Watts = 10 Kilowatts. Enter the number.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Output calibrated: 10 kW green energy flowing into the campus microgrid.",
      },
    ],
  },
  {
    title: "The Autonomous Rover Signal: Robotics Mystery",
    description: "An experimental rover in the CAD & Robotics Studio lost its navigation waypoint sequence. Squads must recover the trajectory.",
    theme: "ROBOTICS_CAD",
    questType: "SQUAD_HUNT",
    difficulty: 4,
    locationCode: "BLK-C",
    xpReward: 350,
    coinReward: 75,
    squadXpReward: 120,
    clues: [
      {
        stageOrder: 1,
        title: "Stage 1: Coordinate Matrix",
        clueText: "The rover moves 10 meters North, then 24 meters East. What is the straight-line displacement (in meters) from its starting datum?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "26",
        hintText: "Use Pythagorean theorem: sqrt(10^2 + 24^2) = sqrt(100 + 576) = sqrt(676) = 26.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Displacement vector locked: 26 meters bearing 067 degrees.",
      },
      {
        stageOrder: 2,
        title: "Stage 2: G-Code Decoding",
        clueText: "In CNC machining and 3D printing G-code, which standard command instructs rapid linear positioning without cutting?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "g00",
        hintText: "Rapid traverse command: 'G0' or 'G00'.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Waypoint G00 accepted. Rover beacon relocated near Workshop Bay 3.",
      },
      {
        stageOrder: 3,
        title: "Stage 3: Sensor Fusion",
        clueText: "What does the acronym 'LIDAR' stand for? (First word only: Light Detection And _____)",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "ranging",
        hintText: "Light Detection and R______.",
        hintCoinCost: 10,
        unlockedBreadcrumbText: "Sensors fused: Rover mission telemetry uploaded to the Squad board!",
      },
    ],
  },
  {
    title: "The Canteen Barter Ledger: Festival Mystery",
    description: "A friendly challenge left on the Student Activity noticeboard tests campus lore, nutrition, and student economics.",
    theme: "CAMPUS_CULTURE",
    questType: "DAILY_HUNT",
    difficulty: 1,
    locationCode: "CNT-01",
    xpReward: 140,
    coinReward: 25,
    squadXpReward: 40,
    clues: [
      {
        stageOrder: 1,
        title: "Stage 1: The Morning Fuel",
        clueText: "The traditional Goan bread roll served with canteen bhaji is known as what? (4 letters)",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "poee",
        hintText: "P _ _ E or P _ O I.",
        hintCoinCost: 5,
        unlockedBreadcrumbText: "Breakfast order confirmed. Proceed to SAC outdoor gazebo.",
      },
      {
        stageOrder: 2,
        title: "Stage 2: The Energy Constant",
        clueText: "1 Kilocalorie (kcal) equals approximately how many Joules (round to nearest hundred: 4200 or 4184)?",
        verificationType: "TEXT_RIDDLE",
        expectedAnswer: "4200",
        hintText: "Approximately 4200 Joules (or enter 4184).",
        hintCoinCost: 8,
        unlockedBreadcrumbText: "Nutrition metrics matched. Ledger unlocked!",
      },
    ],
  },
];

export function getRandomChallengeTemplate(
  themeFilter?: string,
  difficultyFilter?: number
): QuestTemplate {
  let filtered = CAMPUS_QUEST_TEMPLATES;

  if (themeFilter) {
    filtered = filtered.filter((t) => t.theme.toLowerCase() === themeFilter.toLowerCase());
  }
  if (difficultyFilter) {
    filtered = filtered.filter((t) => t.difficulty === difficultyFilter);
  }
  if (filtered.length === 0) {
    filtered = CAMPUS_QUEST_TEMPLATES;
  }

  const index = Math.floor(Math.random() * filtered.length);
  return JSON.parse(JSON.stringify(filtered[index]));
}

