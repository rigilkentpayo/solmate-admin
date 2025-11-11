"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase-client";
import { Mail, Lock, Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      r.replace("/dashboard");
    } catch (e: any) {
      const msg =
        e?.code === "auth/invalid-credential"
          ? "Invalid email or password."
          : e?.message ?? "Login failed.";
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden text-slate-100">
      {/* --- Background: grayer, calmer --- */}
      {/* Base radial gradients (slate-focused) */}
      <div className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(1200px_700px_at_10%_-10%,theme(colors.slate.800/.95),transparent_55%),radial-gradient(1000px_600px_at_100%_0%,theme(colors.slate.900/.8),transparent_60%)]" />
      {/* Soft linear wash */}
      <div className="pointer-events-none absolute inset-0 -z-30 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900" />
      {/* 50% gray veil to neutralize color further */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-slate-900/50" />
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage:
            "radial-gradient(ellipse at center, black 65%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 65%, transparent 100%)",
        }}
      />
      {/* Soft blobs (desaturated) */}
      <div className="pointer-events-none absolute -top-24 -left-24 -z-10 h-[420px] w-[420px] rounded-full bg-slate-600/18 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/3 -z-10 h-[300px] w-[300px] rounded-full bg-slate-700/14 blur-[100px]" />

      {/* Center container */}
      <div className="mx-auto grid min-h-screen max-w-screen-sm place-items-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full"
        >
          <div className="rounded-2xl border border-white/10 bg-white/10 p-1 backdrop-blur-md shadow-2xl shadow-slate-950/40">
            <div className="rounded-2xl bg-gradient-to-b from-white/10 to-white/5 p-6 sm:p-8">
              {/* Brand header (larger logo + high contrast) */}
              <div className="mb-6 flex items-center gap-4">
                <Image
                  src="/solmate-logo.png" // ensure this exists in /public
                  alt="SolMate"
                  width={72}
                  height={72}
                  className="rounded-xl ring-1 ring-white/25"
                  priority
                />
                <div className="leading-tight">
                  <h1 className="text-2xl font-semibold text-white">SolMate Admin</h1>
                  <p className="text-sm text-white/85">Secure access • Monitoring &amp; Reporting</p>
                </div>
              </div>

              {/* Card content */}
              <form
                onSubmit={onSubmit}
                className="rounded-xl bg-white p-5 text-slate-900 shadow-lg ring-1 ring-slate-900/5"
              >
                <div className="mb-5 flex items-center gap-2 text-slate-600">
                  <Shield className="h-4 w-4" />
                  <span className="text-xs">Admin area — authorized users only</span>
                </div>

                {/* Email */}
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>
                <div className="relative mb-4">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Password */}
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative mb-4">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                    placeholder="••••••••"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Error / info */}
                {err && (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                    {err}
                  </div>
                )}

                {/* Action */}
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500/40 disabled:opacity-60"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </button>
              </form>

              {/* Footer tiny text (high contrast) */}
              <p className="mt-4 text-center text-xs text-white/80">
                © {new Date().getFullYear()} SolMate • Admin Console
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
