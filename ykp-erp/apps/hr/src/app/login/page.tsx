"use client";
import * as React from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = React.useState("OWNER");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (r.ok) {
      router.push("/");
    } else {
      setBusy(false);
      alert("Login failed: " + r.status);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-bold">YKP Finance — Pilot Login</h1>
        <p className="text-sm text-muted-foreground">Demo only. Choose a role to mint a session cookie.</p>
        <label className="block space-y-1 text-sm">
          <span>Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            <option value="OWNER">OWNER (full access)</option>
            <option value="FINANCE_ADMIN">FINANCE_ADMIN</option>
            <option value="HR_ADMIN">HR_ADMIN</option>
            <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            <option value="VIEWER">VIEWER</option>
          </select>
        </label>
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
