import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings2, Eye } from "lucide-react";
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
        <>
          <ProfileCard
            profile={{ ...profile, fullName: profile.fullName || "Manyata Manocha" }}
            extraLine="Role: Administrator"
          />
          <section className="admin-card-row" style={{ marginTop: 26 }}>
            <Link href="/admin" className="admin-card-btn">
              <span className="admin-card-btn-icon" style={{ background: "var(--primary)" }}>
                <Settings2 size={16} aria-hidden="true" />
              </span>
              <div>
                <div className="admin-card-btn-title">Admin dashboard</div>
                <p className="admin-card-btn-sub">Manage content &amp; users</p>
              </div>
            </Link>
            <Link href="/settings?view=learner" className="admin-card-btn">
              <span className="admin-card-btn-icon" style={{ background: "var(--muted-foreground)" }}>
                <Eye size={16} aria-hidden="true" />
              </span>
              <div>
                <div className="admin-card-btn-title">Preview learner view</div>
                <p className="admin-card-btn-sub">See it as a learner would</p>
              </div>
            </Link>
          </section>
        </>
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
