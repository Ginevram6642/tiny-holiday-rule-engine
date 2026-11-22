# tiny-holiday-rule-engine

Computes the exact date of observed holidays for a given year from rules such as "fourth Thursday of November" or "nearest weekday to January 1".

```js
import {
  computeHolidays,
  fixedDate,
  lastWeekdayOfMonth,
  nearestWeekday,
  nthWeekdayOfMonth,
} from "./src/index.js";

const rules = {
  newYear: nearestWeekday(1, 1),
  memorialDay: lastWeekdayOfMonth(5, 1),
  independence: fixedDate(7, 4),
  thanksgiving: nthWeekdayOfMonth(11, 4, 4),
};

const holidays = computeHolidays(rules, 2024);
// {
//   newYear:      { year: 2024, month: 1,  day: 1  },
//   memorialDay:  { year: 2024, month: 5,  day: 27 },
//   independence: { year: 2024, month: 7,  day: 4  },
//   thanksgiving: { year: 2024, month: 11, day: 28 },
// }
```

Single rules can be resolved with `observedDate(rule, year)` or its alias `computeHoliday(rule, year)`.

## Why this exists

Holiday dates are almost never fixed. Most statutes and calendars describe them relative to a weekday, and the arithmetic for that is small but easy to get wrong at the edges: which Thursday is the fourth one, what happens when the target day is itself a weekend, what happens when a "nearest weekday" rule crosses a year boundary.

This library exists so that arithmetic lives in one place. The trade-off is that it resolves rules only for a single year at a time and does not attempt to model anything beyond the Gregorian calendar. It also does not know about timezones, because holidays are calendar facts, not instants. Dates are returned as `{ year, month, day }` objects rather than `Date` instances; `month` is 1-based and `weekday` is 0-based with Sunday as 0, matching `Date#getDay()`.

## The edge you will hit

`nearestWeekday` can return a date in the previous month or the previous year. `nearestWeekday(1, 1)` for 2022 resolves to 2021-12-31, because January 1, 2022 was a Saturday and the nearest weekday is the preceding Friday. The returned object's `year` field reflects the real date, not the year you passed in. If you are grouping results by the input year, be aware of this.

## API

- `fixedDate(month, day)` — the same month and day every year. February 29 is accepted at construction time and only resolves in leap years.
- `nthWeekdayOfMonth(month, weekday, n)` — the `n`-th weekday of a month. `n` is 1-based; negative `n` counts from the end (`-1` is the last). A positive `n` that overshoots the month throws a `RuleError`.
- `lastWeekdayOfMonth(month, weekday)` — the last such weekday of a month.
- `nearestWeekday(month, day)` — the weekday nearest to that date. Saturday moves back one day, Sunday moves forward one day, weekdays are unchanged.
- `observedDate(rule, year)` / `computeHoliday(rule, year)` — resolve one rule.
- `computeHolidays(rules, year)` — resolve a map of name to rule.
- `weekdayOf(date)` — day of week for a `{ year, month, day }`, 0 = Sunday.
- `addDays(date, delta)` — shift a date by whole days.
- `daysInMonth(year, month)` and `isLeapYear(year)` — calendar helpers.
- `RuleError` — thrown for malformed rules and out-of-range arguments.

## Tests

```
node --test
```
