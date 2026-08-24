"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Pencil, User as UserIcon } from "lucide-react";
import { updateProfile, type Profile } from "./profile-actions";

// The mockup reads the file via FileReader into a data URL with no backend
// at all (it's a static artifact). The real app has no storage bucket
// provisioned yet, so it keeps that same approach — the data URL is written
// straight onto the user's own auth profile (updateProfile below) rather than
// uploaded anywhere. Capped well under the mockup's stated 5 MB: that much
// base64 text on the user's auth profile risks bloating the session cookie
// enough to break login, which a real storage bucket (a follow-up, not done
// here) would avoid entirely.
const MAX_AVATAR_BYTES = 500 * 1024;

export function ProfileCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.fullName);
  const [role, setRole] = useState(profile.role);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function pickAvatar() {
    setAvatarError(null);
    fileInputRef.current?.click();
  }

  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be under 500 KB.");
      return;
    }
    setAvatarError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatarUrl(dataUrl);
      startTransition(async () => {
        try {
          await updateProfile({ avatarUrl: dataUrl });
          router.refresh();
        } catch (err) {
          setAvatarError(err instanceof Error ? err.message : "Could not save your photo.");
        }
      });
    };
    reader.readAsDataURL(file);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateProfile({ fullName: name.trim(), role: role.trim() });
        setEditing(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save your profile.");
      }
    });
  }

  function cancel() {
    setName(profile.fullName);
    setRole(profile.role);
    setError(null);
    setEditing(false);
  }

  return (
    <>
      <div className="row-between" style={{ marginBottom: 26 }}>
        <div className="row-between" style={{ justifyContent: "flex-start", gap: 12 }}>
          <button
            type="button"
            onClick={pickAvatar}
            aria-label="Add profile picture"
            style={{ position: "relative", width: 52, height: 52, border: 0, padding: 0, background: "transparent", cursor: "pointer", flexShrink: 0 }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 999,
                background: "var(--accent)",
                color: "var(--accent-foreground)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 18,
                overflow: "hidden",
              }}
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : name.trim() ? (
                name.trim().charAt(0).toUpperCase()
              ) : (
                <UserIcon size={20} aria-hidden="true" />
              )}
            </div>
            <span
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                width: 22,
                height: 22,
                borderRadius: 999,
                background: "var(--primary)",
                color: "var(--primary-foreground)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "2px solid var(--background)",
              }}
            >
              <Camera size={12} aria-hidden="true" />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={onAvatarChange}
          />
          <div>
            <div style={{ fontWeight: 700 }}>{profile.fullName || "Add your name"}</div>
            <div className="card-text" style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
              {profile.role || "Add your role"}
            </div>
            <div className="card-text" style={{ fontSize: 12.5, color: "var(--muted-foreground)", marginTop: 1 }}>
              {profile.email || "Add your email"}
            </div>
            {avatarError ? (
              <div style={{ fontSize: 12, color: "var(--destructive)", marginTop: 3 }}>{avatarError}</div>
            ) : null}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => setEditing((v) => !v)}>
          <Pencil size={14} aria-hidden="true" /> Edit profile
        </button>
      </div>

      {editing ? (
        <div className="card" style={{ marginBottom: 14 }}>
          <span className="card-label" style={{ marginBottom: 14 }}>Edit profile</span>
          <div className="stack">
            <label className="field" htmlFor="pfName">
              <span>Name</span>
              <input className="input" id="pfName" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field" htmlFor="pfRole">
              <span>Role</span>
              <input className="input" id="pfRole" placeholder="e.g. Consultant" value={role} onChange={(e) => setRole(e.target.value)} />
            </label>
            <label className="field" htmlFor="pfEmail">
              <span>Email</span>
              <input className="input" id="pfEmail" type="email" value={profile.email} disabled />
            </label>
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={save} disabled={isPending}>
              {isPending ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={cancel} disabled={isPending}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
