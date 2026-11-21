// Core of tiny-holiday-rule-engine.
//
// Design decision: dates are represented as a plain object {year, month, day}
// rather than a Date. A Date carries a time-of-day and a timezone, and holiday
// rules are calendar rules. Using a Date would force every caller to agree on a
// timezone, and would make the library's answers depend on the machine's clock
// settings. A {year, month, day} triple is unambiguous, comparable, and cheap to
// construct in tests.
//
// Conventions used throughout:
//   - month is 1..12 (January is 1), not the 0-based index Date uses.
//   - day is 1..31.
//   - weekday is 0..6 where 0 is Sunday, matching Date#getDay().

/**
 * Error thrown for malformed rules or out-of-range arguments.
 *
 * We use a dedicated subclass rather than a bare Error so callers can catch
 * rule problems specifically without swallowing unrelated bugs.
 */
export class RuleError extends Error {
  constructor(message) {
    super(message);
    this.name = "RuleError";
  }
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Returns true when `year` is a leap year in the proleptic Gregorian calendar.
 *
 * The Gregorian rule (divisible by 4, except centuries, except multiples of
 * 400) is used for all years, including pre-1582 ones. Extending the calendar
 * backwards is the conventional choice for date libraries and keeps the code
 * free of a special case nobody would exercise.
 */
export function isLeapYear(year) {
  if (!Number.isInteger(year)) {
    throw new RuleError(`year must be an integer, got ${year}`);
  }
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Number of days in a given month, honouring leap years.
 */
export function daysInMonth(year, month) {
  assertMonth(month);
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return DAYS_IN_MONTH[month - 1];
}

function assertMonth(month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RuleError(`month must be an integer in 1..12, got ${month}`);
  }
}

function assertWeekday(weekday) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new RuleError(`weekday must be an integer in 0..6, got ${weekday}`);
  }
}

function assertYear(year) {
  if (!Number.isInteger(year)) {
    throw new RuleError(`year must be an integer, got ${year}`);
  }
}

/**
 * Validates a {year, month, day} triple and returns it unchanged.
 *
 * Returning the same object (rather than a copy) is deliberate: the callers
 * inside this module build the object themselves and never mutate it, so a
 * copy would be pure overhead.
 */
function assertDate(date) {
  if (date === null || typeof date !== "object") {
    throw new RuleError(`expected a date object, got ${date}`);
  }
  assertYear(date.year);
  assertMonth(date.month);
  const max = daysInMonth(date.year, date.month);
  if (!Number.isInteger(date.day) || date.day < 1 || date.day > max) {
    throw new RuleError(
      `day must be an integer in 1..${max} for ${date.year}-${date.month}, got ${date.day}`,
    );
  }
  return date;
}

/**
 * Day of week for a Gregorian date, 0 = Sunday.
 *
 * This is a direct port of the standard Sakamoto algorithm. It is used instead
 * of Date.UTC because Date is timezone-sensitive in ways that are easy to get
 * subtly wrong, and because the algorithm is exact for the proleptic Gregorian
 * calendar which is what the rest of this module assumes.
 */
export function weekdayOf(date) {
  assertDate(date);
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = date.year;
  if (date.month < 3) {
    y -= 1;
  }
  return (
    y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) +
    offsets[date.month - 1] +
    date.day
  ) % 7;
}

/**
 * Adds `delta` days to a date, returning a fresh object.
 *
 * Only whole days are supported. Rolling over month and year boundaries is
 * handled by normalising through a day-of-year count, which avoids a long
 * chain of per-month conditionals.
 */
export function addDays(date, delta) {
  assertDate(date);
  if (!Number.isInteger(delta)) {
    throw new RuleError(`delta must be an integer, got ${delta}`);
  }
  let year = date.year;
  let month = date.month;
  let day = date.day + delta;

  while (day < 1) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    day += daysInMonth(year, month);
  }

  for (;;) {
    const max = daysInMonth(year, month);
    if (day <= max) {
      break;
    }
    day -= max;
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return { year, month, day };
}

/**
 * A rule that always lands on the same month and day.
 *
 * `month` and `day` are validated eagerly so a typo surfaces at construction
 * time rather than when a caller asks for a year that happens to be a leap year.
 */
export function fixedDate(month, day) {
  assertMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RuleError(`day must be an integer in 1..31, got ${day}`);
  }
  // Validate against a leap year so February 29 is accepted at construction.
  const max = daysInMonth(2000, month);
  if (day > max) {
    throw new RuleError(`day ${day} does not exist in month ${month}`);
  }
  return { kind: "fixed", month, day };
}

/**
 * The `n`-th `weekday` of `month`.
 *
 * `n` is 1-based: nthWeekdayOfMonth(11, 4, 4) is the fourth Thursday of
 * November. Negative `n` counts from the end (-1 is the last such weekday),
 * which is a common way to express rules such as "last Monday in May".
 * A positive `n` that overshoots the month throws rather than silently
 * returning a date in the next month.
 */
export function nthWeekdayOfMonth(month, weekday, n) {
  assertMonth(month);
  assertWeekday(weekday);
  if (!Number.isInteger(n) || n === 0) {
    throw new RuleError(`n must be a non-zero integer, got ${n}`);
  }
  return { kind: "nthWeekday", month, weekday, n };
}

