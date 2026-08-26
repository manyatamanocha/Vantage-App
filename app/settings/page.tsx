import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getSettings } from "./actions";
import { getProfile } from "./profile-actions";
import { SettingsForm } from "./settings-form";
import { ProfileCard } from "./profile-card";

export default async function SettingsPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const userId = user.id;
  const [settings, profile] = await Promise.all([getSettings(userId), getProfile()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Account</span></div>
      <header><h1 className="display">Settings</h1></header>

      <ProfileCard profile={profile} />

      <SettingsForm
        userId={userId}
        initialDifficulty={settings.practiceDifficulty}
        initialFrequency={settings.practiceFrequency}
        initialDefaultQuestionType={settings.defaultQuestionType}
      />
    </main>
  );
}
