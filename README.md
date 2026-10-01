# Durak · Training Edition

Kleine lokale Web-App ohne Bibliotheken, Installation von Paketen oder Backend. 36 Karten, ein Mensch, zwei Bots. Alle Spielinformationen bleiben im Browser. Ein Neuladen beginnt eine neue Partie.

## Windows starten

Voraussetzung: Node.js 20 oder neuer.

1. `start.cmd` doppelklicken.
2. Im Browser **http://localhost:5173** öffnen.
3. Zum Beenden im geöffneten Fenster Strg+C drücken.

Alternativ in PowerShell:

```powershell
cd C:\Users\danie\Documents\Automaten\durak
npm.cmd start
```

Tests: `npm.cmd test` oder `node --test`. Kein `npm install` notwendig. Der Server liefert nur Dateien aus; die Spiellogik läuft vollständig im Browser. `PORT` kann einen anderen Port festlegen.

## Dateien

| Datei | Aufgabe |
| --- | --- |
| `src/game/cards.js` | Kartensatz, Mischen, Schlagregeln |
| `src/game/engine.js` | Zustandsautomat, legale Aktionen, Nachziehen, Ausscheiden, öffentliche Bot-Sicht |
| `src/ui/app.js` | Kartenansicht, Bedienung, Bot-Takt und temporäres Aufdecken |
| `src/bots/strategy.js` | Einheitlicher Einstieg, deterministische Auswahl und `explainDecision()` |
| `src/bots/view.js` | Explizite Positivliste erlaubter Eingaben; keine verdeckten Felder |
| `src/bots/beginner.js` | Einfache günstige Züge, ohne Historie oder Kartenzählen |
| `src/bots/amateur.js` | Additive Bewertung aller legalen Aktionen einschließlich Aufnehmen und Passen |
| `src/bots/knowledge.js` | Sichtbare Aufnahmen, ausgespielte Karten, vorsichtige Schwäche-Indizien |
| `src/bots/weights.js`, `src/bots/scoring.js` | Benannte Gewichte und nachvollziehbare Score-Beiträge |
| `src/training/analysis.js` | Öffentliche Kartenanalyse und Gedächtnis-Daten |
| `src/training/trainingLevels.js` | Level 1–4 und kumulative Funktionsfreigaben |
| `src/training/trainingState.js` | Separater Trainingszustand, eine gemerkte Karte je Gegner, Vermutungen |
| `src/training/trainingSelectors.js` | Lösungen und Merkkandidaten aus öffentlichem Spielwissen |
| `src/training/trainingEvaluation.js` | Eingefrorene Quizfragen und reine Antwortauswertung |
| `src/training/trainingStats.js` | Lokale Statistiken, Serien und sichere Speicherung |
| `src/ui/trainingUI.js` | Trainingsoberfläche, Kontrollpanel und Pausensteuerung |
| `tests/training.test.js` | Trainingsregeln, Statistik und Trennung von Engine/Bots |
| `dist/index.html`, `dist/style.css` | Responsive Oberfläche für Touch und Desktop |
| `dist/manifest.webmanifest`, `dist/sw.js`, `dist/icons/` | Installation und Offline-Dateien |
| `server.mjs`, `start.cmd` | Lokaler Dateiserver und Windows-Start |
| `tests/` | Regeltests und 200 reproduzierbare Bot-Partien |
| `scripts/benchmark-bots.mjs` | Reproduzierbarer Vergleich gegen zufällige legale Züge |

## Regeln und Bedienung

