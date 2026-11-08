export function savingsGoalProgress(goal, transactions) {
  const saved = transactions
    .filter((transaction) => transaction.savingsGoalId === goal.id)
    .reduce((total, transaction) => total + transaction.amount, 0);
  return { saved, remaining: Math.max(0, goal.target - saved), met: saved >= goal.target };
}

export function allSavingsGoalsMet(goals, transactions) {
  return goals.length > 0 && goals.every((goal) => savingsGoalProgress(goal, transactions).met);
}
