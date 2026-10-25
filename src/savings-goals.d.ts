export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
}

export interface SavingsGoalTransaction {
  savingsGoalId?: string | null;
  amount: number;
}

export interface SavingsGoalProgress {
  saved: number;
  remaining: number;
  met: boolean;
}

export function savingsGoalProgress(goal: SavingsGoal, transactions: SavingsGoalTransaction[]): SavingsGoalProgress;
export function allSavingsGoalsMet(goals: SavingsGoal[], transactions: SavingsGoalTransaction[]): boolean;
