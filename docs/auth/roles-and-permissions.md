# Roles and Permissions

Status: Approved baseline; maintained as modules are implemented
Owner: Product owner / Operations
Last updated: 2026-09-12
Applies to: General production and manufacturing companies

Related documents: [Auth documentation index](README.md),
[architecture](authentication-and-authorization-architecture.md),
[audit events](audit-events.md), [implementation plan](implementation-plan.md),
and [deferred Sales/CRM architecture](../architecture/sales-crm-and-customer-onboarding-workflow.md)

## 1. Purpose

This document is the source of truth for who will use the ERP, what each role
is responsible for, and how permissions should be designed. It must be updated
when a module, business process, approval, or role changes.

The matrix describes the target authorization model. Customers, Parts, Products,
and BOMs now enforce these role-specific permissions, and Access Control now
supports multiple assignments and company-specific custom roles.

## 2. Agreed user population

The ERP is designed around ten general production-company business roles:

1. Executive / General Manager.
2. Operations Manager.
3. Sales / Customer Service.
4. Production Planner.
5. Procurement / Purchasing.
6. Warehouse / Inventory.
7. Production Supervisor.
8. Production Operator / Team Leader.
9. Quality Control.
10. Finance / Accounts.

`SYSTEM_ADMIN` is also required as a technical access role. It is not treated
as a normal business department and does not automatically carry business
approval authority.

Specialist roles such as dedicated Product Engineer, Maintenance Planner, BOM
Approver, Compliance Auditor, or Logistics Coordinator are intentionally not
part of the initial model. Their duties can be assigned through the agreed
roles if a company needs them later.

## 3. Authorization design principles

### 3.1 Users may hold multiple roles

One employee may work across several functions, particularly in a smaller
company. A user may therefore hold more than one role. Examples:

- A Production Planner may also hold Procurement / Purchasing.
- An Operations Manager may also hold Production Supervisor.
- An Executive may also hold Finance / Accounts.

The target database design must not remain limited to the current single
`User.role` text field.

### 3.2 Roles describe functions; permissions describe actions

Roles are reusable permission bundles. Application code should check a named
permission such as `bom.activate`, not hard-code a job title such as
`OPERATIONS_MANAGER` throughout the codebase.

### 3.3 Deny by default

A user receives no write access unless a role explicitly grants the required
permission. Navigation visibility is not a security control; every Server
Action and future API endpoint must independently enforce authorization.

### 3.4 Separate preparation from approval

Where practical, the person who prepares a controlled transaction should not
approve the same transaction. This is particularly important for:

- BOM preparation and activation.
- Purchase-order preparation and approval.
- Inventory adjustment entry and approval.
- Quality inspection and stock release.
- Customer credit changes and credit overrides.

### 3.5 Preserve history

Deactivation, cancellation, archiving, approval, and reversal permissions are
more sensitive than ordinary editing. Operational records should normally be
reversed, superseded, or archived instead of physically deleted.

### 3.6 Technical administration is not business authority

`SYSTEM_ADMIN` manages accounts, access, configuration, and integrations. It
should not automatically approve BOMs, purchase orders, credit overrides, or
quality releases unless the person also holds the appropriate business role.

## 4. Permission level notation

The high-level matrix uses these symbols:

| Code | Meaning |
| --- | --- |
| `—` | No normal access |
| `V` | View records relevant to the role |
| `T` | Create or update normal working records |
| `A` | Approve, release, cancel, deactivate, or control exceptions |
| `ADM` | Configure the module or administer security |

`T` does not include `A`. A role may have both, shown as `T+A`.

## 5. Role profiles

### 5.1 Executive / General Manager (`EXECUTIVE_GENERAL_MANAGER`)

Purpose: company-wide oversight and high-impact approval.

Typical work:

- View company, sales, production, inventory, purchasing, quality, and finance KPIs.
- Review exceptions, shortages, delays, quality events, and financial exposure.
- Approve transactions above agreed financial or operational thresholds.
- Authorize exceptional overrides where company policy permits.

Boundaries:

- Primarily a viewing and approval role, not a routine data-entry role.
- Does not administer user accounts unless also assigned `SYSTEM_ADMIN`.
- Does not bypass quality or audit controls without a recorded exception.

### 5.2 Operations Manager (`OPERATIONS_MANAGER`)

Purpose: control day-to-day operations across planning, production, purchasing,
inventory, and dispatch.

Typical work:

- Review operational dashboards and work queues.
- Activate BOM revisions prepared by Production Planning.
- Approve Product, Part, and Customer deactivation when dependencies permit.
- Approve purchase orders and inventory adjustments within delegated limits.
- Resolve production, inventory, purchasing, and delivery exceptions.

