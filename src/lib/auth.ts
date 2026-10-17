import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { verifySessionToken, signSessionToken, SessionPayload, UserRole } from "@/lib/jwt";

export { verifySessionToken, signSessionToken };
export type { SessionPayload, UserRole };

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("aiem_session")?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  await connectDB();
  const user = await User.findById(session.userId).lean();
  if (!user || user.accountStatus !== "ACTIVE") return null;

  return user;
}
