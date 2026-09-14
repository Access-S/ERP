# Architecture Documentation

Status: Living index
Last updated: 2026-09-14

Read the relevant architecture document before changing a module boundary,
workflow state, approval process, or core data relationship.

## Module references

- [Products & BOM workflow](products-and-bom-workflow.md) — Product, BOM,
  Part, Customer SKU, master-data lifecycle, and navigation design.
- [Sales/CRM and Customer onboarding](sales-crm-and-customer-onboarding-workflow.md)
  — deferred Lead, Prospect, Opportunity, RFQ, costing, Quote, approval, and
  Customer-conversion module.
- [Customer Orders and Production Planning](customer-orders-and-production-planning-workflow.md)
  — Standard and Blanket Customer POs, releases, commercial validation,
  revisions, and planning handoff.

- [Audit information architecture](audit-information-architecture.md) documents
  canonical append-only storage, classified security views, future operational
  categories, severity, and category-scoped access direction.

Authorization design is maintained separately in the
[Auth documentation index](../auth/README.md).