Boundaries:

- Does not manage user security unless also assigned `SYSTEM_ADMIN`.
- Does not change Customer credit limits unless also assigned Finance / Accounts.
- Quality release remains owned by Quality Control unless a formal override is defined.

### 5.3 Sales / Customer Service (`SALES_CUSTOMER_SERVICE`)

Purpose: manage Customer relationships, demand, orders, and delivery communication.

Typical work:

- Capture and qualify Leads; manage Prospect Accounts, Opportunities, RFQs,
  and approved Quote communication when the standalone Sales/CRM module is
  introduced.
- Create and maintain Customer identity, contacts, and delivery information.
- Create and maintain sales orders when that module is introduced.
- View Products, active BOM availability, inventory availability, and order progress.
- Record Customer forecasts or demand information when permitted.
- Enter, correct, cancel, and release Standard or Blanket Customer POs.
- Record documented positive Blanket PO top-ups.
- Maintain Customer-facing Product descriptions or SKU mappings later.

Boundaries:

- Cannot edit BOM components, quantities, or revisions.
- Cannot directly adjust inventory.
- Cannot change Customer credit limits or override credit holds.
- Cannot activate BOMs or approve purchase orders.
- Cannot override a Customer PO validation failure; discrepancies must be
  corrected with the Customer.

### 5.4 Production Planner (`PRODUCTION_PLANNER`)

Purpose: maintain production master data and turn demand into executable plans.

Typical work:

- Create and edit Product and Part master records.
- Prepare and validate draft BOM revisions.
- Maintain forecasts, planning rates, units per shipper, and scheduling inputs.
- Create production plans and work orders when production execution is introduced.
- Review shortages and material requirements.

Boundaries:

- Cannot activate their own BOM revision under normal separation-of-duty rules.
- Cannot create or approve purchase orders unless also assigned Procurement.
- Cannot make physical inventory adjustments.
- Cannot release quality-held material.

### 5.5 Procurement / Purchasing (`PROCUREMENT_PURCHASING`)

Purpose: procure materials and manage supplier purchasing activity.

Typical work:

- View Products, Parts, BOM requirements, forecasts, and inventory availability.
- Create and edit purchase requisitions and purchase orders.
- Maintain expected dates, supplier references, quantities, and purchase pricing.
- Follow overdue orders and purchasing exceptions.
- Submit purchase orders for approval when thresholds apply.

Boundaries:

- Cannot edit Product or BOM definitions.
- Cannot receive stock merely by changing a purchase-order status.
- Cannot approve their own high-value purchase order unless policy explicitly allows it.
- Cannot change Customer credit or sales pricing.

### 5.6 Warehouse / Inventory (`WAREHOUSE_INVENTORY`)

Purpose: control physical stock and warehouse execution.

Typical work:

- Receive materials against purchase orders.
- Put away, transfer, pick, issue, return, and count stock.
- Record warehouse locations, lot/batch references, and stock condition.
- View released BOMs and production material requirements.
- Initiate inventory adjustments with a reason.

Boundaries:

- Cannot edit BOM quantities or Product definitions.
- Cannot change purchase prices, Customer credit, or financial values.
- Cannot approve high-value inventory adjustments they entered.
- Cannot release stock held by Quality Control.

### 5.7 Production Supervisor (`PRODUCTION_SUPERVISOR`)

Purpose: control execution of the approved production plan.

Typical work:

- View released BOMs, work orders, material availability, and schedules.
- Assign work to teams and sequence production activity.
- Start, pause, complete, or report exceptions against production work.
- Review output, material usage, scrap, downtime, and labour reporting.
- Confirm production completion subject to quality requirements.

Boundaries:

- Cannot change released BOM definitions.
- Cannot directly change financial or Customer-credit information.
- Cannot release rejected or quality-held stock.
- Cannot create purchase orders unless also assigned Procurement.

### 5.8 Production Operator / Team Leader (`PRODUCTION_OPERATOR_TEAM_LEADER`)

Purpose: perform and report assigned production work.

Typical work:

- View assigned jobs, work instructions, and released BOM information.
- Record quantities started, completed, scrapped, or reworked.
- Record material consumption, downtime, and production notes.
- Escalate shortages, defects, and equipment problems.
- A Team Leader may coordinate tasks for their assigned team or shift.

Boundaries:

