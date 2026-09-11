export const PERMISSIONS = [
  { key: "customer.view", module: "CUSTOMER", description: "View customer records" },
  { key: "customer.create", module: "CUSTOMER", description: "Create customer records" },
  { key: "customer.edit_identity", module: "CUSTOMER", description: "Edit customer identity details" },
  { key: "customer.edit_contacts", module: "CUSTOMER", description: "Edit customer contacts and delivery details" },
  { key: "customer.edit_financial", module: "CUSTOMER", description: "Edit customer financial and tax details" },
  { key: "customer.deactivate", module: "CUSTOMER", description: "Deactivate customer records" },
  { key: "customer.reactivate", module: "CUSTOMER", description: "Reactivate customer records" },
  { key: "customer.address.manage", module: "CUSTOMER", description: "Manage customer addresses" },

  { key: "product.view", module: "PRODUCT", description: "View product records" },
  { key: "product.create", module: "PRODUCT", description: "Create product records" },
  { key: "product.edit_master", module: "PRODUCT", description: "Edit product production master data" },
  { key: "product.edit_commercial", module: "PRODUCT", description: "Edit product commercial data" },
  { key: "product.deactivate", module: "PRODUCT", description: "Deactivate product records" },
  { key: "product.reactivate", module: "PRODUCT", description: "Reactivate product records" },

  { key: "part.view", module: "PART", description: "View part records" },
  { key: "part.create", module: "PART", description: "Create part records" },
  { key: "part.edit", module: "PART", description: "Edit part records" },
  { key: "part.deactivate", module: "PART", description: "Deactivate part records" },
  { key: "part.reactivate", module: "PART", description: "Reactivate part records" },

  { key: "bom.view", module: "BOM", description: "View BOM revisions and components" },
  { key: "bom.draft.create", module: "BOM", description: "Create draft BOM revisions" },
  { key: "bom.draft.edit", module: "BOM", description: "Edit draft BOM revisions" },
  { key: "bom.draft.discard", module: "BOM", description: "Discard draft BOM revisions" },
  { key: "bom.activate", module: "BOM", description: "Activate BOM revisions" },
  { key: "bom.archive", module: "BOM", description: "Archive BOM revisions" },
  { key: "bom.import", module: "BOM", description: "Import BOM master data" },

  { key: "forecast.view", module: "PLANNING", description: "View forecasts" },
  { key: "forecast.create", module: "PLANNING", description: "Create forecasts" },
  { key: "forecast.edit", module: "PLANNING", description: "Edit forecasts" },
  { key: "production_plan.view", module: "PLANNING", description: "View production plans" },
  { key: "production_plan.create", module: "PLANNING", description: "Create production plans" },
  { key: "production_plan.release", module: "PLANNING", description: "Release production plans" },

  { key: "purchase_order.view", module: "PURCHASING", description: "View purchase orders" },
  { key: "purchase_order.create", module: "PURCHASING", description: "Create purchase orders" },
  { key: "purchase_order.edit", module: "PURCHASING", description: "Edit purchase orders" },
  { key: "purchase_order.submit", module: "PURCHASING", description: "Submit purchase orders for approval" },
  { key: "purchase_order.approve", module: "PURCHASING", description: "Approve purchase orders" },
  { key: "purchase_order.cancel", module: "PURCHASING", description: "Cancel purchase orders" },
  { key: "purchase_order.view_cost", module: "PURCHASING", description: "View purchase costs" },

  { key: "inventory.view", module: "INVENTORY", description: "View inventory" },
  { key: "inventory.receive", module: "INVENTORY", description: "Receive inventory" },
  { key: "inventory.transfer", module: "INVENTORY", description: "Transfer inventory" },
  { key: "inventory.issue", module: "INVENTORY", description: "Issue inventory" },
  { key: "inventory.return", module: "INVENTORY", description: "Return inventory" },
  { key: "inventory.count", module: "INVENTORY", description: "Count inventory" },
  { key: "inventory.adjust.request", module: "INVENTORY", description: "Request inventory adjustments" },
  { key: "inventory.adjust.approve", module: "INVENTORY", description: "Approve inventory adjustments" },
  { key: "inventory.view_value", module: "INVENTORY", description: "View inventory financial value" },

  { key: "production_work.view", module: "PRODUCTION", description: "View production work" },
  { key: "production_work.assign", module: "PRODUCTION", description: "Assign production work" },
  { key: "production_work.start", module: "PRODUCTION", description: "Start production work" },
  { key: "production_work.report", module: "PRODUCTION", description: "Report production activity" },
  { key: "production_work.complete", module: "PRODUCTION", description: "Complete production work" },
  { key: "production_work.cancel", module: "PRODUCTION", description: "Cancel production work" },

  { key: "quality.view", module: "QUALITY", description: "View quality records" },
  { key: "quality.inspect", module: "QUALITY", description: "Record quality inspections" },
  { key: "quality.hold", module: "QUALITY", description: "Place material or production on quality hold" },
  { key: "quality.release", module: "QUALITY", description: "Release quality-held material or production" },
  { key: "quality.reject", module: "QUALITY", description: "Reject material or production" },
  { key: "quality.nonconformance.manage", module: "QUALITY", description: "Manage quality non-conformances" },

  { key: "finance.view", module: "FINANCE", description: "View finance records" },
  { key: "finance.customer_credit.manage", module: "FINANCE", description: "Manage customer credit controls" },
  { key: "finance.pricing.manage", module: "FINANCE", description: "Manage pricing controls" },
  { key: "finance.invoice.manage", module: "FINANCE", description: "Manage invoices" },
  { key: "finance.override_credit_hold", module: "FINANCE", description: "Override customer credit holds" },
  { key: "finance.report", module: "FINANCE", description: "Run finance reports" },

  { key: "admin.user.view", module: "ADMIN", description: "View user accounts" },
  { key: "admin.user.manage", module: "ADMIN", description: "Create, update, suspend, and disable user accounts" },
  { key: "admin.role.assign", module: "ADMIN", description: "Assign and revoke approved roles" },
  { key: "admin.role.manage", module: "ADMIN", description: "Create, edit, archive, and reactivate custom roles" },
  { key: "admin.configuration.manage", module: "ADMIN", description: "Manage application configuration" },
  { key: "admin.integration.manage", module: "ADMIN", description: "Manage application integrations" },
  { key: "admin.audit.view", module: "ADMIN", description: "View security and business audit history" },
] as const

