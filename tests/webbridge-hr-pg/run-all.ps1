#!/usr/bin/env pwsh
$base = "D:\Users\stefa\Project\YKP HERMEZ AI COMMAND CENTER\tests\webbridge-hr-pg"
function wb($bodyFile) {
  return (curl.exe -s -X POST http://127.0.0.1:10086/command -H "Content-Type: application/json" --data-binary "@$bodyFile" | Out-String)
}
function snap($n) {
  $out = wb "$base\req-snap.json"
  $out | Out-File -Encoding utf8 "$base\snap-$n.json"
  return $out
}
function shot($n) {
  $out = wb "$base\req-shot-$n.json"
  $out | Out-File -Encoding utf8 "$base\shot-$n.json"
  return $out
}
function nav($req, $snapName, $shotName) {
  wb $req | Out-File -Encoding utf8 "$base\nav-$snapName.json"
  snap $snapName | Out-Null
  shot $shotName | Out-Null
}

# Step 1: Home / Ringkasan
nav "$base\req-home.json" "home" "home"
# Step 2: Attendance
nav "$base\req-attendance.json" "attendance" "attendance"
# Step 3: Payroll
nav "$base\req-payroll.json" "payroll" "payroll"
# Step 4: Rules
nav "$base\req-rules.json" "rules" "rules"
# Step 5: Employees
nav "$base\req-employees.json" "employees" "employees"
# Step 6: Reports
nav "$base\req-reports.json" "reports" "reports"

"done" | Out-File -Encoding utf8 "$base\all-navs-done.txt"
