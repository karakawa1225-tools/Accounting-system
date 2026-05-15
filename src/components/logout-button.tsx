"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function LogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/login");
          router.refresh();
        })
      }
    >
      {pending ? "ログアウト中…" : "ログアウト"}
    </button>
  );
}
