# Durak · Training Edition

Kleine lokale Web-App ohne Bibliotheken, Installation von Paketen oder Backend. 36 Karten, ein Mensch, zwei Bots. Alle Spielinformationen bleiben im Browser. Beim Öffnen oder Neuladen erscheint immer die Setup-Ansicht. Erst **Runde starten** erzeugt und verteilt Karten. **Neue Runde** führt zurück zum Setup; Bot-Stärke, Tempo, Training, Level und Audio bleiben voreingestellt.

## Audio

Unter **Audio** stehen Musik und Soundeffekte mit getrennten Schaltern und Lautstärken bereit (Musik 15 %, Effekte 65 %). Freischaltung erfolgt beim ersten echten Tippen/Klicken. Nach Rückkehr aus dem Hintergrund gegebenenfalls erneut tippen. Die bereitgestellte Musik und Kartenaufnahmen sind eingebunden; `win.mp3` und `lose.mp3` fehlen noch und bleiben harmlos stumm. Exakte Ordner, Dateinamen, Quellenzuordnung und iPhone-Prüfschritte: **[AUDIO.md](AUDIO.md)**.

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

Oben im Spiel unter **Gegner** zwischen **Anfänger**, **Amateur**, **Profi** und **Meister** wählen. Die Änderung gilt sofort für den nächsten Zug beider Bots. Architektur, Level-Grenzen, Suchlimits und Kalibrierung: **[BOTS-COACH.md](BOTS-COACH.md)**. Die Spielregeln bleiben unverändert.

Die Engine bestimmt ausschließlich die legalen Aktionen. `chooseAction(observation, level)` wählt eine davon. Ein zusätzlicher Eingabefilter liest nur eigene Karten, Tisch, Trumpffarbe, Spieleranzahlen und öffentliche Ereignisse; gegnerische Hände, Stapelreihenfolge und Trainings-Aufdeckungen werden nicht gelesen. Die Zahl verbliebener Stapelkarten lässt sich für das Endspiel aus 36 minus öffentlichen Kartenanzahlen ableiten. Anfänger liest weder Historie noch Ablagestapel.

Amateur addiert gewichtete Merkmale, auch für Passen und Aufnehmen. Der höchste Score gewinnt. Sichtbar aufgenommene Karten werden beim Ausspielen vergessen. Unbekannte Karten bleiben ein gemeinsamer Möglichkeitsraum; die geschätzte Chance einer fehlenden Gegenkarte ist ausdrücklich keine Gewissheit und keine vollständige Gegnerhand-Rekonstruktion. Eine Aufnahme gibt nur ein kleines, unsicheres Farbschwäche-Indiz; eine später ausgespielte Karte der Farbe löscht dieses Indiz. Wiederholte eigene Eröffnungen erhalten einen Malus gegen Aufnahme-Schleifen.

Wichtigste Amateur-Gewichte (`src/bots/weights.js`):

| Faktor | Beitrag |
| --- | --- |
| Angriff / erfolgreiche Verteidigung | +10 / +30 |
| Niedriger Nicht-Trumpf / hohen Nicht-Trumpf loswerden | bis +8 / bis +4 |
| Weiterer gleicher Rang, soweit Nachwerfen plausibel ist | +10 je Karte |
| Fehlende Abwehr geschätzt aus öffentlichen Informationen | bis +22 |
| Bekannte Gegenkarte | −12 |
| Trumpf einsetzen | −12 |
| Hoher Trumpf | zusätzlich bis −24, quadratisch nach Rang |
| Letzter oder vorletzter eigener Trumpf | zusätzlich −14 |
| Abgelegte Trümpfe | bis −6 zusätzlicher Reserveschutz |
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
2. **Jetzt prüfen** öffnet auf ausdrücklichen Wunsch einen Check; nach einer abgeschlossenen Runde erscheint zusätzlich ein unaufdringlicher Hinweis. Während eines Checks pausiert das Spiel; die kurzen Merkmeldungen unterbrechen den Spielfluss nicht. **Überspringen**, **Weiterspielen** oder Training AUS setzt es fort. Überspringen zählt nicht als Fehler.
3. **Level 1:** J/Q/K/A wählen, die sicher auf dem Ablagestapel liegen, dann **Prüfen**. Keine Auswahl bedeutet „keiner“.
4. **Level 2:** Zusätzlich die Zahl 0–5 für die Zahlentrümpfe **6–10** wählen. `3 J Q` bedeutet drei Zahlentrümpfe und J/Q abgelegt. Karten auf dem Tisch oder aufgenommene Karten zählen niemals als raus.
5. **Level 3A / 3B:** Das Spiel wählt automatisch höchstens eine bzw. zwei relevante bekannte Karten pro Gegner. Es zeigt neue Merkkarten 1,9 Sekunden lang. Erst nach weiteren 2–4 öffentlichen Spielaktionen folgt eine überspringbare Frage mit vier Antwortmöglichkeiten. 3B fragt jeweils eine Karte; die zweite aktive Merkkarte wird nicht als falsche Antwort angeboten. Rückmeldung dauert 1,3 Sekunden, dann geht das Spiel weiter.
6. **Level 4:** Pro Gegner Farben als **vermutlich schwach oder leer** markieren. Erneutes Antippen entfernt eine Markierung. Gelbe Vermutungen sind keine sicheren Karteninformationen; sie werden nicht automatisch als bewiesen behandelt oder bewertet. Frühere Level bleiben verfügbar.