export type PermissionKey = (typeof PERMISSIONS)[number]["key"]

const PERMISSION_KEYS = new Set<string>(
  PERMISSIONS.map((permission) => permission.key)
)

export function isPermissionKey(value: string): value is PermissionKey {
  return PERMISSION_KEYS.has(value)
}

type SystemRoleDefinition = {
  key: string
  name: string
  description: string
  permissions: readonly PermissionKey[]
}

export const SYSTEM_ROLES = [
  {
    key: "EXECUTIVE_GENERAL_MANAGER",
    name: "Executive / General Manager",
    description: "Company-wide oversight and high-impact approval",
    permissions: [
      "customer.view", "product.view", "part.view", "bom.view", "bom.activate", "bom.archive",
      "forecast.view", "production_plan.view", "purchase_order.view", "purchase_order.approve",
      "purchase_order.cancel", "inventory.view", "production_work.view", "quality.view",
      "finance.view", "finance.override_credit_hold", "finance.report",
    ],
  },
  {
    key: "OPERATIONS_MANAGER",
    name: "Operations Manager",
    description: "Day-to-day operational control across planning, production, purchasing, and inventory",
    permissions: [
      "customer.view", "customer.deactivate", "customer.reactivate",
      "product.view", "product.deactivate", "product.reactivate",
      "part.view", "part.deactivate", "part.reactivate",
      "bom.view", "bom.activate", "bom.archive", "forecast.view",
      "production_plan.view", "production_plan.create", "production_plan.release",
      "purchase_order.view", "purchase_order.approve", "purchase_order.cancel",
      "inventory.view", "inventory.adjust.approve",
      "production_work.view", "production_work.assign", "production_work.start",
      "production_work.report", "production_work.complete", "production_work.cancel",
      "quality.view", "finance.view",
    ],
  },
  {
    key: "SALES_CUSTOMER_SERVICE",
    name: "Sales / Customer Service",
    description: "Customer relationships, demand, orders, and delivery communication",
    permissions: [
      "customer.view", "customer.create", "customer.edit_identity", "customer.edit_contacts",
      "customer.address.manage", "product.view", "bom.view", "forecast.view", "forecast.create",
      "forecast.edit", "purchase_order.view", "inventory.view", "production_work.view", "quality.view",
    ],
  },
  {
    key: "PRODUCTION_PLANNER",
    name: "Production Planner",
    description: "Production master data, BOM preparation, forecasts, and executable plans",
    permissions: [
      "customer.view", "product.view", "product.create", "product.edit_master",
      "part.view", "part.create", "part.edit", "bom.view", "bom.draft.create",
      "bom.draft.edit", "bom.draft.discard", "bom.import", "forecast.view",
      "forecast.create", "forecast.edit", "production_plan.view", "production_plan.create",
      "purchase_order.view", "inventory.view", "production_work.view", "quality.view",
    ],
  },
  {
    key: "PROCUREMENT_PURCHASING",
    name: "Procurement / Purchasing",
    description: "Material procurement and supplier purchasing activity",
    permissions: [
      "customer.view", "product.view", "part.view", "bom.view", "forecast.view",
      "production_plan.view", "purchase_order.view", "purchase_order.create",
      "purchase_order.edit", "purchase_order.submit", "purchase_order.view_cost",
      "inventory.view", "production_work.view", "quality.view",
    ],
  },
  {
    key: "WAREHOUSE_INVENTORY",
    name: "Warehouse / Inventory",
    description: "Physical stock control and warehouse execution",
    permissions: [
      "product.view", "part.view", "bom.view", "forecast.view", "production_plan.view",
      "purchase_order.view", "inventory.view", "inventory.receive", "inventory.transfer",
      "inventory.issue", "inventory.return", "inventory.count", "inventory.adjust.request",
      "production_work.view", "quality.view",
    ],
  },
  {
    key: "PRODUCTION_SUPERVISOR",
    name: "Production Supervisor",
    description: "Execution and supervision of approved production plans",
    permissions: [
      "product.view", "part.view", "bom.view", "forecast.view", "production_plan.view",
      "production_plan.release", "purchase_order.view", "inventory.view", "production_work.view",
      "production_work.assign", "production_work.start", "production_work.report",
      "production_work.complete", "production_work.cancel", "quality.view",
    ],
  },
  {
    key: "PRODUCTION_OPERATOR_TEAM_LEADER",
    name: "Production Operator / Team Leader",
    description: "Execution and reporting of assigned production work",
    permissions: [
      "product.view", "part.view", "bom.view", "production_plan.view", "inventory.view",
      "inventory.issue", "inventory.return", "production_work.view", "production_work.start",
      "production_work.report", "quality.view", "quality.inspect",
    ],
  },
  {
    key: "QUALITY_CONTROL",
    name: "Quality Control",
    description: "Inspection and control of material and production quality status",
    permissions: [
      "product.view", "part.view", "bom.view", "forecast.view", "production_plan.view",
      "purchase_order.view", "inventory.view", "production_work.view", "quality.view",
      "quality.inspect", "quality.hold", "quality.release", "quality.reject",
      "quality.nonconformance.manage",
    ],
  },
  {
    key: "FINANCE_ACCOUNTS",
    name: "Finance / Accounts",
    description: "Financial controls and reconciliation of commercial activity",
    permissions: [
      "customer.view", "customer.edit_financial", "product.view", "product.edit_commercial",
      "part.view", "bom.view", "forecast.view", "production_plan.view", "purchase_order.view",
      "purchase_order.view_cost", "inventory.view", "inventory.view_value", "production_work.view",
      "quality.view", "finance.view", "finance.customer_credit.manage", "finance.pricing.manage",
      "finance.invoice.manage", "finance.override_credit_hold", "finance.report",
    ],
  },
  {
    key: "SYSTEM_ADMIN",
    name: "System Administrator",
    description: "Technical account, access, configuration, integration, and audit administration",
    permissions: [
      "customer.view", "product.view", "part.view", "bom.view", "forecast.view",
      "production_plan.view", "purchase_order.view", "inventory.view", "production_work.view",
      "quality.view", "finance.view", "admin.user.view", "admin.user.manage",
      "admin.role.assign", "admin.role.manage", "admin.configuration.manage", "admin.integration.manage",
      "admin.audit.view",
    ],
  },
] as const satisfies readonly SystemRoleDefinition[]

