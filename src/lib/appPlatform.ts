import { prisma } from '@/lib/prisma'
import {
  getEntitlementPlanLevel,
  getEntitlementAppSlug,
  isAppSpecificEntitlement,
  isLegacyProjectSelectionEntitlement,
  matchesAppEntitlement,
  normalizeEntitlementCodeForApp,
} from '@/lib/licenseApps'

const USABLE_ENTITLEMENT_STATUSES = new Set(['active', 'trialing', 'past_due'])

type AllowedProjectsMap = Record<string, string[]>

export type AppBootstrapInput = {
  billingAccountId?: string
  customerId?: string | null
  appSlug?: string
  entitlementCode?: string
  instanceKey?: string
  displayName?: string
  bindingType?: string
  bindingValue?: string
}

function normalizeAppSlugFromEntitlement(code: string): string {
  return getEntitlementAppSlug(code) || code.trim().toLowerCase().split('.')[0] || ''
}

function isUsableStatus(status: string | null | undefined): boolean {
  return USABLE_ENTITLEMENT_STATUSES.has((status || '').trim().toLowerCase())
}

async function getAllowedProjectsMap(): Promise<AllowedProjectsMap> {
  const rows = await prisma.planConfig.findMany({
    select: { entitlementsJson: true, entitlementProjectsJson: true },
  })

  const map: AllowedProjectsMap = {}
  for (const row of rows) {
    let entitlements: string[] = []
    let projectMap: Record<string, string[]> = {}

    try {
      entitlements = row.entitlementsJson ? (JSON.parse(row.entitlementsJson) as string[]) : []
    } catch {}

    try {
      projectMap = row.entitlementProjectsJson
        ? (JSON.parse(row.entitlementProjectsJson) as Record<string, string[]>)
        : {}
    } catch {}

    for (const code of entitlements) {
      const allowed = Array.isArray(projectMap[code]) ? projectMap[code] : []
      if (allowed.length) map[code] = Array.from(new Set([...(map[code] || []), ...allowed]))
    }
  }

  return map
}

export async function ensureBillingAccountForCustomer(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { user: true },
  })

  if (!customer) throw new Error('Customer not found')

  return prisma.billingAccount.upsert({
    where: { customerId },
    update: {
      externalBillingId: customerId,
      provider: 'stripe',
      email: customer.email ?? undefined,
      ownerUserId: customer.userId ?? undefined,
      status: 'active',
    },
    create: {
      customerId,
      externalBillingId: customerId,
      provider: 'stripe',
      email: customer.email ?? undefined,
      ownerUserId: customer.userId ?? undefined,
      status: 'active',
    },
  })
}

export async function getBillingAccountForClerkUser(clerkUserId: string) {
  const user = await prisma.user.findFirst({ where: { clerkUserId } })
  if (!user?.stripeCustomerId) return null
  return ensureBillingAccountForCustomer(user.stripeCustomerId)
}

