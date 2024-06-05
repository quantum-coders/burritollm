/*
  Warnings:

  - You are about to drop the column `userId` on the `chat` table. All the data in the column will be lost.
  - You are about to drop the column `chatId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `message` table. All the data in the column will be lost.
  - You are about to drop the `log` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `idUser` to the `chat` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idUser` to the `message` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `chat` DROP FOREIGN KEY `chat_userId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `message_chatId_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `message_userId_fkey`;

-- AlterTable
ALTER TABLE `chat` DROP COLUMN `userId`,
    ADD COLUMN `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `idUser` INTEGER NOT NULL,
    ADD COLUMN `modified` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `message` DROP COLUMN `chatId`,
    DROP COLUMN `userId`,
    ADD COLUMN `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `idUser` INTEGER NOT NULL,
    ADD COLUMN `id_chat` INTEGER NULL,
    ADD COLUMN `modified` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- DropTable
DROP TABLE `log`;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_idUser_fkey` FOREIGN KEY (`idUser`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_id_chat_fkey` FOREIGN KEY (`id_chat`) REFERENCES `chat`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat` ADD CONSTRAINT `chat_idUser_fkey` FOREIGN KEY (`idUser`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