**Analyse / Kontrolle** und Augen folgen dem Trainingslevel. Die Stapelübersicht zeigt bei Training AN unabhängig vom Level alle tatsächlich abgelegten Karten. Level 1 zeigt hohe Trümpfe, Level 2 zusätzlich die Zahl 0–5, Level 3 bekannte Gegnerkarten und Level 4 vermutete Farb-Schwächen. Die Augen zeigen ab Level 3 nur bekannte Aufnahmekarten und die unbekannte Kartenanzahl für acht Sekunden; echte verdeckte Hände werden nie angezeigt. Während einer Merkkartenfrage ist das Auge des betroffenen Gegners gesperrt. Analyse und Stapelkontrolle pausieren während Checks; vorherige Aufdeckungen werden geschlossen.

### Statistik und Trennung

`trainingStats.js` speichert ausschließlich Statistik unter `durak.training.stats.v1` in `localStorage`: Anzahl Checks, richtige Antworten, Trefferquote und aktuelle/beste Serie global sowie je Level. Ein Check zählt zum beim Öffnen gewählten Level, auch wenn er eine Fähigkeit aus einem früheren Level übt. Vermutungen und übersprungene Fragen zählen nicht. Mehrfaches Prüfen derselben Frage wird verhindert. Bei gesperrtem Speicher bleibt die Statistik für die Sitzung nutzbar; fehlerhafte gespeicherte Daten werden verworfen.

Quizantworten, Merkkarten und Vermutungen gehören nie zum Engine-Zustand und werden nie an Bots übergeben. `trainingUI.js` bekommt nur `observation(state, 0)`. Die Augen verwenden ausschließlich die levelgefilterte öffentliche Wissensbasis; verdeckte Karten fließen weder in Anzeige, Quizlösungen noch Trainings- oder Bot-Selektoren. Statistiken und globale Einstellungen einschließlich Level-Auswahl überleben einen Neustart; Spielstand, Merkkarten und Vermutungen sind sitzungsbezogen. Ein neues Spiel löscht die Merkkarten/Vermutungen, erhält aber gewähltes Level und Statistik.

### Später Level 5–7 ergänzen

- **`trainingLevels.js`:** neue Level und ihre kumulativen Fähigkeiten registrieren.
- **`trainingSelectors.js`:** zusätzliche rein öffentliche Übungsdaten ableiten.
- **`trainingState.js`:** neue Übungsnotizen und deren öffentliche Ereignisbehandlung ergänzen.
- **`trainingEvaluation.js`:** neue Check-Typen und deren Bewertung hinzufügen.
- **`trainingStats.js`:** Statistikversion bei Schema-Erweiterung erhöhen und gespeicherte ältere Level migrieren.
- **`trainingUI.js`:** passende, durch Fähigkeiten freigeschaltete Bedienung ergänzen.

Die Engine und Bot-Strategien müssen dafür nicht verändert werden. Level 5–7, vollständige Handrekonstruktion und Cloud-Synchronisation sind nicht implementiert. Der regelbasierte Coach ist in BOTS-COACH.md beschrieben.

## PWA und iPhone

Auf dem PC ist `localhost` ein sicherer Kontext. Der Service Worker speichert die App beim ersten vollständigen Laden; danach ist sie offline nutzbar. Der Spielstand selbst wird nicht gespeichert. Der Production-Build erzeugt automatisch eine Cache-Version aus allen ausgelieferten Inhalten. Neue Versionen werden im Hintergrund vollständig geladen und nach Schließen aller App-Fenster aktiviert, ohne eine laufende Partie zu unterbrechen. Für Änderungen am lokalen Entwicklungsserver die `development`-Version in `dist/sw.js` erhöhen.

Für das iPhone im gleichen WLAN ist die Oberfläche unter `http://<Windows-IP>:5173` erreichbar, sofern die Windows-Firewall den Zugriff erlaubt. **Für eine installierbare Offline-PWA auf dem iPhone ist HTTPS erforderlich.** GitHub Pages stellt HTTPS bereit. Die veröffentlichte Adresse in Safari öffnen, einmal vollständig laden (unter Spielregeln & Installation steht dann „Offline-Unterstützung aktiv“), anschließend **Teilen → Zum Home-Bildschirm**. Falls angeboten, **Als Web-App öffnen** aktivieren. Danach lässt sich die App ohne Internet starten und eine neue Partie spielen. Vorhandene Spielstände überleben weiterhin keinen Neustart; Statistiken sind lokal je Browser/Installation gespeichert.

