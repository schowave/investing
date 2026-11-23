# comdirect REST API: was die Anbindung braucht

Nachschlagewerk für `src/comdirect/api.ts` (Spezifikation 6.1). Quellen: Schnittstellenspezifikation der comdirect (PDF, Stand
April 2020, https://kunde.comdirect.de/cms/media/comdirect_REST_API_Dokumentation.pdf) und Swagger 20.04
(https://kunde.comdirect.de/cms/media/comdirect_rest_api_swagger.json, die genauere Quelle für Schemas). „Clients“ meint
verbreitete Open-Source-Clients (go-comdirect, comdirect-mcp, mcdax/comdirect-python-library), Stand November 2026.

## Ablauf

| Schritt           | Aufruf                                                                                                                                                | Hinweis                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Anmeldung         | `POST /oauth/token`, Formular `grant_type=password`, `username` (Zugangsnummer), `password` (PIN)                                                     | ohne `/api`; Token mit Scope `TWO_FACTOR`                                                                            |
| Sitzung           | `GET /api/session/clients/user/v1/sessions`                                                                                                           | Antwort ist ein nacktes Array; `[0].identifier`                                                                      |
| TAN anfordern     | `POST …/sessions/{identifier}/validate`, Body `{identifier, sessionTanActive: true, activated2FA: true}`                                              | Header `x-once-authentication-info: {"typ":"P_TAN_PUSH"}` wählt ein Verfahren; Antwort 201 (Doku) oder 200 (Swagger) |
| Anforderung lesen | Antwortheader `x-once-authentication-info`: `id`, `typ`, `challenge` (photoTAN: Base64-PNG), `availableTypes`, `link`                                 | `link.href` fehlt in der Doku, alle Clients nutzen es                                                                |
| pushTAN abfragen  | `GET {link.href}` → `{"status":"PENDING"}` bis `"AUTHENTICATED"`                                                                                      | nicht dokumentiert; andere Werte gelten als abgelehnt                                                                |
| TAN freigeben     | `PATCH …/sessions/{identifier}`, Header `x-once-authentication-info: {"id":"…"}` (nur die id), bei photoTAN zusätzlich `x-once-authentication: <TAN>` | bei pushTAN ohne TAN-Header (Doku 2.4)                                                                               |
| Freischalten      | `POST /oauth/token`, `grant_type=cd_secondary`, `token=<Token der Anmeldung>`                                                                         | Scopes für Konten und Depot                                                                                          |
| Depots            | `GET /api/brokerage/clients/user/v3/depots`                                                                                                           | `depotId`, `depotDisplayId`, `defaultSettlementAccountId`, `settlementAccountIds`                                    |
| Positionen        | `GET /api/brokerage/v3/depots/{depotId}/positions?with-attr=instrument`                                                                               | keine Paging-Parameter; `paging.matches` gegen `values.length` prüfen                                                |
| Salden            | `GET /api/banking/clients/user/v2/accounts/balances`                                                                                                  | Barbestand ist `balanceEUR`, nicht `availableCashAmountEUR` (enthält den Dispo)                                      |
| Ende              | `DELETE /oauth/revoke`                                                                                                                                | Fehler egal                                                                                                          |

Jeder Aufruf nach der Anmeldung trägt `x-http-request-info: {"clientRequestId":{"sessionId":"<32 Hexzeichen>","requestId":"<9 Ziffern>"}}`;
`sessionId` bleibt für die Sitzung gleich, `requestId` ist je Aufruf eindeutig (Doku: `HHmmssSSS`).

## Daten

- Beträge sind `{"value": "<Dezimal als Text>", "unit": "EUR"}`, Punkt als Dezimaltrenner.
- `instrument.staticData.instrumentType`: `SHARE`, `BONDS`, `SUBSCRIPTION_RIGHT`, `ETF`, `PROFIT_PART_CERTIFICATE`, `FUND`,
  `WARRANT`, `CERTIFICATE`, `NOT_AVAILABLE`. Nur `SHARE` gilt als Aktie.
- Offen: ob `defaultSettlementAccountId` die Kontokennung (`accountId`) oder die Kontonummer (`accountDisplayId`) ist; der
  Client vergleicht mit beidem.

## Grenzen der Bank

- Fünf TAN-Anforderungen ohne Freigabe dazwischen sperren das Online-Banking; jedes `validate` zählt, auch ein Wechsel des
  Verfahrens. Die Anwendung hört nach drei auf.
- Drei falsche TANs sperren ebenfalls; eine TAN nie automatisch wiederholen.
- Token gelten 599 Sekunden; das Refresh-Token laut einem Client 20 Minuten (nicht dokumentiert).
- Ratenlimit laut go-comdirect 10 Anfragen je Sekunde (nicht dokumentiert).

## Zugangsdaten

Client-ID und Secret gibt es nach der Registrierung im Persönlichen Bereich (Verwaltung → „Verwendung des comdirect REST API“).
Ein Wert, den die Bank nicht als Client-ID erkennt (etwa ein unaufgelöstes `$(creds read …)`), endet mit einer HTML-Seite
„403 Forbidden“ vom vorgeschalteten nginx, nicht mit JSON.
