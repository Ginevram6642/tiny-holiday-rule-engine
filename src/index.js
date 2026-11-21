// Public entry point for tiny-holiday-rule-engine.
// Everything consumers need is re-exported here so the internal layout of
// src/core.js is not part of the public contract.
export {
  RuleError,
  observedDate,
  nthWeekdayOfMonth,
  lastWeekdayOfMonth,
  nearestWeekday,
  fixedDate,
  computeHoliday,
  computeHolidays,
  weekdayOf,
  addDays,
  daysInMonth,
  isLeapYear,
} from "./core.js";
