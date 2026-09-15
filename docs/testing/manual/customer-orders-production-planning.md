# Customer Orders and Production Planning Manual Tests

Status: **Partially ready for browser UAT** - Customer Order scenarios ready; Production Planning pending
Owner: Product owner / Customer Service / Production Planning
Last updated: 2026-09-15

Use these scenarios only after the relevant implementation phase is marked
ready. Use dummy Customer PO and SKU references beginning with `UAT-`.

Current ready scope: `COPP-01` to `COPP-12` and `COPP-16`.

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

## Result record

| Date | Environment | Tester | Scenarios | Result | Defect or notes |
| --- | --- | --- | --- | --- | --- |
|  |  |  | COPP-01 to COPP-12, COPP-16 | Ready | Standard and Blanket Customer Order workflows |
|  |  |  | COPP-13 to COPP-15 | Not ready | Production Planning implementation pending |

Do not record customer documents, real prices, credentials, or personal details
in this file or in screenshots attached to defects.
