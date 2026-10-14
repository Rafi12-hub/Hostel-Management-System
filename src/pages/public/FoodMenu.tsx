import React, { useState, useEffect } from "react";
import { Utensils, Calendar, Sparkles, Share2, Check, Leaf } from "lucide-react";
import { listCollection } from "@/lib/firestore";
import { QRCode } from "@/components/ui/QRCode";
import { PageHeader } from "@/components/ui/PageHeader";

export default function FoodMenu() {
  const [menu, setMenu] = useState<any>(null);
  const [weeklyView, setWeeklyView] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listCollection("Menu").then((res) => {
      if (res.length > 0) setMenu(res[0]);
    });
  }, []);

  const shareMenu = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const daysOfWeek = [
    { day: "Monday", b: "Idli, Vada, Sambar", l: "Rice, Dal, Veg Fry, Curd", s: "Samosa & Tea", d: "Chapati, Meal Maker Curry, Rice" },
    { day: "Tuesday", b: "Puri & Potato Masala", l: "Rice, Tomato Pappu, Chana Masala", s: "Mirchi Bajji & Tea", d: "Roti, Mix Veg Curry, Curd Rice" },
    { day: "Wednesday", b: "Dosa & Coconut Chutney", l: "Rice, Sambar, Bagara Rice, Paneer", s: "Cutlet & Tea", d: "Chapati, Egg/Paneer Curry, Rice" },
    { day: "Thursday", b: "Upma & Chutney", l: "Rice, Spinach Pappu, Potato Fry", s: "Onion Pakoda & Tea", d: "Roti, Dal Tadka, Kheer, Rice" },
    { day: "Friday", b: "Pongal & Vada", l: "Rice, Majjiga Pulusu, Capsicum Fry", s: "Biscuits & Tea", d: "Chapati, Rajma Masala, Rice" },
    { day: "Saturday", b: "Uthappam & Chutney", l: "Rice, Lemon Rice, Aviyal", s: "Sweet Corn & Tea", d: "Roti, Veg Kadai, Rice, Curd" },
    { day: "Sunday", b: "Mysore Bonda & Chutney", l: "Special Veg Biryani, Paneer Butter Masala, Sweet", s: "Cake & Coffee", d: "Chapati, Plain Rice, Rasam" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <PageHeader
        title="Hostel Mess Food Menu"
        subtitle="Hygienic, balanced, and nutritious South Indian daily dining schedule"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeeklyView(!weeklyView)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 sm:px-4 sm:py-3 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Calendar className="h-4 w-4 text-indigo-600" />
              {weeklyView ? "Today" : "Weekly"}
            </button>

            <button
              onClick={shareMenu}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 sm:px-4 sm:py-3"
            >
              {copied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
              {copied ? "Copied!" : "Share"}
            </button>
          </div>
        }
      />

      {/* Veg/Non-Veg & Special Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-6 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            <Leaf className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-extrabold flex items-center gap-2">
              100% Pure Veg Dining Available
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
                FSSAI Certified
              </span>
            </h3>
            <p className="text-xs text-indigo-200 mt-1">
              Separate cooking vessels and dedicated dining halls maintained for pure veg options.
            </p>
          </div>
        </div>

        {menu?.is_special && (
          <div className="inline-flex items-center gap-2 rounded-xl bg-amber-400/20 border border-amber-400/40 px-4 py-2 text-xs font-bold text-amber-200">
            <Sparkles className="h-4 w-4 text-amber-300" />
            <span>{menu.special}</span>
          </div>
        )}
      </div>

      {!weeklyView ? (
        /* Daily View */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Breakfast", time: "7:30 AM - 9:00 AM", items: menu?.breakfast || ["Idli & Medu Vada", "Sambar & Coconut Chutney", "Bread Jam & Butter", "Tea / Coffee / Milk"] },
            { name: "Lunch", time: "12:30 PM - 2:00 PM", items: menu?.lunch || ["Steamed Rice", "Andhra Style Pappu", "Paneer Butter Masala", "Rasam & Curd", "Appalam"] },
            { name: "Snacks", time: "4:30 PM - 5:30 PM", items: menu?.snacks || ["Samosa / Onion Pakoda", "Hot Masala Chai", "Biscuits"] },
            { name: "Dinner", time: "7:30 PM - 9:00 PM", items: menu?.dinner || ["Chapati / Phulka", "Dal Tadka", "Veg Biryani & Raita", "Gulab Jamun", "Milk"] },
          ].map((meal, idx) => (
            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{meal.name}</h3>
                  <Utensils className="h-5 w-5 text-indigo-600" />
                </div>
                <p className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">{meal.time}</p>

                <ul className="mt-4 space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  {meal.items.map((item: string, i: number) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Weekly View */
        <>
          {/* Mobile cards */}
          <div className="space-y-3 md:hidden">
            {daysOfWeek.map((row, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/50">
                  <h4 className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">{row.day}</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Day Menu</span>
                </div>
                <div className="space-y-3 p-4">
                  {[
                    ["Breakfast · 7:30 AM", row.b],
                    ["Lunch · 12:30 PM", row.l],
                    ["Snacks · 4:30 PM", row.s],
                    ["Dinner · 7:30 PM", row.d],
                  ].map(([meal, items]) => (
                    <div key={meal as string}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{meal}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">{items}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800 dark:bg-slate-900 md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 uppercase font-bold dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Day</th>
                    <th className="px-4 py-3">Breakfast (7:30 AM)</th>
                    <th className="px-4 py-3">Lunch (12:30 PM)</th>
                    <th className="px-4 py-3">Snacks (4:30 PM)</th>
                    <th className="px-4 py-3">Dinner (7:30 PM)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {daysOfWeek.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <td className="px-4 py-3.5 font-bold text-indigo-600 dark:text-indigo-400">{row.day}</td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{row.b}</td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{row.l}</td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{row.s}</td>
                      <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">{row.d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* QR Code Share Card */}
      <div className="flex flex-col sm:flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 gap-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Share Today's Menu</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Scan this QR code with any mobile device to view or bookmark the RGMCET daily dining schedule.
          </p>
        </div>
        <QRCode value={window.location.href} size={130} />
      </div>
    </div>
  );
}