- Cannot create or edit Products, Parts, or BOM definitions.
- Cannot activate BOMs, approve purchase orders, or adjust Customer credit.
- Cannot make unrestricted inventory adjustments.
- Cannot complete work outside their assigned team, shift, or site when data scoping is introduced.

### 5.9 Quality Control (`QUALITY_CONTROL`)

Purpose: inspect and control the quality status of materials and production output.

Typical work:

- View Products, Parts, released BOMs, lots, work orders, and traceability information.
- Record inspections, samples, results, defects, and non-conformances.
- Place stock or production output on quality hold.
- Release, reject, quarantine, or require rework according to policy.
- Review supplier and production quality history.

Boundaries:

- Cannot change BOM quantities as part of an inspection.
- Cannot change purchasing prices or Customer financial data.
- Quality results and release decisions must retain an audit history.
- Operations cannot silently override a quality hold.

### 5.10 Finance / Accounts (`FINANCE_ACCOUNTS`)

Purpose: maintain financial controls and reconcile commercial activity.

Typical work:

- Maintain Customer credit limits, payment terms, discounts, and tax information.
- View sales orders, purchase orders, receipts, dispatches, and inventory values.
- Review pricing, invoice readiness, variances, and financial exceptions.
- Apply or approve credit holds and authorized overrides later.
- Produce financial and reconciliation reports.

Boundaries:

- Cannot alter physical stock quantities directly.
- Cannot change BOM components or production results.
- Cannot release quality-held inventory.
- Cannot administer user access unless also assigned `SYSTEM_ADMIN`.

### 5.11 System Administrator (`SYSTEM_ADMIN`)

Purpose: administer the application securely.

Typical work:

- Create, disable, and support user accounts.
- Create, duplicate, edit, archive, and reactivate custom roles.
- Assign approved roles.
- Configure authentication, integrations, reference settings, and imports.
- Review technical logs and investigate access problems.
- Support backup, recovery, and deployment operations.

Boundaries:

- Does not receive business approval permissions automatically.
- Cannot use support access to conceal or rewrite business history.
- Elevated actions must be audited.
- At least one recoverable administrator account must exist.

## 6. High-level module matrix

This is the maintained baseline matrix. Detailed permission keys in section 8
are enforced by application code as each module is implemented.

| Role | Customers | Product/Part Master | BOM | Customer Orders | Forecast & Planning | Purchasing | Inventory | Production | Quality | Finance | Security |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Executive / GM | V | V | V+A | V | V | V+A | V | V | V | V+A | — |
| Operations Manager | V+A | V+A | V+A | V | V+A | V+A | V+A | T+A | V | V | — |
| Sales / Customer Service | T | V | V | T+A | T | V | V | V | V | V-limited | — |
| Production Planner | V | T | T | V | T | V | V | T | V | V-limited | — |
| Procurement / Purchasing | V | V | V | — | V | T | V | V | V | V-limited | — |
| Warehouse / Inventory | V-limited | V | V-released | — | V | V-receiving | T | V | V | — | — |
| Production Supervisor | — | V | V-released | V | V | V | V | T | V | — | — |
| Production Operator / Team Leader | — | V-limited | V-released | — | V-assigned | — | T-limited | T-assigned | T-report | — | — |
| Quality Control | V-limited | V | V-released | — | V | V | T-quality | V | T+A | — | — |
| Finance / Accounts | T-financial | V-financial | V | — | V | V-financial | V-value | V | V | T+A | — |
| System Administrator | V-support | V-support | V-support | V-support | V-support | V-support | V-support | V-support | V-support | V-support | ADM |

Terms such as `limited`, `released`, `assigned`, `financial`, and `quality`
represent data or field scope that must be defined when those modules are built.

## 7. Ownership of sensitive actions

| Sensitive action | Prepares or requests | Approves or controls |
| --- | --- | --- |
| Create/edit Customer identity and contacts | Sales / Customer Service | Operations Manager for exceptional deactivation |
| Change Customer credit, discount, payment, or tax settings | Finance / Accounts | Finance authority; Executive above threshold |
| Create/edit Product and Part master data | Production Planner | Operations Manager for deactivation |
| Prepare draft BOM | Production Planner | Operations Manager activates/releases |
| Enter/correct a Customer PO or release | Sales / Customer Service | Automatic validation; no manager approval or override |
| Record a Blanket Customer PO top-up | Sales / Customer Service | Customer authority is retained as an amendment |
| Create purchase order | Procurement / Purchasing | Operations Manager; Executive above threshold |
| Receive purchased stock | Warehouse / Inventory | Based on approved PO; Quality controls held stock |
| Enter inventory adjustment | Warehouse / Inventory | Operations Manager above threshold |
| Create production plan/work order | Production Planner | Production Supervisor releases/executes |
| Report production | Operator / Team Leader | Production Supervisor reviews/completes |
| Record inspection and place hold | Quality Control | Quality Control releases/rejects under policy |
| Override operational or financial exception | Relevant manager | Executive when outside delegated threshold |
| Assign roles or disable users | System Administrator | Must follow approved access request |

