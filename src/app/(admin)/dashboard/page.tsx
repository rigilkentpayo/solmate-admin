// app/(admin)/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import type React from "react";
import { db, auth } from "@/lib/firebase-client";
import { onValue, ref, update } from "firebase/database";
import emailjs from "@emailjs/browser";
import {
  Users,
  Cpu,
  Wifi,
  WifiOff,
  Download,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  CircleSlash,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

/* ==================== Types ==================== */
type TicketStatus = "open" | "pending" | "closed";

type UserRow = {
  uid: string;
  name?: string | null;
  fullName?: string | null;
  email?: string | null;
  pairedDevice?: string | null;
  pairedDevices?: Record<string, boolean> | null;
  devices?: Record<string, boolean> | null;
  role?: string | null;
};

type DeviceRow = {
  id: string;
  name?: string | null;
  ownerUid?: string | null;
  pairedTo?: string | null; // legacy single pairing (kept for compatibility but not shown)
  pairedUsers?: Record<string, boolean> | null; // multi-user mapping
  lastSeen?: number | null;
  battery?: number | null;
  power?: boolean | null;
  online?: boolean | null; // ignored. we use heartbeat only
};

type Ticket = {
  id: string;
  uid?: string;
  email?: string;
  status?: TicketStatus; // "open" | "pending" | "closed"
  subject?: string;
  message?: string;
  createdAt?: number;
  createdAtServer?: number;
  updatedAt?: number;
  deviceId?: string; // for DeviceTicket
  __type?: "support" | "device";
};

const ONLINE_WINDOW_MS = 20_000;

/* ==================== EmailJS config ==================== */
const EJ_SERVICE = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
const EJ_TEMPLATE = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
const EJ_PUBLIC = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";
const FROM_NAME = process.env.NEXT_PUBLIC_EMAILJS_FROM_NAME || "SolMate Support";
const FROM_EMAIL = process.env.NEXT_PUBLIC_EMAILJS_FROM_EMAIL || "solmateadm@gmail.com";
const EMAILJS_ENABLED = !!(EJ_SERVICE && EJ_TEMPLATE && EJ_PUBLIC);

if (!EMAILJS_ENABLED) {
  // eslint-disable-next-line no-console
  console.info(
      "[EmailJS] Disabled: set NEXT_PUBLIC_EMAILJS_SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY to enable direct send."
  );
}

/* ==================== Helpers ==================== */
function getUserDeviceIds(
    u: any,
    allDevices: Record<string, DeviceRow>,
    uid: string
): string[] {
  const fromPairedDevices = u?.pairedDevices ? Object.keys(u.pairedDevices) : [];
  const fromDevicesMap = u?.devices ? Object.keys(u.devices) : [];
  const fromSingle = u?.pairedDevice ? [String(u.pairedDevice)] : [];
  const inferredFromDevices = Object.values(allDevices)
      .filter((d) => (d?.pairedTo ?? "") === uid || (d?.pairedUsers && d.pairedUsers[uid]))
      .map((d) => String(d.id));

  return Array.from(
      new Set<string>([
        ...fromPairedDevices.map(String),
        ...fromDevicesMap.map(String),
        ...fromSingle.map(String),
        ...inferredFromDevices,
      ])
  );
}

function isOnline(lastSeen?: number | null, now = Date.now()) {
  return typeof lastSeen === "number" && now - lastSeen <= ONLINE_WINDOW_MS;
}
function timeAgo(deltaMs: number) {
  if (deltaMs < 5_000) return "just now";
  const s = Math.floor(deltaMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
function tsCompact() {
  return new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
}
function keyOf(t: Ticket) {
  return `${t.__type}:${t.id}`;
}

/* Utility: paired users of a device as [{uid, name}] */
function devicePairedUsersList(
    d: DeviceRow,
    users: Record<string, UserRow>
): Array<{ uid: string; name?: string | null }> {
  const ids = d?.pairedUsers ? Object.keys(d.pairedUsers) : [];
  return ids.map((uid) => ({ uid, name: users[uid]?.fullName ?? users[uid]?.name ?? null }));
}

/* ==================== Toast (light theme) ==================== */
type ToastKind = "success" | "error" | "info";
function Toast({
                 show,
                 kind,
                 title,
                 msg,
                 onClose,
               }: {
  show: boolean;
  kind: ToastKind;
  title: string;
  msg?: string;
  onClose: () => void;
}) {
  if (!show) return null;
  const palette =
      kind === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-slate-200 bg-white text-slate-900";
  return (
      <div className="fixed right-4 top-4 z-[100]">
        <div
            className={`min-w=[260px] max-w-[480px] rounded-xl border p-3 shadow-lg ${palette}`}
        >
          <div className="flex items-start gap-3">
            <div className="font-semibold">{title}</div>
            <button onClick={onClose} className="ml-auto text-xs opacity-80 hover:opacity-100">
              ✕
            </button>
          </div>
          {msg && <div className="mt-1 text-sm opacity-90">{msg}</div>}
        </div>
      </div>
  );
}

/* ==================== Page ==================== */
export default function Dashboard() {
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [devices, setDevices] = useState<Record<string, DeviceRow>>({});
  const [supportTickets, setSupportTickets] = useState<Record<string, Ticket>>({});
  const [deviceTickets, setDeviceTickets] = useState<Record<string, Ticket>>({});

  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"device" | "name">("device");

  // for real-time heartbeat flip
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Ticket UI state
  const [tSearch, setTSearch] = useState("");
  const [tType, setTType] = useState<"all" | "support" | "device">("all");
  const [tStatus, setTStatus] = useState<"all" | TicketStatus>("all");
  const [pendingStatus, setPendingStatus] = useState<
      Record<string, TicketStatus | string>
  >({});
  const [replyOpen, setReplyOpen] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // deviceId -> expanded panel

  // Toast
  const [toast, setToast] = useState<{
    show: boolean;
    kind: ToastKind;
    title: string;
    msg?: string;
  }>({
    show: false,
    kind: "info",
    title: "",
    msg: "",
  });
  function showToast(kind: ToastKind, title: string, msg?: string) {
    setToast({ show: true, kind, title, msg });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
  }

  // Live subscriptions
  useEffect(() => {
    const offUsers = onValue(ref(db, "/users"), (s) => {
      const v = (s.val() ?? {}) as Record<string, any>;
      const mapped: Record<string, UserRow> = {};
      Object.entries(v).forEach(([uid, u]) => (mapped[uid] = { uid, ...u }));
      setUsers(mapped);
    });
    const offDevices = onValue(ref(db, "/devices"), (s) => {
      const v = (s.val() ?? {}) as Record<string, any>;
      const mapped: Record<string, DeviceRow> = {};
      Object.entries(v).forEach(([id, d]) => (mapped[id] = { id, ...d } as DeviceRow));
      setDevices(mapped);
    });
    const offSupport = onValue(ref(db, "/supportTickets"), (s) => {
      const v = (s.val() ?? {}) as Record<string, any>;
      const mapped: Record<string, Ticket> = {};
      Object.entries(v || {}).forEach(
          ([id, t]) => (mapped[id] = { id, __type: "support", ...t })
      );
      setSupportTickets(mapped);
    });
    const offDevTickets = onValue(ref(db, "/DeviceTicket"), (s) => {
      const v = (s.val() ?? {}) as Record<string, any>;
      const mapped: Record<string, Ticket> = {};
      Object.entries(v || {}).forEach(
          ([id, t]) => (mapped[id] = { id, __type: "device", ...t })
      );
      setDeviceTickets(mapped);
    });
    return () => {
      offUsers();
      offDevices();
      offSupport();
      offDevTickets();
    };
  }, []);

  /* ---------- Stats ---------- */
  const { totalDevices, onlineDevices } = useMemo(() => {
    const devs = Object.values(devices);
    const countOnline = devs.filter((d) => isOnline(d?.lastSeen, now)).length; // heartbeat only
    return { totalDevices: devs.length, onlineDevices: countOnline };
  }, [devices, now]);
  const offlineDevices = totalDevices - onlineDevices;
  const totalUsers = Object.keys(users).length;

  const allTickets = useMemo(() => {
    const a = Object.values(supportTickets);
    const b = Object.values(deviceTickets);
    return [...a, ...b].map((t) => ({
      ...t,
      status: (t.status ?? "open").toLowerCase() as TicketStatus,
    }));
  }, [supportTickets, deviceTickets]);

  /* ---------- Rows: Users (with Device List only) ---------- */
  type UDRow = {
    uid: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    deviceIds: string[];
  };

  const rows: UDRow[] = useMemo(() => {
    const list: UDRow[] = [];

    Object.values(users).forEach((u) => {
      const collectedIds = getUserDeviceIds(u, devices, u.uid);
      const deviceIds = Array.from(new Set(collectedIds.map(String)));
      list.push({
        uid: u.uid,
        name: (u as any).fullName ?? (u as any).name ?? null,
        email: (u as any).email ?? null,
        role: (u as any).role ?? null,
        deviceIds,
      });
    });

    const Q = q.trim().toLowerCase();
    const searched = !Q
        ? list
        : list.filter((r) => {
          const uid = (r.uid ?? "").toLowerCase();
          const email = (r.email ?? "").toLowerCase();
          const name = (r.name == null ? "" : String(r.name)).toLowerCase();
          const devList = r.deviceIds.join(",").toLowerCase();
          return uid.includes(Q) || email.includes(Q) || name.includes(Q) || devList.includes(Q);
        });

    const sorted = [...searched].sort((a, b) => {
      if (sort === "name") {
        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      }
      // sort by first device id
      const aFirst = a.deviceIds[0] ?? "";
      const bFirst = b.deviceIds[0] ?? "";
      return aFirst.localeCompare(bFirst);
    });

    return sorted;
  }, [users, devices, q, sort]);

  /* ---------- Tickets: filters & rows ---------- */
  const ticketCounts = useMemo(() => {
    return allTickets.reduce(
        (acc, t) => {
          const s = (t.status ?? "open") as TicketStatus;
          acc[s] = (acc[s] ?? 0) + 1;
          return acc;
        },
        { open: 0, pending: 0, closed: 0 } as Record<TicketStatus, number>
    );
  }, [allTickets]);

  const ticketRows = useMemo(() => {
    const merged: Ticket[] = allTickets.map((t) => ({
      ...t,
      status: (t.status ?? "open").toLowerCase() as TicketStatus,
    }));
    merged.sort((a, b) => {
      const ta = a.createdAtServer ?? a.createdAt ?? a.updatedAt ?? 0;
      const tb = b.createdAtServer ?? b.createdAt ?? b.updatedAt ?? 0;
      return tb - ta;
    });
    const Q = tSearch.trim().toLowerCase();
    return merged.filter((t) => {
      if (tType !== "all" && t.__type !== tType) return false;
      if (tStatus !== "all" && (t.status ?? "open") !== tStatus) return false;
      if (!Q) return true;
      const email = (t.email ?? "").toLowerCase();
      const uid = (t.uid ?? "").toLowerCase();
      const subj = (t.subject ?? "").toLowerCase();
      const msg = (t.message ?? "").toLowerCase();
      const dev = (t.deviceId ?? "").toLowerCase();
      return (
          email.includes(Q) ||
          uid.includes(Q) ||
          subj.includes(Q) ||
          msg.includes(Q) ||
          dev.includes(Q)
      );
    });
  }, [allTickets, tSearch, tType, tStatus]);

  function onLocalStatusChange(t: Ticket, next: string) {
    setPendingStatus((prev) => ({ ...prev, [keyOf(t)]: next }));
  }
  async function saveTicketStatus(t: Ticket) {
    const k = keyOf(t);
    const next = (pendingStatus[k] ?? t.status ?? "open").toLowerCase() as TicketStatus;
    if (!["open", "pending", "closed"].includes(next))
      return showToast("error", "Invalid status", "Use open, pending, or closed.");
    const path =
        t.__type === "device" ? `/DeviceTicket/${t.id}` : `/supportTickets/${t.id}`;
    await update(ref(db, path), { status: next, updatedAt: Date.now() });
    setPendingStatus((prev) => {
      const { [k]: _omit, ...rest } = prev;
      return rest;
    });
    showToast("success", "Status updated", `Ticket ${t.id} → ${next}`);
  }

  async function sendReply(t: Ticket) {
    const me = auth.currentUser;
    if (!me) return showToast("error", "Sign in first");
    if (!t.email)
      return showToast("error", "No recipient email", "This ticket has no email to reply to.");

    const k = keyOf(t);
    const body = (replyText[k] ?? "").trim();
    if (!body) return showToast("error", "Write a message first");

    const subjCore = t.subject && t.subject.trim() ? t.subject : "(no subject)";
    const subject = `[SolMate Support] ${subjCore}${t.deviceId ? ` • ${t.deviceId}` : ""} • ${t.id}`;

    try {
      setSending((p) => ({ ...p, [k]: true }));

      // Log to RTDB
      const repliesPath =
          t.__type === "device"
              ? `/DeviceTicket/${t.id}/replies`
              : `/supportTickets/${t.id}/replies`;
      const newId = Date.now().toString();
      await update(ref(db, `${repliesPath}/${newId}`), {
        by: me.uid,
        emailTo: t.email,
        message: body,
        createdAt: Date.now(),
        via: EMAILJS_ENABLED ? "emailjs" : "gmail_web",
      });

      if (EMAILJS_ENABLED) {
        await emailjs.send(
            EJ_SERVICE,
            EJ_TEMPLATE,
            {
              to_email: t.email,
              to_name: t.uid ?? t.email,
              from_name: FROM_NAME,
              from_email: FROM_EMAIL,
              subject,
              message: body,
              ticket_id: t.id,
              ticket_type: t.__type,
              device_id: t.deviceId ?? "",
              user_uid: t.uid ?? "",
            },
            { publicKey: EJ_PUBLIC }
        );
        showToast("success", "Email sent ✅", `To ${t.email}`);
      } else {
        const composeUrl =
            `https://mail.google.com/mail/?view=cm&fs=1` +
            `&to=${encodeURIComponent(t.email)}` +
            `&su=${encodeURIComponent(subject)}` +
            `&body=${encodeURIComponent(body)}`;
        const win = window.open(composeUrl, "_blank", "noopener,noreferrer");
        if (!win) {
          showToast("error", "Popup blocked", "Allow pop-ups for this site and try again.");
        } else {
          showToast("info", "Opened Gmail compose", "Press Send in the Gmail tab.");
        }
      }

      setReplyText((p) => ({ ...p, [k]: "" }));
      setReplyOpen((p) => ({ ...p, [k]: false }));
    } catch (e: any) {
      console.error(e);
      showToast("error", "Failed to send", e?.message ?? "Unknown error");
    } finally {
      setSending((p) => ({ ...p, [k]: false }));
    }
  }

  /* ---------- PDF export (Users page, Devices page with Paired Users, Tickets page) ---------- */
  async function exportPDF() {
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable: any = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ unit: "pt", orientation: "landscape" });
      const margin = { top: 70, right: 36, bottom: 40, left: 36 };
      const pageWidth = (doc as any).internal.pageSize.getWidth();

      // Page 1. Users & Devices list
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("SolMate Admin Export • Users & Devices", margin.left, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const ts = new Date().toLocaleString();
      const onlineCount = Object.values(devices).filter((d) => isOnline(d?.lastSeen)).length;
      const offlineCount = Object.keys(devices).length - onlineCount;
      doc.text(
          `Generated: ${ts} • Users: ${Object.keys(users).length} • Devices: ${
              Object.keys(devices).length
          } • Online: ${onlineCount} • Offline: ${offlineCount}`,
          margin.left,
          56,
          { maxWidth: pageWidth - margin.left - margin.right }
      );

      const userBody = rows.map((r) => ({
        uid: r.uid,
        name: r.name ?? "—",
        email: r.email ?? "—",
        deviceList: r.deviceIds.length ? r.deviceIds.join(", ") : "—",
      }));
      const userColumns = [
        { header: "User UID", dataKey: "uid" },
        { header: "Name", dataKey: "name" },
        { header: "Email", dataKey: "email" },
        { header: "Device List", dataKey: "deviceList" },
      ];

      autoTable(doc, {
        columns: userColumns,
        body: userBody,
        startY: margin.top,
        margin,
        tableWidth: "auto",
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        alternateRowStyles: { fillColor: [247, 249, 251] },
      });

      // Page 2. Devices (with Paired Users)
      doc.addPage("landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("SolMate Admin Export • Devices", margin.left, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const deviceRows = Object.values(devices).map((d) => {
        const list = devicePairedUsersList(d, users)
            .map((p) => `${p.uid}:${p.name ?? "-"}`)
            .join("; ");
        const onlineText = isOnline(d.lastSeen ?? null, Date.now()) ? "online" : "offline";
        return {
          id: d.id,
          name: d.name ?? "—",
          online: onlineText,
          battery: d.battery != null ? `${d.battery}%` : "—",
          owner: d.ownerUid ?? "—",
          power: d.power ? "On" : "Off",
          pairedUsers: list || "—",
        };
      });

      const deviceCols = [
        { header: "Device ID", dataKey: "id" },
        { header: "Name", dataKey: "name" },
        { header: "Online", dataKey: "online" },
        { header: "Battery", dataKey: "battery" },
        { header: "Owner UID", dataKey: "owner" },
        { header: "Power", dataKey: "power" },
        { header: "Paired Users (uid:name)", dataKey: "pairedUsers" },
      ];

      autoTable(doc, {
        columns: deviceCols,
        body: deviceRows,
        startY: margin.top,
        margin,
        tableWidth: "auto",
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        alternateRowStyles: { fillColor: [247, 249, 251] },
      });

      // Page 3. Tickets
      doc.addPage("landscape");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("SolMate Admin Export • Tickets", margin.left, 40);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
          `Filter: ${tType === "all" ? "all types" : tType} • ${
              tStatus === "all" ? "all statuses" : tStatus
          } • Showing ${ticketRows.length} ticket(s)`,
          margin.left,
          56
      );

      const ticketsBody = ticketRows.map((t) => {
        const tsCore = t.createdAtServer ?? t.createdAt ?? t.updatedAt ?? 0;
        const created = tsCore ? new Date(tsCore).toLocaleString() : "—";
        return {
          type: t.__type ?? "—",
          created,
          status: (t.status ?? "open").toLowerCase(),
          email: t.email ?? "—",
          uid: t.uid ?? "—",
          device: t.deviceId ?? "—",
          subject: t.subject ?? "—",
          message: t.message ?? "—",
        };
      });

      const ticketColumns = [
        { header: "Type", dataKey: "type" },
        { header: "Created", dataKey: "created" },
        { header: "Status", dataKey: "status" },
        { header: "Email", dataKey: "email" },
        { header: "User UID", dataKey: "uid" },
        { header: "Device", dataKey: "device" },
        { header: "Subject", dataKey: "subject" },
        { header: "Message", dataKey: "message" },
      ];

      autoTable(doc, {
        columns: ticketColumns,
        body: ticketsBody,
        startY: margin.top,
        margin,
        tableWidth: "auto",
        styles: {
          fontSize: 9,
          cellPadding: 6,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        alternateRowStyles: { fillColor: [247, 249, 251] },
      });

      doc.save(`solmate-admin-${tsCompact()}.pdf`);
      showToast("success", "PDF exported");
    } catch (e: any) {
      console.error(e);
      showToast("error", "Failed to export PDF", e?.message ?? "Unknown error");
    }
  }

  /* ==================== UI (white page surface) ==================== */
  return (
      <div className="rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-slate-900/5">
        <Toast
            show={toast.show}
            kind={toast.kind}
            title={toast.title}
            msg={toast.msg}
            onClose={() => setToast((t) => ({ ...t, show: false }))}
        />

        {/* Header */}
        <div className="flex items-end justify-between gap-3 border-b border-slate-200 px-6 pt-6 pb-4 md:px-8">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
            <p className="text-sm text-slate-600">Overview of users, devices, and tickets.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search user, email, device…"
                  className="h-10 w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </div>

            <div className="relative">
              <Filter className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <select
                  className="h-10 rounded-lg border border-slate-300 bg-white pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  title="Sort"
              >
                <option value="device">Sort: Device ID</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>

            <button
                onClick={exportPDF}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 px-6 py-6 md:grid-cols-4 md:px-8">
          <Stat title="Users" value={totalUsers} icon={<Users className="h-5 w-5" />} tone="primary" />
          <Stat title="Devices" value={Object.keys(devices).length} icon={<Cpu className="h-5 w-5" />} />
          <Stat title="Online" value={onlineDevices} icon={<Wifi className="h-5 w-5" />} tone="ok" />
          <Stat title="Offline" value={offlineDevices} icon={<WifiOff className="h-5 w-5" />} tone="muted" />
        </div>

        {/* Users & Devices Table */}
        <section className="px-6 pb-6 md:px-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[58vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-left text-slate-800">
                  <Th>User UID</Th>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Device List</Th>
                </tr>
                </thead>
                <tbody>
                {rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500">
                        No matching records.
                      </td>
                    </tr>
                ) : (
                    rows.map((r, i) => (
                        <tr key={`${r.uid}:${i}`} className="border-t border-slate-200">
                          <Td mono>{r.uid}</Td>
                          <Td>{r.name ?? "—"}</Td>
                          <Td className="truncate max-w-[280px]">{r.email ?? "—"}</Td>
                          <Td className="whitespace-pre-wrap">
                            {r.deviceIds.length ? r.deviceIds.join(", ") : "—"}
                          </Td>
                        </tr>
                    ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Device Database Table with Paired Users panel */}
        <section className="px-6 pb-6 md:px-8">
          <h3 className="mb-2 text-lg font-semibold">Device Database</h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-left text-slate-800">
                  <Th>Device ID</Th>
                  <Th>Name</Th>
                  <Th>Online</Th>
                  <Th>Battery</Th>
                  <Th>Owner UID</Th>
                  <Th>Paired Users</Th>
                  <Th>Power</Th>
                  <Th>Last seen</Th>
                </tr>
                </thead>
                <tbody>
                {Object.values(devices).length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No devices.
                      </td>
                    </tr>
                ) : (
                    Object.values(devices).map((d) => {
                      const online = isOnline(d?.lastSeen, now);
                      const pairedList = devicePairedUsersList(d, users);
                      const open = !!expanded[d.id];

                      return (
                          <Fragment key={d.id}>
                            <tr className="border-t border-slate-200 align-top">
                              <Td mono>{d.id}</Td>
                              <Td>{d.name ?? "—"}</Td>
                              <Td>{online ? "🟢 Online" : "🔴 Offline"}</Td>
                              <Td>{d.battery != null ? `${d.battery}%` : "—"}</Td>
                              <Td mono>{d.ownerUid ?? "—"}</Td>
                              <Td>
                                <button
                                    onClick={() =>
                                        setExpanded((p) => ({ ...p, [d.id]: !p[d.id] }))
                                    }
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-50"
                                    title="View paired users"
                                >
                                  {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  {pairedList.length} user{pairedList.length === 1 ? "" : "s"}
                                </button>
                              </Td>
                              <Td>{d.power ? "On" : "Off"}</Td>
                              <Td title={d.lastSeen ? new Date(d.lastSeen).toLocaleString() : ""}>
                                {d.lastSeen ? timeAgo(now - d.lastSeen) : "—"}
                              </Td>
                            </tr>

                            {open && (
                                <tr className="border-t border-slate-100 bg-slate-50">
                                  <td colSpan={8} className="p-4">
                                    <div className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
                                      <div className="flex items-center justify-between">
                                        <h4 className="text-base font-semibold text-slate-900">
                                          Paired Users
                                        </h4>
                                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {pairedList.length} user{pairedList.length === 1 ? "" : "s"}
                                  </span>
                                      </div>

                                      {pairedList.length === 0 ? (
                                          <p className="mt-2 text-sm text-slate-500">
                                            No paired users for this device.
                                          </p>
                                      ) : (
                                          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {pairedList.map((p) => (
                                                <li
                                                    key={p.uid}
                                                    className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200"
                                                >
                                                  <div className="min-w-0">
                                                    <div className="truncate font-mono text-[12px] text-slate-800">
                                                      {p.uid}
                                                    </div>
                                                    <div className="truncate text-sm text-slate-700">
                                                      {p.name ?? "—"}
                                                    </div>
                                                  </div>
                                                </li>
                                            ))}
                                          </ul>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                            )}
                          </Fragment>
                      );
                    })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tickets Summary (chips) */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-6 pt-6 md:px-8">
          <TicketChip active={tStatus === "all"} label="All" count={allTickets.length} />
          <TicketChip active={tStatus === "open"} label="Open" tone="ok" count={ticketCounts.open} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
          <TicketChip active={tStatus === "pending"} label="Pending" tone="warn" count={ticketCounts.pending} icon={<Clock className="h-3.5 w-3.5" />} />
          <TicketChip active={tStatus === "closed"} label="Closed" tone="muted" count={ticketCounts.closed} icon={<CircleSlash className="h-3.5 w-3.5" />} />

          <button
              onClick={() => setTStatus("all")}
              className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              title="Clear status filter"
          >
            Clear
          </button>

          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                  value={tSearch}
                  onChange={(e) => setTSearch(e.target.value)}
                  placeholder="Search tickets…"
                  className="h-9 rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
              />
            </div>
            <select
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                value={tType}
                onChange={(e) => setTType(e.target.value as any)}
                title="Filter by type"
            >
              <option value="all">Type: All</option>
              <option value="support">Type: Support</option>
              <option value="device">Type: Device</option>
            </select>
            <select
                className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                value={tStatus}
                onChange={(e) => setTStatus(e.target.value as any)}
                title="Filter by status"
            >
              <option value="all">Status: All</option>
              <option value="open">Status: Open</option>
              <option value="pending">Status: Pending</option>
              <option value="closed">Status: Closed</option>
            </select>
          </div>
        </div>

        {/* Tickets Section */}
        <section className="px-6 pb-8 md:px-8">
          {/* Added title for the tickets block */}
          <div className="mt-4 mb-2 flex items-end justify-between">
            <div>
              <h3 className="text-lg font-semibold">Tickets</h3>
              <p className="text-xs text-slate-600">
                Support and device tickets visible with filters above.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="text-left text-slate-800">
                  <Th>Type</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <Th>Email</Th>
                  <Th>User UID</Th>
                  <Th>Device</Th>
                  <Th>Subject</Th>
                  <Th>Message</Th>
                  <Th>Actions</Th>
                </tr>
                </thead>
                <tbody>
                {ticketRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        No tickets found.
                      </td>
                    </tr>
                ) : (
                    ticketRows.map((t) => {
                      const ts = t.createdAtServer ?? t.createdAt ?? t.updatedAt ?? 0;
                      const when = ts ? timeAgo(Date.now() - ts) : "—";
                      const k = keyOf(t);
                      const current = (pendingStatus[k] ?? t.status ?? "open").toLowerCase() as TicketStatus;

                      return (
                          <Fragment key={`row:${k}`}>
                            <tr className="border-t border-slate-200 align-top">
                              <Td>
                            <span
                                className={
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium " +
                                    (t.__type === "device"
                                        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                        : "border-slate-200 bg-slate-50 text-slate-700")
                                }
                            >
                              {t.__type === "device" ? "device" : "support"}
                            </span>
                              </Td>
                              <Td title={ts ? new Date(ts).toLocaleString() : ""}>{when}</Td>
                              <Td>
                            <span
                                className={
                                    "mr-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium " +
                                    (current === "open"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : current === "pending"
                                            ? "border-amber-200 bg-amber-50 text-amber-700"
                                            : "border-slate-300 bg-slate-100 text-slate-700")
                                }
                            >
                              {current}
                            </span>
                              </Td>
                              <Td className="truncate max-w-[240px]">{t.email ?? "—"}</Td>
                              <Td mono>{t.uid ?? "—"}</Td>
                              <Td mono>{t.deviceId ?? "—"}</Td>
                              <Td className="truncate max-w-[280px]">{t.subject ?? "—"}</Td>
                              <Td>
                                <div className="whitespace-pre-wrap max-w-[420px]">{t.message ?? "—"}</div>
                              </Td>
                              <Td>
                                <div className="flex flex-wrap items-center gap-2">
                                  <select
                                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                                      value={current}
                                      onChange={(e) => onLocalStatusChange(t, e.target.value.toLowerCase())}
                                      title="Change status"
                                  >
                                    <option value="open">open</option>
                                    <option value="pending">pending</option>
                                    <option value="closed">closed</option>
                                  </select>
                                  <button
                                      onClick={() => saveTicketStatus(t)}
                                      className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                      title="Save status"
                                  >
                                    Save
                                  </button>
                                  <button
                                      onClick={() => setReplyOpen((p) => ({ ...p, [k]: !p[k] }))}
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50"
                                      title="Reply to user"
                                  >
                                    <Mail className="h-3.5 w-3.5" />
                                    {replyOpen[k] ? "Close reply" : "Reply"}
                                  </button>
                                </div>
                              </Td>
                            </tr>

                            {replyOpen[k] && (
                                <tr key={`reply:${k}`} className="border-t border-slate-100">
                                  <td colSpan={9} className="bg-slate-50 p-4">
                                    <div className="flex flex-col gap-2">
                                      <label className="text-xs text-slate-600">
                                        To: <span className="font-mono">{t.email ?? "—"}</span>
                                      </label>
                                      <textarea
                                          rows={4}
                                          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                                          placeholder="Write your reply…"
                                          value={replyText[k] ?? ""}
                                          onChange={(e) => setReplyText((p) => ({ ...p, [k]: e.target.value }))}
                                      />
                                      <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => sendReply(t)}
                                            disabled={!!sending[k]}
                                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                                            title={EMAILJS_ENABLED ? "Send with EmailJS" : "Open Gmail compose"}
                                        >
                                          {sending[k] ? "Sending…" : EMAILJS_ENABLED ? "Send reply" : "Send via Gmail"}
                                        </button>
                                        {!EMAILJS_ENABLED && (
                                            <span className="text-xs text-slate-500">
                                      This opens Gmail. click Send in the new tab.
                                    </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                            )}
                          </Fragment>
                      );
                    })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
  );
}

/* ==================== Small UI bits (light theme) ==================== */
function Stat({
                title,
                value,
                tone,
                icon,
              }: {
  title: string;
  value: number;
  tone?: "ok" | "muted" | "primary";
  icon?: React.ReactNode;
}) {
  const ring =
      tone === "ok"
          ? "ring-emerald-200"
          : tone === "primary"
              ? "ring-blue-200"
              : "ring-slate-200";
  return (
      <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ${ring}`}>
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">{title}</p>
          {icon && <div className="text-slate-600">{icon}</div>}
        </div>
        <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      </div>
  );
}

function Th({
              className = "",
              ...rest
            }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...rest} className={`p-3 font-semibold whitespace-nowrap ${className}`} />;
}

type TdProps = React.TdHTMLAttributes<HTMLTableCellElement> & {
  mono?: boolean;
};

function Td({
              mono = false,
              className = "",
              ...rest
            }: TdProps) {
  return (
      <td
          {...rest}
          className={`p-3 align-middle ${mono ? "font-mono text-xs" : ""} ${className}`}
      />
  );
}

function TicketChip({
                      label,
                      count,
                      active,
                      tone,
                      icon,
                    }: {
  label: string;
  count: number;
  active?: boolean;
  tone?: "ok" | "warn" | "muted";
  icon?: React.ReactNode;
}) {
  const base =
      "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium border transition";
  const normal = "bg-white border-slate-300 text-slate-800 hover:bg-slate-50";
  const ok = "bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100";
  const warn = "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100";
  const muted = "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100";
  const activeRing = active ? " ring-2 ring-blue-200" : "";
  const toneClass = tone === "ok" ? ok : tone === "warn" ? warn : tone === "muted" ? muted : normal;
  return (
      <button className={`${base} ${toneClass} ${activeRing}`}>
        {icon && <span className="opacity-90">{icon}</span>}
        <span>{label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{count}</span>
      </button>
  );
}
