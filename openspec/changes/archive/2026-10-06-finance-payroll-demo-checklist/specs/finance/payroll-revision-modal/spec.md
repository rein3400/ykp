# Revision Modal — Delta Spec

## Purpose

Forces Finance to state a reason before sending payroll back to HR, with visible confirmation that the queue item is locked during revision.

## ADDED Requirements

### Requirement: Mandatory-reason revision popup

Clicking "Minta Revisi" on the Finance payroll queue SHALL open a popup containing the employee name, a mandatory reason textarea (min 5 characters), and submit/cancel actions. Submission SHALL be disabled or rejected inline while the reason is shorter than required; a successful submit SHALL flip the row to NEEDS_REVISION locally (payable=false, locked actions hidden) and confirm with a toast.

#### Scenario: Finance opens the popup and submits with a reason

- **WHEN** Finance clicks "Minta Revisi" on an unpaid payable row and submits a reason of ≥5 characters
- **THEN** the popup opens, submission calls the needs-revision endpoint once, the row shows "MENUNGGU REVISI HR" with the reason, and the action buttons are replaced by a locked notice

#### Scenario: short reason is rejected inline

- **WHEN** Finance submits the popup with a shorter/empty reason
- **THEN** submission is blocked with a validation message and no request is sent