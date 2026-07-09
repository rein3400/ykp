import { EmployeesTableClient } from "@hr/features/components/employees-table";

/**
 * Employee roster page. Reads master_employee from master DB. HR_ADMIN
 * can create new employees and assign role/department/outlet.
 */
export default function EmployeesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground">
          Roster karyawan aktif. Import CSV untuk onboarding massal.
        </p>
      </div>
      <EmployeesTableClient />
    </div>
  );
}