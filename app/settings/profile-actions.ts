"use server";

import { z } from "zod";
import { getVerifiedUser } from "@/lib/supabase/server";

// profile-card.tsx already caps the picked file at 500KB client-side (a data
// URL that large risks bloating the session cookie enough to break login —
// see HANDOFF.md), but a server action is a public endpoint: nothing stopped
// a direct call from sending an oversized or non-data-URL string. Data URLs
// base64-encode their bytes at ~4/3 the original size, so the cap here is
// scaled up from the 500KB source-file limit rather than reusing it directly.
const MAX_AVATAR_DATA_URL_LENGTH = Math.ceil((500 * 1024 * 4) / 3);

const updateProfileSchema = z.object({
  fullName: z.string().trim().max(200, "Name is too long").optional(),
  role: z.string().trim().max(200, "Role is too long").optional(),
  avatarUrl: z
    .string()
    .startsWith("data:image/", "Avatar must be an image")
    .max(MAX_AVATAR_DATA_URL_LENGTH, "Image must be under 500 KB.")
    .optional(),
});

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
  const parseResult = updateProfileSchema.safeParse(patch);
  if (!parseResult.success) throw new Error(parseResult.error.issues[0].message);
  const parsed = parseResult.data;

  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const data: Record<string, string> = {};
  if (parsed.fullName !== undefined) data.full_name = parsed.fullName;
  if (parsed.role !== undefined) data.role = parsed.role;

  if (Object.keys(data).length > 0) {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) throw new Error(error.message);
  }

  if (parsed.avatarUrl !== undefined) {
    const { error } = await supabase
      .from("user_settings")
      .upsert({ user_id: user.id, avatar_url: parsed.avatarUrl });
    if (error) throw new Error(error.message);
  }
}
