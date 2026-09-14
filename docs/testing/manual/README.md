# Manual Testing Library

Status: Active
Owner: Product owner / Engineering
Last updated: 2026-09-14

## Purpose

This folder contains short, plain-language scenarios for manually testing the
ERP from a user's point of view. Start with
[Current System Scenarios](current-system-scenarios.md).

Detailed technical and automated UAT documents remain in their existing
folders. This library is the easier checklist to use during a normal browser
testing session.

## How this folder will be maintained

Whenever a feature or permission materially changes:

1. Add or update its scenario in this folder.
2. Keep each action short and state the expected result.
3. Mark unfinished functionality as **Not ready** instead of testing it.
4. Record accepted results without passwords, tokens, or real customer data.
5. Move large specialist checklists into a separate file and link them here.

## Files

| File | Use |
| --- | --- |
| [Current System Scenarios](current-system-scenarios.md) | Main browser checklist for functionality currently ready to test |

## Related detailed checks

- [Master Data and BOM UAT](../master-data-bom-uat.md)
- [Products & BOM Role UAT](../../auth/product-bom-role-uat.md)
- [Password Management and Recovery](../../auth/password-management.md)