export type RoleKey = (typeof SYSTEM_ROLES)[number]["key"]

export const LEGACY_ROLE_ALIASES: Readonly<Record<string, RoleKey>> = {
  ADMIN: "SYSTEM_ADMIN",
  ADMINISTRATOR: "SYSTEM_ADMIN",
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  EXECUTIVE: "EXECUTIVE_GENERAL_MANAGER",
  EXECUTIVE_GENERAL_MANAGER: "EXECUTIVE_GENERAL_MANAGER",
  OPERATIONS_MANAGER: "OPERATIONS_MANAGER",
  SALES: "SALES_CUSTOMER_SERVICE",
  SALES_CUSTOMER_SERVICE: "SALES_CUSTOMER_SERVICE",
  PRODUCTION_PLANNER: "PRODUCTION_PLANNER",
  PROCUREMENT: "PROCUREMENT_PURCHASING",
  PURCHASING: "PROCUREMENT_PURCHASING",
  PROCUREMENT_PURCHASING: "PROCUREMENT_PURCHASING",
  WAREHOUSE: "WAREHOUSE_INVENTORY",
  INVENTORY: "WAREHOUSE_INVENTORY",
  WAREHOUSE_INVENTORY: "WAREHOUSE_INVENTORY",
  PRODUCTION_SUPERVISOR: "PRODUCTION_SUPERVISOR",
  PRODUCTION_OPERATOR: "PRODUCTION_OPERATOR_TEAM_LEADER",
  TEAM_LEADER: "PRODUCTION_OPERATOR_TEAM_LEADER",
  PRODUCTION_OPERATOR_TEAM_LEADER: "PRODUCTION_OPERATOR_TEAM_LEADER",
  QUALITY: "QUALITY_CONTROL",
  QUALITY_CONTROL: "QUALITY_CONTROL",
  FINANCE: "FINANCE_ACCOUNTS",
  ACCOUNTS: "FINANCE_ACCOUNTS",
  FINANCE_ACCOUNTS: "FINANCE_ACCOUNTS",
}

export function normalizeLegacyRoleLabel(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

export function mapLegacyRole(value: string): RoleKey | null {
  return LEGACY_ROLE_ALIASES[normalizeLegacyRoleLabel(value)] ?? null
}
