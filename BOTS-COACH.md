# Öffentliche Kartenkenntnis, Bots und Coach

## Bedienung

Unter **Gegner** stehen Anfänger, Amateur, Profi und Meister zur Auswahl; die Einstellung gilt für beide Bots ab ihrem nächsten Zug. **Training AN** schaltet den manuellen Button **Tipp anzeigen** frei. Tipps erscheinen nur auf Wunsch am eigenen Zug und werden bei Zustands- oder Levelwechsel verworfen.

Die Augen zeigen ab Level 3 acht Sekunden lang ausschließlich bekannte, noch nicht wieder ausgespielte Aufnahmekarten und die Anzahl unbekannter Karten. Sie zeigen niemals die vollständige echte Hand. Training AUS blendet Augen, Coach, Kontrolle und Replay aus.

## Datengrenzen

`game/engine.js` behält die echten Hände und den geordneten Nachziehstapel. `observation()` erzeugt eine öffentliche Beobachtung mit eigener Hand, Tisch, Trumpf, Kartenanzahlen, öffentlichen Ereignissen und legalen Aktionen. Neu hinzugekommen ist nur die öffentliche Angriffsgrenze `limit`; die Spielregeln bleiben gleich.

`knowledge/publicGameKnowledge.js` berechnet gemeinsame Fakten aus öffentlichen Aufnahme-/Ausspielereignissen und dem Ablagestapel. Aufnahme fügt bekannte Karten hinzu, sichtbares Ausspielen entfernt sie. Nur tatsächlich abgelegte Karten zählen als raus. Farbschwächen bleiben ausdrücklich Vermutungen. Diese Schicht enthält weder echte Gegnerhände noch zukünftige Stapelkarten.

`bots/view.js` kopiert ausdrücklich erlaubte Felder. Bots erhalten keine Trainingsnotizen oder Augen-Daten. Anfänger liest keine Historie. Profi und Meister verwenden exakt dieselbe öffentliche Information; ihre Verarbeitung unterscheidet sich.

`knowledge/trainingKnowledge.js` und `coach/knowledge.js` bilden eine zweite, engere Grenze für Training, Augen, Kontrollpanel und Coach. Rohe Ereignisse werden nicht an den Coach weitergereicht. Tests verwenden verbotene Getter, die bei einem Zugriff sofort werfen, sowie unterschiedliche verdeckte Deals bei identischer öffentlicher Sicht.

## Freigaben pro Level

Eigene Hand, aktueller Tisch, Trumpffarbe, Kartenanzahlen und legale Aktionen bilden die normale Spielgrundlage.

| Level | Zusätzlich verwendbare Gedächtnisinformation |
| --- | --- |
| 1 | Rausgegangene hohe Trümpfe J, Q, K, A |
| 2 | Anzahl rausgegangener Zahlentrümpfe 0–5; keine einzelnen Identitäten dieser Zahlentrümpfe |
| 3 | Bekannte gegnerische Aufnahmekarten, abzüglich später ausgespielter Karten |
| 4 | Öffentlich abgeleitete und vom Menschen markierte Farb-Schwächen als Vermutungen |

Auch manuelle Kontrolle zeigt nur diese Freigaben. Es gibt in Level 1–4 keine vollständige Liste abgelegter Nicht-Trümpfe. Weitere Level können über `trainingLevels.js` und die Projektion `trainingKnowledge.js` ergänzt werden; Coach-Faktoren und UI müssen passende neue Fähigkeiten ausdrücklich freigeben.

## Strategien und Gewichte

Amateur bleibt die vorhandene additive Bewertung legaler Züge: günstige Verteidigung, Trümpfe sparen, Nachwurfränge, bekannte Antworten, öffentliche Aufnahme-Indizien und Endspiel.

Profi ergänzt die Bewertung der verbleibenden Hand und stärkeres Abgeben hoher Nicht-Trümpfe. Benannte Konstanten stehen in `bots/profi.js`: Handstruktur 1, gleiche Ränge 5, Farbkontrolle 2, Trumpfreserve 3, hohe Nicht-Trümpfe 6. Weitere Zusatzgewichte sind bewusst 0, weil entsprechende Merkmale bereits aus der Amateur-Bewertung übernommen werden und sonst doppelt zählen würden.

Meister ergänzt eine begrenzte Suche mit denselben Fakten. `bots/meister.js`: Kartenanzahl 8, gleiche Ränge 5, Trumpfreserve 3, Aufnahmedruck 3, Risiko 6, leere Endspielhand 100; Suchbeitrag 0,3. `explainDecision()` liefert gewählte Aktion, Alternativen, Scores und Gründe; bei Meister zusätzlich Suchdetails. Auswahl ist deterministisch, optionales RNG betrifft nur Gleichstände.

