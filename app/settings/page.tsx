import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getSettings } from "./actions";
import { getProfile } from "./profile-actions";
import { SettingsForm } from "./settings-form";
import { ProfileCard } from "./profile-card";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const isAdmin = user.app_metadata?.role === "admin";
  const params = await searchParams;
  const previewLearner = params.view === "learner";

  const userId = user.id;
  const [settings, profile] = await Promise.all([getSettings(userId), getProfile()]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Account</span></div>
      <header><h1 className="display">Settings</h1></header>

      {isAdmin && !previewLearner ? (
        <section className="stack">
          <span className="card-label">Account</span>
          <div className="card">
            <div className="history-row">
              <div className="flex-1">
                <strong>{profile.fullName || profile.email}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">Role: Administrator</p>
              </div>
            </div>
          </div>
          <div className="actions">
            <Link href="/admin" className="btn btn-primary">Open admin dashboard</Link>
            <Link href="/settings?view=learner" className="btn btn-secondary">Preview learner experience</Link>
          </div>
        </section>
      ) : null}

      {isAdmin && previewLearner ? (
        <div className="actions" style={{ marginBottom: 14 }}>
          <Link href="/settings" className="btn btn-secondary">Back to admin view</Link>
        </div>
      ) : null}

      {!isAdmin || previewLearner ? (
        <>
          <ProfileCard profile={profile} />

          <SettingsForm
            userId={userId}
            initialDifficulty={settings.practiceDifficulty}
            initialFrequency={settings.practiceFrequency}
            initialDefaultQuestionType={settings.defaultQuestionType}
          />
        </>
      ) : null}
    </main>
  );
}
