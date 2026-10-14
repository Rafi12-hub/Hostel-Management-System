// Lightweight Firestore helpers used across the app. Direct Cloud Firestore calls.
import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type WithId<T> = T & { id: string };

type SnapshotDoc = { id: string; data: () => any };

function toItem(d: SnapshotDoc): WithId<any> {
  return { id: d.id, ...d.data() };
}

export interface ListOptions {
  orderByField?: string;
  order?: "asc" | "desc";
  limit?: number;
}

/** Fetch an entire collection (optionally ordered/limited). */
export async function listCollection<T = any>(
  name: string,
  opts: ListOptions = {}
): Promise<WithId<T>[]> {
  const constraints: QueryConstraint[] = [];
  if (opts.orderByField) {
    constraints.push(orderBy(opts.orderByField, opts.order || "asc"));
  }
  if (opts.limit) {
    constraints.push(firestoreLimit(opts.limit));
  }
  const q = constraints.length ? query(collection(db, name), ...constraints) : collection(db, name);
  const snap = await getDocs(q);
  return snap.docs.map((d) => toItem(d) as WithId<T>);
}

/** Fetch a single document by its id, or null. */
export async function getById<T = any>(name: string, id: string): Promise<WithId<T> | null> {
  const ref = doc(collection(db, name), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toItem(snap) as WithId<T>;
}

/**
 * Fetch documents matching a set of conditions.
 * `conditions` may be a field->value map, or a predicate function for
 * client-side filtering (e.g. when matching requires normalization).
 */
export async function filterCollection<T = any>(
  name: string,
  conditions: Record<string, any> | ((item: WithId<T>) => boolean)
): Promise<WithId<T>[]> {
  const snap = await getDocs(collection(db, name));
  const items = snap.docs.map((d) => toItem(d) as WithId<T>);
  if (typeof conditions === "function") {
    return items.filter(conditions as (item: WithId<T>) => boolean);
  }
  return items.filter((item: any) =>
    Object.entries(conditions).every(([k, v]) => item[k] === v)
  );
}

/** Filter with an exact-match Firestore query. */
export async function filterByFields<T = any>(
  name: string,
  conditions: Record<string, any>
): Promise<WithId<T>[]> {
  const constraints: QueryConstraint[] = Object.entries(conditions).map(([k, v]) =>
    where(k, "==", v)
  );
  const snap = constraints.length
    ? await getDocs(query(collection(db, name), ...constraints))
    : await getDocs(collection(db, name));
  return snap.docs.map((d) => toItem(d) as WithId<T>);
}

/** Create a document with an auto-generated id. Returns the created record. */
export async function createRecord<T = any>(name: string, data: Record<string, any>): Promise<WithId<T>> {
  const created_at = new Date().toISOString();
  const ref = await addDoc(collection(db, name), { ...data, created_at });
  return { id: ref.id, ...data, created_at } as unknown as WithId<T>;
}

/** Create a document with an explicit id. */
export async function createRecordWithId<T = any>(
  name: string,
  id: string,
  data: Record<string, any>
): Promise<WithId<T>> {
  const ref = doc(collection(db, name), id);
  await setDoc(ref, { ...data, id, created_at: new Date().toISOString() });
  return { id, ...data } as unknown as WithId<T>;
}

/** Update a document by id. Returns the updated record. */
export async function updateRecord<T = any>(
  name: string,
  id: string,
  updates: Record<string, any>
): Promise<WithId<T>> {
  const ref = doc(collection(db, name), id);
  await updateDoc(ref, { ...updates, updated_at: new Date().toISOString() });
  const snap = await getDoc(ref);
  return toItem(snap) as WithId<T>;
}

/** Delete a document by id. */
export async function deleteRecord(name: string, id: string): Promise<void> {
  const ref = doc(collection(db, name), id);
  await deleteDoc(ref);
}

/** Subscribe to a collection with realtime updates. Returns an unsubscribe function. */
export function subscribeCollection<T = any>(
  name: string,
  callback: (items: WithId<T>[]) => void
): () => void {
  return onSnapshot(collection(db, name), (snap) =>
    callback(snap.docs.map((d) => toItem(d) as WithId<T>))
  );
}
