"use client";

import { memo, useEffect, useRef, useState, useSyncExternalStore, type AnimationEvent } from "react";
import { MapPin, Ticket } from "lucide-react";
import { SEEN_KEY, SEEN_STYLE_ID, hasSeenCoverIntro, markCoverIntroSeen } from "./cover-intro-state";
import { createPassportSounds } from "./passport-sounds";
import "./passport-cover-intro.css";

// タブを開いて最初にパスポート画面を開いたときだけ、表紙が開く演出を見せる（同じタブで再読み込みしても出さない）
// 机に置いたパスポートを斜め上から見る → 表紙が開く → 入国スタンプが押される → カメラがページに入り込んで今の画面になる

// 見たかどうかは sessionStorage に入れる（cover-intro-state.ts）。変わっても通知はないので購読はしない
const subscribe = () => () => {};
// スタンプの日付。サーバーと端末で日付がずれることがあるので、端末側でだけ出す
const todayLabel = () => {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;
};

// サーバーが返す HTML には表紙が入っている。見たことがあるタブでは、React が動く前に一瞬表紙が出ないよう描画前に隠す
const hideIfSeen = `try{if(sessionStorage.getItem("${SEEN_KEY}")==="1"){var s=document.createElement("style");s.id="${SEEN_STYLE_ID}";s.textContent="[data-cover-intro]{display:none}";document.head.appendChild(s)}}catch(e){}`;