## 8. Initial permission catalogue

These names are the recommended stable permissions for implementation. New
features should reuse or deliberately extend this catalogue.

### 8.1 Customer permissions

- `customer.view`
- `customer.create`
- `customer.edit_identity`
- `customer.edit_contacts`
- `customer.edit_financial`
- `customer.deactivate`
- `customer.reactivate`
- `customer.address.manage` — later

### 8.2 Product permissions

- `product.view`
- `product.create`
- `product.edit_master`
- `product.edit_commercial`
- `product.deactivate`
- `product.reactivate`

### 8.3 Part permissions

- `part.view`
- `part.create`
- `part.edit`
- `part.deactivate`
- `part.reactivate`

### 8.4 BOM permissions

- `bom.view`
- `bom.draft.create`
- `bom.draft.edit`
- `bom.draft.discard`
- `bom.activate`
- `bom.archive`
- `bom.import`

### 8.5 Forecast and planning permissions

- `forecast.view`
- `forecast.create`
- `forecast.edit`
- `production_plan.view`
- `production_plan.create`
- `production_plan.release`

### 8.6 Customer Order permissions

- `customer_order.view`
- `customer_order.create`
- `customer_order.edit`
- `customer_order.cancel`
- `customer_order.blanket_amend`
- `customer_order.release.create`
- `customer_order.release.edit`

These permissions apply to purchase orders received from Customers. They are
separate from supplier purchasing permissions below.

### 8.7 Purchasing permissions

- `purchase_order.view`
- `purchase_order.create`
- `purchase_order.edit`
- `purchase_order.submit`
- `purchase_order.approve`
- `purchase_order.cancel`
- `purchase_order.view_cost`

### 8.8 Inventory permissions

- `inventory.view`
- `inventory.receive`
- `inventory.transfer`
- `inventory.issue`
- `inventory.return`
- `inventory.count`
- `inventory.adjust.request`
- `inventory.adjust.approve`
- `inventory.view_value`

### 8.9 Production permissions

- `production_work.view`
- `production_work.assign`
- `production_work.start`
- `production_work.report`
- `production_work.complete`
- `production_work.cancel`

### 8.10 Quality permissions

- `quality.view`
- `quality.inspect`
- `quality.hold`
- `quality.release`
- `quality.reject`
- `quality.nonconformance.manage`

### 8.11 Finance permissions

- `finance.view`
- `finance.customer_credit.manage`
- `finance.pricing.manage`
- `finance.invoice.manage`
- `finance.override_credit_hold`
- `finance.report`

### 8.12 Administration permissions

- `admin.user.view`
- `admin.user.invite`
- `admin.user.manage`
- `admin.role.assign`
- `admin.role.manage`
- `admin.configuration.manage`
- `admin.integration.manage`
- `admin.audit.view`

## 9. Current application enforcement state

Customer, Part, Product, BOM, and Customer Order entry points enforce the role
matrix at protected page reads and Server Actions. Customer Order navigation is
also permission-aware: Customer Service can create, correct, and cancel
pre-planning orders; designated operational roles can view them; unrelated
roles do not receive access.

Access Control now supports invitation and activation, existing-user status
management, multiple role assignments, effective-permission inspection, and
custom roles built only from the controlled permission catalogue. Standard
roles remain locked.

The normalized `Role`, `Permission`, `UserRole`, and `RolePermission` tables now
exist and are seeded from the typed authorization registry. The legacy
`User.role` string remains temporarily because Auth.js still copies it into the
JWT/session. The implemented database model supports:

```text
User ──< UserRole >── Role ──< RolePermission >── Permission
```

Required implementation behavior:

Completed foundation:

1. Seed stable roles and permissions rather than accepting arbitrary strings.
2. Allow multiple role assignments per user in the database.
3. Preserve and explicitly map all known legacy roles.

Remaining enforcement work:

1. Apply the implemented central permission guard to every future module entry
   point and API endpoint.
2. Protect sensitive reads and return only permitted data.
3. Use the same permission result to hide or disable unavailable UI actions.
4. Record sensitive approvals, status changes, and role assignments later.
5. Expose the recoverable bootstrap administrator procedure operationally.

