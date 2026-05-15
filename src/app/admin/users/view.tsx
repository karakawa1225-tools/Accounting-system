"use client";

import { useMemo, useState, useTransition } from "react";
import { matchesListSearch } from "@/lib/list-search";
import { createStaffUser, deleteStaffUser, updateStaffUser } from "./actions";

const card: React.CSSProperties = { background: "#fff", border: "1px solid #cdd4de", borderRadius: 12, padding: 22 };
const btn: React.CSSProperties = {
  border: "none",
  color: "#fff",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: "0.12em",
  background: "linear-gradient(90deg,#06b6d4,#0ea5e9,#3b82f6)",
  cursor: "pointer",
};
const btnDanger: React.CSSProperties = {
  border: "1px solid #fca5a5",
  color: "#b91c1c",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 14,
  fontWeight: 700,
  background: "#fef2f2",
  cursor: "pointer",
};
const inp: React.CSSProperties = { border: "1px solid #cbd5e1", borderRadius: 8, padding: "8px 10px", fontSize: 15, fontWeight: 600 };
const field: React.CSSProperties = { display: "grid", gap: 6 };

type UserRow = {
  id: string;
  email: string;
  role: string | null;
  displayName: string | null;
};

export function UsersManageView({ users, currentUserId }: { users: UserRow[]; currentUserId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  const [listSearch, setListSearch] = useState("");

  const filteredUsers = useMemo(() => {
    if (!listSearch.trim()) return users;
    return users.filter((u) =>
      matchesListSearch([u.email, u.displayName ?? "", u.role === "user" ? "使用者" : "管理者"].join(" "), listSearch)
    );
  }, [users, listSearch]);

  const run = (f: () => Promise<void>) =>
    startTransition(() =>
      void f()
        .then(() => setMsg(""))
        .catch((e) => setMsg(e?.message ?? "処理に失敗しました"))
    );

  return (
    <main style={{ display: "grid", gap: 20 }}>
      <div>
        <h1 className="m-0 text-3xl font-extrabold tracking-[0.08em] sm:text-4xl">ユーザー管理</h1>
        <p style={{ margin: "10px 0 0", color: "#64748b", fontSize: 15, fontWeight: 600, letterSpacing: "0.04em", lineHeight: 1.65 }}>
          管理者のみが、アカウント（使用者／管理者）を追加・変更できます。
        </p>
      </div>

      {msg ? (
        <div style={{ fontSize: 15, fontWeight: 700, color: "#b91c1c" }}>{msg}</div>
      ) : null}

      <section style={card}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800 }}>使用者を追加</h2>
        <form
          action={(fd) =>
            run(() =>
              createStaffUser(fd).then(() => {
                (document.getElementById("new-user-form") as HTMLFormElement | null)?.reset();
              })
            )
          }
          id="new-user-form"
          style={{ display: "grid", gap: 10, maxWidth: 440 }}
        >
          <label style={field}>
            <span style={{ fontWeight: 700 }}>メール</span>
            <input style={inp} name="email" type="email" required autoComplete="off" />
          </label>
          <label style={field}>
            <span style={{ fontWeight: 700 }}>表示名（任意）</span>
            <input style={inp} name="displayName" autoComplete="off" />
          </label>
          <label style={field}>
            <span style={{ fontWeight: 700 }}>初期パスワード（8文字以上）</span>
            <input style={inp} name="password" type="password" autoComplete="new-password" required minLength={8} />
          </label>
          <button type="submit" disabled={pending} style={btn}>
            追加
          </button>
        </form>
      </section>

      <section style={card}>
        <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800 }}>登録済み</h2>
        <label style={{ ...field, marginBottom: 14, maxWidth: 440 }}>
          <span style={{ fontWeight: 700 }}>この一覧を検索（メール・表示名・役割）</span>
          <input
            style={inp}
            type="search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="例: admin / 使用者"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div style={{ display: "grid", gap: 14 }}>
          {filteredUsers.map((u) => (
            <article
              key={u.id}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 14,
                display: "grid",
                gap: 10,
                gridTemplateColumns: "minmax(0, 1fr) auto",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontWeight: 800, letterSpacing: "0.04em", color: "#0f172a" }}>
                  {u.email}
                  {u.id === currentUserId ? (
                    <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 700, color: "#64748b" }}>(あなた)</span>
                  ) : null}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>
                  現在: {u.role === "user" ? "使用者" : "管理者"}
                </div>
                <form
                  action={(fd) => run(() => updateStaffUser(fd))}
                  style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginTop: 4 }}
                >
                  <input type="hidden" name="id" value={u.id} />
                  <label style={{ ...field, minWidth: 140 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>表示名</span>
                    <input style={inp} name="displayName" defaultValue={u.displayName ?? ""} />
                  </label>
                  <label style={{ ...field, minWidth: 120 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>権限</span>
                    <select style={inp} name="role" defaultValue={u.role === "user" ? "user" : "admin"}>
                      <option value="user">使用者</option>
                      <option value="admin">管理者</option>
                    </select>
                  </label>
                  <label style={{ ...field, flex: "1 1 180px", minWidth: 160 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>新パスワード（変更時のみ）</span>
                    <input style={inp} name="newPassword" type="password" autoComplete="new-password" placeholder="変更しない場合は空欄" />
                  </label>
                  <button type="submit" disabled={pending} style={{ ...btn, alignSelf: "flex-end", marginBottom: 2 }}>
                    保存
                  </button>
                </form>
              </div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
                <form action={(fd) => run(() => deleteStaffUser(fd))}>
                  <input type="hidden" name="id" value={u.id} />
                  <button type="submit" disabled={pending || u.id === currentUserId} style={btnDanger}>
                    削除
                  </button>
                </form>
              </div>
            </article>
          ))}
          {filteredUsers.length === 0 ? (
            <p style={{ margin: 0, padding: 12, color: "#64748b", fontWeight: 700 }}>
              {users.length === 0 ? "登録ユーザーはいません。" : "検索条件に一致するユーザーがありません。"}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