export const PassportCoverIntro = memo(function PassportCoverIntro({ username, onSoundReplay, onSoundFinish }: {
  username: string;
  onSoundReplay: () => void;
  onSoundFinish: () => void;
}) {
  const seen = useSyncExternalStore(subscribe, hasSeenCoverIntro, () => false);
  // サーバーでの描画とハイドレーションのときだけ true。クライアントで足した script は実行されないので、そのときは出さない
  const fromServer = useSyncExternalStore(subscribe, () => false, () => true);
  const today = useSyncExternalStore(subscribe, todayLabel, () => null);
  const [done, setDone] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [soundReplay, setSoundReplay] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const sounds = useRef<ReturnType<typeof createPassportSounds>>(null);
  const show = !seen && !done;

  useEffect(() => {
    if (!show) return;
    return () => {
      sounds.current?.dispose();
      sounds.current = null;
    };
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const overlay = overlayRef.current;
    // React が動き出す前に CSS のアニメーションが終わっていたら、そのまま片付ける
    // （アニメーションが取れないとき・getAnimations がない古いブラウザでは、閉じずに animationend を待つ）
    const animations = typeof overlay?.getAnimations === "function" ? overlay.getAnimations() : [];
    if (animations.length > 0 && animations.every((animation) => animation.playState === "finished")) {
      const frame = requestAnimationFrame(() => { markCoverIntroSeen(); setDone(true); });
      return () => cancelAnimationFrame(frame);
    }
    // 読み上げやキーボードでも飛ばせるよう、表紙にフォーカスを移す
    skipButtonRef.current?.focus({ preventScroll: true });
    // 演出中は後ろの画面をスクロールさせない（iPhone のスワイプは CSS の touch-action で止める）
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = "hidden";
    // 後ろの画面のボタンなどが一緒に押されないよう、ほかより先に受け取って止める
    const skipByKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setSkipping(true);
    };
    window.addEventListener("keydown", skipByKey, true);
    return () => {
      root.style.overflow = overflow;
      window.removeEventListener("keydown", skipByKey, true);
    };
  }, [show, soundReplay]);

  if (!show) return null;

  const replayWithSound = () => {
    if (skipping || soundReplay) return;
    sounds.current = createPassportSounds();
    onSoundReplay();
    setSoundReplay(true);
  };

  const playCue = (event: AnimationEvent<HTMLDivElement>) => {
    if (skipping) return;
    if (event.animationName === "coverIntroOpen") sounds.current?.play("pageTurn");
    if (event.animationName === "coverIntroThud") sounds.current?.play("stamp");
  };

  // 子要素のアニメーションの終わりも伝わってくるので、全体が消え終わったときだけ閉じる
  const finish = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (soundReplay) onSoundFinish();
    markCoverIntroSeen();
    setDone(true);
  };

  return <>
    {fromServer && <script dangerouslySetInnerHTML={{ __html: hideIfSeen }} />}
    <div key={soundReplay ? "with-sound" : "silent"} ref={overlayRef} data-cover-intro="" className={`coverIntro${skipping ? " isSkipping" : ""}`}
      onAnimationStart={playCue} onAnimationEnd={finish}>
      {/* 紙で覆いきったあと、見えない場面を描かないよう透明にするための外枠 */}
      <div className="coverIntroWorld" aria-hidden="true">
      <div className="coverIntroScene">
        {/* カメラ。机ごと傾けて手前上から見下ろし、開くにつれて近づき、最後は右のページに入り込む */}
        <div className="coverIntroCamera">
          <div className="coverIntroDesk" />
          <div className="coverIntroLamp" />

          {/* 机の上の小物。旅の途中の机に見えるように */}
          <div className="coverIntroMap">
            <svg className="coverIntroRoute" viewBox="0 0 160 110" preserveAspectRatio="none">
              <path d="M14 92 C 40 70, 52 84, 74 58 S 118 30, 146 18" />
            </svg>
            <MapPin className="coverIntroMapPin" strokeWidth={1.6} />
            <span>LIVE ROUTE</span>
          </div>
          <div className="coverIntroTicket">
            <span className="coverIntroTicketMain"><small>TICKETLY · ADMIT ONE</small><strong>LIVE TICKET</strong></span>
            <span className="coverIntroTicketStub">No.<br />0001</span>
          </div>

          <div className="coverIntroBook">
            <div className="coverIntroBookShadow" />
            {/* ページの厚み（手前と右の小口） */}
            <div className="coverIntroEdge coverIntroEdgeFront" />
            <div className="coverIntroEdge coverIntroEdgeSide" />

            {/* 表紙の下にある最初のページ。表紙が開くと見え、入国スタンプが押される */}
            <div className="coverIntroPage">
              <span className="coverIntroPageLabel">TICKETLY</span>
              <Ticket className="coverIntroWatermark" strokeWidth={0.8} />
              <div className="coverIntroHolder">
                <small>所持人 / HOLDER</small>
                <strong>{username}</strong>
              </div>
              <p className="coverIntroMotto">推しに会う旅を、パスポートに刻もう。</p>
              <div className="coverIntroStamp">
                <small>ENTRY · 入国</small>
                <strong>TICKETLY</strong>
                <small>{today ?? " "}</small>
              </div>
            </div>

            {/* 表紙。背表紙（左端）を軸に持ち上がって左へ倒れる。裏側は見返し */}
            <div className="coverIntroCover">
              <div className="coverIntroFace coverIntroFront">
                <span className="coverIntroSheen" />
                <span className="coverIntroTitleJa">推し旅券</span>
                {/* チケットの形の紋章（左右の切り欠き・ミシン目・頭文字の T・星） */}
                <svg className="coverIntroEmblem" viewBox="-1 -1 102 62" aria-hidden="true">
                  <path className="coverIntroEmblemOuter" d="M5 0H95A5 5 0 0 1 100 5V23A7 7 0 0 0 100 37V55A5 5 0 0 1 95 60H5A5 5 0 0 1 0 55V37A7 7 0 0 0 0 23V5A5 5 0 0 1 5 0Z" />
                  <rect x="11" y="5" width="78" height="50" rx="3" opacity=".45" />
                  <line x1="70" y1="9" x2="70" y2="51" strokeDasharray="2 2.5" />
                  <text x="40" y="40.5" textAnchor="middle">T</text>
                  <path className="coverIntroEmblemStar" d="M81 23L82.6 28.4L88 30L82.6 31.6L81 37L79.4 31.6L74 30L79.4 28.4Z" />
                </svg>
                <span className="coverIntroTitle">TICKETLY</span>
                <span className="coverIntroSub">LIVE TICKET PASSPORT</span>
              </div>
              <div className="coverIntroFace coverIntroInside">
                {/* 本物の旅券の見返しにある要請文をもじった一文 */}
                <Ticket className="coverIntroInsideMark" strokeWidth={1} />
                <p>推しに会う旅に出る本券の所持人が、迷わず、遅れず、笑顔で帰ってこられるよう、すべての遠征先に要請する。</p>
                <small>TICKETLY 発行</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
      {/* 周りを暗くして本に目を集める。ページに入り込むときは消す */}
      <div className="coverIntroVignette" aria-hidden="true" />
      {/* 最後に画面いっぱいが紙になり、そのままパスポート画面に変わる */}
      <div className="coverIntroWash" aria-hidden="true"><span>YOUR LIVE JOURNEY BEGINS</span></div>
      <p className="coverIntroHint" aria-hidden="true">タップでスキップ</p>
      <button ref={skipButtonRef} type="button" className="coverIntroSkipButton" aria-label="オープニングをスキップ" onClick={() => setSkipping(true)} />
      {!soundReplay && !skipping && <button type="button" className="coverIntroSoundButton" onClick={replayWithSound}>音ありで再生</button>}
    </div>
  </>;
});