## 10. Data-scope direction

The first permission release may allow organization-wide access. The design
must leave room for later scoping by:

- Company or legal entity.
- Site or factory.
- Warehouse.
- Department.
- Production line.
- Shift or team.
- Assigned work.

Role permission and data scope are separate. For example, two users may both
have `inventory.transfer`, while each is limited to different warehouses.

## 11. Open decisions before implementation

1. May an Executive edit operational records, or only view and approve them?
2. Does Sales create Product records, or request them from Production Planning?
3. What financial threshold requires Operations or Executive PO approval?
4. What inventory-adjustment threshold requires independent approval?
5. May an Operations Manager override a Quality hold, and under what recorded reason?
6. Can Production Planners activate a BOM prepared by another Planner?
7. Does Team Leader access cover only an assigned team/shift or the whole site?
8. Which Customer fields belong exclusively to Finance?
9. Who approves user-role assignments?
10. Will the first release need site or warehouse-level data restrictions?

Until decided, use the safest defaults:

- Executives view and approve but do not routinely edit.
- Sales requests new Products; Production Planning creates them.
- Production Planning prepares BOMs; Operations activates them.
- Procurement prepares POs; Operations approves them.
- Warehouse enters adjustments; Operations approves material adjustments.
- Quality Control alone releases quality-held stock.
- Finance alone changes credit limits and financial Customer settings.

## 12. Implementation sequence

1. Confirm the open decisions and high-level matrix.
2. Add normalized `Role`, `Permission`, `UserRole`, and `RolePermission` tables.
3. Seed the agreed roles and initial permission catalogue.
4. Migrate existing users from the free-text role safely.
5. Add one central server-side authorization helper.
6. Protect Customer, Product, Part, and BOM Server Actions.
7. Update navigation and action visibility.
8. Add authorization tests for allowed and denied paths.
9. Add role-management UI for System Administrators.
10. Add sensitive-action audit history.

## 13. Maintenance rules

Update this document when:

- A role is added, removed, renamed, split, or merged.
- A module or sensitive action is introduced.
- Approval ownership or thresholds change.
- A new data scope is introduced.
- Authorization code differs from the documented matrix.

For every change:

1. Update the role profile and module matrix.
2. Add or change the stable permission key.
3. Update affected server-side authorization tests.
4. Add an entry to the decision log below.
5. Change the status from Draft only after business approval.

## 14. Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-09-09 | Use ten broadly applicable production-company business roles. | They cover the main order, planning, purchasing, inventory, production, quality, and finance functions without introducing niche roles. |
| 2026-09-09 | Combine Production Operator and Team Leader initially. | Both need limited execution access; team or shift scope can distinguish responsibility later. |
| 2026-09-09 | Keep System Administrator as a technical role outside the ten business roles. | User administration is necessary but must not automatically grant business approval authority. |
| 2026-09-09 | Design for multiple roles per user. | Employees in smaller companies commonly perform more than one business function. |
| 2026-09-09 | Separate stable permissions from role names. | Server code can enforce actions consistently while role bundles evolve with the business. |
| 2026-09-09 | Separate BOM preparation from activation. | Independent release reduces accidental or unauthorized production changes. |
| 2026-09-10 | Enforce all five Parts permissions independently. | Viewing, master-data maintenance, and lifecycle control belong to different operational responsibilities. |
| 2026-09-10 | Separate Product operational fields from commercial price updates. | Production Planning owns production master data while Finance owns commercial pricing. |
| 2026-09-10 | Treat Product creation and deactivation as compound BOM operations. | Creating a Product creates a draft BOM, and deactivation archives BOMs, so both permission boundaries must approve the change. |
| 2026-09-10 | Require `bom.archive` when activating a BOM revision. | Activation archives the previous active revision in the same transaction, so release authority cannot bypass archival authority. |
| 2026-09-10 | Require Parts visibility for draft BOM editing. | The draft editor loads active Part master records for component selection. |
| 2026-09-10 | Split Customer edits into identity, contacts, and financial payloads. | Sales and Finance can update their owned fields without receiving authority over the other field groups. |
| 2026-09-10 | Treat accounts-payable email as a financial Customer field. | It belongs to the Finance relationship and should not be changed through general operational-contact access. |
| 2026-09-11 | Keep standard roles locked and allow custom roles to be created or duplicated from the controlled permission catalogue. | Companies can adapt access to their staffing model without changing stable permissions or shared baseline templates. |
| 2026-09-11 | Block custom-role archival while any user remains assigned. | Archival must not silently revoke access from a group of users; administrators must deliberately reassign them first. |
