import { test } from "node:test";
import assert from "node:assert/strict";

import {
  RuleError,
  addDays,
  computeHoliday,
  computeHolidays,
  daysInMonth,
  fixedDate,
  isLeapYear,
  lastWeekdayOfMonth,
  nearestWeekday,
  nthWeekdayOfMonth,
  observedDate,
  weekdayOf,
} from "../src/index.js";

// 2024-11-28 was a Thursday. 2024-11-01 was a Friday.
// 2023-11-23 was a Thursday. 2023-11-01 was a Wednesday.
// 2022-11-24 was a Thursday. 2022-11-01 was a Tuesday.

function eqDate(got, want) {
  assert.deepEqual(got, { year: want[0], month: want[1], day: want[2] });
}

test("isLeapYear follows the Gregorian rule", () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2023), false);
  assert.equal(isLeapYear(1900), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1600), true);
  assert.equal(isLeapYear(1700), false);
});

test("isLeapYear rejects non-integers", () => {
  assert.throws(() => isLeapYear(2024.5), RuleError);
  assert.throws(() => isLeapYear("2024"), RuleError);
});

test("daysInMonth handles February and leap years", () => {
  assert.equal(daysInMonth(2023, 2), 28);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2024, 4), 30);
  assert.equal(daysInMonth(2024, 12), 31);
  assert.throws(() => daysInMonth(2024, 13), RuleError);
  assert.throws(() => daysInMonth(2024, 0), RuleError);
});

test("weekdayOf matches known dates", () => {
  // 2024-11-28 was a Thursday (Thanksgiving 2024).
  assert.equal(weekdayOf({ year: 2024, month: 11, day: 28 }), 4);
  // 2000-01-01 was a Saturday.
  assert.equal(weekdayOf({ year: 2000, month: 1, day: 1 }), 6);
  // 1970-01-01 was a Thursday.
  assert.equal(weekdayOf({ year: 1970, month: 1, day: 1 }), 4);
});

test("weekdayOf rejects invalid dates", () => {
  assert.throws(() => weekdayOf({ year: 2023, month: 2, day: 29 }), RuleError);
  assert.throws(() => weekdayOf({ year: 2024, month: 4, day: 31 }), RuleError);
});

test("addDays crosses month and year boundaries", () => {
  eqDate(addDays({ year: 2024, month: 12, day: 31 }, 1), [2025, 1, 1]);
  eqDate(addDays({ year: 2024, month: 1, day: 1 }, -1), [2023, 12, 31]);
  eqDate(addDays({ year: 2024, month: 2, day: 28 }, 1), [2024, 2, 29]);
  eqDate(addDays({ year: 2023, month: 2, day: 28 }, 1), [2023, 3, 1]);
  eqDate(addDays({ year: 2024, month: 11, day: 28 }, 0), [2024, 11, 28]);
});

test("fixedDate resolves to the same day each year", () => {
  const rule = fixedDate(7, 4);
  eqDate(observedDate(rule, 2024), [2024, 7, 4]);
  eqDate(observedDate(rule, 2025), [2025, 7, 4]);
});

test("fixedDate rejects impossible dates", () => {
  assert.throws(() => fixedDate(2, 30), RuleError);
  assert.throws(() => fixedDate(4, 31), RuleError);
  assert.throws(() => fixedDate(13, 1), RuleError);
  // February 29 is accepted because some year will have it.
  const leap = fixedDate(2, 29);
  eqDate(observedDate(leap, 2024), [2024, 2, 29]);
});

test("nthWeekdayOfMonth finds the fourth Thursday of November", () => {
  const rule = nthWeekdayOfMonth(11, 4, 4);
  eqDate(observedDate(rule, 2024), [2024, 11, 28]);
  eqDate(observedDate(rule, 2023), [2023, 11, 23]);
  eqDate(observedDate(rule, 2022), [2022, 11, 24]);
});

test("nthWeekdayOfMonth handles fifth occurrences and overshoot", () => {
  // November 2023 has five Thursdays: 2, 9, 16, 23, 30.
  const fifth = nthWeekdayOfMonth(11, 4, 5);
  eqDate(observedDate(fifth, 2023), [2023, 11, 30]);
  // November 2024 has only four Thursdays, so asking for a fifth is an error.
  assert.throws(() => observedDate(fifth, 2024), RuleError);
});

test("nthWeekdayOfMonth supports negative n", () => {
  const lastThursday = nthWeekdayOfMonth(11, 4, -1);
  eqDate(observedDate(lastThursday, 2024), [2024, 11, 28]);
  eqDate(observedDate(lastThursday, 2023), [2023, 11, 30]);
});

test("lastWeekdayOfMonth finds Memorial Day", () => {
  // Last Monday of May.
  const rule = lastWeekdayOfMonth(5, 1);
  eqDate(observedDate(rule, 2024), [2024, 5, 27]);
  eqDate(observedDate(rule, 2025), [2025, 5, 26]);
});

test("nearestWeekday moves weekend targets to a weekday", () => {
  // 2022-01-01 was a Saturday; nearest weekday is Friday 2021-12-31.
  eqDate(observedDate(nearestWeekday(1, 1), 2022), [2021, 12, 31]);
  // 2023-01-01 was a Sunday; nearest weekday is Monday 2023-01-02.
  eqDate(observedDate(nearestWeekday(1, 1), 2023), [2023, 1, 2]);
  // 2024-01-01 was a Monday; unchanged.
  eqDate(observedDate(nearestWeekday(1, 1), 2024), [2024, 1, 1]);
});

test("nearestWeekday leaves weekday targets alone", () => {
  // 2024-07-04 was a Thursday.
  eqDate(observedDate(nearestWeekday(7, 4), 2024), [2024, 7, 4]);
});

test("observedDate rejects unknown rule kinds and bad rules", () => {
  assert.throws(() => observedDate({ kind: "wat" }, 2024), RuleError);
  assert.throws(() => observedDate(null, 2024), RuleError);
  assert.throws(() => observedDate({}, 2024), RuleError);
  assert.throws(() => observedDate(fixedDate(1, 1), 2024.5), RuleError);
});

test("computeHoliday is an alias for observedDate", () => {
  eqDate(computeHoliday(nthWeekdayOfMonth(11, 4, 4), 2024), [2024, 11, 28]);
});

test("computeHolidays resolves a map of rules", () => {
  const rules = {
    newYear: nearestWeekday(1, 1),
    thanksgiving: nthWeekdayOfMonth(11, 4, 4),
    independence: fixedDate(7, 4),
  };
  const got = computeHolidays(rules, 2024);
  eqDate(got.newYear, [2024, 1, 1]);
  eqDate(got.thanksgiving, [2024, 11, 28]);
  eqDate(got.independence, [2024, 7, 4]);
});

test("computeHolidays propagates rule errors", () => {
  const rules = { bad: nthWeekdayOfMonth(11, 4, 5) };
  assert.throws(() => computeHolidays(rules, 2024), RuleError);
});

// Determinism guard: none of the tests above touch Date or the wall clock, and
// the library never reads the current time. This test simply asserts that the
// same call twice yields the same value, which would fail if any hidden state
// were introduced later.
test("resolution is deterministic", () => {
  const rule = nearestWeekday(1, 1);
  assert.deepEqual(observedDate(rule, 2022), observedDate(rule, 2022));
});
