import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function ProfileDefaultPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  redirect(`/profile/${user.username}`);
}

