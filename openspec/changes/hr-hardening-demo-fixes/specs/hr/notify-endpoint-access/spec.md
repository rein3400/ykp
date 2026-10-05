# Notify Endpoint Access — Delta Spec

## Purpose

Keeps scheduler-facing notification endpoints reachable by the cron runner while preventing public access to employee data.

## ADDED Requirements

### Requirement: Reminder preview is secret-gated

The GET preview of `/api/hr/notify/contract-reminders` SHALL require the same `CRON_SECRET` authorization as its POST variant: requests without a valid `x-cron-secret` (or Bearer) header SHALL be rejected with 401 and MUST NOT include any employee-derived data.

#### Scenario: anonymous GET is rejected

- **WHEN** a request without cron credentials hits `GET /api/hr/notify/contract-reminders`
- **THEN** the response is 401 with the standard error envelope and no employee names/ids/statuses are present anywhere in the response

#### Scenario: owner previews with the cron secret

- **WHEN** a request carries the valid `x-cron-secret` header
- **THEN** the preview returns the reminder candidates normally