/**
 * The last `weekday` of `month`.
 *
 * Expressed as a separate rule rather than nthWeekdayOfMonth(month, weekday, -1)
 * because "last" is the phrasing holiday statutes use, and because it reads
 * better at the call site.
 */
export function lastWeekdayOfMonth(month, weekday) {
  assertMonth(month);
  assertWeekday(weekday);
  return { kind: "lastWeekday", month, weekday };
}

/**
 * The `weekday` nearest to `month`/`day`.
 *
 * Ties are broken towards the following day. This matters for rules such as
 * "nearest weekday to January 1": when the 1st falls on a Sunday the nearest
 * weekday is Monday the 2nd, and when it falls on a Saturday the nearest
 * weekday is Friday the 31st of December. The tie case only arises when the
 * target day itself is a weekend day, and in that case there is no ambiguity
 * about which direction to go: Saturday goes back, Sunday goes forward.
 * For a weekday target the rule returns the target day unchanged.
 */
export function nearestWeekday(month, day) {
  assertMonth(month);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new RuleError(`day must be an integer in 1..31, got ${day}`);
  }
  const max = daysInMonth(2000, month);
  if (day > max) {
    throw new RuleError(`day ${day} does not exist in month ${month}`);
  }
  return { kind: "nearestWeekday", month, day };
}

function resolveNthWeekday(rule, year) {
  if (rule.n > 0) {
    const first = { year, month: rule.month, day: 1 };
    const firstWeekday = weekdayOf(first);
    // Distance forward from the 1st to the first occurrence of `weekday`.
    const offset = (rule.weekday - firstWeekday + 7) % 7;
    const candidate = addDays(first, offset + (rule.n - 1) * 7);
    if (candidate.month !== rule.month) {
      throw new RuleError(
        `no ${WEEKDAY_NAMES[rule.weekday]} #${rule.n} in month ${rule.month} of ${year}`,
      );
    }
    return candidate;
  }
  // Negative n: count backwards from the end of the month. n = -1 is the last
  // occurrence, n = -2 the second-to-last, and so on.
  const last = { year, month: rule.month, day: daysInMonth(year, rule.month) };
  const lastWeekday = weekdayOf(last);
  // Distance backward from the last day to the last occurrence of `weekday`.
  const back = (lastWeekday - rule.weekday + 7) % 7;
  const candidate = addDays(last, -(back + (-rule.n - 1) * 7));
  if (candidate.month !== rule.month) {
    throw new RuleError(
      `no ${WEEKDAY_NAMES[rule.weekday]} #${rule.n} in month ${rule.month} of ${year}`,
    );
  }
  return candidate;
}

function resolveLastWeekday(rule, year) {
  const last = { year, month: rule.month, day: daysInMonth(year, rule.month) };
  const lastWeekday = weekdayOf(last);
  const back = (lastWeekday - rule.weekday + 7) % 7;
  return addDays(last, -back);
}

function resolveNearestWeekday(rule, year) {
  const target = { year, month: rule.month, day: rule.day };
  const wd = weekdayOf(target);
  if (wd === 0) {
    // Sunday: the nearest weekday is Monday, one day forward.
    return addDays(target, 1);
  }
  if (wd === 6) {
    // Saturday: the nearest weekday is Friday, one day back. This can cross
    // into the previous month or year; addDays handles that.
    return addDays(target, -1);
  }
  return target;
}

/**
 * Resolves a single rule for a single year.
 *
 * Returns a fresh {year, month, day} object. The result is not validated
 * against the year argument because some rules legitimately cross a year
 * boundary (nearestWeekday to January 1 can land in the previous December).
 */
export function observedDate(rule, year) {
  assertYear(year);
  if (rule === null || typeof rule !== "object" || typeof rule.kind !== "string") {
    throw new RuleError(`expected a rule object, got ${JSON.stringify(rule)}`);
  }
  switch (rule.kind) {
    case "fixed":
      return { year, month: rule.month, day: rule.day };
    case "nthWeekday":
      return resolveNthWeekday(rule, year);
    case "lastWeekday":
      return resolveLastWeekday(rule, year);
    case "nearestWeekday":
      return resolveNearestWeekday(rule, year);
    default:
      throw new RuleError(`unknown rule kind: ${rule.kind}`);
  }
}

/**
 * Resolves a named rule for a year.
 *
 * `rule` may be a rule object built by one of the factory functions, or a
 * plain object with a `kind` field. Both go through the same switch in
 * observedDate, so the two forms are interchangeable.
 */
export function computeHoliday(rule, year) {
  return observedDate(rule, year);
}

/**
 * Resolves a map of name -> rule for a year.
 *
 * Returns a plain object of name -> {year, month, day}. Iteration order of the
 * input map is preserved by JavaScript's object property order for string
 * keys, so the output mirrors the input's declaration order.
 */
export function computeHolidays(rules, year) {
  if (rules === null || typeof rules !== "object") {
    throw new RuleError(`expected a rules object, got ${rules}`);
  }
  const out = {};
  for (const name of Object.keys(rules)) {
    out[name] = observedDate(rules[name], year);
  }
  return out;
}
