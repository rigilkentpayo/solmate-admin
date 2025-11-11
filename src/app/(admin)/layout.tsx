"use client";

import { ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase-client";
import { onValue, ref } from "firebase/database";
import { LogOut } from "lucide-react";

// Email allow-list + RTDB role check (keep)
const ADMIN_EMAILS = ["admin@solmate.com", "queenelynalunan0@gmail.com"]; // add yours here

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ok" | "nope">("checking");
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const r = useRouter();

  useEffect(() => {
    let roleUnsub: (() => void) | null = null;

    const off = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setState("checking");
        r.replace("/login");
        return;
      }

      setMeEmail(user.email ?? null);

      const emailAllowed = !!user.email && ADMIN_EMAILS.includes(user.email);
      if (emailAllowed) {
        setState("ok");
        if (roleUnsub) roleUnsub();
        roleUnsub = null;
        return;
      }

      // fallback: RTDB role
      const roleRef = ref(db, `/users/${user.uid}/role`);
      const stop = onValue(roleRef, (snap) => {
        const role = snap.val();
        setState(role === "admin" ? "ok" : "nope");
      });
      roleUnsub = () => stop();
    });

    return () => {
      off();
      if (roleUnsub) roleUnsub();
    };
  }, [r]);

  if (state === "checking") {
    return (
      <Shell>
        <div className="grid min-h-screen place-items-center px-6">
          <GlassCard>Checking access…</GlassCard>
        </div>
      </Shell>
    );
  }

  if (state === "nope") {
    return (
      <Shell>
        <div className="grid min-h-screen place-items-center px-6">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/10 p-6 text-slate-100 backdrop-blur-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <Image
                src="/solmate-logo.png"
                alt="SolMate Logo"
                width={40}
                height={40}
                className="rounded-md"
                priority
              />
              <div className="leading-tight">
                <h1 className="text-lg font-semibold">SolMate Admin</h1>
                <p className="text-xs text-slate-200/80">Monitoring &amp; Reporting</p>
              </div>
            </div>

            <p className="text-sm text-slate-100/90">
              This area is for admins only. Your account{" "}
              <span className="font-mono">{meEmail ?? "(no email)"}</span> is not authorized.
            </p>

            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-slate-600 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-slate-900/40 hover:from-slate-500 hover:to-sky-500"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // Authorized layout
  return (
    <Shell>
      {/* Header (Dashboard button removed) */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-800/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/solmate-logo.png"
              alt="SolMate Logo"
              width={44}
              height={44}
              className="rounded-lg ring-1 ring-white/10"
              priority
            />
            <div className="leading-tight">
              <h1 className="font-semibold tracking-tight">SolMate Admin</h1>
              <p className="text-xs text-slate-200/80">Monitoring &amp; Reporting</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* email pill */}
            {meEmail && (
              <span className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-100/90">
                {meEmail}
              </span>
            )}
            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-slate-600 to-sky-600 px-3.5 py-2 text-sm font-medium text-white shadow-md shadow-slate-900/30 hover:from-slate-500 hover:to-sky-500"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>

        {/* Slim accent bar */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </header>

      {/* Main: wider container with gray panels */}
      <main className="relative mx-auto max-w-screen-2xl px-6 py-8">
        {/* Left/Right gray rails */}
        <div className="pointer-events-none absolute inset-y-0 left-0 -z-10 hidden w-24 bg-white/5 backdrop-blur-[1px] sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-24 bg-white/5 backdrop-blur-[1px] sm:block" />

        {/* Center gray panel behind the glass frame */}
        <div className="pointer-events-none absolute inset-0 -z-10 mx-2 rounded-3xl bg-white/[0.055] ring-1 ring-white/5" />

        {/* Glass frame around page content */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-1 backdrop-blur-md shadow-2xl shadow-slate-950/40">
          <div className="rounded-2xl bg-gradient-to-b from-white/6 via-white/4 to-white/2 p-5">
            {children}
          </div>
        </div>

        {/* Footer gray strip */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-center text-xs text-slate-200/80">
          © {new Date().getFullYear()} SolMate Admin • internal dashboard
        </div>
      </main>
    </Shell>
  );
}

/* ---------- Shell + Grayish-blue Background (even more layers) ---------- */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-slate-100">
      {/* Base grayish slate gradient */}
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(1200px_700px_at_10%_-10%,theme(colors.slate.800/.9),transparent_55%),radial-gradient(1100px_600px_at_100%_0%,theme(colors.slate.900/.75),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 mix-blend-screen" />

      {/* Deep vignettes */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 bg-gradient-to-b from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-black/45 to-transparent" />

      {/* Pulsing glow blobs (very subtle) */}
      <div className="pointer-events-none absolute -top-24 -left-24 -z-10 h-[420px] w-[420px] rounded-full bg-slate-500/25 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute top-1/3 -right-24 -z-10 h-[360px] w-[360px] rounded-full bg-slate-600/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 -z-10 h-[300px] w-[300px] rounded-full bg-slate-700/18 blur-[100px] animate-pulse" />

      {/* Orbit rings (architectural lines) */}
      <div className="pointer-events-none absolute left-1/2 top-[22%] -z-10 -translate-x-1/2 rounded-full border border-white/8 p-[180px]" />
      <div className="pointer-events-none absolute left-1/2 top-[22%] -z-10 -translate-x-1/2 rounded-full border border-white/6 p-[260px]" />
      <div className="pointer-events-none absolute left-1/2 top-[22%] -z-10 -translate-x-1/2 rounded-full border border-white/5 p-[340px]" />

      {/* Conic highlight behind header */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[conic-gradient(from_220deg_at_50%_50%,theme(colors.slate.300/.18),transparent_25%,transparent_75%,theme(colors.slate.300/.18))] blur-2xl" />

      {/* Diagonal texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.045]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, rgba(255,255,255,0.18) 0px, rgba(255,255,255,0.18) 1px, transparent 1px, transparent 7px)",
        }}
      />

      {/* Tiny specks (starry dust) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.065]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 20%, rgba(255,255,255,0.15) 1px, transparent 1.2px), radial-gradient(circle at 70% 10%, rgba(255,255,255,0.14) 1.2px, transparent 1.4px), radial-gradient(circle at 40% 80%, rgba(255,255,255,0.12) 1px, transparent 1.2px), radial-gradient(circle at 85% 60%, rgba(255,255,255,0.13) 1px, transparent 1.3px), radial-gradient(circle at 25% 65%, rgba(255,255,255,0.12) 1px, transparent 1.2px)",
        }}
      />

      {/* Soft grid overlay (cool gray) */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage: "radial-gradient(ellipse at center, black 66%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 66%, transparent 100%)",
        }}
      />

      {children}
    </div>
  );
}

function GlassCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-6 text-slate-100 backdrop-blur-md shadow-2xl">
      {children}
    </div>
  );
}
