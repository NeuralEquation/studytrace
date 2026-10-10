import type { ComponentProps } from "react";
import { useViewState } from "../features/navigation/useViewState";

export function RememberedDetails({
  viewKey,
  defaultOpen = false,
  children,
  ...props
}: Omit<ComponentProps<"details">, "open" | "onToggle"> & {
  viewKey: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useViewState(viewKey, defaultOpen);
  return (
    <details
      {...props}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      {children}
    </details>
  );
}
