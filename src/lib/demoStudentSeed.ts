// One-time demo student provisioning.
//
// Students normally self-register (Firebase Auth + a Firestore `User` profile).
// For convenience this module auto-creates a *ready-to-login* demo student
// account (Firebase credentials + matching Firestore profile linked to a seed
// student record) so reviewers can sign straight in without the sign-up flow.
//
// It is idempotent: if the Firebase user or profile already exists it does
// nothing. Gated by a marker doc so it runs once per Firestore project.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, setDoc, getDocs, query, where } from "firebase/firestore";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { DEFAULT_AVATAR } from "@/context/DemoAuthContext";

const DEMO_STUDENT = {
  email: "student.demo@rgmcet.edu.in",
  password: "student123",
  studentId: "22091A003", // Rohan Sharma (BH-2) - normal (non-exempt) student
};

const MARKER = doc(db, "_meta", "demo_student_state");

async function createFirebaseUser(email: string, password: string): Promise<"created" | "exists"> {
  try {
    await createUserWithEmailAndPassword(auth, email, password);
    return "created";
  } catch (err: any) {
    if (err?.code === "auth/email-already-in-use") return "exists";
    // Invalid/other errors — attempt to verify an account with these creds.
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return "exists";
    } catch {
      return "exists";
    }
  }
}

async function findStudentById(studentId: string) {
  const snap = await getDocs(collection(db, "Student"));
  const target = String(studentId).trim().toUpperCase();
  const match = snap.docs.find(
    (d) => String(d.data().student_id || "").trim().toUpperCase() === target
  );
  return match ? { id: match.id, ...match.data() } : null;
}

async function ensureProfile(email: string, student: any) {
  const normalized = email.toLowerCase();
  const q = query(collection(db, "User"), where("email_lower", "==", normalized));
  const snap = await getDocs(q);
  const existing = snap.docs[0] ?? null;
  if (existing) {
    const data = existing.data();
    const patch: any = {};
    if (!data.studentId) patch.studentId = DEMO_STUDENT.studentId;
    if (!data.hostel && student?.hostel) patch.hostel = student.hostel;
    if (!data.room && student?.room) patch.room = student.room;
    if (Object.keys(patch).length) {
      await setDoc(existing.ref, patch, { merge: true });
    }
    return;
  }
  await setDoc(doc(collection(db, "User")), {
    email,
    email_lower: normalized,
    role: "student",
    name: student?.name || "Demo Student",
    roleTitle: "Hostel Resident",
    avatarUrl: student?.photo_url || DEFAULT_AVATAR,
    studentId: DEMO_STUDENT.studentId,
    hostel: student?.hostel || "",
    room: student?.room || "",
    createdBy: "system",
    active: true,
    createdAt: new Date().toISOString(),
  });
}

export async function provisionDemoStudent(): Promise<void> {
  try {
    const marker = await getDoc(MARKER);
    if (marker.exists()) return;

    const student = await findStudentById(DEMO_STUDENT.studentId);
    await ensureProfile(DEMO_STUDENT.email, student);
    await createFirebaseUser(DEMO_STUDENT.email, DEMO_STUDENT.password);
    // Guarantee the Firebase account exists even if profile creation raced.
    try {
      await signInWithEmailAndPassword(auth, DEMO_STUDENT.email, DEMO_STUDENT.password);
    } catch {
      /* sign-in probe only */
    }

    await setDoc(MARKER, { provisioned_at: new Date().toISOString(), studentId: DEMO_STUDENT.studentId });
    console.log("[Demo] Demo student account ready:", DEMO_STUDENT.email);
  } catch (err) {
    console.warn("[Demo] Demo student provisioning skipped.", err);
  }
}
