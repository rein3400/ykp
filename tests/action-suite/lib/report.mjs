import fs from 'node:fs';
import path from 'node:path';

export function reportPath(outDir, moduleId) {
  return path.join(outDir, 'results', `${moduleId}-report.json`);
}

export function loadReport(outDir, moduleId) {
  const p = reportPath(outDir, moduleId);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  return {
    module: moduleId,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    totals: { actions: 0, pass: 0, fail: 0, skip: 0, error: 0 },
    login: null,
    actions: [],
    findings: [],
  };
}

export function saveReport(outDir, moduleId, report) {
  const dir = path.join(outDir, 'results');
  fs.mkdirSync(dir, { recursive: true });
  report.finishedAt = new Date().toISOString();
  report.totals = {
    actions: report.actions.length,
    pass: report.actions.filter((a) => a.status === 'pass').length,
    fail: report.actions.filter((a) => a.status === 'fail').length,
    skip: report.actions.filter((a) => a.status === 'skip').length,
    error: report.actions.filter((a) => a.status === 'error').length,
  };
  fs.writeFileSync(reportPath(outDir, moduleId), JSON.stringify(report, null, 2));
}

export function addFinding(report, severity, actionId, msg, evidence = {}) {
  report.findings.push({ severity, actionId, msg, evidence, ts: new Date().toISOString() });
}

export function aggregateFindings(report) {
  const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return report.findings.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));
}

export function writeSummary(outDir, moduleReports) {
  const summary = {
    ts: new Date().toISOString(),
    modules: moduleReports.map((r) => ({
      module: r.module,
      totals: r.totals,
      loginOk: r.login?.ok ?? false,
      findingsCount: r.findings.length,
      critical: r.findings.filter((f) => f.severity === 'CRITICAL').length,
      high: r.findings.filter((f) => f.severity === 'HIGH').length,
    })),
    overall: {
      actions: moduleReports.reduce((a, r) => a + r.totals.actions, 0),
      pass: moduleReports.reduce((a, r) => a + r.totals.pass, 0),
      fail: moduleReports.reduce((a, r) => a + r.totals.fail, 0),
      skip: moduleReports.reduce((a, r) => a + r.totals.skip, 0),
      error: moduleReports.reduce((a, r) => a + r.totals.error, 0),
      critical: moduleReports.reduce((a, r) => a + r.findings.filter((f) => f.severity === 'CRITICAL').length, 0),
      high: moduleReports.reduce((a, r) => a + r.findings.filter((f) => f.severity === 'HIGH').length, 0),
    },
  };
  fs.writeFileSync(path.join(outDir, 'results', 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}
