import type { Prisma } from "@prisma/client"

export const authorizationUserSelect = {
  id: true,
  email: true,
  normalizedEmail: true,
  name: true,
  status: true,
  authVersion: true,
  roleAssignments: {
    select: {
      role: {
        select: {
          key: true,
          isActive: true,
          rolePermissions: {
            select: {
              permission: {
                select: { key: true, isActive: true },
              },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.UserSelect

export type AuthorizationUserRecord = Prisma.UserGetPayload<{
  select: typeof authorizationUserSelect
}>
