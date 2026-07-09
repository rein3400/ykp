import { HrSummaryClient } from "@hr/features/components/hr-summary-cards";

/**
 * HR daily summary page. Grid of hr_daily_summary rows + rebuild button
 * that calls /api/hr/summary/rebuild to regenerate summaries idempotently.
 */
export default function SummaryPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Summary</h1>
        <p className="text-sm text-muted-foreground">
          Rekap harian per outlet. Klik Rebuild untuk regenerate idempotent.
        </p>
      </div>
      <HrSummaryClient />
    </div>
  );
}