# Customer Orders and Production Planning Manual Tests

Status: **Partially ready for browser UAT** - Customer Order scenarios ready; Production Planning pending
Owner: Product owner / Customer Service / Production Planning
Last updated: 2026-09-16

Use these scenarios only after the relevant implementation phase is marked
ready. Use dummy Customer PO and SKU references beginning with `UAT-`.

Current ready scope: `COPP-01` to `COPP-12` and `COPP-16` to `COPP-20`.

## Customer Order entry

### COPP-01 - Valid Standard PO

1. Create a Standard PO with two valid SKU lines.
2. Enter units for one line and shippers for the other.
3. Enter matching GST-exclusive line and PO totals.
4. Save the order.

Expected: Both lines pass and the order becomes `Ready for Planning`.

### COPP-02 - Incomplete shipper quantity

1. Enter a unit quantity that does not divide into complete shippers.
2. Save the order.

Expected: The affected line and order show `PO Check` and cannot enter planning.

### COPP-03 - Price outside tolerance

1. Enter a customer line value outside the configured percentage tolerance.
2. Keep the complete PO total outside tolerance as well.
3. Save the order.

Expected: The line explains the variance and the order shows `PO Check`.

### COPP-04 - Line errors cannot cancel out

1. Overstate one line and understate another by the same amount.
2. Keep the overall PO total mathematically correct.
3. Save the order.

Expected: The total passes, both incorrect lines fail, and the order remains
`PO Check`.

### COPP-05 - Customer Service correction

1. Open a `PO Check` order.
2. Correct the quantity and customer-stated value.
3. Save it again.

Expected: The system recalculates automatically, preserves the revision, and
moves the order to `Ready for Planning` when every check passes.

## Blanket POs and releases

### COPP-06 - Blanket release without customer reference

1. Create an active Blanket PO with an authorised value and expiry date.
2. Add a release without entering a customer release number.
3. Add valid SKU lines and values.

Expected: The ERP generates an internal release number and the valid release
becomes `Ready for Planning`.

### COPP-07 - Blanket value exceeded

1. Create a release whose expected value exceeds the available blanket value.
2. Save the release.

Expected: The release shows `PO Check`, explains the insufficient balance, and
does not reserve blanket value.

### COPP-08 - Blanket top-up

1. Add a documented positive amendment to the Blanket PO.
2. Reopen the previously blocked release.
3. Revalidate it.

Expected: Original authority and top-up remain separately visible. The release
becomes ready only when the new balance and every other check pass.

### COPP-09 - Cancelled release returns balance

1. Record the available blanket value.
2. Cancel a committed release.
3. Review the balance and history.

Expected: The eligible committed value returns to the blanket balance and the
cancelled release remains in history.

## Price and dates

### COPP-10 - Current approved price snapshot

1. Create and validate a release.
2. Change the Product's approved price through the authorised Product workflow.
3. Reopen the earlier release and create a new release.

Expected: The earlier release retains its price snapshot. The new release uses
the new approved price.

### COPP-11 - Different delivery dates

1. Add multiple SKU lines to one release.
2. Give each line a different requested delivery date.
3. Validate the release.

Expected: Each date is retained and passed to Production Planning with its line.

## Planning changes

### COPP-12 - Edit before planning

1. Edit quantity or delivery date before a plan exists.
2. Correct the customer value when quantity changes.

Expected: The release is recalculated and receives `PO Check` or
`Ready for Planning` from the new values.

### COPP-13 - Edit after draft planning

1. Create a draft Production Plan for a release.
2. Change its quantity or delivery date as Customer Service.

Expected: A release revision is preserved and the draft plan becomes
`Replanning Required`.

### COPP-14 - Edit after plan release

1. Release a Production Plan.
2. Change the connected customer release.

Expected: The original planning snapshot remains visible and the plan becomes
`Change Review Required`; Production is clearly alerted.

### COPP-15 - Completed release is locked

