# Products & BOM Role UAT

Status: Ready for manual execution after test accounts are created
Owner: Product owner / Operations
Last updated: 2026-09-10

## 1. Purpose

Use this checklist once to verify the completed Customer, Product, Part, and BOM
authorization rollout from a user's point of view. Automated tests remain the
proof that hidden Server Actions are also denied; this checklist verifies page
access, field availability, buttons, and normal workflows.

Run this only against development or a dedicated test environment. Use dummy
records whose codes begin with `UAT-` and never reuse real passwords.

## 2. Expected role matrix

| Role | Customers | Products | Parts | BOMs |
| --- | --- | --- | --- | --- |
| Executive / General Manager | View | View | View | View and activate |
| Operations Manager | View; deactivate/reactivate | View; deactivate/reactivate | View; deactivate/reactivate | View and activate |
| Sales / Customer Service | Create; edit identity and operational contacts | View | No access | View |
| Production Planner | View | Create; edit production master | Create and edit | Create/edit draft; no activation |
| Procurement / Purchasing | View | View | View | View |
| Warehouse / Inventory | No access | View | View | View |
| Production Supervisor | No access | View | View | View |
| Production Operator / Team Leader | No access | View | View | View |
| Quality Control | No access | View | View | View |
| Finance / Accounts | View; edit financial fields | View; edit commercial price | View | View |
| System Administrator | View only | View only | View only | View only |

`System Administrator` is deliberately not a business super-user. Assign a
second business role when an administrator also performs an operational job.

## 3. Test preparation

- [ ] Create one test user for each role in section 2.
- [ ] Use a unique password for every test user and keep credentials outside Git.
- [ ] Sign out and back in after assigning or changing a role so the new
  `authVersion` is used.
- [ ] Prepare one dependency-free Customer for lifecycle testing.
- [ ] Prepare one active Product with an active Part and a complete draft BOM.
- [ ] Prepare one Product/Customer with dependencies to verify blocked
  deactivation.

## 4. Common checks for every role

- [ ] The user can sign in and sees no prototype password or shared credential.
- [ ] Directly opening an unauthorized URL shows **Access restricted**.
- [ ] Unauthorized create, edit, deactivate, reactivate, and activate buttons are
  absent rather than merely cosmetic.
- [ ] Authorized list and detail pages load without exposing an unavailable
  action.
- [ ] Signing in after a role change reflects the new permissions.

## 5. Business workflow checks

### Sales / Customer Service

- [ ] Create `UAT-CUSTOMER-SALES` with identity and primary contact information.
- [ ] Confirm commercial fields are disabled during creation and editing.
- [ ] Edit identity, notes, and primary operational contacts successfully.
- [ ] Confirm accounts-payable email is disabled because it belongs to Finance.
- [ ] Confirm Customer lifecycle controls and the Parts Library are unavailable.

### Finance / Accounts

- [ ] Open `UAT-CUSTOMER-SALES` and edit payment terms, credit limit, currency,
  discount, tax information, and accounts-payable email.
- [ ] Confirm Customer identity and operational-contact fields are disabled.
- [ ] Edit a Product commercial price and confirm production master fields are
  disabled.
- [ ] Confirm create and lifecycle controls remain unavailable.

### Production Planner

- [ ] Create `UAT-PRODUCT-PLANNER`; confirm an editable draft BOM is created.
- [ ] Create and edit `UAT-PART-PLANNER`.
- [ ] Add the Part to the draft, update its quantity/UOM, and remove/re-add it.
- [ ] Create a new draft revision from an active or archived revision.
- [ ] Confirm Product price, Product/Part lifecycle, and BOM activation controls
  are unavailable.

### Operations Manager

- [ ] Open a complete draft BOM and activate it.
- [ ] Confirm the former active revision becomes archived.
- [ ] Deactivate and reactivate dependency-free Customer, Product, and Part test
  records.
- [ ] Confirm deactivation is blocked when active Products, live purchase orders,
  or active BOM usage still exists.
- [ ] Confirm draft line editing and Product/Part master editing are unavailable.

### Executive / General Manager

- [ ] View all four modules and activate a complete BOM draft.
- [ ] Confirm routine create/edit and Customer/Product/Part lifecycle controls are
  unavailable.

### Read-only operational roles

Repeat for Procurement, Warehouse, Production Supervisor, Production Operator /
Team Leader, and Quality Control:

- [ ] Open each module marked **View** in section 2.
- [ ] Confirm no master-data or BOM workflow mutation controls are shown.
- [ ] Confirm modules marked **No access** show **Access restricted** when opened
  directly.

### System Administrator

- [ ] View Customer, Product, Part, and BOM pages for support purposes.
- [ ] Confirm all business create, edit, lifecycle, draft, and activation controls
  are unavailable.

### Multiple-role user

- [ ] Assign Sales / Customer Service plus Finance / Accounts to one test user.
- [ ] Confirm the user can edit all three Customer field groups and create a
  Customer with financial values.
- [ ] Remove Finance, sign out/in, and confirm financial editing disappears while
  Sales access remains.

## 6. Completion record

Record the environment, date, tester, failed scenario, role, page URL, and a
short description for every defect. Do not include passwords, cookies, session
tokens, or real Customer data in screenshots or issue reports.

Phase 3 is accepted only when every applicable item passes or has an explicitly
approved deferral in the implementation plan.
