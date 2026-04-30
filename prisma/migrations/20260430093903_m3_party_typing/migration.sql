-- Customer.type
ALTER TABLE `Customer` ADD COLUMN `type` ENUM('INDIVIDUAL','COMPANY','GOVERNMENT') NOT NULL DEFAULT 'COMPANY';

-- Heuristic: Thai citizen-ID shape (13 digits, leading 1-8)
UPDATE `Customer` SET `type` = 'INDIVIDUAL' WHERE `taxId` REGEXP '^[1-8][0-9]{12}$';

-- Supplier.type
ALTER TABLE `Supplier` ADD COLUMN `type` ENUM('COMPANY','INDIVIDUAL') NOT NULL DEFAULT 'COMPANY';

-- Attachment.category
ALTER TABLE `Attachment` ADD COLUMN `category` ENUM('CUSTOMER_PO','QUOTATION','DRAWING','OTHER') NOT NULL DEFAULT 'OTHER';

-- ContactPerson table
CREATE TABLE `ContactPerson` (
  `id`             VARCHAR(191) NOT NULL,
  `customerId`     VARCHAR(191) NOT NULL,
  `name`           VARCHAR(191) NOT NULL,
  `position`       VARCHAR(191) NULL,
  `phone`          VARCHAR(191) NULL,
  `email`          VARCHAR(191) NULL,
  `isPrimary`      BOOLEAN      NOT NULL DEFAULT false,
  `organizationId` VARCHAR(191) NOT NULL,
  `isDeleted`      BOOLEAN      NOT NULL DEFAULT false,
  `createdAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `ContactPerson_customerId_idx` (`customerId`),
  INDEX `ContactPerson_organizationId_idx` (`organizationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ContactPerson` ADD CONSTRAINT `ContactPerson_customerId_fkey`     FOREIGN KEY (`customerId`)     REFERENCES `Customer`(`id`)      ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE `ContactPerson` ADD CONSTRAINT `ContactPerson_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
