export function canViewPayroll(role: string | undefined): boolean {
  return role === 'owner' || role === 'finance_admin';
}
export function employeeWithoutSalary<T extends object>(row: T): T {
  const copy = { ...row } as T & Record<string, unknown>;
  delete copy.basic_salary;
  delete copy.base_salary;
  delete copy.bank_account;
  delete copy.bank_name;
  return copy;
}
