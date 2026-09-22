"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function PreferencesPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  const [rolesText, setRolesText] = useState("");
  const [locationsText, setLocationsText] = useState("");
  const [remotePref, setRemotePref] = useState("any");
  const [salaryFloor, setSalaryFloor] = useState("");
  const [industriesText, setIndustriesText] = useState("");
  const [maxApplicationsPerDay, setMaxApplicationsPerDay] = useState(10);
  const [dailyRunTime, setDailyRunTime] = useState("08:00");

  const [loaded, setLoaded] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!session) return;
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences) {
          const p = data.preferences;
          setRolesText((p.roles ?? []).join("\n"));
          setLocationsText((p.locations ?? []).join("\n"));
          setRemotePref(p.remotePref ?? "any");
          setSalaryFloor(p.salaryFloor?.toString() ?? "");
          setIndustriesText((p.industries ?? []).join("\n"));
          setMaxApplicationsPerDay(p.maxApplicationsPerDay ?? 10);
          setDailyRunTime(p.dailyRunTime ?? "08:00");
        }
        setLoaded(true);
      });
  }, [session]);

  if (isPending) return <main className="p-8">Loading…</main>;
  if (!session) {
    router.push("/login");
    return null;
  }

  async function handleSuggest() {
    setError(null);
    setSuggesting(true);
    const res = await fetch("/api/preferences/suggest", { method: "POST" });
    const data = await res.json();
    setSuggesting(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't generate suggestions");
      return;
    }
    const s = data.suggestion;
    setRolesText(s.roles.join("\n"));
    setLocationsText(s.locations.join("\n"));
    setRemotePref(s.remotePref);
    setSalaryFloor(s.salaryFloor?.toString() ?? "");
    setIndustriesText(s.industries.join("\n"));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roles: rolesText.split("\n").map((s) => s.trim()).filter(Boolean),
        locations: locationsText.split("\n").map((s) => s.trim()).filter(Boolean),
        remotePref,
        salaryFloor: salaryFloor ? Number(salaryFloor) : undefined,
        industries: industriesText.split("\n").map((s) => s.trim()).filter(Boolean),
        maxApplicationsPerDay,
        dailyRunTime,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
      return;
    }
    setSaved(true);
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-xl font-semibold">Job preferences</h1>
      {loaded && (
        <button
          type="button"
          onClick={handleSuggest}
          disabled={suggesting}
          className="mb-6 rounded border px-3 py-2 text-sm disabled:opacity-50"
        >
          {suggesting ? "Thinking…" : "Suggest from my CV"}
        </button>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <label className="text-sm font-medium">Target roles (one per line)</label>
        <textarea
          className="border rounded px-3 py-2"
          rows={3}
          value={rolesText}
          onChange={(e) => setRolesText(e.target.value)}
        />

        <label className="text-sm font-medium">Locations (one per line)</label>
        <textarea
          className="border rounded px-3 py-2"
          rows={2}
          value={locationsText}
          onChange={(e) => setLocationsText(e.target.value)}
        />

        <label className="text-sm font-medium">Remote preference</label>
        <select
          className="border rounded px-3 py-2"
          value={remotePref}
          onChange={(e) => setRemotePref(e.target.value)}
        >
          <option value="any">Any</option>
          <option value="remote">Remote only</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>

        <label className="text-sm font-medium">Minimum salary (USD, optional)</label>
        <input
          className="border rounded px-3 py-2"
          type="number"
          value={salaryFloor}
          onChange={(e) => setSalaryFloor(e.target.value)}
        />

        <label className="text-sm font-medium">Industries (one per line)</label>
        <textarea
          className="border rounded px-3 py-2"
          rows={2}
          value={industriesText}
          onChange={(e) => setIndustriesText(e.target.value)}
        />

        <label className="text-sm font-medium">Max applications per day</label>
        <input
          className="border rounded px-3 py-2"
          type="number"
          min={1}
          max={50}
          value={maxApplicationsPerDay}
          onChange={(e) => setMaxApplicationsPerDay(Number(e.target.value))}
        />

        <label className="text-sm font-medium">Daily run time</label>
        <input
          className="border rounded px-3 py-2"
          type="time"
          value={dailyRunTime}
          onChange={(e) => setDailyRunTime(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-green-700">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save preferences"}
        </button>
      </form>
    </main>
  );
}
