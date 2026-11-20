# Mission: Strategie „Rückflussrendite" verstehen

## Why
David betreibt eine Anwendung, die Dividendenaktien nach ihrer inneren Rendite bewertet und daraus ein Zielportfolio
ableitet. Er will die Strategie dahinter verstehen: was die Rechnung über Aktien aussagt und warum bestimmte
Entscheidungen so getroffen wurden. Der Code ist dabei nicht das Ziel.

## Success looks like
- Bei einer Aktie in der Anwendung erklären, was die angezeigte innere Rendite bedeutet und was sie bewegt.
- Für jede Annahme der Spezifikation (Abschmelzen, Ausfallwahrscheinlichkeit, steigende Ausschüttungsquote) sagen,
  welches Problem sie löst und welche Alternative es gäbe.
- Beurteilen, ob eine Rendite plausibel ist, und Eingaben begründet übersteuern.

## Constraints
- Anfänger in Aktienbewertung und Finanzmathe; Numerik (Bisektion) ist kein Problem.
- Lektionen auf Deutsch, kurz, mit Bezug auf die Zahlen in der eigenen Anwendung.
- Fachliche Grundlage: `docs/SPEZIFIKATION.md` und `docs/Recherche-Bewertungsansatz.md` im Repo.

## Out of scope
- Der TypeScript-Code (`src/calc/`) als Programmierthema.
- Portfolio-Bau und Positionsgrößen, bis die Rendite einer einzelnen Aktie sitzt.
