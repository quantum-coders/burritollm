/*
  Warnings:

  - You are about to drop the column `idUser` on the `chat` table. All the data in the column will be lost.
  - You are about to drop the column `messageType` on the `message` table. All the data in the column will be lost.
  - Added the required column `id_user` to the `chat` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `chat` DROP FOREIGN KEY `chat_idUser_fkey`;

-- AlterTable
ALTER TABLE `chat` DROP COLUMN `idUser`,
    ADD COLUMN `id_user` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `message` DROP COLUMN `messageType`,
    ADD COLUMN `message_type` VARCHAR(191) NOT NULL DEFAULT 'user';

-- AddForeignKey
ALTER TABLE `chat` ADD CONSTRAINT `chat_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
