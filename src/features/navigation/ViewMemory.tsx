import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { readViewState, writeViewState } from "./viewState";

export function ViewMemory() {
  const location = useLocation();
  const route = location.pathname + location.search;
  useLayoutEffect(() => {
    writeViewState("last-route", route);
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const y = readViewState("scroll:" + route, 0);
    let restoring = true;
    const frame = requestAnimationFrame(() => {
      window.scrollTo(0, Number.isFinite(y) ? Math.max(0, y) : 0);
      restoring = false;
    });
    let pending: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      if (!restoring) writeViewState("scroll:" + route, window.scrollY);
    };
    const onScroll = () => {
      clearTimeout(pending);
      pending = setTimeout(save, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    document.addEventListener("visibilitychange", save);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(pending);
      save();
      window.history.scrollRestoration = previousRestoration;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", save);
    };
  }, [route]);
  return null;
}
