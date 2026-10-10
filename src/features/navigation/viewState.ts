// UI preferences live separately from study data and JSON backups.
export const viewStatePrefix = "studytrace:ui:v1:";
export function readViewState<T>(key: string, fallback: T): T {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(viewStatePrefix + key) ?? "null",
    );
    if (
      value === null ||
      Array.isArray(value) ||
      typeof value !== typeof fallback
    )
      return fallback;
    if (typeof fallback === "object") {
      if (!value || Object.values(value).some((v) => typeof v !== "boolean"))
        return fallback;
    }
    return value as T;
  } catch {
    return fallback;
  }
}
export function writeViewState(key: string, value: unknown) {
  try {
    localStorage.setItem(viewStatePrefix + key, JSON.stringify(value));
  } catch {
    /* Storage may be disabled; learning still works. */
  }
}
export function validViewRoute(route: unknown): route is string {
  return (
    typeof route === "string" &&
    route.length < 2000 &&
    /^\/(?:|courses(?:\/[^/?#]+)?|study\/[^/?#]+|records|sprint|analytics|coach|report|settings)(?:\?[^#\r\n]*)?$/.test(
      route,
    )
  );
}
export function restoreLastView() {
  if (window.location.hash && window.location.hash !== "#") return;
  const route = readViewState("last-route", "");
  if (validViewRoute(route)) {
    try {
      window.history.replaceState(
        window.history.state,
        "",
        window.location.pathname + window.location.search + "#" + route,
      );
    } catch {
      window.location.hash = route;
    }
  }
}
