export function hasMatchingUnscheduledOccurrence(events, categoryId, occurrence) {
  const name = occurrence.name.trim().toLocaleLowerCase();
  return events.some((event) => !event.scheduleId
    && event.categoryId === categoryId
    && event.date === occurrence.date
    && event.amount === occurrence.amount
    && event.name.trim().toLocaleLowerCase() === name);
}
