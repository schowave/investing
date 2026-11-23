"use client";

import { useEffect, useRef } from "react";

/**
 * Kästchen im Tabellenkopf, das alle Kästchen mit demselben Namen im umgebenden Formular an- oder abwählt. Es folgt auch der
 * Auswahl einzelner Zeilen: angehakt, wenn alle gewählt sind, „teilweise“, wenn nur manche.
 */
export function SelectAll({ name, label }: { name: string; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const own = ref.current;
    const form = own?.form;
    if (!own || !form) return;
    const boxes = () => [...form.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`)];
    const sync = () => {
      const chosen = boxes().filter((box) => box.checked).length;
      own.checked = chosen > 0 && chosen === boxes().length;
      own.indeterminate = chosen > 0 && chosen < boxes().length;
    };
    form.addEventListener("change", sync);
    sync();
    return () => form.removeEventListener("change", sync);
  }, [name]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      onChange={(event) => {
        const { form, checked } = event.currentTarget;
        for (const box of form?.querySelectorAll<HTMLInputElement>(`input[type="checkbox"][name="${name}"]`) ?? []) {
          box.checked = checked;
        }
      }}
    />
  );
}