export async function syncLegacyAppEntitlementsForCustomer(customerId: string) {
  const billingAccount = await ensureBillingAccountForCustomer(customerId)
  const legacy = await prisma.entitlement.findMany({ where: { customerId } })

  for (const row of legacy) {
    let normalizedCode = row.code
    if (isLegacyProjectSelectionEntitlement(row.code)) {
      const selection = await getEffectiveSelection(customerId, row.code)
      normalizedCode = normalizeEntitlementCodeForApp(row.code, selection?.currentProject || undefined)
    } else if (getEntitlementPlanLevel(row.code)) {
      normalizedCode = normalizeEntitlementCodeForApp(row.code)
    }

    await prisma.appEntitlement.upsert({
      where: { legacyEntitlementId: row.id },
      update: {
        billingAccountId: billingAccount.id,
        entitlementCode: normalizedCode,
        appSlug: normalizeAppSlugFromEntitlement(normalizedCode),
        planCode: normalizedCode,
        status: row.status,
        currentPeriodEnd: row.currentPeriodEnd ?? undefined,
        source: 'legacy-sync',
      },
      create: {
        billingAccountId: billingAccount.id,
        legacyEntitlementId: row.id,
        entitlementCode: normalizedCode,
        appSlug: normalizeAppSlugFromEntitlement(normalizedCode),
        planCode: normalizedCode,
        status: row.status,
        currentPeriodEnd: row.currentPeriodEnd ?? undefined,
        source: 'legacy-sync',
      },
    })
  }

  const legacyIds = legacy.map((row) => row.id)
  await prisma.appEntitlement.updateMany({
    where: {
      billingAccountId: billingAccount.id,
      AND: [
        { legacyEntitlementId: { not: null } },
        ...(legacyIds.length ? [{ legacyEntitlementId: { notIn: legacyIds } }] : []),
      ],
    },
    data: { status: 'inactive' },
  })

  return prisma.appEntitlement.findMany({
    where: { billingAccountId: billingAccount.id },
    orderBy: [{ appSlug: 'asc' }, { entitlementCode: 'asc' }],
  })
}

async function getEffectiveSelection(customerId: string, entitlementCode: string) {
  let selection = await prisma.projectSelection.findUnique({
    where: { customerId_entitlementCode: { customerId, entitlementCode } },
  })

  const now = new Date()
  if (selection?.pendingProject && selection.pendingEffectiveAt && selection.pendingEffectiveAt <= now) {
    selection = await prisma.projectSelection.update({
      where: { customerId_entitlementCode: { customerId, entitlementCode } },
      data: {
        currentProject: selection.pendingProject,
        pendingProject: null,
        pendingEffectiveAt: null,
      },
    })
  }

  return selection
}

export async function resolveTargetEntitlement(params: {
  billingAccountId: string
  customerId: string | null | undefined
  appSlug?: string
  entitlementCode?: string
}) {
  const entitlements = await prisma.appEntitlement.findMany({
    where: { billingAccountId: params.billingAccountId },
    orderBy: [{ appSlug: 'asc' }, { entitlementCode: 'asc' }],
  })

  const usable = entitlements.filter((row) => isUsableStatus(row.status))
  const entitlement =
    (params.entitlementCode
      ? usable.find((row) => row.entitlementCode === params.entitlementCode)
      : undefined) ||
    (params.appSlug ? usable.find((row) => matchesAppEntitlement(row.entitlementCode, params.appSlug)) : undefined) ||
    usable[0]

  if (!entitlement) throw new Error('No active entitlement available')

  const allowedProjects = await getAllowedProjectsMap()
  const requestedApp = (params.appSlug || '').trim().toLowerCase()
  const entitlementAppSlug = getEntitlementAppSlug(entitlement.entitlementCode) || entitlement.appSlug

  if (isAppSpecificEntitlement(entitlement.entitlementCode)) {
    if (requestedApp && requestedApp !== entitlementAppSlug) {
      throw new Error('Requested app is not active for the current billing period')
    }

    return { entitlement, resolvedAppSlug: entitlementAppSlug }
  }

  const selection = params.customerId
    ? await getEffectiveSelection(params.customerId, entitlement.entitlementCode)
    : null

  const allowed = allowedProjects[entitlement.entitlementCode] || []
  const selectedApp = selection?.currentProject?.trim().toLowerCase() || ''
  const resolvedAppSlug = requestedApp || selectedApp || allowed[0] || entitlementAppSlug

  if (selectedApp && resolvedAppSlug !== selectedApp) {
    throw new Error('Requested app is not active for the current billing period')
  }

  if (!selectedApp && requestedApp && allowed.length && !allowed.includes(requestedApp)) {
    throw new Error('Requested app is not allowed for this entitlement')
  }

  return { entitlement, resolvedAppSlug }
}

