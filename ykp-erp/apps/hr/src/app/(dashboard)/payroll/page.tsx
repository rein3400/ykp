import { PayrollTableClient } from "@hr/features/components/payroll-table";

/**
 * Payroll page. Lists payroll runs, hosts the generate-payroll modal,
 * approval inbox, and gross/net chart. All interactions go through the
 * client island + TanStack mutations.
 */
export default function PayrollPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Generate payroll per periode, preview kalkulasi, jalur approval.
        </p>
      </div>
      <PayrollTableClient />
    </div>
  );
}