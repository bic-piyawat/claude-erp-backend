-- M2: Add EstimateItem table; drop CostItem.safetyBufferPercent.
-- Plan reference: docs/wave-1-plan.md Section 3.3.

-- CreateTable: EstimateItem
CREATE TABLE `EstimateItem` (
  `id`             VARCHAR(191) NOT NULL,
  `projectId`      VARCHAR(191) NOT NULL,
  `productId`      VARCHAR(191) NULL,
  `productName`    VARCHAR(191) NULL,
  `productUom`     VARCHAR(191) NULL,
  `supplierId`     VARCHAR(191) NULL,
  `supplierName`   VARCHAR(191) NULL,
  `qty`            DOUBLE       NOT NULL DEFAULT 1,
  `unitPrice`      DOUBLE       NOT NULL DEFAULT 0,
  `vatIncluded`    BOOLEAN      NOT NULL DEFAULT true,
  `bufferAmount`   DECIMAL(12,2) NOT NULL DEFAULT 0,
  `category`       ENUM('MATERIAL','LABOR','LOGISTICS','MISC') NOT NULL DEFAULT 'MATERIAL',
  `currency`       VARCHAR(191) NOT NULL DEFAULT 'THB',
  `fxRate`         DOUBLE       NOT NULL DEFAULT 1,
  `organizationId` VARCHAR(191) NOT NULL,
  `isDeleted`      BOOLEAN      NOT NULL DEFAULT false,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `EstimateItem_projectId_idx` (`projectId`),
  INDEX `EstimateItem_organizationId_idx` (`organizationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: project (RESTRICT on delete)
ALTER TABLE `EstimateItem` ADD CONSTRAINT `EstimateItem_projectId_fkey`      FOREIGN KEY (`projectId`)      REFERENCES `Project`(`id`)       ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: product (SET NULL on delete)
ALTER TABLE `EstimateItem` ADD CONSTRAINT `EstimateItem_productId_fkey`      FOREIGN KEY (`productId`)      REFERENCES `Product`(`id`)       ON DELETE SET NULL  ON UPDATE CASCADE;

-- AddForeignKey: supplier (SET NULL on delete)
ALTER TABLE `EstimateItem` ADD CONSTRAINT `EstimateItem_supplierId_fkey`     FOREIGN KEY (`supplierId`)     REFERENCES `Supplier`(`id`)      ON DELETE SET NULL  ON UPDATE CASCADE;

-- AddForeignKey: organization (RESTRICT on delete)
ALTER TABLE `EstimateItem` ADD CONSTRAINT `EstimateItem_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: drop CostItem.safetyBufferPercent (Cluster A=B — buffer moves to EstimateItem)
ALTER TABLE `CostItem` DROP COLUMN `safetyBufferPercent`;
