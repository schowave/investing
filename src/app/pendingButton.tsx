"use client";

import { useFormStatus } from "react-dom";

/** Absendeknopf, der während der Server-Aktion gesperrt ist und anzeigt, dass gearbeitet wird. */
export function PendingButton(props: { label: string; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={props.className} disabled={pending} aria-busy={pending}>
      {pending ? props.pendingLabel : props.label}
    </button>
  );
}