Der Coach bewertet in `coach/evaluation.js` die Änderung der gesamten Handqualität, unabhängig von den Bot-Scores. Früh/Mitte/Endspiel gewichten Kartenanzahl mit 6/9/16, zusätzliche gleiche Ränge mit 10/12/18 und Trumpfreserve mit 14/12/8. Weitere Faktoren: isolierte hohe Farbkarte bis −6, gegnerischer Aufnahmedruck 22 bzw. 34 im Endspiel, Kosten einer gegnerischen Antwort bis 12, Nachwurfpotenzial 9, Farbvermutung 5, Endspielabschluss 100 und Suchbeitrag 0,65. Es gibt keine abschließende Regel „kleinste Karte“ oder pauschale Trumpfverbote.

Die Verteidigungsbewertung prüft vollständige Zuordnungen zu offenen Angriffen statt gierig die kleinste passende Karte zu wählen (maximal 256 besuchte Zuordnungen je Bewertung). Aufnehmen erhält eine eigene Resthandbewertung einschließlich der sichtbaren Tischkarten und eines phasenabhängigen Tempoverlusts. Neu geöffnete Ränge werden auf bekannte gegnerische Nachwürfe und unbekannte Möglichkeiten geprüft. Eine leere Hand bei noch offenen Angriffen ist ausdrücklich kein Sieg.

## Bedingte Mehrzugplanung und Grenzen

Meister verwendet unverändert `planning/publicLines.js`. Der Coach hat nun seine eigene Suche in `coach/planning.js`; Änderungen daran verändern keine Bot-Entscheidung. Alle legalen Kandidaten erhalten eine Positionsbewertung. Bis zu 8 davon werden vertieft: Breite 4, bis zu 4 eigene Aktionen, höchstens 48 Knoten pro Kandidat bzw. 384 insgesamt. Gegnerszenarien bleiben auf jeder Suchtiefe getrennt; die Fortsetzung wird gegen die ungünstigste untersuchte Antwort bewertet. Die Darstellung kann zusätzlich eine ausdrücklich bedingte günstige Linie zeigen. Es werden bekannte Antworten, eine mögliche unbekannte Antwort und eine Aufnahme betrachtet, niemals echte verdeckte Karten.

Jeder Knoten führt Resthand, Tischränge, Angriffsgrenze, bekannte Gegnerkarten und Kartenanzahlen fort. Nachwürfe müssen zum Tisch passen. Eine folgende Runde nach Verteidigung steht ausdrücklich unter der Bedingung, dass keine weiteren Nachwürfe folgen. Es werden keine Nachziehkarten erfunden. Deshalb sind Linien bedingte Pläne, keine vollständigen Spielsimulationen oder garantierten Gewinnwege. Bei weniger sinnvollen Aktionen wird eine kürzere Linie gezeigt.

Der Coach sucht auf jedem Level, ausschließlich mit dessen freigegebenen Informationen. Ab Level 3 kommen bekannte Gegnerkarten hinzu, ab Level 4 Farbvermutungen. Es erscheinen eine Empfehlung mit zwei bis vier Gründen und bis zu zwei ähnlich bewertete Linien (Score-Abstand höchstens 8), jeweils mit Resthand und bis zu vier eigenen Aktionen. Unbekannte Antworten werden als Möglichkeiten formuliert. Es gibt keine dauernden Tipps oder Hintergrundsuche.

## Prüfung und Kalibrierung

`node --test` führt alle Regel-, Bot-, Wissens-, Coach-, Training-, Replay-, Audio- und Deploymenttests aus. `node scripts/build.mjs` baut den Pages-Unterpfad und generiert die Offline-Dateiliste einschließlich neuer Module.

`node scripts/benchmark-advanced.mjs 12` vergleicht pro Strategie 36 feste Partien gegen zwei Amateure, mit wechselnden Sitzpositionen. Bei der aktuellen Kalibrierung: Amateur 12 Niederlagen, Profi 3, Meister 7; Profi/Meister jeweils 4 Unentschieden. Keine Partie überschritt das Aktionslimit. Meister benötigte hier durchschnittlich ca. 3 ms, maximal ca. 50 ms pro Entscheidung auf dem Entwicklungs-PC. Das ist keine iPhone-Messung und keine universelle Spielstärke-Garantie: Meister schlägt Profi in dieser Stichprobe noch nicht durchgehend.

Die bestehende PWA wird weiter statisch ausgeliefert. Neue Module sind im Entwicklungs-Service-Worker und automatisch im Production-Cache enthalten. Reale Safari-/iPhone-Installation und Offlinebetrieb auf dem Gerät müssen zusätzlich auf dem Zielgerät geprüft werden.

Stand der ersten Implementierung: 99 Tests bestanden, Production-Build mit 48 Cache-Dateien. Damalige Browserprüfung: Level-1-Tipp, Level-3-Mehrzuglinie, bekannte Augenansicht, Ausblenden bei Training AUS und 320-Pixel-Layout ohne horizontalen Überlauf.

## Coach-Überarbeitung: reproduzierbare Positionen

`tests/coachStrategy.test.js` ergänzt strategische Teststellungen und vollständige Partien gegen unveränderte Amateur-Bots. Beispiele, jeweils Pik als Trumpf:

