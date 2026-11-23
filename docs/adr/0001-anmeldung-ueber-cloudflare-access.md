# Anmeldung über Cloudflare Access statt in der Anwendung

Die Oberfläche ist über einen Cloudflare-Tunnel öffentlich erreichbar (`investing.schowalter.co`), und mit der wikifolio-Anbindung kann sie Orders auslösen. Die Anmeldung aus Spezifikation 6 (Identitätsanbieter, feste Liste erlaubter E-Mail-Adressen) übernimmt Cloudflare Access vor dem Tunnel; die Anwendung verwaltet keine Benutzer. Vor jeder Order prüft sie zusätzlich das signierte Token von Access (`Cf-Access-Jwt-Assertion`), damit auch ein direkter Aufruf des LXC im Heimnetz keine Order auslösen kann.

## Considered Options

- Anmeldung in der Anwendung (z. B. Auth.js mit OAuth): eigener Code, Sitzungen und Geheimnisse für einen einzigen Nutzer; verworfen.
- Nur Access ohne Prüfung in der Anwendung: der Tunnel ließe sich im Heimnetz umgehen; für lesende Seiten hinnehmbar, für Orders nicht.