- Durak mit Nachwerfen, ohne Überschieben. Der Besitzer des niedrigsten ausgeteilten Trumpfs beginnt. Falls kein Trumpf ausgeteilt wurde, beginnt der Mensch.
- Angreifer legen einzeln, der Verteidiger antwortet. Danach erhalten der ursprüngliche Angreifer und anschließend weitere Angreifer im Uhrzeigersinn Nachwurfgelegenheiten.
- Ein Passen gilt bis zur nächsten gelegten Angriffskarte; damit kann man nach einer neuen Karte wieder nachwerfen. Sobald alle Angreifer passen oder keine Karten mehr haben, endet die Runde.
- Verteidigungswerte zählen ebenfalls zum Nachwerfen. Nach „Aufnehmen“ darf bis zur ursprünglichen Angriffsgrenze nachgeworfen werden.
- Höchstens sechs Angriffe, zusätzlich begrenzt durch die Handgröße des Verteidigers zu Beginn der Runde; diese Grenze ändert sich nicht während der Runde.
- Nachziehen zuerst beim ursprünglichen Angreifer, dann im Uhrzeigersinn, Verteidiger zuletzt. Bei erfolgreicher Verteidigung greift dieser als Nächstes an, nach Aufnahme wird er übersprungen. Ausgeschiedene Spieler werden übersprungen.
- Ausscheiden wird nach Rundenabschluss und Nachziehen ermittelt. Sind alle Hände gleichzeitig leer, ist es unentschieden; ansonsten ist der letzte Spieler mit Karten Durak.
- Spielbare Handkarten sind hervorgehoben. Verteidigen: passende Handkarte anklicken; falls mehrere Ziele möglich sind, danach die gewünschte Angriffskarte wählen.
- „Weiter“ führt bei manuellem Tempo genau eine Bot-Aktion aus. Nach deinem Ausscheiden kannst du die Bots weiter beobachten.
- Schwierigkeit und Tempo können während der Partie geändert werden und gelten für beide Bots.

## Bot-Architektur und Debugging

Oben im Spiel unter **Gegner** zwischen **Anfänger** und **Amateur** wählen. Die Änderung gilt sofort für den nächsten Zug beider Bots. Die Oberfläche und die Spielregeln wurden für diese Bot-Iteration nicht verändert.

Die Engine bestimmt ausschließlich die legalen Aktionen. `chooseAction(observation, level)` wählt eine davon. Ein zusätzlicher Eingabefilter liest nur eigene Karten, Tisch, Trumpffarbe, Spieleranzahlen und öffentliche Ereignisse; gegnerische Hände, Stapelreihenfolge und Trainings-Aufdeckungen werden nicht gelesen. Die Zahl verbliebener Stapelkarten lässt sich für das Endspiel aus 36 minus öffentlichen Kartenanzahlen ableiten. Anfänger liest weder Historie noch Ablagestapel.

Amateur addiert gewichtete Merkmale, auch für Passen und Aufnehmen. Der höchste Score gewinnt. Sichtbar aufgenommene Karten werden beim Ausspielen vergessen. Unbekannte Karten bleiben ein gemeinsamer Möglichkeitsraum; die geschätzte Chance einer fehlenden Gegenkarte ist ausdrücklich keine Gewissheit und keine vollständige Gegnerhand-Rekonstruktion. Eine Aufnahme gibt nur ein kleines, unsicheres Farbschwäche-Indiz; eine später ausgespielte Karte der Farbe löscht dieses Indiz. Wiederholte eigene Eröffnungen erhalten einen Malus gegen Aufnahme-Schleifen.

Wichtigste Amateur-Gewichte (`src/bots/weights.js`):

| Faktor | Beitrag |
| --- | --- |
| Angriff / erfolgreiche Verteidigung | +10 / +30 |
| Niedriger Nicht-Trumpf / hohen Nicht-Trumpf loswerden | bis +8 / bis +4 |
| Weiterer gleicher Rang, soweit Nachwerfen plausibel ist | +10 je Karte |
| Fehlende Abwehr geschätzt aus öffentlichen Informationen | bis +22 |
| Sicher bekannte Gegenkarte | −12 |
| Trumpf einsetzen | −12 |
| Hoher Trumpf | zusätzlich bis −24, quadratisch nach Rang |
| Letzter oder vorletzter eigener Trumpf | zusätzlich −14 |
| Sicher abgelegte Trümpfe | bis −6 zusätzlicher Reserveschutz |
| Schwaches Indiz für Farbschwäche | +3, maximal +6 |
| Aufnehmen | −6 und −3 je sichtbarer Tischkarte |
| Aufnehmen bei leerem Stapel | zusätzlich −55 |
| Letzte eigene Karte bei leerem Stapel abgeben | +90 |

Standardmäßig sind Entscheidungen komplett deterministisch; Gleichstände löst eine stabile Sortierung. Optional kann `{rng: seededRandom}` als drittes Argument übergeben werden. Das beeinflusst ausschließlich exakte Gleichstände.

