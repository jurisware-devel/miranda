# Data Authorization Matrix

Last updated: 2026-02-22

This matrix defines required API authorization behavior for the production shard model.

## Roles

- `guest`: unauthenticated public visitor
- `user`: authenticated non-admin subscriber
- `admin`: authenticated user in Cognito `Admin` group

## Models and Mutations

### Case

- `read`: `guest`, `user`, `admin`
- `create`: `admin` only
- `update` (metadata edits): `admin` only
- `delete`: `admin` only

### Tag

- `read`: `guest`, `user`, `admin`
- `create`: `admin` only
- `update`: `admin` only
- `delete`: `admin` only

### CaseTag

- `read`: `guest`, `user`, `admin`
- `create` (tag case): `admin` only
- `delete` (untag case): `admin` only

### saveOpinionText (custom mutation)

- `invoke`: `admin` only

### UserProfile

- `create`: authenticated users (`user`, `admin`)
- `read`: authenticated users (`user`, `admin`)
- `update`: authenticated users (`user`, `admin`)
- `delete`: `admin` only

## Enforcement Source

Primary policy lives in `/Users/jonathan/Projects/miranda/amplify/data/resource.ts`.

## Regression Guard

Policy is validated by `/Users/jonathan/Projects/miranda/tests/authz/data-auth-policy.test.mjs`.
