# Master Data and BOM UAT

Last updated: 2026-09-09

## Purpose

This is the repeatable acceptance check for the first usable Customer,
Product, Part, and BOM workflow. It verifies input boundaries, the main data
relationship, and critical database uniqueness constraints.

## Automated reversible check

Run:

```powershell
npm run uat:master-data
```

The script connects to the configured database, creates clearly named UAT
records inside serializable transactions, performs its assertions, and
deliberately rolls each transaction back. A final baseline comparison confirms
that no Customer, Product, BOM, BOM Line, Part, or Purchase Order remains.

Covered checks:

1. Customer, Product, Part, and BOM-Line Zod boundaries.
2. Customer -> Product -> draft BOM -> Part -> active BOM relationship.
3. Dependency counts used by Part, Product, and Customer lifecycle guards.
4. Case- and whitespace-insensitive Customer-code uniqueness.
5. Case- and whitespace-insensitive Product-code uniqueness.
6. One draft and one active BOM per Product.

## Manual browser check

When a browser session is available, verify the visible workflow:

1. Sign in and create a Customer with a unique `UAT-` code.
2. Create a Product assigned to that Customer.
3. Confirm the app opens its blank revision-1 draft BOM directly.
4. Create a Part, return to the draft, and add the Part with a positive quantity and UOM.
5. Activate the BOM and confirm the Product Details page shows it as active.
6. Confirm Part deactivation is blocked while the active BOM uses it.
7. Confirm Customer deactivation is blocked while it owns the active Product.
8. Confirm Product deactivation is blocked while it has an `Open` or `PO Check` purchase order.
9. Resolve dependencies in reverse order and confirm allowed deactivation/reactivation paths.
10. Remove only the records created with the `UAT-` prefix.

The automated script is safe to repeat. The manual checklist creates real data
and therefore requires deliberate cleanup.
