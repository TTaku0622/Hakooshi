"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Compass, Globe2, Ticket } from "lucide-react";
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
    {
      name: "username",
      label: "ユーザーID",
      type: "text",
      autoComplete: "username",
    },
    {
      name: "password",
      label: "パスワード",
      type: "password",
      autoComplete: "current-password",
    },
  ],
  signup: [
    {
      name: "username",
      label: "ユーザーID",
      type: "text",
      autoComplete: "username",
      help: "半角英数字と . _ - で3〜64文字",
    },
    {
      name: "password",
      label: "パスワード",
      type: "password",
      autoComplete: "new-password",
      help: "8文字以上",
    },
    {
      name: "confirmPassword",
      label: "パスワード（確認）",
      type: "password",
      autoComplete: "new-password",
    },
  ],
};

export default function AuthForm({ mode, action, notice }: Props) {
  const [state, formAction, pending] = useActionState(action, {
    errors: [],
    username: "",
  });
  const isLogin = mode === "login";

  return (
    <main className="authPage">
      <header className="authHeader">
        <Link href="/login" className="authBrand" aria-label="HAKOOSHI ログイン">
          <span className="authBrandIcon">
            <Ticket size={21} />
          </span>
          <span>HAKOOSHI</span>
        </Link>
        <span className="authHeaderTag">YOUR LIVE JOURNEY STARTS HERE</span>
      </header>

      <div className="authBackgroundDecoration" aria-hidden="true">
        <span className="authRoute authRouteOne" />
        <span className="authRoute authRouteTwo" />
        <span className="authBackgroundStamp">
          <Globe2 size={42} />
          <span>JAPAN</span>
          <small>LIVE TOUR</small>
        </span>
      </div>

      <section className="authPassport">
        <div className="authPassportInner">
          <div className="authPassportTop">
            <span className="authPassportLabel">JAPAN · LIVE TRAVEL PASSPORT</span>
            <Compass size={19} />
          </div>

          <div className="authPassportEmblem" aria-hidden="true">
            <div className="authEmblemCircle">
              <Ticket size={33} strokeWidth={1.4} />
            </div>
            <span>YOUR MEMORIES</span>
          </div>

          <p className="authEyebrow">
            {isLogin ? "WELCOME BACK, TRAVELER" : "YOUR JOURNEY BEGINS"}
          </p>

          <h1 className="authTitle">
            {isLogin ? "旅の続きを、ここから。" : "新しい旅を、はじめよう。"}
          </h1>

          <p className="authDescription">
            {isLogin
              ? "あなたのライブ遠征と思い出が、ここで待っています。"
              : "アカウントを作成して、推しに会う旅を記録しよう。"}
          </p>

          <div className="authGoldDivider">
            <span />
            <Compass size={15} />
            <span />
          </div>

          <div className="authFormHeading">
            <span className="authFormHeadingNumber">
              {isLogin ? "01" : "02"}
            </span>
            <div>
              <h2>{isLogin ? "ログイン" : "アカウント新規登録"}</h2>
              <p>{isLogin ? "SIGN IN TO YOUR PASSPORT" : "CREATE YOUR PASSPORT"}</p>
            </div>
          </div>

          {notice && (
            <p className="authNotice" role="status">
              {notice}
            </p>
          )}

          {state.errors.map((error) => (
            <p key={error} className="authError" role="alert">
              {error}
            </p>
          ))}

          <form action={formAction} noValidate>
            {fields[mode].map((field, index) => (
              <div className="authField" key={field.name}>
                <label htmlFor={field.name}>
                  <span className="authFieldNumber">0{index + 1}</span>
                  {field.label}
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  defaultValue={
                    field.name === "username" ? state.username : undefined
                  }
                  placeholder={
                    field.name === "username"
                      ? "ユーザーIDを入力"
                      : "パスワードを入力"
                  }
                />
                {field.help && <p className="authHelp">{field.help}</p>}
              </div>
            ))}

            <button className="authSubmit" type="submit" disabled={pending}>
              <span>{pending ? "送信中..." : isLogin ? "ログインする" : "アカウントを作成する"}</span>
              <Compass size={18} />
            </button>
          </form>

          <div className="authSwitch">
            {isLogin ? (
              <>
                はじめての方はこちら
                <Link href="/signup">新規登録</Link>
              </>
            ) : (
              <>
                すでにアカウントをお持ちの方は
                <Link href="/login">ログイン</Link>
              </>
            )}
          </div>

          <div className="authPassportBottom">
            <span>HAKOOSHI</span>
            <span>COLLECT YOUR JOURNEY</span>
            <span>✦ JAPAN ✦</span>
          </div>
        </div>
      </section>

      <footer className="authFooter">
        <span>EVERY LIVE, EVERY JOURNEY, EVERY MEMORY.</span>
        <span>© HAKOOSHI</span>
      </footer>
    </main>
  );
}
