# Current System Manual Test Scenarios

Status: Ready for development testing
Owner: Product owner / Operations
Last updated: 2026-09-14

## Before testing

- Use the development environment and dummy records beginning with `UAT-`.
- Use the generated local UAT credentials. Never record passwords here.
- Sign out before changing to another role.
- Record **Pass**, **Fail**, or **Not ready** for each scenario.
- Delete only the dummy business records created during this test.

## Authentication and session security

### MT-01 - Sign in and sign out

1. Sign in with a valid active UAT user.
2. Confirm the dashboard opens.
3. Sign out.
4. Try to reopen a protected page.

Expected: Sign-in succeeds, sign-out returns to login, and the protected page
cannot be used after sign-out.

### MT-02 - Incorrect password

1. Enter a valid UAT email with an incorrect password.
2. Repeat once with an email that does not exist.

Expected: Both attempts fail with a general message that does not reveal
whether the account exists.

### MT-03 - Temporary login block

Use a dedicated UAT user, not the administrator account.

1. Enter the wrong password five times within 15 minutes.
2. Immediately enter the correct password.
3. Open Security Monitoring as an authorized administrator.

Expected: The correct password remains temporarily blocked, the user stays
active, and one rate-limit event appears. The block clears after 15 minutes.

### MT-04 - Change own password

1. Sign in and open **Account security**.
2. Try an incorrect current password.
3. Change to a valid new password.
4. Confirm the app signs out.
5. Confirm the old password fails and the new password works.

Expected: Only the correct current password permits the change, and previous
sessions and the old password stop working.

## Customers

### MT-05 - Sales creates a customer

1. Sign in as Sales / Customer Service.
2. Create `UAT-CUSTOMER-MANUAL`.
3. Edit the customer's general and contact details.
4. Try to edit financial details.

Expected: Sales can create and edit normal customer details but cannot edit
financial fields.

### MT-06 - Finance completes customer finance details

1. Sign in as Finance / Accounts.
2. Click anywhere on the `UAT-CUSTOMER-MANUAL` row.
3. Edit payment terms, credit limit, currency, or accounts-payable details.
4. Try to edit the customer's identity details.

Expected: The whole row opens the customer, Finance can edit financial fields,
and identity fields remain unavailable.

## Products, Parts, and BOMs

### MT-07 - Planner creates product master data

1. Sign in as Production Planner.
2. Create `UAT-PRODUCT-MANUAL` for the UAT customer.
3. Confirm a revision-1 draft BOM is created.
4. Create `UAT-PART-MANUAL` and add it to the draft BOM.
5. Change its quantity and save.

Expected: The Product, Part, draft BOM, and BOM line save successfully. The
planner cannot activate the BOM.

### MT-08 - Operations activates a BOM

1. Sign in as Operations Manager.
2. Open the product by clicking anywhere on its table row.
3. Review and activate the completed draft BOM.
4. Create or open a newer draft and activate it.

Expected: The selected draft becomes active and the previously active revision
is retained as archived history.

### MT-09 - Read-only role

1. Sign in as Warehouse / Inventory or Quality Control.
2. Open each permitted Product, Part, and BOM page.
3. Try opening a known unauthorized URL directly.

Expected: Permitted records are visible, edit controls are absent, and the
unauthorized page shows **Access restricted**.

## Roles and administration

### MT-10 - Multiple roles combine permissions

1. Sign in with the Sales + Finance UAT account.
2. Open the test customer.
3. Edit both general and financial details.
4. Remove Finance from the account and sign in again.

Expected: Both permission sets work together at first. After Finance is
removed, financial editing disappears while Sales access remains.

### MT-11 - Account status blocks access

1. As an authorized administrator, suspend a UAT user.
2. Try signing in as that user.
3. Restore the user and try again.

Expected: The suspended user cannot sign in, restoration allows sign-in again,
and both administrator actions appear in the audit history.

### MT-12 - Security Monitoring access

1. Sign in as System Administrator and open Security Monitoring.
2. Find recent sign-in, sign-out, access-denied, password, and account events.
3. Sign in as a normal business user and try the same page directly.

Expected: The administrator can inspect events without seeing passwords or
tokens. A normal business user cannot access the page.

### MT-13 - Sensitive change reason

1. Start an account, role, password-reset, or activation-link change as an
   authorized administrator.
2. Leave the reason empty or enter fewer than 10 characters.
3. Confirm the change cannot be submitted.
4. Enter a clear reason and complete the change.
5. Find the resulting event in Security Monitoring.

Expected: The server rejects a missing or short reason, the valid change
succeeds, and the exact normalized reason appears in the audit event without
passwords, links, or tokens.

## Test result record

| Date | Environment | Tester | Scenarios | Result | Defect or notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  | MT-01 to MT-13 |  |  |

For a failure, record the scenario number, role, page, expected result, actual
result, and a screenshot if safe. Never include credentials, session cookies,
reset links, or real customer information.
