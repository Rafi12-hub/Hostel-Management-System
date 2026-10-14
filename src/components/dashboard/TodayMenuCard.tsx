import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Utensils, Sparkles } from "lucide-react";
import { subscribeCollection } from "@/lib/firestore";
import { useDemoAuth } from "@/context/DemoAuthContext";
import { MEAL_LABELS, MEAL_EMOJIS, type MealKey } from "@/lib/hostelService";

export const TodayMenuCard: React.FC = () => {
  const { user } = useDemoAuth();
  const hostel = user?.hostel || "";
  const [menus, setMenus] = useState<any[]>([]);
  const [today, setToday] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    const unsub = subscribeCollection("Menu", setMenus);
    const tick = setInterval(() => setToday(new Date().toISOString().split("T")[0]), 60000);
    return () => {
      unsub();
      clearInterval(tick);
    };
  }, []);

  const menu =
    menus.find((m) => m.date === today && m.hostel === hostel) ||
    menus.find((m) => m.date === today) ||
    menus[0];

  if (!menu) return null;

  const meals: MealKey[] = ["breakfast", "lunch", "snacks", "dinner"];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800 mb-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Utensils className="h-5 w-5 text-orange-600" /> Today's Menu
        </h3>
        <Link to="/mess" className="text-xs font-bold text-indigo-600 hover:underline">
          Mess & Dining →
        </Link>
      </div>

      {menu.is_special && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <Sparkles className="h-4 w-4" /> {menu.special}
          {menu.festival ? ` · ${menu.festival}` : ""}
        </div>
      )}

      <div className="space-y-3">
        {meals.map((meal) => {
          const items = menu[meal];
          if (!items || !items.length) return null;
          return (
            <div key={meal} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
              <p className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span>{MEAL_EMOJIS[meal]}</span> {MEAL_LABELS[meal]}
              </p>
              <ul className="mt-2 space-y-1 pl-5 list-disc">
                {items.map((item: string, idx: number) => (
                  <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};