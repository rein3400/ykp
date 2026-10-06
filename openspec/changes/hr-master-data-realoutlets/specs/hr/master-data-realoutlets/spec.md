# Master Data Real Outlets — Delta Spec

## Purpose

Restricts the outlet list to the four real client locations and the employment status field to the canonical three states, in both stored data and rendered UI.

## ADDED Requirements

### Requirement: Canonical outlet list

`master_outlet` SHALL contain exactly four active outlets — `Sekar Pizza Tirtodipuran`, `Sekar Pizza Colombo`, `Funkydak Colombo`, `Suburbun` — every other outlet row SHALL be `active_status=inactive` (never deleted; historic attendance/roster references keep resolving), and UI outlet pickers SHALL offer only active outlets while display maps still render names of historic rows.

#### Scenario: migration converges the outlet list

- **WHEN** the fix-master-data migration runs against a sheet with dummy outlets (Kemang, Cipete, smoke-test row, …)
- **THEN** the four real outlets are active with stable ids (known OL- ids reused; missing ones appended), all others are inactive, and re-running is a no-op

### Requirement: Closed employment status set with labels

Employee `employment_status` SHALL hold only `PROBATION`, `PERMANENT`, or `CONTRACT` (upper-case storage tokens). Variant spellings found in data (TETAP, PERMANENT variants, KONTRAK, PKWT, PROBASI, …) SHALL be normalized by the migration; unknown values SHALL be left untouched and reported. UI SHALL render the labels `Probation`, `Permanent`, `Contract` and the create/edit form SHALL offer exactly these three.

#### Scenario: variant status normalized, unknown reported

- **WHEN** a row holds `TETAP` it becomes `PERMANENT`; a row holding `FREELANCE` stays unchanged and appears in the migration report for manual follow-up.