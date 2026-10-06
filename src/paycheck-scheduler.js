export const PAY_FREQUENCY_INTERVAL_DAYS = { weekly: 7, biweekly: 14, monthly: 30 };

export function getPayFrequencyIntervalDays(frequency) {
  return PAY_FREQUENCY_INTERVAL_DAYS[frequency] ?? PAY_FREQUENCY_INTERVAL_DAYS.biweekly;
}

export function isWithinMonth(dateString, monthString) {
  const [monthYear, monthNumber] = monthString.split('-').map(Number);
  const [dateYear, dateMonth, dateDay] = dateString.split('-').map(Number);
  if (!dateYear || !dateMonth || !dateDay || !monthYear || !monthNumber) return false;
  return dateYear === monthYear && dateMonth === monthNumber;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function clampDay(year, monthIndex, day) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.min(day, lastDay);
}

export function buildIncomeEntriesForMonth(schedule, monthString) {
  const amount = Number(schedule?.amount ?? 0);
  const frequency = schedule?.frequency ?? (Number(schedule?.intervalDays) === 7 ? 'weekly' : Number(schedule?.intervalDays) === 14 ? 'biweekly' : 'monthly');
  const intervalDays = getPayFrequencyIntervalDays(frequency);
  const paydayCursor = new Date(`${schedule.nextPayday ?? '1970-01-01'}T00:00:00`);
  const [year, month] = monthString.split('-').map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  if (frequency === 'monthly') {
    const monthlyDate = new Date(year, month - 1, clampDay(year, month - 1, paydayCursor.getDate()));
    if (monthlyDate >= monthStart && monthlyDate <= monthEnd) {
      const dateKey = `${monthlyDate.getFullYear()}-${String(monthlyDate.getMonth() + 1).padStart(2, '0')}-${String(monthlyDate.getDate()).padStart(2, '0')}`;
      return [{ id: `${schedule.id}-${dateKey}`, date: dateKey, amount, name: schedule.name }];
    }
    return [];
  }

  const entries = [];
  let cursor = new Date(paydayCursor);

  while (cursor < monthStart) {
    cursor = addDays(cursor, intervalDays);
  }

  while (cursor <= monthEnd) {
    const dateKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
    entries.push({
      id: `${schedule.id}-${dateKey}`,
      date: dateKey,
      amount,
      name: schedule.name,
    });
    cursor = addDays(cursor, intervalDays);
  }

  return entries;
}

export function buildExpenseEntriesForMonth(schedule, monthString) {
  const firstDueDate = String(schedule?.nextDueDate ?? '');
  if (!firstDueDate || schedule?.paused) return [];
  if (schedule.frequency === 'yearly') {
    const [year, month] = monthString.split('-').map(Number);
    const [firstYear, firstMonth, firstDay] = firstDueDate.split('-').map(Number);
    if (!year || !month || !firstYear || !firstMonth || !firstDay || month !== firstMonth) return [];
    const day = clampDay(year, month - 1, firstDay);
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return date >= firstDueDate
      ? [{ id: `${schedule.id}-${date}`, date, amount: Number(schedule.amount ?? 0), name: schedule.name }]
      : [];
  }
  return buildIncomeEntriesForMonth({
    ...schedule,
    nextPayday: schedule?.nextDueDate,
  }, monthString).filter((entry) => entry.date >= firstDueDate);
}
