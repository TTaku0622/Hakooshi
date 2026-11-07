"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BookOpen } from "lucide-react";
import type { AuthFormState } from "./auth-actions";

type Field = {
  name: string;
  label: string;
  type: "text" | "password";
  autoComplete: string;
  help?: string;
};

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  notice?: string;
};

const fields: Record<Props["mode"], Field[]> = {
  login: [
    { name: "username", label: "ユーザーID", type: "text", autoComplete: "username" },
    { name: "password", label: "パスワード", type: "password", autoComplete: "current-password" },
  ],
  signup: [
    { name: "username", label: "ユーザーID", type: "text", autoComplete: "username", help: "半角英数字と . _ - で3〜64文字" },
    { name: "password", label: "パスワード", type: "password", autoComplete: "new-password", help: "8文字以上" },
    { name: "confirmPassword", label: "パスワード（確認）", type: "password", autoComplete: "new-password" },
  ],
};

export default function AuthForm({ mode, action, notice }: Props) {
  const [state, formAction, pending] = useActionState(action, { errors: [], username: "" });
  const isLogin = mode === "login";

  return (
    <main className={"page"}>
      <header className={"header"}>
        <div className={"logo"}>
          <span className={"logoIcon"}><BookOpen size={21} /></span>
          <span>OSHI PASSPORT</span>
        </div>
        <span className={"headerTag"}>A PASSPORT TO YOUR OSHI.</span>
      </header>

      <section className={"authCard"}>
        <h1>{isLogin ? "ログイン" : "アカウント新規登録"}</h1>

        {notice && <p className={"authNotice"}>{notice}</p>}
        {state.errors.map((error) => (
          <p key={error} className={"authError"}>{error}</p>
        ))}

        <form action={formAction} noValidate>
          {fields[mode].map((field) => (
            <div className={"field"} key={field.name}>
              <label htmlFor={field.name}>{field.label}</label>
              <input
                id={field.name}
                name={field.name}
                type={field.type}
                autoComplete={field.autoComplete}
                defaultValue={field.name === "username" ? state.username : undefined}
              />
              {field.help && <p className={"authHelp"}>{field.help}</p>}
            </div>
          ))}
          <button className={"downloadButton"} type="submit" disabled={pending}>
            {pending ? "送信中..." : isLogin ? "ログイン" : "アカウントを作成"}
          </button>
        </form>

        <p className={"authSwitch"}>
          {isLogin ? (
            <>アカウントをお持ちでない方は <Link href="/signup">新規登録</Link></>
          ) : (
            <>すでにアカウントをお持ちの方は <Link href="/login">ログイン</Link></>
          )}
        </p>
      </section>
    </main>
  );
}