function defaultBindingType(appSlug: string): string {
  if (appSlug === 'qubito') return 'tenant'
  if (appSlug === 'nexora') return 'installation'
  return 'instance'
}

export async function ensureAppInstance(input: AppBootstrapInput & { billingAccountId: string; customerId?: string | null }) {
  const { entitlement, resolvedAppSlug } = await resolveTargetEntitlement({
    billingAccountId: input.billingAccountId,
    customerId: input.customerId,
    appSlug: input.appSlug,
    entitlementCode: input.entitlementCode,
  })

  const instanceKey =
    input.instanceKey?.trim() ||
    `${resolvedAppSlug}-${input.billingAccountId}`
  const bindingType = input.bindingType?.trim() || defaultBindingType(resolvedAppSlug)
  const bindingValue =
    input.bindingValue?.trim() ||
    (bindingType === 'tenant'
      ? input.customerId || instanceKey
      : instanceKey)

  let instance = await prisma.appInstance.findUnique({ where: { instanceKey } })

  const existingBinding = await prisma.appInstanceBinding.findUnique({
    where: { bindingType_bindingValue: { bindingType, bindingValue } },
    include: { appInstance: true },
  })

  if (!instance && existingBinding) instance = existingBinding.appInstance

  if (instance && instance.billingAccountId !== input.billingAccountId) {
    throw new Error('Instance belongs to another billing account')
  }

  if (!instance) {
    instance = await prisma.appInstance.create({
      data: {
        billingAccountId: input.billingAccountId,
        appSlug: resolvedAppSlug,
        instanceKey,
        displayName: input.displayName?.trim() || null,
        status: 'active',
        lastSeenAt: new Date(),
      },
    })
  } else {
    instance = await prisma.appInstance.update({
      where: { id: instance.id },
      data: {
        appSlug: resolvedAppSlug,
        displayName: input.displayName?.trim() || instance.displayName,
        status: 'active',
        lastSeenAt: new Date(),
      },
    })
  }

  const binding = existingBinding && existingBinding.appInstanceId === instance.id
    ? await prisma.appInstanceBinding.update({
        where: { id: existingBinding.id },
        data: { isPrimary: true, metadataJson: existingBinding.metadataJson ?? undefined },
      })
    : await prisma.appInstanceBinding.upsert({
        where: { appInstanceId_bindingType_bindingValue: { appInstanceId: instance.id, bindingType, bindingValue } },
        update: { isPrimary: true },
        create: { appInstanceId: instance.id, bindingType, bindingValue, isPrimary: true },
      })

  const externalAccess = await prisma.externalAccessProvision.findUnique({
    where: { appInstanceId: instance.id },
  })

  return { entitlement, instance, binding, externalAccess }
}

export function serializePlatformState(params: {
  billingAccount: {
    id: string
    customerId: string | null
    externalBillingId: string | null
    provider: string
    status: string
  }
  entitlement: {
    id: string
    entitlementCode: string
    appSlug: string
    planCode: string
    status: string
    currentPeriodEnd: Date | null
    graceEndsAt: Date | null
  }
  instance: {
    id: string
    appSlug: string
    instanceKey: string
    displayName: string | null
    status: string
    lastSeenAt: Date | null
  }
  binding: {
    bindingType: string
    bindingValue: string
    isPrimary: boolean
  }
  externalAccess: {
    provider: string
    hostname: string | null
    enabled: boolean
    status: string
    configVersion: number
  } | null
}) {
  return {
    billingAccount: params.billingAccount,
    entitlement: {
      ...params.entitlement,
      currentPeriodEnd: params.entitlement.currentPeriodEnd?.toISOString() || null,
      graceEndsAt: params.entitlement.graceEndsAt?.toISOString() || null,
    },
    instance: {
      ...params.instance,
      lastSeenAt: params.instance.lastSeenAt?.toISOString() || null,
    },
    binding: params.binding,
    externalAccess: params.externalAccess,
  }
}