```js
import {observation} from './src/game/engine.js';
import {chooseAction, explainDecision} from './src/bots/strategy.js';

const view = observation(state); // state ist dein vorhandener Engine-Spielzustand
const action = chooseAction(view, 'amateur');
const debug = explainDecision(view, 'amateur');
console.log(debug.action, debug.card, debug.score, debug.reasons);
console.table(debug.alternatives.map(a => ({
  ...a.action, score: a.score,
  reasons: a.reasons.map(r => `${r.factor}: ${r.points}`).join('; '),
})));
```

`debug.reasons` zeigt die fünf stärksten Beiträge der gewählten Aktion. Jede Alternative enthält sämtliche Beiträge; deren Summe ergibt exakt ihren Score. Keine legalen Aktionen ergeben `action: null`. Debug-Daten verändern weder Engine noch Auswahl und sind nicht mit dem Trainingsmodus gekoppelt.

Tests: `npm.cmd test`. Optionaler Vergleich: `npm.cmd run benchmark` (90 feste Partien pro Strategie, über alle drei Sitzpositionen; Gegner wählen gleichverteilt unter legalen Aktionen). Das ist ein reproduzierbarer Plausibilitätsvergleich, keine allgemeine Spielstärke-Garantie.

Ergebnis dieser Bot-Iteration: Zufallsstrategie 25/90-mal Durak, Anfänger 2/90, Amateur 0/90 (ein Unentschieden). Diese Werte gelten nur für den beschriebenen Vergleich gegen gleichverteilte Zufallszüge.

## Trainingsarchitektur

Die Engine führt öffentliche `play`, `pickup`, `discard` und `out`-Ereignisse. `observation()` entfernt gegnerische Hände und die Stapelreihenfolge. Nur diese Beobachtung wird an Bots übergeben. Das Aufdecken ist ein separater, zeitlich begrenzter UI-Zustand und fließt nicht in Bot-Entscheidungen ein.

`analyzePublicCards()` rekonstruiert sicher bekannte aufgenommene Karten und entfernt sie beim Ausspielen. Aufnahmeverlauf und aktuelles Wissen sind getrennt. „Trümpfe im Spiel“ bedeutet alle nicht abgelegten Trümpfe, auch auf dem Tisch oder im Stapel.

### Level 1–4 verwenden

1. Oben **Training AN** einschalten und unter der Hand das gewünschte **Trainingslevel** auswählen. Standardmäßig ist Training AUS. Es gibt keine automatischen Quiz-Popups.
2. **Jetzt prüfen** öffnet auf ausdrücklichen Wunsch einen Check; nach einer abgeschlossenen Runde erscheint zusätzlich ein unaufdringlicher Hinweis. Während eines Checks oder der Merkkartenauswahl pausiert das Spiel. **Überspringen**, **Weiterspielen** oder Training AUS setzt es fort. Überspringen zählt nicht als Fehler.
3. **Level 1:** J/Q/K/A wählen, die sicher auf dem Ablagestapel liegen, dann **Prüfen**. Keine Auswahl bedeutet „keiner“.
4. **Level 2:** Zusätzlich die Zahl 0–5 für die Zahlentrümpfe **6–10** wählen. `3 J Q` bedeutet drei Zahlentrümpfe und J/Q abgelegt. Karten auf dem Tisch oder aufgenommene Karten zählen niemals als raus.
5. **Level 3:** Nach einer sichtbaren Gegneraufnahme über **Karte merken** genau eine bekannte Karte dieses Gegners auswählen. Empfehlung: Trumpf vor A/K/Q/J, danach übrige Karten. Die Wahl ist frei und ersetzt eine bisherige Merkkarte. **Karte abfragen** prüft Farbe und Rang, ohne die Lösung vorab zu zeigen. Sobald die Karte öffentlich ausgespielt wird, verschwindet sie automatisch aus dem Trainingsspeicher, auch bei vorübergehend ausgeschaltetem Training.
6. **Level 4:** Pro Gegner Farben als **vermutlich schwach oder leer** markieren. Erneutes Antippen entfernt eine Markierung. Gelbe Vermutungen sind keine sicheren Karteninformationen; sie werden nicht automatisch als bewiesen behandelt oder bewertet. Frühere Level bleiben verfügbar.

