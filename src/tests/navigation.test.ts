import { afterEach, expect, it, vi } from "vitest";
import { fixture } from "./fixtures";
import {
  courseStudyItems,
  itemNeighbors,
} from "../features/study/itemNavigation";
import {
  readViewState,
  restoreLastView,
  validViewRoute,
  viewStatePrefix,
  writeViewState,
} from "../features/navigation/viewState";

afterEach(() => vi.unstubAllGlobals());
it("orders neighboring items across sections, excluding hidden courses, units and items", () => {
  const data = fixture();
  const first = data.studyItems[0];
  data.units.push(
    { ...data.units[0], id: "next-unit", order: 1 },
    { ...data.units[0], id: "hidden-unit", order: 2, archived: true },
  );
  data.studyItems.push(
    { ...first, id: "last-in-section", order: 1 },
    { ...first, id: "first-in-next", unitId: "next-unit", order: 0 },
    { ...first, id: "hidden-item", order: 0.5, archived: true },
    { ...first, id: "in-hidden-unit", unitId: "hidden-unit" },
  );
  data.studyItems.reverse();
  expect(courseStudyItems(data, first.courseId).map((i) => i.id)).toEqual([
    first.id,
    "last-in-section",
    "first-in-next",
  ]);
  const middle = data.studyItems.find((i) => i.id === "last-in-section")!;
  expect(itemNeighbors(data, middle)).toMatchObject({
    index: 1,
    total: 3,
    previous: { id: first.id },
    next: { id: "first-in-next" },
  });
  expect(itemNeighbors(data, first).previous).toBeUndefined();
  expect(
    itemNeighbors(
      data,
      data.studyItems.find((i) => i.id === "first-in-next")!,
    ).next,
  ).toBeUndefined();
  expect(itemNeighbors(data, { ...first, id: "missing" }).next).toBeUndefined();
  data.courses[0].archived = true;
  expect(courseStudyItems(data, first.courseId)).toEqual([]);
});
it("accepts only in-app routes and preserves the selected record/report period", () => {
  for (const route of [
    "/",
    "/study/item-1",
    "/courses/course-1",
    "/records?tab=history",
    "/report?start=2026-10-07&end=2026-10-08",
  ])
    expect(validViewRoute(route)).toBe(true);
  for (const route of [
    "https://example.org/",
    "//example.org",
    "/unknown",
    "/study/",
    "/records#outside",
    "/records?x=1\n",
    null,
    {},
  ])
    expect(validViewRoute(route)).toBe(false);
});
it("handles damaged or unavailable UI storage without interrupting learning", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => "not json",
    setItem: () => {
      throw new Error("storage full");
    },
  });
  expect(readViewState("chapters", {})).toEqual({});
  expect(() => writeViewState("chapters", { chapter: true })).not.toThrow();
  vi.stubGlobal("localStorage", { getItem: () => '{"chapter":"true"}' });
  expect(readViewState("chapters", {})).toEqual({});
  vi.stubGlobal("localStorage", { getItem: () => '"false"' });
  expect(readViewState("open", false)).toBe(false);
});
it("restores a manifest launch and keeps an explicit deep link or Today link", () => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  writeViewState("last-route", "/study/problem-2");
  expect(values.get(viewStatePrefix + "last-route")).toBe('"/study/problem-2"');
  const replaceState = vi.fn();
  const location = {
    hash: "",
    pathname: "/studytrace/index.html",
    search: "?launch=pwa",
  };
  vi.stubGlobal("window", { location, history: { state: null, replaceState } });
  restoreLastView();
  expect(replaceState).toHaveBeenCalledWith(
    null,
    "",
    "/studytrace/index.html?launch=pwa#/study/problem-2",
  );
  replaceState.mockClear();
  for (const hash of ["#/", "#/courses/math"]) {
    location.hash = hash;
    restoreLastView();
  }
  expect(replaceState).not.toHaveBeenCalled();
  location.hash = "";
  writeViewState("last-route", "//outside");
  restoreLastView();
  expect(replaceState).not.toHaveBeenCalled();
});
