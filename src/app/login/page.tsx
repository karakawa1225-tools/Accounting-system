"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "ログイン失敗");
      setLoading(false);
      return;
    }
    router.push("/admin/masters");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-6">
      <div className="text-center font-brand text-4xl font-black tracking-[0.18em] text-transparent sm:text-5xl md:text-6xl bg-gradient-to-r from-cyan-700 via-sky-600 to-blue-600 bg-clip-text">
        Silverjet
      </div>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-xl border border-slate-300 bg-white p-8 shadow-md"
      >
        <h1 className="mt-0 text-2xl font-extrabold tracking-[0.08em]">ログイン</h1>
        <label className="block text-base font-bold tracking-wide">メールアドレス</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 text-base font-semibold tracking-wide"
        />
        <label className="block text-base font-bold tracking-wide">パスワード</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-3 text-base font-semibold tracking-wide"
        />
        {error ? <p className="font-bold tracking-wide text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border-0 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500 px-4 py-3.5 text-base font-extrabold tracking-[0.12em] text-white shadow-sm disabled:opacity-60"
        >
          {loading ? "送信中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
