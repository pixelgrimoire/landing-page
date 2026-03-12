-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "customerId" TEXT,
    "externalBillingId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "email" TEXT,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppEntitlement" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "legacyEntitlementId" TEXT,
    "entitlementCode" TEXT NOT NULL,
    "appSlug" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3),
    "graceEndsAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'legacy-sync',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppInstance" (
    "id" TEXT NOT NULL,
    "billingAccountId" TEXT NOT NULL,
    "appSlug" TEXT NOT NULL,
    "instanceKey" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppInstanceBinding" (
    "id" TEXT NOT NULL,
    "appInstanceId" TEXT NOT NULL,
    "bindingType" TEXT NOT NULL,
    "bindingValue" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInstanceBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAccessProvision" (
    "id" TEXT NOT NULL,
    "appInstanceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'cloudflare',
    "hostname" TEXT,
    "tokenEncrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'not_configured',
    "lastProvisionedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "configVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalAccessProvision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_customerId_key" ON "BillingAccount"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_externalBillingId_key" ON "BillingAccount"("externalBillingId");

-- CreateIndex
CREATE UNIQUE INDEX "AppEntitlement_legacyEntitlementId_key" ON "AppEntitlement"("legacyEntitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "AppEntitlement_billingAccountId_entitlementCode_key" ON "AppEntitlement"("billingAccountId", "entitlementCode");

-- CreateIndex
CREATE INDEX "AppEntitlement_billingAccountId_appSlug_idx" ON "AppEntitlement"("billingAccountId", "appSlug");

-- CreateIndex
CREATE UNIQUE INDEX "AppInstance_instanceKey_key" ON "AppInstance"("instanceKey");

-- CreateIndex
CREATE INDEX "AppInstance_billingAccountId_appSlug_idx" ON "AppInstance"("billingAccountId", "appSlug");

-- CreateIndex
CREATE UNIQUE INDEX "AppInstanceBinding_bindingType_bindingValue_key" ON "AppInstanceBinding"("bindingType", "bindingValue");

-- CreateIndex
CREATE UNIQUE INDEX "AppInstanceBinding_appInstanceId_bindingType_bindingValue_key" ON "AppInstanceBinding"("appInstanceId", "bindingType", "bindingValue");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccessProvision_appInstanceId_key" ON "ExternalAccessProvision"("appInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAccessProvision_hostname_key" ON "ExternalAccessProvision"("hostname");

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppEntitlement" ADD CONSTRAINT "AppEntitlement_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppInstance" ADD CONSTRAINT "AppInstance_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppInstanceBinding" ADD CONSTRAINT "AppInstanceBinding_appInstanceId_fkey" FOREIGN KEY ("appInstanceId") REFERENCES "AppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAccessProvision" ADD CONSTRAINT "ExternalAccessProvision_appInstanceId_fkey" FOREIGN KEY ("appInstanceId") REFERENCES "AppInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill billing accounts from existing Stripe customers.
INSERT INTO "BillingAccount" (
    "id",
    "customerId",
    "externalBillingId",
    "provider",
    "email",
    "ownerUserId",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'ba_' || md5("id"),
    "id",
    "id",
    'stripe',
    "email",
    "userId",
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Customer"
ON CONFLICT ("customerId") DO NOTHING;

-- Backfill app entitlements from the legacy entitlement table.
INSERT INTO "AppEntitlement" (
    "id",
    "billingAccountId",
    "legacyEntitlementId",
    "entitlementCode",
    "appSlug",
    "planCode",
    "status",
    "currentPeriodEnd",
    "source",
    "createdAt",
    "updatedAt"
)
SELECT
    'ae_' || md5(e."id"),
    ba."id",
    e."id",
    e."code",
    CASE
        WHEN split_part(lower(e."code"), '.', 1) = 'pos' THEN 'qubito'
        ELSE split_part(lower(e."code"), '.', 1)
    END,
    e."code",
    e."status",
    e."currentPeriodEnd",
    'legacy-migration',
    e."createdAt",
    e."updatedAt"
FROM "Entitlement" e
JOIN "BillingAccount" ba ON ba."customerId" = e."customerId"
ON CONFLICT ("billingAccountId", "entitlementCode") DO NOTHING;

-- Backfill instances from current project selections so Qubito/Nexora can start from legacy state.
INSERT INTO "AppInstance" (
    "id",
    "billingAccountId",
    "appSlug",
    "instanceKey",
    "displayName",
    "status",
    "createdAt",
    "updatedAt"
)
SELECT
    'ai_' || md5(ps."customerId" || ':' || coalesce(ps."currentProject", 'unassigned')),
    ba."id",
    coalesce(lower(ps."currentProject"), 'unknown'),
    lower(coalesce(ps."currentProject", 'unknown')) || '-' || ba."id",
    initcap(coalesce(ps."currentProject", 'Instancia')),
    'active',
    ps."createdAt",
    ps."updatedAt"
FROM "ProjectSelection" ps
JOIN "BillingAccount" ba ON ba."customerId" = ps."customerId"
WHERE ps."currentProject" IS NOT NULL
ON CONFLICT ("instanceKey") DO NOTHING;

INSERT INTO "AppInstanceBinding" (
    "id",
    "appInstanceId",
    "bindingType",
    "bindingValue",
    "isPrimary",
    "createdAt",
    "updatedAt"
)
SELECT
    'ab_' || md5(ai."id" || ':' || ba."customerId"),
    ai."id",
    CASE WHEN ai."appSlug" = 'qubito' THEN 'tenant' ELSE 'legacy-customer' END,
    CASE WHEN ai."appSlug" = 'qubito' THEN ba."customerId" ELSE ai."appSlug" || ':' || ba."customerId" END,
    true,
    ai."createdAt",
    ai."updatedAt"
FROM "AppInstance" ai
JOIN "BillingAccount" ba ON ba."id" = ai."billingAccountId"
ON CONFLICT ("bindingType", "bindingValue") DO NOTHING;
