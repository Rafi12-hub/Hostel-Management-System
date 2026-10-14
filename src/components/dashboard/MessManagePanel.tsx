import React, { useEffect, useMemo, useState } from "react";
import {
  Utensils,
  Users,
  Star,
  Settings2,
  Clock,
  Loader2,
  ScanLine,
  Save,
  QrCode,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { subscribeCollection, createRecord, updateRecord } from "@/lib/firestore";
import { KpiCard } from "@/components/ui/KpiCard";
import { QRCode } from "@/components/ui/QRCode";
import { useDemoAuth } from "@/context/DemoAuthContext";
import {
  MEAL_ORDER,
  MEAL_LABELS,
  MEAL_EMOJIS,
  DEFAULT_MEAL_CONFIG,
  ensureMealConfig,
  saveMealConfig,
  todayMealCounts,
  todayCountsByHostel,
  getActiveMeal,
  fmtHm,
  todayStr,
  regenerateMessQr,
  downloadMessPoster,
  isMessCycleValid,
  messCyclePayload,
  type MealConfig,
} from "@/lib/hostelService";
import { MealBookingAnalytics } from "@/components/mess/MealBookingAnalytics";

export const MessManagePanel: React.FC = () => {
  const { user } = useDemoAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<any[]>([]);
  const [config, setConfig] = useState<MealConfig>({ ...DEFAULT_MEAL_CONFIG });
  const [draft, setDraft] = useState<MealConfig>({ ...DEFAULT_MEAL_CONFIG });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(new Date());

  // Mess points (QR) — manager may cover multiple hostels, so list all.
  const [messPoints, setMessPoints] = useState<any[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>("");
  const [regenerating, setRegenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  // Menu editor state
  const [menus, setMenus] = useState<any[]>([]);
  const [menuDraft, setMenuDraft] = useState<any>(null);
  const [menuSaving, setMenuSaving] = useState(false);
  const [menuSaved, setMenuSaved] = useState(false);

  useEffect(() => {
    const unsubA = subscribeCollection("MessAttendance", setRecords);
    const unsubF = subscribeCollection("FoodFeedback", setFeedback);
    const unsubM = subscribeCollection("Menu", setMenus);
    const unsubP = subscribeCollection("MessPoint", setMessPoints);
    ensureMealConfig()
      .then((cfg) => {
        setConfig(cfg);
        setDraft(cfg);
      })
      .catch(() => undefined);
    const tick = setInterval(() => setNow(new Date()), 30000);
    return () => {
      unsubA();
      unsubF();
      unsubM();
      unsubP();
      clearInterval(tick);
    };
  }, []);

  // Default the selected mess point to the one matching the manager's hostel.
  useEffect(() => {
    if (messPoints.length === 0) return;
    if (selectedPointId && messPoints.some((p) => p.id === selectedPointId)) return;
    const mine = messPoints.find((p) => p.hostel === user?.hostel) || messPoints[0];
    setSelectedPointId(mine?.id || messPoints[0]?.id || "");
  }, [messPoints, selectedPointId, user?.hostel]);

  const selectedPoint = useMemo(
    () => messPoints.find((p) => p.id === selectedPointId) || null,
    [messPoints, selectedPointId]
  );

  const liveCounts = useMemo(() => todayMealCounts(records), [records]);
  const byHostel = useMemo(() => todayCountsByHostel(records), [records]);
  const active = config ? getActiveMeal(config, now) : null;
  const total = Object.values(liveCounts).reduce((a, b) => a + b, 0);
  const avgRating = feedback.length
    ? (feedback.reduce((acc, f) => acc + (f.rating || 5), 0) / feedback.length).toFixed(1)
    : "—";

  // ---- QR rotation helpers ------------------------------------------------

  const cycleValid = selectedPoint ? isMessCycleValid(selectedPoint, now) : false;

  const cycleExpiresLabel = useMemo(() => {
    if (!selectedPoint) return "";
    const exp = new Date(selectedPoint.cycleExpiresAt || "");
    if (isNaN(exp.getTime())) return "";
    const diff = exp.getTime() - now.getTime();
    const days = Math.ceil(diff / 86400000);
    if (days <= 0) return "Expired — regenerate now";
    return `Valid for ${days} more day${days === 1 ? "" : "s"} (until ${exp.toLocaleDateString()})`;
  }, [selectedPoint, now]);

  const flashMsg = (m: string) => {
    setFlash(m);
    setTimeout(() => setFlash(null), 3500);
  };

  const handleRegenerate = async () => {
    if (!selectedPoint) return;
    const ok = window.confirm(
      `Regenerate the Mess QR for ${selectedPoint.name}?\n\nThe previous QR will stop working immediately.\n\nNew QR valid for 3 days.`
    );
    if (!ok) return;
    setRegenerating(true);
    try {
      const updated = await regenerateMessQr(selectedPoint, user?.name || "Mess Manager");
      const next = messPoints.map((p) => (p.id === updated.id ? updated : p));
      setMessPoints(next);
      if (!selectedPointId) setSelectedPointId(updated.id);
      flashMsg("QR regenerated! Old QR is now invalid. Download the new poster to print.");
    } catch {
      flashMsg("Failed to regenerate QR. Please try again.");
    }
    setRegenerating(false);
  };

  const handleDownload = async () => {
    if (!selectedPoint) return;
    if (!selectedPoint.currentCycleCode) {
      flashMsg("This mess has no cycle QR yet. Regenerate it first.");
      return;
    }
    setDownloading(true);
    try {
      await downloadMessPoster({
        hostel: selectedPoint.hostel,
        messName: selectedPoint.name,
        hall: selectedPoint.hall,
        payload: messCyclePayload(selectedPoint),
        expiresAt: selectedPoint.cycleExpiresAt || "",
      });
      flashMsg("Poster downloaded. Print it and paste it on the mess hall wall.");
    } catch {
      flashMsg("Could not download the poster. Check your connection and try again.");
    }
    setDownloading(false);
  };

  // ---- Menu editor helpers -----------------------------------------------

  // Initialise an editable draft from today's menu (or a blank one).
  const menuInitHostelRef = React.useRef<string>("");
  useEffect(() => {
    const hostel = selectedPoint?.hostel || "";
    if (menuInitHostelRef.current === hostel) return;
    menuInitHostelRef.current = hostel;
    const today = todayStr(now);
    const found =
      menus.find((m) => m.date === today && m.hostel === hostel) ||
      menus.find((m) => m.date === today) ||
      null;
    setMenuDraft({
      id: found?.id,
      date: found?.date || today,
      hostel: found?.hostel || hostel,
      breakfast: [...(found?.breakfast || [])],
      lunch: [...(found?.lunch || [])],
      snacks: [...(found?.snacks || [])],
      dinner: [...(found?.dinner || [])],
      special: found?.special || "",
      festival: found?.festival || "",
      is_special: !!found?.is_special,
      _dirty: true,
    });
  }, [menus, selectedPoint?.hostel, now]);

  const menuToday = menuDraft || {
    date: todayStr(now),
    hostel: selectedPoint?.hostel || "",
    breakfast: [],
    lunch: [],
    snacks: [],
    dinner: [],
    special: "",
    festival: "",
    is_special: false,
    _dirty: true,
  };

  const addMenuItem = (meal: (typeof MEAL_ORDER)[number]) => {
    const items = [...(menuDraft?.[meal] || [])];
    items.push("");
    setMenuDraft({ ...menuDraft, [meal]: items, _dirty: true });
  };

  const updateMenuItem = (meal: (typeof MEAL_ORDER)[number], idx: number, value: string) => {
    const items = [...(menuDraft?.[meal] || [])];
    items[idx] = value;
    setMenuDraft({ ...menuDraft, [meal]: items, _dirty: true });
  };

  const removeMenuItem = (meal: (typeof MEAL_ORDER)[number], idx: number) => {
    const items = [...(menuDraft?.[meal] || [])];
    items.splice(idx, 1);
    setMenuDraft({ ...menuDraft, [meal]: items, _dirty: true });
  };

  const handleSaveMenu = async () => {
    if (!menuDraft) return;
    setMenuSaving(true);
    const { id, _dirty, ...data } = menuDraft as any;
    const payload = {
      ...data,
      date: data.date || todayStr(now),
      hostel: data.hostel || selectedPoint?.hostel || "",
      is_veg: true,
      updated_at: new Date().toISOString(),
    };
    try {
      if (id) {
        await updateRecord("Menu", id, payload);
      } else {
        const created = await createRecord("Menu", payload);
        setMenuDraft({ ...payload, id: created.id, _dirty: true });
      }
      setMenuSaved(true);
      setTimeout(() => setMenuSaved(false), 2500);
    } finally {
      setMenuSaving(false);
    }
  };

  const sortedScans = useMemo(
    () =>
      [...records]
        .filter((r) => r.date === todayStr(now))
        .sort((a, b) => String(b.scanned_at || "").localeCompare(String(a.scanned_at || "")))
        .slice(0, 8),
    [records, now]
  );

  const handleSave = async () => {
    setSaving(true);
    await saveMealConfig(draft);
    setConfig(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Today's Total Scans" value={total} icon={ScanLine} tone="indigo" sub="All hostels · live" />
        {MEAL_ORDER.map((meal, idx) => (
          <KpiCard
            key={meal}
            label={`${MEAL_LABELS[meal]} Diners`}
            value={`${liveCounts[meal]}`}
            icon={MEAL_EMOJIS[meal].includes("🍞") ? Utensils : Utensils}
            tone={idx === 0 ? "amber" : idx === 1 ? "green" : idx === 2 ? "teal" : "purple"}
            sub={config?.[meal] ? `${fmtHm(config[meal].start)} – ${fmtHm(config[meal].end)}` : "Not configured"}
          />
        ))}
      </div>

      {/* ==================== MESS ATTENDANCE QR ==================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" /> Mess Attendance QR
          </h3>
          <div className="flex items-center gap-2">
            {messPoints.length > 1 && (
              <select
                value={selectedPointId}
                onChange={(e) => setSelectedPointId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold dark:bg-slate-900 dark:text-white dark:border-slate-700"
              >
                {messPoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.hostel}
                  </option>
                ))}
              </select>
            )}
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                cycleValid
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
              }`}
            >
              {cycleValid ? "● Active" : "● Expired"}
            </span>
          </div>
        </div>

        {flash && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {flash}
          </div>
        )}

        {!selectedPoint ? (
          <p className="py-6 text-center text-xs text-slate-400">
            No mess checkpoints configured. Add a MessPoint to generate a QR.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 items-start">
            {/* QR display */}
            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 p-6 dark:bg-slate-800/50">
              <QRCode
                value={messCyclePayload(selectedPoint)}
                size={200}
                alt={`${selectedPoint.name} Mess QR`}
              />
              <p className="mt-3 text-center text-[11px] font-semibold text-slate-500">
                {selectedPoint.name} · {selectedPoint.hall || selectedPoint.hostel}
              </p>
            </div>

            {/* Info + actions */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs dark:bg-slate-800/40 dark:border-slate-800">
                <p className="font-bold text-slate-900 dark:text-white">
                  Print this QR and paste it on the mess hall wall. Students scan it with the app to mark attendance.
                </p>
                <p className={`mt-2 font-extrabold ${cycleValid ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-400"}`}>
                  {cycleExpiresLabel || (cycleValid ? "Active" : "Expired")}
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  The QR changes every 3 days. Click <b>Regenerate</b> to issue a new code; the previous one stops working immediately.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 active:scale-95 transition-all"
                >
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Regenerate QR (3 days)
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading || !selectedPoint.currentCycleCode}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60 active:scale-95 transition-all"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download Poster
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Meal timing config */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-indigo-600" /> Meal Session Timings
            </h3>
            {active && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-extrabold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                ● {MEAL_LABELS[active.meal]} live
              </span>
            )}
          </div>
          <div className="space-y-3">
            {MEAL_ORDER.map((meal) => (
              <div key={meal} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800/50">
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {MEAL_EMOJIS[meal]} {MEAL_LABELS[meal]}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={draft[meal]?.start || DEFAULT_MEAL_CONFIG[meal].start}
                    onChange={(e) =>
                      setDraft({ ...draft, [meal]: { ...draft[meal], start: e.target.value } })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold dark:bg-slate-900 dark:border-slate-700"
                  />
                  <span className="text-slate-400">to</span>
                  <input
                    type="time"
                    value={draft[meal]?.end || DEFAULT_MEAL_CONFIG[meal].end}
                    onChange={(e) =>
                      setDraft({ ...draft, [meal]: { ...draft[meal], end: e.target.value } })
                    }
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold dark:bg-slate-900 dark:border-slate-700"
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Clock className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
            {saved ? "Session timings saved" : "Save Meal Timings"}
          </button>
        </div>

        {/* Hostel-wise breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" /> Attendance by Hostel · Today
            </h3>
          </div>
          <div className="space-y-3">
            {Object.keys(byHostel).length === 0 && (
              <p className="py-6 text-center text-xs text-slate-400">No scans recorded yet today.</p>
            )}
            {Object.entries(byHostel).map(([hostel, meals]) => (
              <div key={hostel} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <p className="text-xs font-bold text-slate-900 dark:text-white">{hostel}</p>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {MEAL_ORDER.map((m) => (
                    <div key={m} className="rounded-lg bg-white px-1 py-1.5 text-center dark:bg-slate-900">
                      <p className="text-[9px] font-bold uppercase text-slate-400">{MEAL_LABELS[m]}</p>
                      <p className="mt-0.5 text-sm font-extrabold text-slate-800 dark:text-slate-200">{meals[m] ?? 0}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="scroll-touch hidden overflow-x-auto md:block">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 pr-2">Hostel</th>
                  {MEAL_ORDER.map((m) => (
                    <th key={m} className="px-2 py-2 text-center">{MEAL_LABELS[m]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.keys(byHostel).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No scans recorded yet today.
                    </td>
                  </tr>
                )}
                {Object.entries(byHostel).map(([hostel, meals]) => (
                  <tr key={hostel} className="border-b border-slate-50 dark:border-slate-800/40">
                    <td className="py-2.5 pr-2 font-bold text-slate-900 dark:text-white">{hostel}</td>
                    {MEAL_ORDER.map((m) => (
                      <td key={m} className="px-2 py-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">
                        {meals[m] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-600" /> Mess Complaints & Food Feedback
          </h3>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-extrabold text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
            {feedback.length} {feedback.length === 1 ? "complaint" : "complaints"}
          </span>
        </div>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-xs dark:bg-slate-800/50">
          <span className="font-bold text-slate-700 dark:text-slate-300">Average food rating</span>
          <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{avgRating} / 5 ⭐</span>
        </div>
        <div className="space-y-3">
          {feedback.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-400">No mess complaints or feedback yet.</p>
          )}
          {feedback.slice(0, 12).map((f) => (
            <div key={f.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{f.hostel}</p>
                  <p className="text-[11px] text-slate-500">{f.date}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  ★ {f.rating || "-"}/5
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{f.comments}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-900 dark:border-slate-700">Taste {f.taste || "-"}/5</span>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-900 dark:border-slate-700">Quality {f.quality || "-"}/5</span>
                <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-900 dark:border-slate-700">Cleanliness {f.cleanliness || "-"}/5</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================== MENU EDITOR ==================== */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Utensils className="h-5 w-5 text-orange-600" /> Edit Today's Menu
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">
            {selectedPoint?.hostel || "All hostels"} · {todayStr(now)}
          </span>
        </div>

        <div className="space-y-5">
          {MEAL_ORDER.map((meal) => (
            <div key={meal} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{MEAL_EMOJIS[meal]}</span> {MEAL_LABELS[meal]}
                </p>
                <button
                  type="button"
                  onClick={() => addMenuItem(meal)}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </button>
              </div>
              {(menuToday[meal] || []).map((item: string, idx: number) => (
                <div key={idx} className="flex items-center gap-2 mb-1.5">
                  <input
                    value={item}
                    onChange={(e) => updateMenuItem(meal, idx, e.target.value)}
                    placeholder={`${MEAL_LABELS[meal]} item`}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs dark:bg-slate-900 dark:text-white dark:border-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeMenuItem(meal, idx)}
                    className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                    aria-label={`Remove ${MEAL_LABELS[meal]} item`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {(menuToday[meal] || []).length === 0 && (
                <p className="text-[11px] text-slate-400">No items — click "Add Item" to add one.</p>
              )}
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Special Note (optional)</label>
              <input
                value={menuToday.special || ""}
                onChange={(e) => setMenuDraft({ ...menuDraft, special: e.target.value, _dirty: true })}
                placeholder="e.g. Special Paneer Biryani for Sunday"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-900 dark:text-white dark:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wide">Festival (optional)</label>
              <input
                value={menuToday.festival || ""}
                onChange={(e) => setMenuDraft({ ...menuDraft, festival: e.target.value, _dirty: true })}
                placeholder="e.g. Ugadi Celebration"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:bg-slate-900 dark:text-white dark:border-slate-700"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={!!menuToday.is_special}
              onChange={(e) => setMenuDraft({ ...menuDraft, is_special: e.target.checked, _dirty: true })}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            Highlight this as a special menu
          </label>

          <button
            onClick={handleSaveMenu}
            disabled={menuSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-60 active:scale-95 transition-all"
          >
            {menuSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : menuSaved ? <Save className="h-4 w-4 text-emerald-300" /> : <Save className="h-4 w-4" />}
            {menuSaved ? "Menu saved" : "Save Menu"}
          </button>
        </div>
      </div>

      {/* Item-Wise Booking Analytics */}
      <MealBookingAnalytics hostel={user?.hostel || "APJ Abdul Kalam Boys Hostel (BH-1)"} />

      {/* Live scan feed */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4 dark:border-slate-800">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-emerald-600" /> Live Check-In Feed
          </h3>
          <span className="text-[11px] font-semibold text-slate-400">Auto-updates in realtime</span>
        </div>
        <div className="space-y-2">
          {sortedScans.length === 0 && (
            <p className="py-4 text-center text-xs text-slate-400">Live feed is empty — scans will appear here.</p>
          )}
          {sortedScans.map((r) => (
            <div
              key={r.id}
              className={`flex items-center justify-between rounded-xl px-4 py-2.5 text-xs ${
                r.mess_name ? "bg-emerald-50/70 dark:bg-emerald-950/30" : "bg-slate-50 dark:bg-slate-800/50"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-base">{MEAL_EMOJIS[r.meal as keyof typeof MEAL_EMOJIS]}</span>
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    {r.student_name} <span className="font-mono text-[10px] text-slate-400">({r.student_id})</span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {r.hostel} · {r.mess_name || r.mess_code || "QR"}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-400">
                {r.scanned_at
                  ? new Date(r.scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "-"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};