CREATE TABLE `User` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `passwordHash` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `User_email_key` (`email`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Session` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `csrfTokenHash` VARCHAR(191) NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastUsedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `Session_tokenHash_key` (`tokenHash`),
  INDEX `Session_expiresAt_idx` (`expiresAt`),
  INDEX `Session_userId_idx` (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Lead` (
  `id` VARCHAR(191) NOT NULL,
  `instituteName` VARCHAR(180) NOT NULL,
  `ownerName` VARCHAR(160) NULL,
  `mobileNumber` VARCHAR(40) NOT NULL,
  `normalizedMobileNumber` VARCHAR(40) NOT NULL,
  `email` VARCHAR(254) NULL,
  `location` VARCHAR(180) NULL,
  `instituteType` ENUM('COACHING_CENTRE','COMPUTER_INSTITUTE','COLLEGE','SCHOOL','OTHER') NOT NULL DEFAULT 'OTHER',
  `source` ENUM('COLD_CALLING','REFERRAL','WHATSAPP','WEBSITE','LINKEDIN','WALK_IN','OTHER') NOT NULL DEFAULT 'OTHER',
  `status` ENUM('NEW','CONTACTED','INTERESTED','DEMO_SCHEDULED','PILOT','CUSTOMER','NOT_INTERESTED','LOST') NOT NULL DEFAULT 'NEW',
  `hasBeenCalled` BOOLEAN NOT NULL DEFAULT false,
  `remarks` TEXT NULL,
  `onboardingStatus` ENUM('NOT_STARTED','IN_PROGRESS','COMPLETED') NOT NULL DEFAULT 'NOT_STARTED',
  `convertedAt` DATETIME(3) NULL,
  `customerNotes` TEXT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  `archivedAt` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  INDEX `Lead_status_idx` (`status`),
  INDEX `Lead_normalizedMobileNumber_idx` (`normalizedMobileNumber`),
  INDEX `Lead_instituteName_idx` (`instituteName`),
  INDEX `Lead_createdAt_idx` (`createdAt`),
  INDEX `Lead_archivedAt_idx` (`archivedAt`),
  INDEX `Lead_status_archivedAt_idx` (`status`,`archivedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Activity` (
  `id` VARCHAR(191) NOT NULL,
  `leadId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `type` ENUM('CALL','WHATSAPP','EMAIL','DEMO','MEETING','NOTE','STATUS_CHANGE','OTHER') NOT NULL,
  `outcome` ENUM('NO_ANSWER','SPOKE_SUCCESSFULLY','INTERESTED','CALLBACK_REQUESTED','NOT_INTERESTED','WRONG_NUMBER','OTHER') NULL,
  `notes` TEXT NULL,
  `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `Activity_leadId_occurredAt_idx` (`leadId`,`occurredAt`),
  INDEX `Activity_occurredAt_idx` (`occurredAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Task` (
  `id` VARCHAR(191) NOT NULL,
  `leadId` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `description` TEXT NULL,
  `type` ENUM('FOLLOW_UP','DEMO','ONBOARDING','OTHER') NOT NULL DEFAULT 'FOLLOW_UP',
  `priority` ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  `status` ENUM('OPEN','COMPLETED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  `dueAt` DATETIME(3) NOT NULL,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `Task_status_dueAt_idx` (`status`,`dueAt`),
  INDEX `Task_leadId_idx` (`leadId`),
  INDEX `Task_userId_status_dueAt_idx` (`userId`,`status`,`dueAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Activity` ADD CONSTRAINT `Activity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Task` ADD CONSTRAINT `Task_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Task` ADD CONSTRAINT `Task_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
