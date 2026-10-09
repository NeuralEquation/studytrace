import { Component, useEffect, useState } from "react";
import logoUrl from "../assets/icon.svg";
import type { ReactNode, ErrorInfo } from "react";
import {
  HashRouter,
  NavLink,
  Route,
  Routes,
  Link,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  ChartNoAxesCombined,
  MessageSquare,
  Settings as SettingsIcon,
  CalendarRange,
  Check,
  WifiOff,
  ArrowUpRight,
} from "lucide-react";
import { activeData } from "../features/study/records";
import { Records } from "../pages/Study/Records";
import { useData } from "../db/useData";
import { action, useUI } from "../stores/ui";
import {
  ensureInorganicCourse,
  inorganicUpdateKey,
} from "../features/courses/catalog";
import { stopDisallowedTimers } from "../features/study/session";
import { Onboarding } from "../pages/Onboarding";
import { Today } from "../pages/Today/Today";
import { Courses } from "../pages/Courses/Courses";
import { Study } from "../pages/Study/Study";
import { SprintPage } from "../pages/Sprint";
import { Analytics } from "../pages/Analytics/Analytics";
import { Coach } from "../pages/Coach/Coach";
import { WeeklyReport } from "../pages/Coach/WeeklyReport";
import { Settings } from "../pages/Settings/Settings";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("StudyTrace", error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <main className="fatal">
        <h1>表示できませんでした</h1>
        <p>{this.state.error}</p>
        <p>保存データを消去せず、ページを再読み込みしてください。</p>
        <button onClick={() => location.reload()}>再読み込み</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function Toast() {
  const { message, error, notify } = useUI();
  useEffect(() => {
    if (!message || error) return;
    const timer = setTimeout(() => notify(""), 7000);
    return () => clearTimeout(timer);
  }, [message, error, notify]);
  return message ? (
    <div
      className={"toast " + (error ? "error" : "")}
      role={error ? "alert" : "status"}
    >
      <span>{message}</span>
      <button aria-label="通知を閉じる" onClick={() => notify("")}>
        ×
      </button>
    </div>
  ) : null;
}
const nav = [
  { to: "/", label: "Today", icon: LayoutDashboard },
  { to: "/courses", label: "講座・授業", icon: BookOpen },
  { to: "/records", label: "学習記録", icon: CalendarRange },
  { to: "/sprint", label: "Sprint", icon: CalendarRange },
  { to: "/analytics", label: "学習の変化", icon: ChartNoAxesCombined },
  { to: "/coach", label: "Coach", icon: MessageSquare },
  { to: "/settings", label: "設定", icon: SettingsIcon },
];
function Content() {
  const rawData = useData();
  const data = rawData ? activeData(rawData) : undefined;
  const location = useLocation();
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    void action(() => stopDisallowedTimers());
  }, []);
  const needsInorganic =
    !!data?.courses.length &&
    !data.settings.some((s) => s.key === inorganicUpdateKey && s.value);
  useEffect(() => {
    if (needsInorganic)
      void action(
        () => ensureInorganicCourse(),
        "無機化学の授業一覧を確認・追加しました。既存の記録は保持しています。",
      );
  }, [needsInorganic]);
  useEffect(() => {
    const fn = () => setOffline(!navigator.onLine);
    window.addEventListener("online", fn);
    window.addEventListener("offline", fn);
    return () => {
      window.removeEventListener("online", fn);
      window.removeEventListener("offline", fn);
    };
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (!data)
    return <div className="loading">StudyTraceを読み込んでいます…</div>;
  if (
    !data.settings.some((s) => s.key === "onboarded" && s.value) &&
    !data.courses.length
  )
    return (
      <>
        <Onboarding />
        <Toast />
      </>
    );
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        本文へ移動
      </a>
      <aside className="sidebar">
        <Link className="brand" to="/">
          <img src={logoUrl} alt="" />
          StudyTrace
        </Link>
        <span className="sidebar-caption">MAKE YOUR LEARNING VISIBLE</span>
        <nav aria-label="メインナビゲーション">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} end={to === "/"} to={to}>
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link to="/report">
            週間進捗報告 <ArrowUpRight size={17} />
          </Link>
          <span>
            <i className="online-dot" />
            LOCAL FIRST
          </span>
          <small>このブラウザに、自動保存。</small>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>
            MY STUDY SPACE <span className="divider">/</span> 個人の学習記録
          </span>
          <span className="save-status">
            {offline ? (
              <>
                <WifiOff size={14} />
                オフライン
              </>
            ) : (
              <>
                <Check size={14} />
                ローカル保存
              </>
            )}
          </span>
        </div>
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Today data={data} />} />
            <Route path="/courses" element={<Courses data={data} />} />
            <Route
              path="/courses/:id"
              element={<Courses key={location.pathname} data={data} />}
            />
            <Route
              path="/study/:id"
              element={
                <Study key={location.pathname} data={data} rawData={rawData} />
              }
            />
            <Route path="/sprint" element={<SprintPage data={data} />} />
            <Route path="/analytics" element={<Analytics data={data} />} />
            <Route path="/coach" element={<Coach data={data} />} />
            <Route path="/report" element={<WeeklyReport data={data} />} />
            <Route path="/records" element={<Records data={rawData!} />} />
            <Route path="/settings" element={<Settings data={rawData!} />} />
            <Route
              path="*"
              element={
                <div>
                  <h1>ページが見つかりません</h1>
                  <Link to="/">Todayへ戻る</Link>
                </div>
              }
            />
          </Routes>
        </main>
        <footer className="app-footer">
          StudyTrace <span>日々の学びを、次の指導へ。</span>
          <span>v0.1</span>
        </footer>
      </div>
      <Toast />
    </div>
  );
}
export function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Content />
      </HashRouter>
    </ErrorBoundary>
  );
}
