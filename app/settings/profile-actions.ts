"use server";

import { getVerifiedUser } from "@/lib/supabase/server";

export type Profile = {
  fullName: string;
  role: string;
  email: string;
  avatarUrl: string | null;
};

export async function getProfile(): Promise<Profile> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  // avatar_url lives in user_settings, not auth user_metadata — a base64 data
  // URL there would get embedded in the session JWT/cookie and can grow large
  // enough to trip ERR_RESPONSE_HEADERS_TOO_BIG on every subsequent request.
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("avatar_url")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error(error.message);

  return {
    fullName: (user.user_metadata.full_name as string | undefined) ?? "",
    role: (user.user_metadata.role as string | undefined) ?? "",
    email: user.email ?? "",
    avatarUrl: settings?.avatar_url ?? null,
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

  if (Object.keys(data).length > 0) {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw new Error(error.message);
  }

  if (patch.avatarUrl !== undefined) {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, avatar_url: patch.avatarUrl });
    if (error) throw new Error(error.message);
  }
}
