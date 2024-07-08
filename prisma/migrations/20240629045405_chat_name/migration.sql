-- AlterTable
ALTER TABLE `chat` ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `metas` JSON NULL,
    ADD COLUMN `name` VARCHAR(191) NOT NULL DEFAULT 'New Chat',
    ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'active';