Es werden ausschließlich die notwendigen statischen App-Dateien vorab gespeichert. Kein Laufzeit-Cache für fremde URLs, API-Antworten oder beliebige Anfragen. Cache-Namen enthalten den App-Scope, sodass andere Projekte derselben GitHub-Pages-Domain nicht gelöscht werden. Die echte iPhone-Installation ist nach dem ersten Deployment auf dem Gerät zu prüfen.

## GitHub Pages

Repository: https://github.com/DanielBu11/Durak-Trainer

Erwartete URL: **https://danielbu11.github.io/Durak-Trainer/**

Es wird kein Vite und kein Client-Side-Router verwendet. Alle HTML-, Modul-, Manifest- und Service-Worker-Verweise sind relativ und funktionieren unter `/Durak-Trainer/`. Reloads der Startseite brauchen deshalb keinen 404-Redirect. Die URL mit abschließendem `/` verwenden.

### Production lokal prüfen

```powershell
cd C:\Users\danie\Documents\Automaten\durak
npm.cmd ci --ignore-scripts --no-audit --no-fund
npm.cmd run build
npm.cmd test
npm.cmd run preview
```

Dann **http://localhost:4173/Durak-Trainer/** öffnen. Die Vorschau liefert nur den gebauten `_site/`-Ordner aus und emuliert den Pages-Unterpfad. `dist/` enthält weiterhin die bearbeitbaren statischen Quelldateien; `src/` die Module. Der Build kopiert beide zusammen nach `_site/`, erstellt `.nojekyll` und erzeugt die vollständige Offline-Dateiliste samt Inhaltsversion. `_site/` ist generiert und wird nicht eingecheckt. Es gibt keine npm-Abhängigkeiten; die Lockdatei ermöglicht trotzdem ein reproduzierbares `npm ci` im Workflow.

### GitHub-Einstellung (einmalig, vor dem ersten Push)

1. Im Repository **Settings → Pages** öffnen.
2. Unter **Build and deployment → Source** genau **GitHub Actions** auswählen.
3. Keine Branch-/Ordnerquelle und keinen zusätzlichen Workflow auswählen. **Custom domain** leer lassen; **Enforce HTTPS** aktiviert lassen bzw. aktivieren, sobald verfügbar.
4. Danach die unten genannten Änderungen auf `main` pushen. Unter **Actions → Deploy GitHub Pages** den Lauf prüfen. Alternativ dort **Run workflow → main → Run workflow** verwenden.

`.github/workflows/pages.yml` installiert mit `npm ci`, baut, führt sämtliche Tests aus und deployed erst nach Erfolg. Verwendet werden die offiziellen `configure-pages`, `upload-pages-artifact` und `deploy-pages` Actions mit dem Environment `github-pages`. Es wird kein Personal Access Token und kein `gh-pages`-Branch benötigt. Bei Repository-Regeln muss GitHub Actions erlaubt sein und das Environment Deployments von `main` zulassen.

### Commit und Push

Remote `origin` zeigt bereits auf das oben genannte Repository, der aktuelle Branch ist `main`.

```powershell
cd C:\Users\danie\Documents\Automaten\durak
git status
git add .github/workflows/pages.yml .gitignore package.json package-lock.json scripts/build.mjs scripts/preview.mjs tests/deployment.test.js dist/sw.js dist/manifest.webmanifest README.md
git commit -m "Configure GitHub Pages build and offline PWA"
git push -u origin main
```

Referenz: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Automatische Merkkarten und Setup

`src/training/automaticMemory.js` liest nur öffentliche Aufnahme-/Ausspielereignisse und Kartenanzahlen. Trümpfe erhalten 100 Punkte plus 8 pro Rangstufe, Farbkarten nur Rangpunkte. Nicht-Trümpfe unter 10 werden zunächst ausgelassen. Bestehende Merkkarten bleiben, bis sie ausgespielt werden oder eine neue Karte mindestens 16 Punkte wichtiger ist. 3A hat Kapazität 1, 3B Kapazität 2, zusätzlich begrenzt durch bekannte Karten und öffentliche Handanzahl. Level 4 übernimmt 3A mit seinen bisherigen Farb-Schwächen.

`src/ui/memoryUI.js` steuert kurze Hinweise, verzögerte Fragen, Feedback und abbrechbare Timer. Neue Fragen warten auch nach einer beantworteten oder übersprungenen Frage erneut einige Aktionen. Bei Training AUS, Levelwechsel, Spielende und neuer Partie wird abgebrochen. Replay speichert Merkkarten mit; alte Timer werden verworfen. Statistik nach 3A/3B und Uhu/Aal liegt unter `durak.memory.stats.v1` lokal im Browser.

`src/ui/setup.js` speichert ausschließlich Einstellungen unter `durak.game.settings.v1`. Ohne expliziten Start existieren weder Runde noch Bot-Aufträge. 3A/3B sind zwei Varianten derselben Wissensstufe 3; der Coach und die übrigen Level-Grenzen ändern sich dadurch nicht.
