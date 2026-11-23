"use client";

/** Öffnet den Druckdialog; als PDF gespeichert ist das die Fassung für Leser ohne Zugang zur Anwendung. */
export function PrintButton() {
  return (
    <button type="button" className="quiet small" onClick={() => window.print()}>
      Drucken oder als PDF sichern
    </button>
  );
}
