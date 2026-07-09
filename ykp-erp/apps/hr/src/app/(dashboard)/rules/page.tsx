import { RulesTableClient } from "@hr/features/components/rules-table";

/**
 * HR rules page. One hr_rules row per outlet+shift. Edit modal lets
 * HR_ADMIN adjust late tolerance, overtime multiplier, cap, mandatory
 * checkout and payroll period cut-off days.
 */
export default function RulesPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">HR Rules</h1>
        <p className="text-sm text-muted-foreground">
          Aturan kehadiran &amp; overtime per outlet + shift.
        </p>
      </div>
      <RulesTableClient />
    </div>
  );
}