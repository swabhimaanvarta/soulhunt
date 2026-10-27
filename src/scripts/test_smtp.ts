import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

// Load .env.local natively without external dependencies
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvLocal();

async function testSmtp() {
  console.log("\n========================================================");
  console.log("   AIEM HUNT — GMAIL SMTP CONFIGURATION & CONNECTION TEST");
  console.log("========================================================\n");

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `AIEM Hunt Security <${user}>`;
  const to = process.argv[2] || user;

  console.log("Configured Parameters in .env.local:");
  console.log(" • SMTP_HOST :", host || "❌ (NOT SET)");
  console.log(" • SMTP_PORT :", port);
  console.log(" • SMTP_USER :", user || "❌ (NOT SET)");
  console.log(" • SMTP_PASS :", pass ? "******** (Configured)" : "❌ (NOT SET)");
  console.log(" • SMTP_FROM :", from || "❌ (NOT SET)");
  console.log(" • Test Recipient:", to || "(None specified)");
  console.log("--------------------------------------------------------");

  if (!host || !user || !pass) {
    console.log("\n⚠️  SMTP credentials are not yet defined in .env.local.");
    console.log("Follow the guide below to add your 16-character Gmail App Password to .env.local.\n");
    process.exit(0);
  }

  const cleanPass = pass.replace(/\s+/g, "");

  console.log(`\n⏳ Attempting handshake with ${host}:${port}...`);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: user.trim(),
      pass: cleanPass,
    },
  });

  try {
    await transporter.verify();
    console.log("✅ Handshake successful! Authentication verified.");
  } catch (err: any) {
    console.error("❌ Handshake failed:", err.message);
    if (err.message.includes("535") || err.message.includes("BadCredentials")) {
      console.error("\n💡 TIP: For Gmail, ensure you are using a 16-character 'App Password', NOT your standard Google account login password.");
    }
    process.exit(1);
  }

  if (to) {
    console.log(`\n⏳ Dispatching test verification email to ${to}...`);
    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject: "[AIEM Hunt] 🔐 Security Clearance Verification Test",
        text: "Congratulations! Your Gmail SMTP integration with AIEM Hunt is active and functioning properly.",
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0B0F17; color: #FFFFFF; padding: 24px; border-radius: 12px; max-width: 500px;">
            <h2 style="color: #10B981; margin-top: 0;">AIEM Hunt — SMTP Active!</h2>
            <p style="color: #94A3B8; font-size: 14px;">Agnel Institute of Engineering and Management</p>
            <p>Your Gmail credentials are authenticated with the AIEM tactical network.</p>
            <div style="background-color: #070A0F; border: 1px solid #10B981; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 28px; letter-spacing: 6px; font-weight: bold; color: #10B981;">123456</span>
            </div>
            <p style="font-size: 12px; color: #64748B;">Live student registrations will now deliver instant OTP clearance challenges directly to inboxes.</p>
          </div>
        `,
      });
      console.log("🎉 Test email sent successfully! Message ID:", info.messageId);
      console.log(`📨 Check the inbox of ${to} to confirm delivery!\n`);
    } catch (sendErr: any) {
      console.error("❌ Failed to send message:", sendErr.message);
      process.exit(1);
    }
  }
}

testSmtp();

