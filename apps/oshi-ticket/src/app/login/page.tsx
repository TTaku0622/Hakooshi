import { Suspense } from "react";
import AuthForm from "../AuthForm";
import { login } from "../auth-actions";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { registered } = await searchParams;
  const notice = registered ? "アカウントを作成しました。ログインしてください。" : undefined;
  return <AuthForm mode="login" action={login} notice={notice} />;
}
