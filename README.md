# Rusttijden ⚓

Web-app om je werk- en rusttijden aan boord bij te houden en te controleren volgens **STCW A-VIII/1** en **MLC 2006 (norm A2.3)**.
Werkt offline op telefoon en laptop; je gegevens blijven op je eigen toestel.

## Wat hij controleert

- minimaal 10 uur rust in **elke** periode van 24 uur (rollend, ook over middernacht)
- minimaal 77 uur rust in elke periode van 7 dagen
- die rust in hoogstens 2 blokken, waarvan één van minstens 6 uur
- hoogstens 14 uur tussen twee rustperiodes

Oranje = toegestaan maar krap (minder dan 11 u per 24 u of 80 u per week).

## Hoe de code in elkaar zit

| Bestand | Wat het doet |
|---|---|
| `js/rules.js` | Al het rekenwerk. Een dag = 48 halfuurvakjes (0 rust, 1 werk). Begin hier met lezen. |
| `js/templates.js` | De wachtroosters (00–04/12–16, dagwerker, 6 op 6 af …). Voeg hier je eigen rooster toe. |
| `js/storage.js` | Opslaan in de browser + back-up als bestand. |
| `js/app.js` | De schermen: Week, Rooster, Export, Profiel. |
| `sw.js` | Service worker: zorgt dat de app zonder internet werkt. |
| `tests/rules.test.js` | Tests voor de regels. |

## Lokaal draaien

```bash
python3 -m http.server 5199
```

Open daarna http://localhost:5199.

## Testen

```bash
npm test
```

## Ideeën om zelf verder te bouwen

- Klok verzetten aan boord (scheepstijd ±1 uur) verwerken
- Een eigen wachtrooster opslaan vanuit de app
- Melding als je binnen 2 uur een rustblok nodig hebt
- Grafiek van je rust per maand

Niet officieel: controleer altijd ook met het systeem van je rederij.
