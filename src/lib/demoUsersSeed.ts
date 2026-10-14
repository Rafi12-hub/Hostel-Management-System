// One-time demo role-account provisioning.
//
// Mirrors demoStudentSeed.ts: creates ready-to-login Firebase accounts (+
// matching Firestore `User` profiles) for every non-student role so reviewers
// can sign into the role-specific integrated dashboards instantly.
// Idempotent (marker-gated + Firebase "email exists" tolerance).
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, doc, getDocs, query, where, setDoc } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { DEFAULT_AVATAR } from "@/context/DemoAuthContext";

export interface DemoUserEntry {
  email: string;
  password: string;
  role: string;
  name: string;
  roleTitle: string;
  hostel?: string;
  room?: string;
  studentId?: string;
  avatarUrl?: string;
}

const DEMO_USERS: DemoUserEntry[] = [
  {
    email: "parent.demo@rgmcet.edu.in",
    password: "parent123",
    role: "parent",
    name: "Mr. Sharma (Guardian)",
    roleTitle: "Parent / Guardian",
    studentId: "22091A003",
    hostel: "CV Raman Boys Hostel (BH-2)",
    room: "105",
    avatarUrl: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "chief.warden@rgmcet.edu.in",
    password: "chief123",
    role: "chief_warden",
    name: "Chief Warden",
    roleTitle: "Chief Warden",
    avatarUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "warden.hostel@rgmcet.edu.in",
    password: "warden123",
    role: "warden",
    name: "Warden Chief",
    roleTitle: "Warden",
    hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "mess.manager@rgmcet.edu.in",
    password: "mess123",
    role: "mess_manager",
    name: "Mess Manager Kumar",
    roleTitle: "Mess Manager",
    hostel: "APJ Abdul Kalam Boys Hostel (BH-1)",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "security.hostel@rgmcet.edu.in",
    password: "security123",
    role: "security",
    name: "Security Ramesh",
    roleTitle: "Security Officer",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "housekeeping.hostel@rgmcet.edu.in",
    password: "housekeeping123",
    role: "housekeeping",
    name: "Housekeeping Lead",
    roleTitle: "Housekeeping Staff",
    avatarUrl: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=150&auto=format&fit=crop&q=80",
  },
];

const MARKER = doc(db, "_meta", "demo_users_state");

async function createFirebaseUser(
  email: string,
  password: string
): Promise<"created" | "exists" | "password-mismatch"> {
  // Verify the account can actually sign in with the demo password first.
  try {
    await signInWithEmailAndPassword(auth, email, password);
    await signOut(auth).catch(() => {});
    return "exists";
  } catch (err: any) {
    const code = err?.code || "";
    if (code === "auth/user-not-found") {
      // Account missing -> create it with the documented demo password.
      const created = await createUserWithEmailAndPassword(auth, email, password).catch((e: any) => {
        if (e?.code === "auth/email-already-in-use") return null;
        throw e;
      });
      await signOut(auth).catch(() => {});
      return created ? "created" : "password-mismatch";
    }
    if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
      // Account exists but its password differs from the documented demo one.
      // Cannot be reset client-side; surfaced in the console so the admin can
      // use the password-reset flow instead.
      return "password-mismatch";
    }
    throw err; // transient error -> retried on the next load
  }
}

async function findUserByEmail(email: string) {
  const normalized = email.toLowerCase();
  const q = query(collection(db, "User"), where("email_lower", "==", normalized));
  const snap = await getDocs(q);
  if (snap.docs.length > 0) return snap.docs[0];
  const fallback = await getDocs(collection(db, "User"));
  return (
    fallback.docs.find((d) => String(d.data().email || "").toLowerCase() === normalized) ?? null
  );
}

async function ensureProfile(entry: DemoUserEntry) {
  const existing = await findUserByEmail(entry.email);
  if (existing) {
    const data = existing.data();
    const patch: any = {};
    if (!data.role) patch.role = entry.role;
    if (!data.roleTitle) patch.roleTitle = entry.roleTitle;
    if (!data.studentId && entry.studentId) patch.studentId = entry.studentId;
    if (!data.hostel && entry.hostel) patch.hostel = entry.hostel;
    if (!data.room && entry.room) patch.room = entry.room;
    if (Object.keys(patch).length) {
      await setDoc(existing.ref, patch, { merge: true });
    }
    return;
  }
  await setDoc(doc(collection(db, "User")), {
    email: entry.email,
    email_lower: entry.email.toLowerCase(),
    role: entry.role,
    name: entry.name,
    roleTitle: entry.roleTitle,
    avatarUrl: entry.avatarUrl || DEFAULT_AVATAR,
    studentId: entry.studentId || "",
    hostel: entry.hostel || "",
    room: entry.room || "",
    createdBy: "system",
    active: true,
    createdAt: new Date().toISOString(),
  });
}

export async function provisionDemoUsers(): Promise<void> {
  try {
    // Self-healing provisioning: the marker alone is NOT trusted. Every load
    // verifies each demo account can actually sign in with the documented
    // password and (re)creates any that are missing, so a failed first-run
    // never leaves the project without working demo credentials.
    const status: string[] = [];
    for (const entry of DEMO_USERS) {
      const result = await createFirebaseUser(entry.email, entry.password);
      status.push(`${entry.email}:${result}`);
      if (result === "password-mismatch") {
        console.warn(
          `[Demo] Account ${entry.email} already exists with a different password. ` +
            `Use the password-reset flow to restore "access, or sign in with the account's real password.`
        );
      }
      await ensureProfile(entry);
    }

    await setDoc(MARKER, {
      provisioned_at: new Date().toISOString(),
      accounts: DEMO_USERS.map((u) => u.email),
      status,
      refreshed_at: new Date().toISOString(),
    });
    console.log("[Demo] Demo role accounts verified:", DEMO_USERS.length);
  } catch (err) {
    console.warn("[Demo] Demo role account provisioning skipped (will retry on next load).", err);
  }
}