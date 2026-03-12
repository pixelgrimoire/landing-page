import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { resolvePlatformBillingAccount } from '@/lib/appPlatformAuth'

export const runtime = 'nodejs'

type SyncBody = {
  billingAccountId?: string
  customerId?: string
  instanceKey?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as SyncBody
    const billingAccount = await resolvePlatformBillingAccount({
      billingAccountId: body.billingAccountId,
      customerId: body.customerId,
      reqApiKey: req.headers.get('x-api-key') || '',
    })

    if (!body.instanceKey?.trim()) {
      return new Response(JSON.stringify({ error: 'instanceKey is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const instance = await prisma.appInstance.findUnique({
      where: { instanceKey: body.instanceKey.trim() },
      include: {
        bindings: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        externalAccess: true,
      },
    })

    if (!instance || instance.billingAccountId !== billingAccount.id) {
      return new Response(JSON.stringify({ error: 'Instance not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const updated = await prisma.appInstance.update({
      where: { id: instance.id },
      data: { lastSeenAt: new Date(), status: 'active' },
      include: {
        bindings: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
        externalAccess: true,
      },
    })

    return new Response(
      JSON.stringify({
        ok: true,
        billingAccount: {
          id: billingAccount.id,
          customerId: billingAccount.customerId,
          externalBillingId: billingAccount.externalBillingId,
          provider: billingAccount.provider,
          status: billingAccount.status,
        },
        instance: {
          id: updated.id,
          appSlug: updated.appSlug,
          instanceKey: updated.instanceKey,
          displayName: updated.displayName,
          status: updated.status,
          lastSeenAt: updated.lastSeenAt?.toISOString() || null,
        },
        bindings: updated.bindings.map((binding) => ({
          bindingType: binding.bindingType,
          bindingValue: binding.bindingValue,
          isPrimary: binding.isPrimary,
        })),
        externalAccess: updated.externalAccess
          ? {
              provider: updated.externalAccess.provider,
              hostname: updated.externalAccess.hostname,
              enabled: updated.externalAccess.enabled,
              status: updated.externalAccess.status,
              configVersion: updated.externalAccess.configVersion,
            }
          : null,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const status = /Unauthorized/i.test(message) ? 401 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
