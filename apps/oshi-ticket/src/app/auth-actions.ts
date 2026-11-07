"use server";

import { redirect } from "next/navigation";
import { authenticate, createUser, endSession, startSession } from "@/lib/auth";

export type AuthFormState = {
  errors: string[];
  username: string;
};

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = text(formData, "username").trim();
  const password = text(formData, "password");
  const loginCode = text(formData, "loginCode");

  const errors: string[] = [];
  if (!username) errors.push("ユーザーIDを入力してください。");
  if (!password) errors.push("パスワードを入力してください。");
  if (!loginCode) errors.push("ログイン用コードを入力してください。");
  if (errors.length) return { errors, username };

  const user = authenticate(username, password, loginCode);
  if (!user) {
    return { errors: ["ユーザーID・パスワード・ログイン用コードのいずれかが違います。"], username };
  }

  await startSession(user.id);
  redirect("/");
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const username = text(formData, "username").trim();
  const password = text(formData, "password");
  const confirmPassword = text(formData, "confirmPassword");
  const loginCode = text(formData, "loginCode");

  const errors: string[] = [];
  if (!/^[A-Za-z0-9_.-]{3,64}$/.test(username)) {
    errors.push("ユーザーIDは半角英数字と . _ - を使って3〜64文字で入力してください。");
  }
  if (password.length < 8 || password.length > 128) {
    errors.push("パスワードは8〜128文字で入力してください。");
  }
  if (password !== confirmPassword) {
    errors.push("パスワードが一致しません。");
  }
  if (!/^\d{6}$/.test(loginCode)) {
    errors.push("ログイン用コードは半角数字6桁で入力してください。");
  }
  if (errors.length) return { errors, username };

  if (!createUser(username, password, loginCode)) {
    return { errors: ["このユーザーIDは既に使われています。"], username };
  }

  redirect("/login?registered=1");
}

export async function logout() {
  await endSession();
  redirect("/login");
}
