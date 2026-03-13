import type { NextRequest } from 'next/server'
import { ensureAppInstance, serializePlatformState, syncLegacyAppEntitlementsForCustomer } from '@/lib/appPlatform'
import { resolvePlatformBillingAccount } from '@/lib/appPlatformAuth'
import { resolveLicenseValidUntil } from '@/lib/licenseWindow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RegisterBody = {
  billingAccountId?: string
  customerId?: string
  appSlug?: string
  entitlementCode?: string
  instanceKey?: string
  displayName?: string
  bindingType?: string
  bindingValue?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as RegisterBody
    const billingAccount = await resolvePlatformBillingAccount({
      billingAccountId: body.billingAccountId,
      customerId: body.customerId,
      reqApiKey: req.headers.get('x-api-key') || '',
    })

    if (billingAccount.customerId) {
      await syncLegacyAppEntitlementsForCustomer(billingAccount.customerId)
    }

    const { entitlement, instance, binding, externalAccess } = await ensureAppInstance({
      billingAccountId: billingAccount.id,
      customerId: billingAccount.customerId,
      appSlug: body.appSlug,
      entitlementCode: body.entitlementCode,
      instanceKey: body.instanceKey,
      displayName: body.displayName,
      bindingType: body.bindingType,
      bindingValue: body.bindingValue,
    })
    const licenseValidUntil = billingAccount.customerId
      ? await resolveLicenseValidUntil({
          customerId: billingAccount.customerId,
          entitlementCurrentPeriodEnd: entitlement.currentPeriodEnd,
        })
      : null

    return new Response(
      JSON.stringify({
        ok: true,
        licenseValidUntil: licenseValidUntil?.toISOString() || null,
        ...serializePlatformState({
          billingAccount: {
            id: billingAccount.id,
            customerId: billingAccount.customerId,
            externalBillingId: billingAccount.externalBillingId,
            provider: billingAccount.provider,
            status: billingAccount.status,
          },
          entitlement,
          instance,
          binding,
          externalAccess: externalAccess
            ? {
                provider: externalAccess.provider,
                hostname: externalAccess.hostname,
                enabled: externalAccess.enabled,
                status: externalAccess.status,
                configVersion: externalAccess.configVersion,
              }
            : null,
        }),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const status = /Unauthorized/i.test(message) ? 401 : /not found|required|No linked/i.test(message) ? 400 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
