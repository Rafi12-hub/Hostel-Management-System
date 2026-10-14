import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BedDouble,
  Building2,
  DoorOpen,
  Users as UsersIcon,
  Wrench,
  ArrowRightLeft,
  ChevronRight,
  CheckCircle2,
  Siren,
} from "lucide-react";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { subscribeCollection, listCollection } from "@/lib/firestore";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SkeletonCard, SkeletonLine } from "@/components/ui/Skeleton";

export default function MyRoom() {
  const { user } = useDemoAuth();
  const navigate = useNavigate();
  const studentId = user?.studentId || "";
  const myHostel = user?.hostel || "";

  const [students, setStudents] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    let subs: (() => void)[] = [];
    subs.push(subscribeCollection("Student", setStudents));
    subs.push(subscribeCollection("Maintenance", setTickets));
    listCollection("Room")
      .then((r) => {
        setRooms(r);
        if (mounted) setLoaded(true);
      })
      .catch(() => mounted && setLoaded(true));
    return () => {
      mounted = false;
      subs.forEach((u) => u());
    };
  }, []);

  const me = useMemo(
    () => students.find((s) => String(s.student_id).trim().toUpperCase() === studentId.toUpperCase()),
    [students, studentId]
  );

  const block = me?.block || "—";
  const roomNumber = user?.room || "—";

  const room = useMemo(
    () =>
      rooms.find(
        (r) => r.hostel === myHostel && r.block === me?.block && String(r.room_number) === String(roomNumber)
      ),
    [rooms, myHostel, me, roomNumber]
  );

  const roommates = useMemo(
    () =>
      students.filter(
        (s) =>
          s.hostel === myHostel &&
          s.block === me?.block &&
          String(s.room) === String(roomNumber)
      ),
    [students, myHostel, me, roomNumber]
  );

  const openTickets = useMemo(
    () =>
      tickets.filter(
        (t) =>
          t.hostel === myHostel &&
          t.room === roomNumber &&
          !["completed", "closed"].includes(t.status)
      ),
    [tickets, myHostel, roomNumber]
  );

  const availableBeds = Math.max(0, (room?.capacity || roommates.length) - roommates.length);

  const specs = [
    { icon: Building2, label: "Block", value: block, tone: "text-indigo-600" },
    { icon: DoorOpen, label: "Room", value: roomNumber, tone: "text-indigo-600" },
    { icon: BedDouble, label: "Bed", value: (me?.bed || "—").replace("Bed ", "").padStart(2, "0"), tone: "text-indigo-600" },
  ];

  return (
    <div className="mx-auto max-w-md space-y-5 pb-4">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">My Room</h1>
        <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
          Your hostel block, bed and roommates
        </p>
      </header>

      {/* Room hero card */}
      {!loaded ? (
        <SkeletonCard />
      ) : (
        <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          <div className="bg-gradient-to-br from-indigo-950 via-[#312e81] to-indigo-700 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-indigo-200">
              Room {roomNumber}
            </p>
            <p className="mt-1 text-sm font-semibold text-white/90">
              {user?.hostel?.split(" (")[0] || myHostel}
            </p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
            {specs.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex flex-col items-center gap-1 px-2 py-4 text-center">
                  <Icon className={`h-5 w-5 ${s.tone}`} />
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">{s.value}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
            <span className="text-[11px] font-medium text-slate-500">
              {room?.capacity ? `${room.capacity}-bed room` : "Sharing room"}
            </span>
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
              {availableBeds > 0 ? `${availableBeds} bed${availableBeds > 1 ? "s" : ""} available` : "Room full"}
            </span>
          </div>
        </section>
      )}

      {/* Roommates */}
      <section>
        <h2 className="mb-2.5 flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-white">
          <UsersIcon className="h-4 w-4 text-teal-600" /> Roommates
        </h2>
        <div className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white shadow-card dark:border-slate-800 dark:bg-slate-900">
          {!loaded ? (
            <div className="space-y-3 p-4">
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-full" />
              <SkeletonLine className="w-2/3" />
            </div>
          ) : roommates.length === 0 ? (
            <p className="px-5 py-6 text-center text-xs font-medium text-slate-400">No roommates assigned yet.</p>
          ) : (
            roommates.map((s, idx) => {
              const isMe = String(s.student_id).trim().toUpperCase() === studentId.toUpperCase();
              return (
                <React.Fragment key={s.id}>
                  {idx > 0 && <div className="mx-4 h-px bg-slate-100 dark:bg-slate-800" />}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <img src={s.photo_url} alt={s.name} className="h-10 w-10 shrink-0 rounded-full border border-slate-200 object-cover dark:border-slate-700" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                        {s.name}
                        {isMe && <span className="ml-1.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">(You)</span>}
                      </p>
                      <p className="text-[11px] font-medium text-slate-500 font-mono">{s.bed || "Bed —"}</p>
                    </div>
                    <StatusBadge status={s.status} size="sm" />
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </section>

      {/* Room maintenance */}
      <section className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/50">
              <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Room Maintenance</h3>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {openTickets.length > 0
                  ? `${openTickets.length} open request${openTickets.length > 1 ? "s" : ""} for your room`
                  : "No open requests for your room"}
              </p>
            </div>
          </div>
          <Link
            to="/maintenance"
            className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            Report <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {openTickets.slice(0, 2).map((t) => (
          <div key={t.id} className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-800/60">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
                {t.category} issue
              </p>
              <p className="text-[10px] text-slate-400 font-mono">{t.ticket_id}</p>
            </div>
            <StatusBadge status={t.status} size="sm" />
          </div>
        ))}
      </section>

      {/* Room change request */}
      <button
        onClick={() => setChangeOpen(true)}
        className="flex w-full items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white p-4 text-left shadow-card transition-all hover:border-indigo-200 active:scale-[0.99] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-800"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/50">
          <ArrowRightLeft className="h-5 w-5 text-sky-600 dark:text-sky-400" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-900 dark:text-white">Room Change Request</span>
          <span className="block truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Request to move to a different room or block
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </button>

      <ConfirmDialog
        open={changeOpen}
        destructive={false}
        title="Raise a Room Change Request"
        description={`Room change requests are processed by the hostel office. Continue to the complaint portal and choose "Furniture" as the category, mentioning the preferred block/room.`}
        confirmLabel="Open Complaint Portal"
        onConfirm={() => {
          setChangeOpen(false);
          navigate("/maintenance?category=furniture");
        }}
        onCancel={() => setChangeOpen(false)}
      />

      {/* Quick info strip */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">Housekeeping</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Cleaning schedules in Room portal</p>
        </div>
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-card dark:border-slate-800 dark:bg-slate-900">
          <Siren className="h-5 w-5 text-red-500" />
          <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">Emergency</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Contacts in public site</p>
        </div>
      </section>
    </div>
  );
}