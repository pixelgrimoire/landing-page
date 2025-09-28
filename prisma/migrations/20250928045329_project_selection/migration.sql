-- CreateTable
CREATE TABLE "ProjectSelection" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "entitlementCode" TEXT NOT NULL,
    "currentProject" TEXT,
    "pendingProject" TEXT,
    "pendingEffectiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectSelection_customerId_entitlementCode_key" ON "ProjectSelection"("customerId", "entitlementCode");

-- AddForeignKey
ALTER TABLE "ProjectSelection" ADD CONSTRAINT "ProjectSelection_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
