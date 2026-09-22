"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import type { ParsedCv } from "@job-auto/types";

interface ProfileState {
  linkedinUrl: string | null;
  otherLinks: string[];
  aboutMeText: string | null;
  parsedCvJson: ParsedCv | null;
  canonicalProfileText: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [otherLinksText, setOtherLinksText] = useState("");
  const [aboutMeText, setAboutMeText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
          setLinkedinUrl(data.profile.linkedinUrl ?? "");
          setOtherLinksText((data.profile.otherLinks ?? []).join("\n"));
          setAboutMeText(data.profile.aboutMeText ?? "");
        }
      });
  }, [session]);

  if (isPending) return <main className="p-8">Loading…</main>;
  if (!session) {
    router.push("/login");
    return null;
  }

  async function handleCvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const formData = new FormData();
    formData.append("cv", file);
    const res = await fetch("/api/profile/cv", { method: "POST", body: formData });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setProfile((prev) => ({
      linkedinUrl: prev?.linkedinUrl ?? null,
      otherLinks: prev?.otherLinks ?? [],
      aboutMeText: prev?.aboutMeText ?? null,
      parsedCvJson: data.parsedCv,
      canonicalProfileText: data.canonicalProfileText,
    }));
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linkedinUrl: linkedinUrl || null,
        otherLinks: otherLinksText.split("\n").map((l) => l.trim()).filter(Boolean),
        aboutMeText: aboutMeText || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setProfile((prev) =>
      prev
        ? { ...prev, canonicalProfileText: data.canonicalProfileText }
        : {
            linkedinUrl,
            otherLinks: [],
            aboutMeText,
            parsedCvJson: null,
            canonicalProfileText: data.canonicalProfileText,
          },
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Your profile</h1>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">CV</h2>
        <input type="file" accept=".pdf,.docx" onChange={handleCvUpload} disabled={uploading} />
        {uploading && <p className="mt-2 text-sm text-gray-600">Parsing CV…</p>}
        {profile?.parsedCvJson && (
          <div className="mt-3 rounded border p-3 text-sm">
            <p className="font-medium">{profile.parsedCvJson.summary}</p>
            <p className="mt-2 text-gray-600">
              Skills: {profile.parsedCvJson.skills.join(", ")}
            </p>
            <p className="mt-2 text-gray-600">
              Suggested roles: {profile.parsedCvJson.suggestedRoles.join(", ")}
            </p>
          </div>
        )}
      </section>

      <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
        <label className="text-sm font-medium">LinkedIn URL</label>
        <input
          className="border rounded px-3 py-2"
          type="url"
          placeholder="https://linkedin.com/in/..."
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
        />

        <label className="text-sm font-medium">Other links (one per line)</label>
        <textarea
          className="border rounded px-3 py-2"
          rows={3}
          placeholder="https://github.com/...&#10;https://portfolio.com"
          value={otherLinksText}
          onChange={(e) => setOtherLinksText(e.target.value)}
        />

        <label className="text-sm font-medium">About me</label>
        <textarea
          className="border rounded px-3 py-2"
          rows={5}
          placeholder="Tell us about yourself, what you're looking for, anything your CV doesn't capture..."
          value={aboutMeText}
          onChange={(e) => setAboutMeText(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </form>

      {profile?.canonicalProfileText && (
        <section className="mt-8">
          <h2 className="mb-2 font-medium">Synthesized profile</h2>
          <p className="whitespace-pre-line rounded border p-3 text-sm text-gray-700">
            {profile.canonicalProfileText}
          </p>
        </section>
      )}
    </main>
  );
}
