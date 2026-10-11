import { expect, it } from "vitest";
import {
  countedAccuracy,
  validateCountedAccuracy,
  formatAccuracy,
} from "../studyModes/speed/accuracy";
import { attemptSchema } from "../types/model";
import { speed } from "./fixtures";
import { personalBest } from "../domain/study";

it("calculates accuracy and results from correct/total without rounding stored values", () => {
  expect(countedAccuracy(8, 10)).toEqual({ accuracy: 80, result: "partial" });
  expect(countedAccuracy(0, 10)).toEqual({ accuracy: 0, result: "incorrect" });
  expect(countedAccuracy(10, 10)).toEqual({ accuracy: 100, result: "correct" });
  expect(countedAccuracy(1, 3)?.accuracy).toBeCloseTo(100 / 3, 12);
  expect(countedAccuracy(1, 3)?.accuracy).not.toBe(33.33);
  expect(formatAccuracy(100 / 3)).toBe("33.33%");
  expect(formatAccuracy(99.999)).toBe("100%未満");
  expect(formatAccuracy(100)).toBe("100%");
});
it("rejects empty, zero-total, negative, fractional and excessive counts", () => {
  for (const [correct, total] of [
    [0, 0],
    [1, 0],
    [-1, 10],
    [11, 10],
    [1.5, 10],
    [1, 2.5],
    [NaN, 10],
    [1, Infinity],
  ])
    expect(countedAccuracy(correct, total)).toBeUndefined();
  expect(() =>
    validateCountedAccuracy(
      speed({ correctCount: 8, totalCount: 10, accuracy: 100 }),
    ),
  ).toThrow();
  expect(() => validateCountedAccuracy(speed({ correctCount: 1 }))).toThrow();
});
it("preserves old percentage-only records and round-trips optional count fields", () => {
  const old = speed({ accuracy: 80, result: "partial" });
  expect(attemptSchema.parse(old)).toEqual(old);
  expect(() => validateCountedAccuracy(old)).not.toThrow();
  const counted = speed({
    correctCount: 8,
    totalCount: 10,
    ...countedAccuracy(8, 10)!,
  });
  expect(attemptSchema.parse(JSON.parse(JSON.stringify(counted)))).toEqual(
    counted,
  );
  expect(() => validateCountedAccuracy(counted)).not.toThrow();
});
it("does not qualify a rounded near-perfect fraction as a perfect personal best", () => {
  const almost = speed({
    correctCount: 99999,
    totalCount: 100000,
    ...countedAccuracy(99999, 100000)!,
  });
  expect(personalBest([], almost).isNewBest).toBe(false);
  const perfect = speed({
    correctCount: 10,
    totalCount: 10,
    ...countedAccuracy(10, 10)!,
  });
  expect(personalBest([], perfect).isNewBest).toBe(true);
});
