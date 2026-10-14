// Self-healing rolling menu seeder.
//
// Unlike the one-time marker-gated dataset seed, this module runs on every app
// load and guarantees that the demo hostels always have a published menu for the
// next N days. Without it, the meal-booking feature would only have data on the
// three days captured by the initial seed, and would run out of bookable menus
// as those days pass.
//
// It is idempotent: it reads the existing "Menu" documents and only writes the
// dates/hostels that are still missing, so it never overwrites an admin's
// customised menu for a given day.

import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DEMO_HOSTELS = [
  "APJ Abdul Kalam Boys Hostel (BH-1)",
  "CV Raman Boys Hostel (BH-2)",
  "Kalpana Chawla Girls Hostel (GH-1)",
];

// Rotating daily specials so consecutive days have variety.
const DAY_MENUS = [
  { breakfast: ["Upma", "Bread with Butter and Jam"], lunch: ["Veg Biryani", "Lemon Rice"], dinner: ["Chapati with Curry", "Fried Rice"] },
  { breakfast: ["Idli & Sambar", "Dosa with Chutney"], lunch: ["Steamed Rice with Dal", "Curd Rice"], dinner: ["Paneer Roti", "Veg Pulao"] },
  { breakfast: ["Pongal", "Mysore Bonda"], lunch: ["Veg Fried Rice", "Tomato Rice"], dinner: ["Chole Bhature", "Jeera Rice"] },
  { breakfast: ["Pesarattu", "Rava Idli"], lunch: ["Sambar Rice", "Capsicum Fry"], dinner: ["Palak Paneer with Roti", "Veg Noodles"] },
  { breakfast: ["Poori with Aloo Curry", "Cornflakes with Milk"], lunch: ["Dal Tadka + Rice", "Mix Veg Curry"], dinner: ["Veg Dum Biryani", "Rose Milk"] },
];

const SNACKS = ["Masala Chai", "Banana", "Biscuits"];

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function existingMenuKeys(): Promise<Set<string>> {
  const snap = await getDocs(collection(db, "Menu"));
  const keys = new Set<string>();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.date && data.hostel) keys.add(`${data.date}::${data.hostel}`);
  });
  return keys;
}

/**
 * Ensure menus exist for every demo hostel from today through `days` days ahead.
 * Returns the number of menu documents written.
 */
export async function ensureRollingMenus(days = 10): Promise<number> {
  try {
    const existing = await existingMenuKeys();

    const base = new Date();
    const now = new Date().toISOString();
    const toWrite: { id: string; doc: any }[] = [];

    for (let ahead = 0; ahead < days; ahead++) {
      const d = new Date(base);
      d.setDate(base.getDate() + ahead);
      const date = ymd(d);
      const sp = DAY_MENUS[ahead % DAY_MENUS.length];

      DEMO_HOSTELS.forEach((hostel, h) => {
        const key = `${date}::${hostel}`;
        if (existing.has(key)) return;
        const id = `menu_rl_${ahead}_${h}`;
        toWrite.push({
          id,
          doc: {
            id,
            date,
            hostel,
            breakfast: sp.breakfast,
            lunch: sp.lunch,
            snacks: SNACKS,
            dinner: sp.dinner,
            special: "",
            festival: "",
            is_special: ahead % 2 === 1,
            is_veg: true,
            updated_at: now,
          },
        });
      });
    }

    for (const w of toWrite) {
      await setDoc(doc(collection(db, "Menu"), w.id), w.doc);
    }
    if (toWrite.length > 0) {
      console.log(`[MenuSeeder] Added ${toWrite.length} rolling menu(s).`);
    }
    return toWrite.length;
  } catch (err) {
    console.warn("[MenuSeeder] Rolling menu seeding skipped.", err);
    return 0;
  }
}
