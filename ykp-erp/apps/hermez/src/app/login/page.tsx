"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = React.useState("SUPER_ADMIN");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role, password }),
    });
    if (r.ok) {
      router.push("/");
    } else {
      const j = await r.json().catch(() => ({}));
      setError(j?.error?.message ?? `Login failed: ${r.status}`);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-bold">YKP Hermez — Pilot Login</h1>
        <p className="text-sm text-muted-foreground">Demo only. Access password is required.</p>
        <label className="block space-y-1 text-sm">
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            <option value="SUPER_ADMIN">SUPER_ADMIN (full access)</option>
            <option value="OWNER">OWNER</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
        <label className="block space-y-1 text-sm">
          <span>Access Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md border bg-background px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground"
        >
          {busy ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