1. Open a completed release.
2. Attempt to change its quantity or delivery date.

Expected: The release cannot be edited and the additional requirement must be
entered as a new release.

### COPP-16 - Cancel a Standard PO before planning

1. Open a Standard PO in `PO Check` or `Ready for Planning`.
2. Select **Cancel Customer PO** and enter a clear reason of at least 10 characters.
3. Confirm the cancellation.

Expected: The order becomes `Cancelled`, can no longer be edited, and its
lines, revisions, and cancellation reason remain visible in history.

### COPP-17 - Preserved legacy Customer Order

1. Open **Customer Orders** and search for a known migrated Customer PO number.
2. Open one result and review its Customer, SKU, quantities, values, and history.
3. Confirm an old `Open` record shows `PO Check` and explains that its requested
   delivery date is missing.

Expected: The migrated order has a unique five-digit ERP Order No. and remains
linked to its historical source in the audit evidence. It cannot enter planning
until Customer Service supplies the missing information and the normal validation
passes.

### COPP-18 - Customer Order table navigation

1. Open **Customer Orders** and use search, the Status filter, column controls,
   and pagination.
2. Click an empty area within a Customer Order row.
3. Confirm the PO detail opens, then inspect its release-line table.

Expected: The list follows the same shared table layout and controls as Products
and BOMs. The complete row is navigable, and the detail line table keeps aligned
headers, consistent spacing, and horizontal scrolling when space is limited.

### COPP-19 - Order number and PO Amount

1. Open **Customer Orders** and confirm every Order No. has exactly five digits.
2. Open a Standard PO and compare its list-page PO Amount with the
   customer-entered PO total on its release.
3. Open a Blanket PO and compare its list-page PO Amount with the original
   authorised value plus recorded top-ups.
4. Confirm the Standard/Blanket type remains visible on the detail page even
   though it is not a column on the list page.
5. Confirm the list shows the first SKU Code and a truncated Description. For
   a multi-SKU order, confirm a `+N more` indicator appears and the complete
   release lines remain available on the detail page.

Expected: Order numbers are unique five-digit internal references. PO Amount
shows the customer's current GST-exclusive authority, not the system-calculated
expected amount. SKU information is compact on the list, while Type and complete
release information are available in context on the detail page.

### COPP-20 - ERP Customer Order table behaviour

1. Open **Customer Orders**.
2. Search or apply a Status filter while watching the table refresh.
3. Sort two columns, change the row density and rows per page, and open an order
   from anywhere on its row.
4. Narrow the browser or scroll horizontally and confirm the Order and open-row
   edge columns remain visible.

Expected: The table border, toolbar, headers, column widths, and footer stay in
place during refresh while cell-shaped skeletons replace only the row content.
The table remains dense and scannable, long descriptions truncate, status is
easy to identify without overpowering the row, and navigation remains
keyboard-accessible. Density preference is retained in that browser. Table UI
actions make no Customer Order workflow or data changes.

## Result record

| Date | Environment | Tester | Scenarios | Result | Defect or notes |
| --- | --- | --- | --- | --- | --- |
| 2026-09-16 | Local Next.js + Supabase | Codex browser UAT | COPP-01, COPP-02, COPP-05, COPP-16, COPP-19 | Pass | Created Standard PO `00093`, verified Ready for Planning, forced an incomplete-shipper PO Check, corrected it, and confirmed revisions 1-4. The UAT PO was then cancelled so it cannot enter planning. Domain, authorization, audit, numbering, database rollback, and authenticated route suites also passed. |
|  |  |  | COPP-01 to COPP-12, COPP-16 to COPP-20 | Ready | Standard, Blanket, legacy, table-navigation, numbering, PO Amount, and ERP table workflows |
|  |  |  | COPP-13 to COPP-15 | Not ready | Production Planning implementation pending |

Do not record customer documents, real prices, credentials, or personal details
in this file or in screenshots attached to defects.
