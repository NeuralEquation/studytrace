import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { readViewState, writeViewState } from "./viewState";

export function useViewState<T>(
  key: string,
  fallback: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(() => readViewState(key, fallback));
  const update: Dispatch<SetStateAction<T>> = (next) =>
    setValue((previous) => {
      const result =
        typeof next === "function" ? (next as (value: T) => T)(previous) : next;
      writeViewState(key, result);
      return result;
    });
  return [value, update];
}
