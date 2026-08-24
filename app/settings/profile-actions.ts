"use server";

import { getVerifiedUser } from "@/lib/supabase/server";

export type Profile = {
  fullName: string;
  role: string;
  email: string;
  avatarUrl: string | null;
};

export async function getProfile(): Promise<Profile> {
  const { user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  return {
    fullName: (user.user_metadata.full_name as string | undefined) ?? "",
    role: (user.user_metadata.role as string | undefined) ?? "",
    email: user.email ?? "",
    avatarUrl: (user.user_metadata.avatar_url as string | undefined) ?? null,
  };
}

export async function updateProfile(patch: {
  fullName?: string;
  role?: string;
  avatarUrl?: string;
}): Promise<void> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const data: Record<string, string> = {};
  if (patch.fullName !== undefined) data.full_name = patch.fullName;
  if (patch.role !== undefined) data.role = patch.role;
  if (patch.avatarUrl !== undefined) data.avatar_url = patch.avatarUrl;

  const { error } = await supabase.auth.updateUser({ data });
  if (error) throw new Error(error.message);
}