Unter **Analyse / Kontrolle** sind Ablage, verbleibende Trümpfe, öffentliche Aufnahmen, noch sicher gehaltene Karten und eigene Merkkarten nachsehbar. **Gegnerhand aufdecken** zeigt die aktuelle Hand am Tisch für acht Sekunden. Auch die Augen-Buttons bleiben verfügbar. Während einer offenen Quizfrage werden Aufdeckfunktionen gesperrt; vorherige Aufdeckungen werden geschlossen.

### Statistik und Trennung

`trainingStats.js` speichert ausschließlich Statistik unter `durak.training.stats.v1` in `localStorage`: Anzahl Checks, richtige Antworten, Trefferquote und aktuelle/beste Serie global sowie je Level. Ein Check zählt zum beim Öffnen gewählten Level, auch wenn er eine Fähigkeit aus einem früheren Level übt. Vermutungen und übersprungene Fragen zählen nicht. Mehrfaches Prüfen derselben Frage wird verhindert. Bei gesperrtem Speicher bleibt die Statistik für die Sitzung nutzbar; fehlerhafte gespeicherte Daten werden verworfen.

Quizantworten, Merkkarten und Vermutungen gehören nie zum Engine-Zustand und werden nie an Bots übergeben. `trainingUI.js` bekommt nur `observation(state, 0)`. Das bewusste Aufdecken läuft separat im UI über einen Callback; verdeckte Karten fließen weder in Quizlösungen noch Trainings- oder Bot-Selektoren. Nur die Statistik überlebt einen Neustart; Spielstand, Merkkarten, Vermutungen und Level-Auswahl sind sitzungsbezogen. Ein neues Spiel löscht die Merkkarten/Vermutungen, erhält aber gewähltes Level und Statistik.

### Später Level 5–7 ergänzen

- **`trainingLevels.js`:** neue Level und ihre kumulativen Fähigkeiten registrieren.
- **`trainingSelectors.js`:** zusätzliche rein öffentliche Übungsdaten ableiten.
- **`trainingState.js`:** neue Übungsnotizen und deren öffentliche Ereignisbehandlung ergänzen.
- **`trainingEvaluation.js`:** neue Check-Typen und deren Bewertung hinzufügen.
- **`trainingStats.js`:** Statistikversion bei Schema-Erweiterung erhöhen und gespeicherte ältere Level migrieren.
- **`trainingUI.js`:** passende, durch Fähigkeiten freigeschaltete Bedienung ergänzen.

Die Engine und Bot-Strategien müssen dafür nicht verändert werden. Level 5–7, Handrekonstruktion, KI-Coaching und Cloud-Synchronisation sind nicht implementiert.

## PWA und iPhone

Auf dem PC ist `localhost` ein sicherer Kontext. Der Service Worker speichert die App beim ersten Laden; danach ist sie offline nutzbar. Der Spielstand selbst wird nicht gespeichert. Bei Änderungen die Cache-Version in `dist/sw.js` erhöhen und alle App-Tabs schließen, damit die neue Version aktiviert wird.

Für das iPhone im gleichen WLAN ist die Oberfläche unter `http://<Windows-IP>:5173` erreichbar, sofern die Windows-Firewall den Zugriff erlaubt. **Für eine installierbare Offline-PWA auf dem iPhone ist HTTPS mit einem vom iPhone vertrauten Zertifikat erforderlich.** Eine HTTP-LAN-Adresse bietet das nicht. Später die statischen Dateien über HTTPS bereitstellen: den Inhalt von `dist/` als Website-Wurzel verwenden und `src/` daneben als Unterordner `src/` kopieren. Kein Backend nötig; Unterpfade werden durch relative URLs unterstützt. Anschließend in Safari: Teilen → Zum Home-Bildschirm.

Die PWA-Dateien und Apple-Touch-Icons sind enthalten. Installation und Offline-Verhalten auf einem echten iPhone müssen nach HTTPS-Bereitstellung geprüft werden. Es wurde nichts veröffentlicht.
