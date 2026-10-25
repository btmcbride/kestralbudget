interface SubscriptionCalendarEvent {
  categoryId: string;
  date: string;
  amount: number;
  name: string;
  scheduleId?: string | null;
}

interface SubscriptionOccurrence {
  date: string;
  amount: number;
  name: string;
}

export function hasMatchingUnscheduledOccurrence(
  events: SubscriptionCalendarEvent[],
  categoryId: string,
  occurrence: SubscriptionOccurrence,
): boolean;
