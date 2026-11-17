import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { verifySessionToken, signSessionToken, SessionPayload, UserRole } from "@/lib/jwt";

export { verifySessionToken, signSessionToken };
export type { SessionPayload, UserRole };

export async function getCurrentUser() {
  if ((globalThis as any).__TEST_CURRENT_USER__) {
    const testUser = (globalThis as any).__TEST_CURRENT_USER__;
    if (testUser?._id) {
      await connectDB();
      const fresh = await User.findById(testUser._id).lean();
      if (fresh) return fresh;
    }
    return testUser;
  }

  let token: string | undefined = undefined;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get("aiem_session")?.value;
  } catch {
    // Called outside Next.js request context (e.g. background job or test runner)
    return null;
  }

  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  await connectDB();
  const user = await User.findById(session.userId).lean();
  if (!user || user.accountStatus !== "ACTIVE") return null;

  return user;
}
