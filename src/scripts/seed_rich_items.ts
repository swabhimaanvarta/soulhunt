import { connectDB } from "../lib/db";
import { LostItem, FoundItem, CampusLocation, User } from "../models";
import bcrypt from "bcryptjs";

export async function seedRichItems() {
  await connectDB();
  console.log("Adding diverse realistic AIEM campus Lost & Found items...");

  const users = await User.find({ role: "STUDENT" }).limit(5);
  const locations = await CampusLocation.find({});
  if (users.length === 0 || locations.length === 0) {
    console.error("Missing users or locations. Please run base seed first.");
    return;
  }

  const u0 = users[0]._id;
  const u1 = users[1]?._id || u0;
  const u2 = users[2]?._id || u0;

  const locMap: Record<string, any> = {};
  locations.forEach((loc) => {
    locMap[loc.code] = loc._id;
  });

  const safeDeskId = locMap["SAFE-LIB"] || locMap["SAFE-GATE"] || locations[0]._id;
  const defaultLoc = locations[0]._id;

  const sampleLost = [
    {
      reporterId: u0,
      title: "AIEM Student Identity Card (Computer Dept)",
      category: "ID_CARDS_DOCS",
      publicDescription: "Official blue AIEM student lanyard with ID card holder. Misplaced near 2nd floor corridor.",
      secretIdentifiers: "Roll number 23COMP042, red blood group indicator A+",
      verificationQuestion: "What is the 3-letter department code printed above the photo?",
      verificationAnswer: "comp",
      lastKnownLocationId: locMap["COMP-AI"] || defaultLoc,
      spotDetails: "Computer Department Corridor -> Digital Labs",
      rewardOffered: 15,
      recoveryPreference: "HANDOVER_AT_SAFE_DESK",
      status: "ACTIVE",
    },
    {
      reporterId: u1,
      title: "Hardbound Microprocessor & Interfacing Lab Manual",
      category: "BOOKS_NOTES",
      publicDescription: "Spiral-bound 8085/8086 assembly language lab record with handwritten timing diagrams and signature stamps.",
      secretIdentifiers: "Signed by Prof. Fernandes on Experiment 4 page",
      verificationQuestion: "What is written on the bottom right of the cover page?",
      verificationAnswer: "batch b2",
      lastKnownLocationId: locMap["BLK-ADMIN"] || defaultLoc,
      spotDetails: "Basic Sciences & Humanities Block -> Reading Room",
      rewardOffered: 20,
      recoveryPreference: "HANDOVER_AT_SAFE_DESK",
      status: "ACTIVE",
    },
    {
      reporterId: u2,
      title: "Noise Buds VS102 Wireless Earbuds (Charcoal Black)",
      category: "ACCESSORIES",
      publicDescription: "Matte black wireless charging case with left earbud inside. Left in the cafeteria courtyard after lunch.",
      secretIdentifiers: "Minor scratch near the USB-C charging port",
      verificationQuestion: "Which earbud is missing from the case?",
      verificationAnswer: "right",
      lastKnownLocationId: locMap["CANTEEN-01"] || defaultLoc,
      spotDetails: "Cafeteria Terrace -> Shaded Courtyard Benches",
      rewardOffered: 30,
      recoveryPreference: "HANDOVER_AT_SAFE_DESK",
      status: "ACTIVE",
    },
    {
      reporterId: u0,
      title: "White Cotton Lab Coat with AIEM Engineering Crest",
      category: "LAB_GEAR",
      publicDescription: "Size 38 full-sleeve laboratory coat with embroidered college emblem. Left on the hook near Chemistry Lab 1.",
      secretIdentifiers: "Name 'R. Sharma' written with permanent marker inside the collar tag",
      verificationQuestion: "What color pen is kept in the front chest pocket?",
      verificationAnswer: "blue pilot",
      lastKnownLocationId: locMap["BLK-ADMIN"] || defaultLoc,
      spotDetails: "Admin & BSH Complex 1st Floor Chemistry Wing",
      rewardOffered: 10,
      recoveryPreference: "HANDOVER_AT_SAFE_DESK",
      status: "ACTIVE",
    },
  ];

  const sampleFound = [
    {
      finderId: u1,
      title: "Titan Karishma Analog Watch with Silver Mesh Strap",
      category: "ACCESSORIES",
      publicDescription: "Found near the Central Library silent study tables. White dial with day-date window. Safely handed in to library counter.",
      foundLocationId: locMap["SAFE-LIB"] || defaultLoc,
      spotDetails: "Library 2nd Floor — Desk Row 4",
      custodyStatus: "SAFE_DESK",
      currentCustodyLocationId: safeDeskId,
      status: "ACTIVE",
    },
    {
      finderId: u2,
      title: "Set of 3 Brass Keys on Agnel Technical Tag",
      category: "KEYS",
      publicDescription: "Bunch containing two Godrej locker keys and one ignition key on a blue acrylic AIEM Assagao keychain.",
      foundLocationId: locMap["SPORTS-ARENA"] || defaultLoc,
      spotDetails: "Basketball Court Bleachers",
      custodyStatus: "SAFE_DESK",
      currentCustodyLocationId: locMap["SAFE-GATE"] || safeDeskId,
      status: "ACTIVE",
    },
    {
      finderId: u0,
      title: "HP 65W USB-C Laptop Power Adapter",
      category: "ELECTRONICS",
      publicDescription: "Original HP Type-C power brick with 3-pin Indian plug cable found plugged into wall socket B-204.",
      foundLocationId: locMap["COMP-AI"] || defaultLoc,
      spotDetails: "Room B-204 Digital Systems Lab Bench #9",
      custodyStatus: "SAFE_DESK",
      currentCustodyLocationId: safeDeskId,
      status: "ACTIVE",
    },
    {
      finderId: u1,
      title: "Black Wildcraft Daypack Backpack",
      category: "BAGS_WALLETS",
      publicDescription: "Rain-resistant black and grey backpack containing a water bottle and umbrella. Deposited at Main Gate Security.",
      foundLocationId: locMap["SAFE-GATE"] || defaultLoc,
      spotDetails: "Security Checkpoint Bench near Gate 1",
      custodyStatus: "SAFE_DESK",
      currentCustodyLocationId: locMap["SAFE-GATE"] || safeDeskId,
      status: "ACTIVE",
    },
  ];

  for (const item of sampleLost) {
    const existing = await LostItem.findOne({ title: item.title });
    if (!existing) {
      const answerHash = await bcrypt.hash(item.verificationAnswer.toLowerCase().trim(), 10);
      await LostItem.create({
        ...item,
        verificationAnswerHash: answerHash,
        lostAt: new Date(),
        stateHistory: [
          {
            state: "ACTIVE",
            actorId: item.reporterId,
            note: "Reported lost by student",
            timestamp: new Date(),
          },
        ],
      });
      console.log(`+ Added Lost Item: ${item.title} (${item.category})`);
    }
  }

  for (const item of sampleFound) {
    const existing = await FoundItem.findOne({ title: item.title });
    if (!existing) {
      await FoundItem.create({
        ...item,
        foundAt: new Date(),
        stateHistory: [
          {
            state: "ACTIVE",
            actorId: item.finderId,
            note: "Turned in to campus safe-desk custody",
            timestamp: new Date(),
          },
        ],
      });
      console.log(`+ Added Found Item: ${item.title} (${item.category})`);
    }
  }

  console.log("✅ Rich item seeding finished successfully!");
}

if (process.argv[1]?.includes("seed_rich_items")) {
  seedRichItems()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

