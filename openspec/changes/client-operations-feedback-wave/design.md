## Context

Client approved the scope on 2026-10-07. Source investigation identified two attendance writers, user role versus employee job-title differences, event attribution using current employee assignment, leave reasons saved but omitted by bot formatting, manual Warehouse conversions with NaN validation gaps, and Ops closing aggregate cash rows without checklist details. Source seeds use ordinary IDs, random values, and incomplete provenance: seed resemblance cannot authorize deletion.

## Goals / Non-Goals

**Goals:** implement the approved feedback with testable domain contracts, preserve real history, and provide truthful completion evidence per item.

**Non-goals:** staff web-access cutover; mobile-login diagnosis; inventing SMTP credentials; changing 1 kg to 10,000 g; treating mass/volume as interchangeable; promising zero bugs without tests and live acceptance.

## Decisions

### 1. HR identity, employment and actual attendance location

Employment categories remain PROBATION/PERMANENT/CONTRACT with matching human labels; active/inactive account lifecycle is separate. Names are not globally unique identities. Show active authorized master outlet name, outlet_code and stable outlet_id in HR forms.

Use one shared attendance service across both Telegram pairing paths. Add an owner/HR-controlled multi-location permission with an explicit role allowlist (supervisor, outlet_manager, brand_manager, finance_admin, hr_admin, owner, super_admin); ordinary employees default to home outlet. Multi-location users select an active outlet and must supply GPS within that outlet radius. This does not broaden dashboard read/RBAC rights or exempt GPS. Persist the chosen outlet in attendance and audit; checkout uses that recorded outlet, not a newly edited home assignment. Resolve shift from applicable roster and do not silently claim computed lateness/overtime if schedule is unavailable. Decide transfer-between-outlets/session semantics before implementing additional daily sessions; baseline remains the existing daily attendance model.

Join operational leaves/events to employee identity when denormalized outlet fields are absent; actual attendance outlet determines outlet-attributable counts. Require trimmed rejection reason server-side, HTML-escape it in bot output and notify the active linked account after persistence, recording delivery failures rather than rolling back decisions.

Employee removal is restricted to accidental records with no attendance, payroll, leave, roster, adjustment, linked user or supervisor/replacement references. Never cascade real history; conflict response lists sanitized blocking domains. HR-authorized deletion requires confirmation and before-image audit. Any missing reference enumeration blocks hard deletion; permit corrections and ordinary same-name records independently.

### 2. Finance operational filters versus obligations

Use the active outlet policy for current pickers/KPIs and all-outlet operational daily views, enforce role scope server-side. Explicit historical reporting retains closed outlet records. Unpaid liabilities/payroll and unresolved financial-obligation alerts remain visible irrespective of closure. Do not reuse a global storage filter. Include a closed-outlet debt regression and inactive-only POS fixture so empty POS cannot hide obligations.

### 3. Warehouse units and notifications

Physical fixed conversions use kg/g and l/ml (including explicit aliases): kg→g=1000, g→kg=0.001, l→ml=1000, ml→l=0.001, same unit=1. No generic kg↔ml rule. Autofill and validate known factors server-side; retain editable finite positive manual factors for per-item packaging units such as box/carton/roll. Reject NaN/infinity and conflicting duplicate conversions. Document whether transaction normalization uses the conversion master; do not claim stock normalization solely because the configuration form exists.

Stock minimum/maximum thresholds require validated scope, units and bounded numeric values. Routing is an explicit selected linked recipient/role/outlet configuration for Ops supervisors, not guessed chat IDs or broadcast fallback. Missing recipients produce observable configuration/delivery status. Connect persisted thresholds to low/overstock rule evaluation and test boundary behavior, deduplication and recipient isolation.

### 4. Ops checklist closing and Telegram reporting

Reuse Opening interaction structure: active outlet and shift, departmental template groups, DONE/NOT_DONE, notes/photo, completion and critical-item counts. Closing uses CLOSING templates; clone the existing active Opening template content into missing Closing templates only with stable provenance and no overwriting owner-edited templates. Do not fall back to other outlets' templates when selected outlet has none.

Persist per-item closing submissions in the existing checklist submission store where schema supports it; preserve legacy ops_closing cash rows as history. A final aggregate CLOSED state requires all mandatory/critical gates, no default DONE without item evidence. No daily revenue entry in Ops Closing; Finance/Moka remain authoritative. Schema/header drift requires reviewed additive migration, not destructive rewrite.

Briefing date defaults to WIB today and is clearly displayed with shift; validate supplied dates and shifts. Telegram menu exposes the existing operational reporting capabilities (opening, closing, briefing acknowledgement, KDS, QC, incidents, waste and stock issues as authorized), guides outlet/shift selection, validates identity/activity and records audit through shared web-domain services. Duplicate webhook events must be idempotent. This is a reporting flow, not merely links to pages staff cannot access.

### 5. Dummy cleanup and deployment

First read-only inventory actual storage backends and workbook sharing. Capture a restricted backup and manifest with table, physical identity, full preimage/hash, seed evidence and dependent references. Ordinary IDs/names/date/zeros are not provenance. Ambiguous entries need owner review; never erase audit history or truncate a domain. Warehouse item/supplier cleanup must include dependent recipes, purchase, batches and movements as a coherent reviewed graph, with stock reconciliation.

Deploy repeatable additive/non-destructive schema readiness checks. No dummy seeds or destructive cleanup in automatic deploy.sh. Keep secrets outside Git; commit implementation/tests/non-secret operational records. Rotate previously exposed credentials separately with coordinated deployment, not silently.

## Risks / Trade-offs

- Linked-user migrations and duplicate IDs can target the wrong table: table-specific identity and physical-row/preimage checks are required.
- Multi-location changes payroll attribution: record actual outlet, preserve original payroll obligations and test overnight/home-assignment-change checkout.
- Telegram delivery failure after successful decision must remain visible and retryable without duplicate mutation.
- Mixed seed and real records cannot be safely classified from source recipes alone: cleanup completion may require owner-approved candidates or a separately authorized clean backend.
- Closing contract changes may affect summary consumers: maintain additive compatibility for historical aggregates and deploy producer/schema before consumers.

## Migration Plan

Implement independently tested HR, Finance, Warehouse, then Ops slices; regression tests must fail before fixes. Run lint, typecheck, full tests/build per touched app. Review cross-module scope/security before deploy. Backup and dry-run cleanup separately; owner approves exact ambiguous candidates before destructive apply. Roll out schemas/producers before Telegram/summary consumers; verify GPS, rejection delivery, low/overstock recipients and closing item persistence live. Record unresolved SMTP/data cleanup/live acceptance blockers honestly; archive only after acceptance.
