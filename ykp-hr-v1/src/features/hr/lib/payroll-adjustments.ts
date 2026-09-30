export interface PayrollAdjustmentRow {
  adjustment_type: string;
  amount: string | number;
}

export interface PayrollAdjustmentTotals {
  bonus: number;
  incentive: number;
  penalty: number;
  allowance: number;
  cashAdvance: number;
  overtime: number;
  reimbursement: number;
  otherDeduction: number;
}

/** Aggregate approved manual adjustment values for one employee and period. */
export function summarizePayrollAdjustments(rows: PayrollAdjustmentRow[]): PayrollAdjustmentTotals {
  const totals: PayrollAdjustmentTotals = {
    bonus: 0,
    incentive: 0,
    penalty: 0,
    allowance: 0,
    cashAdvance: 0,
    overtime: 0,
    reimbursement: 0,
    otherDeduction: 0
  };
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || amount < 0) continue;
    switch (row.adjustment_type) {
      case 'BONUS': totals.bonus += amount; break;
      case 'INCENTIVE': totals.incentive += amount; break;
      case 'PENALTY': totals.penalty += amount; break;
      case 'ALLOWANCE': totals.allowance += amount; break;
      case 'CASH_ADVANCE': totals.cashAdvance += amount; break;
      case 'OVERTIME': totals.overtime += amount; break;
      case 'REIMBURSEMENT': totals.reimbursement += amount; break;
      default: totals.otherDeduction += amount;
    }
  }
  return totals;
}
