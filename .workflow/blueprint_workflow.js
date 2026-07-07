export const meta = {
  name: 'ykp-hermez-blueprint',
  description: 'Draft, synthesize, and package YKP Hermez migration technical blueprint (MD + DOCX)',
  phases: [
    { title: 'Draft Sections', detail: 'Parallel agents draft architecture, HR, finance, and Hermez sections' },
    { title: 'Synthesis', detail: 'Merge drafts into single cohesive markdown blueprint' },
    { title: 'Docx Generation', detail: 'Convert markdown to Word document' },
    { title: 'Verify', detail: 'Inspect MD and DOCX structure and completeness' }
  ]
}

const projectDir = 'D:/Users/stefa/Project/YKP HERMEZ AI COMMAND CENTER'
const briefPath = `${projectDir}/YKP_Hermez_Developer_Brief_Migration_V1.docx`
const draftArch = `${projectDir}/.workflow/draft_architecture.md`
const draftHR = `${projectDir}/.workflow/draft_hr.md`
const draftFinance = `${projectDir}/.workflow/draft_finance.md`
const draftHermez = `${projectDir}/.workflow/draft_hermez.md`
const finalMD = `${projectDir}/blueprint/YKP_Hermez_Migration_Blueprint.md`
const finalDOCX = `${projectDir}/blueprint/YKP_Hermez_Migration_Blueprint.docx`
const buildScript = `${projectDir}/.workflow/build_blueprint_docx.py`

phase('Draft Sections')

const [arch, hr, finance, hermez] = await parallel([
  () => agent(`Draft the architecture, topology, and governance section of a technical blueprint for the YKP Hermez migration project. Read the source brief at ${briefPath} (extract the Word XML if needed), then write a markdown file to ${draftArch}. Cover: executive summary/status, goals, principles, target architecture with a text/Mermaid diagram, data topology decision (why split into YKP_MASTER_DATABASE, YKP_HR_DATABASE, YKP_FINANCE_DATABASE), naming conventions (stable IDs, date/time, currency), and audit/permission rules. Use tables and bullet lists. Return only a short confirmation with the word count.`, { label: 'draft:architecture' }),
  () => agent(`Draft the HR app migration section of a technical blueprint. Read the source brief at ${briefPath}, then write a markdown file to ${draftHR}. Include: master_employee schema, master_outlet mapping, hr_rules schema, hr_attendance schema, payroll calculation formulas with example, step-by-step migration task list (clone, connect, fill data, configure rules, test attendance, test payroll, compare 3-5 employees, pilot 1 outlet 7 days, rollout), validation checklist, and common failure modes. Use tables. Return only a short confirmation with the word count.`, { label: 'draft:hr' }),
  () => agent(`Draft the Finance app migration section of a technical blueprint. Read the source brief at ${briefPath}, then write a markdown file to ${draftFinance}. Include: master_brand, master_outlet, master_supplier, finance categories, opening balance, fin_pos_daily, fin_supplier_cost, fin_petty_cash, fin_expense schemas, dashboard formulas (revenue, expense, supplier cost, petty cash, unpaid supplier, cash difference, net profit), migration task list (clone, connect, remove dummy data, fill masters, opening balance, POS import, sample transactions, dashboard validation, pilot), and daily validation against Moka/manual. Use tables. Return only a short confirmation with the word count.`, { label: 'draft:finance' }),
  () => agent(`Draft the Hermez AI layer section of a technical blueprint. Read the source brief at ${briefPath}, then write a markdown file to ${draftHermez}. Include: exact column contracts for hr_daily_summary and fin_daily_summary (the only sheets Hermez reads), hermes_daily_brief schema, hermes_alert_log schema, trigger/threshold rules (late staff, cash diff, supplier overdue, petty cash anomaly, high expense), brief generation logic, Telegram output format, scheduling, no-write-back policy, and example output. Use tables and code blocks. Return only a short confirmation with the word count.`, { label: 'draft:hermez' })
])

phase('Synthesis')

const synthesis = await agent(`You are the lead technical writer. Read these four draft files:
- ${draftArch}
- ${draftHR}
- ${draftFinance}
- ${draftHermez}

Merge them into ONE cohesive, developer-ready technical blueprint markdown file at ${finalMD}. Requirements:
1. Add a title page header and a numbered table of contents.
2. Use the exact same section sequence as the original brief (1–15) plus appendices:
   1. Context & Current Status
   2. Project Goals
   3. Principles for Developers
   4. Target Architecture
   5. Migration Process
   6. HR App Migration (detailed)
   7. Finance App Migration (detailed)
   8. Minimal Sheet Structure
   9. Summary Sheet Contracts for Hermez
   10. Hermez AI Command Center Logic
   11. Implementation Roadmap
   12. Pilot Plan
   13. Definition of Done
   14. Risks & Mitigations
   15. Short Developer Message / Next Actions
   Appendix A: Google Sheets Formula Examples
   Appendix B: Environment Variables & Secrets
3. Keep every table and schema from the drafts; do not drop columns. Normalize terminology.
4. Ensure cross-references are consistent (e.g., brand_id/outlet_id references).
5. Add a "Verification" subsection under DoD describing how the developer should smoke-test each layer.
6. Return the word count and a one-line quality note.`, { label: 'synthesize:blueprint' })

phase('Docx Generation')

const docxResult = await agent(`Convert the markdown blueprint at ${finalMD} into a Word document at ${finalDOCX}.

Steps:
1. Write a Python script at ${buildScript} that:
   - Reads ${finalMD} line by line.
   - Detects headings (# to ######), bullet lists (-, *, 1.), tables (|...|), and code blocks (triple backticks).
   - Uses python-docx to build a .docx with appropriate headings, body text, bullets, and tables.
   - Preserves table structure from markdown; map alignment from separator line ( :--- / :---: / ---: ) to cell paragraph alignment where possible.
   - Saves to ${finalDOCX}.
2. Run the script with python ${buildScript}.
3. If python-docx is missing, install it via pip install python-docx.
4. Return the script path, any stdout/stderr up to 30 lines, and confirmation that ${finalDOCX} exists and has size > 0.`, { label: 'generate:docx' })

phase('Verify')

const verify = await agent(`Verify the two deliverables:
1. Read ${finalMD}. Confirm it has at least 14 numbered sections, contains tables for master_brand, master_outlet, master_employee, hr_rules, hr_daily_summary, fin_daily_summary, hermes_daily_brief, and hermes_alert_log, and has a table of contents.
2. Inspect ${finalDOCX}: unzip it or use python-docx to read document.xml; confirm it has headings, paragraphs, and at least 8 tables. Report any missing elements.
3. Cross-check that the blueprint reflects every major point from the original brief ${briefPath}.
Return a concise verification report: file sizes, section count, table count, and pass/fail status.`, { label: 'verify:deliverables' })

return { arch, hr, finance, hermez, synthesis, docxResult, verify }
