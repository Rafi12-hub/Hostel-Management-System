import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  filterCollection,
  filterByFields,
  listCollection,
  createRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/firestore";

export type Role =
  | "student"
  | "parent"
  | "security"
  | "warden"
  | "chief_warden"
  | "mess_manager"
  | "housekeeping"
  | "admin"
  | "management"
  | "hostel_office"
  | "medical"
  | "principal";

export const ALL_ROLES: Role[] = [
  "student",
  "parent",
  "security",
  "warden",
  "chief_warden",
  "mess_manager",
  "housekeeping",
  "admin",
  "management",
  "hostel_office",
  "medical",
  "principal",
];

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleTitle: string;
  avatarUrl: string;
  studentId?: string;
  hostel?: string;
  room?: string;
}

export interface AuthUser extends UserProfile {
  active: boolean;
  createdBy: string;
}

// Default avatar fallback so dynamically created profiles always have an image.
export const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

// All roles (including student) are provisioned by staff: warden, chief warden, or admin.
export const SELF_SIGNUP_ROLES: Role[] = [];
export const ADMIN_MANAGED_ROLES: Role[] = ALL_ROLES;

interface DemoAuthContextType {
  user: UserProfile | null;
  role: Role | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  // Admin user management
  listUsers: () => Promise<AuthUser[]>;
  createUser: (data: {
    email: string;
    password: string;
    role: Role;
    name?: string;
    studentId?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (
    id: string,
    updates: { email?: string; name?: string; active?: boolean; sendPasswordReset?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ ok: boolean; error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
}

const DemoAuthContext = createContext<DemoAuthContextType | undefined>(undefined);

const profileFromUser = (u: any): UserProfile => {
  const profile: UserProfile = {
    id: u.id,
    name: u.name || "User",
    email: u.email,
    role: u.role,
    roleTitle: u.roleTitle || u.role,
    avatarUrl: u.avatarUrl || DEFAULT_AVATAR,
  };
  if (u.studentId) profile.studentId = u.studentId;
  if (u.hostel) profile.hostel = u.hostel;
  if (u.room) profile.room = u.room;
  return profile;
};

const findUserByEmail = async (email: string) => {
  const normalized = email.trim().toLowerCase();
  const matches = await filterByFields("User", { email_lower: normalized });
  if (matches.length > 0) return matches[0];
  const fallback = await filterCollection("User", (u: any) => u.email.toLowerCase() === normalized);
  return fallback[0] || null;
};

export const DemoAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  // Resolve the Firestore profile for the signed-in Firebase user.
  const resolveProfile = useCallback(async (fbUser: FirebaseUser | null) => {
    if (!fbUser) {
      setUser(null);
      return;
    }
    const record = await findUserByEmail(fbUser.email || "");
    if (record && record.active !== false) {
      setUser(profileFromUser(record));
    } else {
      // No profile or disabled -> treat as not authenticated but keep Firebase
      // session cleared.
      await signOut(auth).catch(() => {});
      setUser(null);
    }
  }, []);

  // Track Firebase auth state.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      resolveProfile(fbUser);
    });
    return unsub;
  }, [resolveProfile]);

  const login: DemoAuthContextType["login"] = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = auth.currentUser;
      const record = await findUserByEmail(email);
      if (fbUser && record && record.active !== false) {
        setUser(profileFromUser(record));
        return { ok: true };
      }
      await signOut(auth).catch(() => {});
      if (!record) return { ok: false, error: "No portal profile found for this account. Contact the administrator." };
      return { ok: false, error: "This account has been disabled by the administrator." };
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        return { ok: false, error: "Invalid email or password. Please try again." };
      }
      if (code === "auth/too-many-requests") {
        return { ok: false, error: "Too many failed attempts. Please try again later." };
      }
      return { ok: false, error: err?.message || "Unable to sign in. Please try again." };
    }
  };

  const logout = async () => {
    await signOut(auth).catch(() => {});
    setFirebaseUser(null);
    setUser(null);
  };

  const listUsers: DemoAuthContextType["listUsers"] = async () => {
    const users = await listCollection("User");
    return users as AuthUser[];
  };

  const createUser: DemoAuthContextType["createUser"] = async ({ email, password, role, name, studentId }) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password || !name?.trim()) {
      return { ok: false, error: "Name, email and password are required." };
    }
    if (password.length < 6) {
      return { ok: false, error: "Password must be at least 6 characters long." };
    }
    const emailExists = await filterCollection("User", (u: any) => u.email.toLowerCase() === normalizedEmail);
    if (emailExists.length > 0) {
      return { ok: false, error: "An account with this email already exists." };
    }
    try {
      await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const payload: Record<string, any> = {
        email: normalizedEmail,
        email_lower: normalizedEmail,
        role,
        name: name.trim(),
        roleTitle: role === "parent" ? "Parent / Guardian" : role === "student" ? "Hostel Resident" : role.replace(/_/g, " "),
        avatarUrl: DEFAULT_AVATAR,
        createdBy: user?.id || "admin",
        active: true,
      };
      if (studentId && String(studentId).trim()) {
        const linked = await filterCollection("Student", (s: any) =>
          String(s.student_id).trim().toUpperCase() === String(studentId).trim().toUpperCase()
        );
        if (linked.length > 0) {
          payload.studentId = linked[0].student_id;
          payload.hostel = linked[0].hostel || "";
          payload.room = linked[0].room || "";
        }
      }
      await createRecord("User", payload);
      return { ok: true };
    } catch (err: any) {
      if (err?.code === "auth/email-already-in-use") {
        return { ok: false, error: "An account with this email already exists." };
      }
      return { ok: false, error: err?.message || "Unable to create account. Please try again." };
    }
  };

  const updateUser: DemoAuthContextType["updateUser"] = async (id, updates) => {
    const matches = await filterCollection("User", (u: any) => u.id === id);
    if (matches.length === 0) return { ok: false, error: "User not found." };
    const payload: any = {};
    if (updates.email !== undefined) {
      const normalizedEmail = updates.email.trim().toLowerCase();
      const dup = await filterByFields("User", { email_lower: normalizedEmail });
      if (dup.length > 0 && dup[0].id !== id) return { ok: false, error: "Another account already uses this email." };
      payload.email = normalizedEmail;
      payload.email_lower = normalizedEmail;
    }
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.active !== undefined) payload.active = updates.active;

    if (payload.active === false) {
      const target = matches[0];
      if (target.role === "admin") {
        const admins = await filterCollection("User", (u: any) => u.active !== false && u.role === "admin");
        if (admins.length <= 1) {
          return { ok: false, error: "Cannot disable the only active admin account." };
        }
      }
    }

    await updateRecord("User", id, payload);
    // If the account was disabled, immediately invalidate its session.
    if (updates.active === false) {
      const isSelf = firebaseUser?.email && matches[0].email.toLowerCase() === firebaseUser.email.toLowerCase();
      if (isSelf) await logout();
    }
    return { ok: true };
  };

  const deleteUser: DemoAuthContextType["deleteUser"] = async (id) => {
    const matches = await filterCollection("User", (u: any) => u.id === id);
    if (matches.length === 0) return { ok: false, error: "User not found." };
    if (matches[0].role === "admin") {
      const admins = await filterCollection("User", (u: any) => u.id !== id && u.role === "admin");
      if (admins.length === 0) {
        return { ok: false, error: "Cannot delete the only admin account." };
      }
    }
    const email = matches[0].email;
    const isSelf = firebaseUser && firebaseUser.email && email.toLowerCase() === firebaseUser.email.toLowerCase();
    await deleteRecord("User", id);
    if (isSelf) await logout();
    return { ok: true };
  };

  const sendPasswordReset: DemoAuthContextType["sendPasswordReset"] = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Unable to send password reset email." };
    }
  };

  return (
    <DemoAuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        login,
        logout,
        listUsers,
        createUser,
        updateUser,
        deleteUser,
        sendPasswordReset,
      }}
    >
      {children}
    </DemoAuthContext.Provider>
  );
};

export const useDemoAuth = () => {
  const context = useContext(DemoAuthContext);
  if (!context) {
    throw new Error("useDemoAuth must be used within a DemoAuthProvider");
  }
  return context;
};
