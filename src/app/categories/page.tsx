"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Panel } from "@/components/ui/Panel";
import { useDefaultOnlinePresence } from "@/hooks/useDefaultOnlinePresence";
import { isFullAccountUser } from "@/lib/auth/google-user";
import { fetchCategories } from "@/lib/firestore/categories.client";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const { user } = useAuth();
  useDefaultOnlinePresence(user?.uid ?? null, isFullAccountUser(user));
  const [cats, setCats] = useState<Category[]>([]);

  useEffect(() => {
    void fetchCategories().then(setCats).catch(() => setCats([]));
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Panel>
        <h1 className="text-4xl font-black text-[#8a3f16]">التصنيفات</h1>
        <p className="mt-2 text-base text-[#a16231]">تُستخدم لتجميع البطاقات داخل المباريات.</p>
        <ul className="mt-5 space-y-2">
          {cats.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-[#f5cda4] bg-[#fff6ea] px-4 py-3 text-sm text-[#8f4d1f]"
            >
              <span className="font-medium">{c.nameAr}</span>
              <span className="text-[#c48652]">{c.id}</span>
            </li>
          ))}
        </ul>
        <Link className="mt-6 inline-block text-sm font-semibold text-[#ea8c2f]" href="/">
          رجوع
        </Link>
      </Panel>
    </div>
  );
}
