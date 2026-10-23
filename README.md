# Rest Hours ⚓

Web app to record and check your hours of rest on board according to **STCW A-VIII/1** and **MLC 2006 (standard A2.3)**.
Works offline on phone and laptop; your data stays on your own device.

**Live:** https://crewwealth.github.io/stcw-rusttijden/ — open in Safari/Chrome and choose *Add to Home Screen*.

## What it checks

- at least 10 hours of rest in **any** 24-hour period (rolling, also across midnight)
- at least 77 hours of rest in any 7-day period
- rest in no more than 2 periods, one of them at least 6 hours
- no more than 14 hours between rest periods

Orange = allowed but tight (less than 11 h per 24 h or 80 h per week).
**Advance warning:** the week screen warns you when your planned roster for the next 14 days breaks the rules.

## Code (uitleg in het Nederlands)

| File | What it does |
|---|---|
| `js/rules.js` | All calculations (one day = 48 half-hour blocks, 0 rest / 1 work) and the advance warning. Start reading here. |
| `js/templates.js` | Watch schedules (5/3, 4-on/8-off, day worker, 6-on/6-off). Add your own here. |
| `js/storage.js` | Saving in the browser + backup as a file. |
| `js/app.js` | The screens: Week, Schedule, Export, Profile. |
| `sw.js` | Service worker: makes the app work offline. |
| `tests/rules.test.js` | Tests for the rules. |

```bash
python3 -m http.server 5199   # run locally, open http://localhost:5199
npm test                      # run the tests
```

Not official: always also check against your company's system.
