//src/hooks/use-callback-ref.ts

// ───────────────── BLOCK 1: Imports ────────────────────────────
import * as React from "react";

// ───────────────── BLOCK 2: Types & Zod Schemas ────────────────
type Callback<T extends (...args: never[]) => unknown> = (...args: Parameters<T>) => void;

// ───────────────── BLOCK 3: Component / Service ────────────────
export function useCallbackRef<T extends (...args: never[]) => unknown>(
  callback: T | undefined
): Callback<T> {
  const callbackRef = React.useRef(callback);

  React.useEffect(() => {
    callbackRef.current = callback;
  });

  return React.useMemo(
    () =>
      (...args: Parameters<T>) => {
        return callbackRef.current?.(...args);
      },
    []
  );
}