- Angriff mit Karo-König statt Herz-6: Hand Herz-6, Karo-König, Pik-7; Uhu hält bekannt Herz-7, Karo-6 und Kreuz-6.
- Herz-König verteidigt Herz-6 statt Herz-7: Hand Herz-7, Karo-7, Herz-König, Pik-6. Das Siebenerpaar bleibt zusammen.
- Herz-Dame verteidigt Herz-6 statt Herz-7: Hand Herz-7, Herz-Dame, Karo-7, Kreuz-7, Pik-6. Drei Siebener bleiben erhalten.
- Bewusst aufnehmen: Herz-Ass greift an; eigene Hand Pik-Ass, Pik-König, Herz-6, Karo-6, Stapel noch 18 Karten. Beide hohen Trümpfe bleiben erhalten, das aufgenommene Ass ergänzt den Ass-Rang.
- Endspiellinie: Hand Herz-Bube, Karo-Bube, Kreuz-Bube; Uhu hält vollständig bekannt Herz-6, Karo-6, Kreuz-6; Stapel leer. Einen Buben angreifen und die beiden weiteren Buben nachwerfen leert die eigene Hand. Das bedeutet Ausscheiden am Rundenende, nicht automatisch alleiniger Gesamtsieg.

Eine Folge „7 spielen, nach Aufnahme 9 nachwerfen“ wird ohne 9 auf dem Tisch nicht erfunden. Bei einem Gegner mit nur einer Karte bleibt außerdem die Angriffsgrenze eins. Längere rundenübergreifende Gewinnpläne werden nicht als bewiesen ausgegeben. Die Suche ist eine begrenzte strategische Näherung, kein Nachweis optimaler Spielstärke.

Dateien dieser Coach-Überarbeitung: `src/coach/evaluation.js`, `src/coach/coach.js`, neu `src/coach/planning.js`, neu `tests/coachStrategy.test.js`, `dist/sw.js` (Offline-Aufnahme des neuen Moduls) und dieses Dokument. Engine, Bots, Wissensfilter, Trainingslevel, Replay und Animationen sind unverändert.

Abschlussprüfung dieser Überarbeitung: 113 Tests bestanden, keine Fehler/übersprungenen Tests; Production-Build erfolgreich mit 49 Cache-Dateien. Keine neue Prüfung auf einem physischen iPhone und keine allgemeine Spielstärke-Garantie.

## Dateien der ursprünglichen Bots-/Coach-Erweiterung

Neu:

- `src/knowledge/publicGameKnowledge.js` – gemeinsame öffentliche Fakten
- `src/knowledge/trainingKnowledge.js` – Level-Projektion und bekannte Augenansicht
- `src/bots/profi.js` – erweiterte Handbewertung
- `src/bots/meister.js` – Bot mit begrenzter Suche
- `src/planning/publicLines.js` – öffentliche bedingte Szenarien
- `src/coach/knowledge.js` – Coach-Eingabefilter
- `src/coach/evaluation.js` – eigene Coach-Gewichte und Bewertung
- `src/coach/coach.js` – Empfehlung und Mehrzuglinien
- `src/ui/coachUI.js` – manuelle Tippoberfläche
- `tests/advancedBots.test.js` – Wissensgrenze, Legalität, Suche, vollständige Partien
- `tests/knowledgeLevels.test.js` – Augen, bekannte Karten und Level-Grenzen
- `tests/coach.test.js` – Coach-Filter, Empfehlungen und Linien
- `scripts/benchmark-advanced.mjs` – reproduzierbarer Vergleich gegen Amateur
- `BOTS-COACH.md` – Architektur, Bedienung, Grenzen und Dateiliste

Geändert:

- `src/game/engine.js` – öffentliche Angriffsgrenze in Beobachtung
- `src/bots/view.js` – erlaubte Bot-Eingaben
- `src/bots/strategy.js` – Auswahl der vier Schwierigkeitsgrade
- `src/bots/knowledge.js` – Adapter zur gemeinsamen Wissensbasis
- `src/bots/amateur.js` – vereinfachte Formulierungen in Debug-Gründen
- `src/training/analysis.js` – gemeinsame Wissensbasis statt doppelter Berechnung
- `src/ui/app.js` – Augen-Projektion, Coach-Anbindung und Zustandswechsel
- `src/ui/trainingUI.js` – levelgefilterte Analyse und Bezeichnungen
- `src/ui/cards.js` – levelgefilterte Stapelkontrolle
- `dist/index.html` – Schwierigkeitsauswahl, Coach-Bereich, Kontrolltexte
- `dist/style.css` – kompakte Coach- und Wissensdarstellung
- `dist/sw.js` – neue Offline-Module und Cache-Version
- `README.md` – aktuelle Bedienung und Architekturverweis

`_site/` wurde neu generiert und bleibt als Buildausgabe vom Git-Tracking ausgeschlossen.
