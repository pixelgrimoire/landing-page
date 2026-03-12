import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { ensureBillingAccountForCustomer, getBillingAccountForClerkUser } from '@/lib/appPlatform'

export async function resolvePlatformBillingAccount(input: {
  customerId?: string
  billingAccountId?: string
  reqApiKey?: string
}) {
  const { userId } = await auth()
  if (userId) {
    const billingAccount = await getBillingAccountForClerkUser(userId)
    if (!billingAccount) throw new Error('No linked billing account')
    return billingAccount
  }

  const expectedApiKey = process.env.ENTITLEMENTS_API_KEY || ''
  if (!expectedApiKey || input.reqApiKey !== expectedApiKey) {
    throw new Error('Unauthorized')
  }

  if (input.billingAccountId) {
    const billingAccount = await prisma.billingAccount.findUnique({ where: { id: input.billingAccountId } })
    if (!billingAccount) throw new Error('Billing account not found')
    return billingAccount
  }

  if (input.customerId) {
    return ensureBillingAccountForCustomer(input.customerId)
  }

  throw new Error('billingAccountId or customerId is required')
}
