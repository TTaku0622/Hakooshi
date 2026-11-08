// 表紙の演出（passport-cover-intro.tsx）を、このタブで見たかどうか
// ログイン画面からも呼ぶので、演出の CSS を読み込まないよう別のファイルにしている
export const SEEN_KEY = "oshi-cover-intro-seen";
export const SEEN_STYLE_ID = "oshi-cover-intro-seen";

export const hasSeenCoverIntro = () => {
  try { return sessionStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
};

export const markCoverIntroSeen = () => {
  try { sessionStorage.setItem(SEEN_KEY, "1"); } catch {}
};

// ログイン画面を開いたら、次にパスポート画面へ入るときにまた表紙から始める（ログアウトでもセッション切れでも）
export function resetCoverIntro() {
  try { sessionStorage.removeItem(SEEN_KEY); } catch {}
  document.getElementById(SEEN_STYLE_ID)?.remove();
}
