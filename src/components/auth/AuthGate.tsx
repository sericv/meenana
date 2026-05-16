"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { Panel } from "@/components/ui/Panel";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname || "/");
      router.replace(`/login?next=${next}`);
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Panel className="w-full max-w-md text-center text-[#9b6338]">جاري التحميل...</Panel>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center text-[#9b6338]">
        <Panel className="w-full max-w-md">
          <p className="text-sm">يلزم تسجيل الدخول للمتابعة.</p>
          <Link className="mt-4 inline-block font-semibold text-[#ea8c2f]" href="/login">
            الانتقال لتسجيل الدخول
          </Link>
          <Link className="mt-3 block text-sm font-semibold text-[#bc7a45]" href="/">
            الرئيسية
          </Link>
        </Panel>
      </div>
    );
  }

  return children;
}
