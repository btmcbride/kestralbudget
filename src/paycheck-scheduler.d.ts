export type PayFrequency = 'weekly' | 'biweekly' | 'monthly';
export type ExpenseFrequency = PayFrequency | 'yearly';

export interface PaycheckSchedule {
  id: string;
  name: string;
  amount: number;
  frequency?: PayFrequency;
  intervalDays?: number;
  nextPayday: string;
}

export interface RecurringExpenseSchedule {
  id: string;
  categoryId: string;
  name: string;
  amount: number;
  frequency?: ExpenseFrequency;
  intervalDays?: number;
  nextDueDate: string;
  paused?: boolean;
}

export interface ScheduledPaydayEntry {
  id: string;
  date: string;
  amount: number;
  name: string;
}

export function isWithinMonth(dateString: string, monthString: string): boolean;
export function getPayFrequencyIntervalDays(frequency: PayFrequency): number;
export function buildIncomeEntriesForMonth(schedule: PaycheckSchedule, monthString: string): ScheduledPaydayEntry[];
export function buildExpenseEntriesForMonth(schedule: RecurringExpenseSchedule, monthString: string): ScheduledPaydayEntry[];
