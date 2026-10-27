import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

export interface SendOtpResult {
  codeHash: string;
  expiresAt: Date;
  deliveryMethod: "SMTP" | "DEV_CONSOLE";
}

/**
 * Generate a cryptographically secure 6-digit OTP and store its hash
 */
export async function generateEmailOtp(): Promise<{ code: string; codeHash: string; expiresAt: Date }> {
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lifetime
  return { code, codeHash, expiresAt };
}

/**
 * Send the 6-digit OTP to the college address using configured SMTP,
 * or safely log strictly to server stdout in development mode.
 */
export async function sendEmailVerificationChallenge(
  toEmail: string,
  displayName: string,
  code: string
): Promise<"SMTP" | "DEV_CONSOLE"> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const rawFrom = process.env.SMTP_FROM?.trim();
  let smtpFrom = "AIEM Hunt Security <security@aiemgoa.ac.in>";
  if (rawFrom) {
    if (rawFrom.includes("<") && rawFrom.includes(">")) {
      smtpFrom = rawFrom;
    } else {
      const emailMatch = rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        const extractedEmail = emailMatch[1];
        const displayName = rawFrom.replace(extractedEmail, "").replace(/powered by/i, "").trim() || "AIEM Hunt Security";
        smtpFrom = `${displayName} <${extractedEmail}>`;
      } else if (smtpUser) {
        smtpFrom = `${rawFrom} <${smtpUser}>`;
      }
    }
  } else if (smtpUser) {
    smtpFrom = `AIEM Hunt Security <${smtpUser}>`;
  }

  // If live SMTP credentials are provided, dispatch via Nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject: `[AIEM Hunt] Your 6-Digit Institutional Verification Code: ${code}`,
        text: `Hello ${displayName},\n\nYour institutional verification code for AIEM Hunt is: ${code}\n\nThis code expires in 15 minutes. If you did not request this, please ignore this email.\n\nAIEM - Agnel Institute of Engineering and Management`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0B0F17; color: #FFFFFF; padding: 24px; border-radius: 12px; max-width: 500px;">
            <h2 style="color: #10B981; margin-top: 0;">AIEM Hunt — Security Verification</h2>
            <p style="color: #94A3B8; font-size: 14px;">Agnel Institute of Engineering and Management</p>
            <p>Hello <strong>${displayName}</strong>,</p>
            <p>Please enter the following 6-digit clearance code to activate your hunter operative account:</p>
            <div style="background-color: #070A0F; border: 1px solid #10B981; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #10B981;">${code}</span>
            </div>
            <p style="font-size: 12px; color: #64748B;">This single-use code expires in 15 minutes. Never share this code with anyone.</p>
          </div>
        `,
      });

      return "SMTP";
    } catch (smtpErr: any) {
      console.warn(`[AIEM SMTP WARNING] Failed to deliver via SMTP (${smtpErr.message}). Falling back to server console.`);
    }
  }

  // Fallback: Log securely to server stdout
  console.log(`\n======================================================`);
  console.log(`🔐 [CLEARANCE DISPATCH] AIEM HUNT EMAIL ACTIVATION`);
  console.log(`   To: ${toEmail} (${displayName})`);
  console.log(`   Code: >>> ${code} <<< (Valid for 15 minutes)`);
  if (!smtpHost) {
    console.log(`   ℹ️ Notice: Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local for live college inbox delivery.`);
  }
  console.log(`======================================================\n`);

  return "DEV_CONSOLE";
}

/**
 * Send the 6-digit Password Reset Code to the college address using configured SMTP,
 * or safely log strictly to server stdout in development mode.
 */
export async function sendPasswordResetChallenge(
  toEmail: string,
  displayName: string,
  code: string
): Promise<"SMTP" | "DEV_CONSOLE"> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.replace(/\s+/g, "");
  const rawFrom = process.env.SMTP_FROM?.trim();
  let smtpFrom = "AIEM Hunt Security <security@aiemgoa.ac.in>";
  if (rawFrom) {
    if (rawFrom.includes("<") && rawFrom.includes(">")) {
      smtpFrom = rawFrom;
    } else {
      const emailMatch = rawFrom.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        const extractedEmail = emailMatch[1];
        const dispName = rawFrom.replace(extractedEmail, "").replace(/powered by/i, "").trim() || "AIEM Hunt Security";
        smtpFrom = `${dispName} <${extractedEmail}>`;
      } else if (smtpUser) {
        smtpFrom = `${rawFrom} <${smtpUser}>`;
      }
    }
  } else if (smtpUser) {
    smtpFrom = `AIEM Hunt Security <${smtpUser}>`;
  }

  // If live SMTP credentials are provided, dispatch via Nodemailer
  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: toEmail,
        subject: `[AIEM Hunt] Password Reset Clearance Code: ${code}`,
        text: `Hello ${displayName},\n\nA password reset request was initiated for your AIEM Hunt operative account.\n\nYour 6-digit recovery code is: ${code}\n\nThis code will expire in 15 minutes. If you did not initiate this request, your account may be under reconnaissance — please secure your credentials immediately.\n\nAIEM - Agnel Institute of Engineering and Management`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #0B0F17; color: #FFFFFF; padding: 24px; border-radius: 12px; max-width: 500px;">
            <h2 style="color: #F59E0B; margin-top: 0;">AIEM Hunt — Password Reset Clearance</h2>
            <p style="color: #94A3B8; font-size: 14px;">Agnel Institute of Engineering and Management Security</p>
            <p>Hello <strong>${displayName}</strong>,</p>
            <p>We received an authorization request to reset the password for your hunter account.</p>
            <div style="background-color: #070A0F; border: 1px solid #F59E0B; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-family: monospace; font-size: 32px; letter-spacing: 6px; font-weight: bold; color: #F59E0B;">${code}</span>
            </div>
            <p style="font-size: 13px; color: #E2E8F0;">Enter this code along with your new password to restore account access. This single-use code expires in 15 minutes.</p>
            <p style="font-size: 11px; color: #EF4444; border-top: 1px solid #1E293B; padding-top: 12px; margin-top: 20px;">
              ⚠️ If you did NOT request a password reset, someone else may have entered your identifier. Your password will remain unchanged unless this clearance code is entered.
            </p>
          </div>
        `,
      });

      return "SMTP";
    } catch (smtpErr: any) {
      console.warn(`[AIEM SMTP WARNING] Failed to deliver password reset via SMTP (${smtpErr.message}). Falling back to server console.`);
    }
  }

  // Fallback: Log securely to server stdout
  console.log(`\n======================================================`);
  console.log(`🔑 [PASSWORD RESET DISPATCH] AIEM HUNT ACCESS RECOVERY`);
  console.log(`   To: ${toEmail} (${displayName})`);
  console.log(`   Reset Code: >>> ${code} <<< (Valid for 15 minutes)`);
  if (!smtpHost) {
    console.log(`   ℹ️ Notice: Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local for live college inbox delivery.`);
  }
  console.log(`======================================================\n`);

  return "DEV_CONSOLE";
}

