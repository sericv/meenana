"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import { col } from "@/lib/firestore/paths";
import type { Category } from "@/types";

export async function fetchCategories(): Promise<Category[]> {
  const db = getFirebaseDb();
  const snap = await getDocs(
    query(collection(db, col.categories), orderBy("order", "asc")),
  );
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      nameAr: String(x.nameAr ?? ""),
      slug: String(x.slug ?? d.id),
      order: Number(x.order ?? 0),
    };
  });
}
