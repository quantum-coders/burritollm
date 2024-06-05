/*
  Warnings:

  - You are about to drop the column `idUser` on the `message` table. All the data in the column will be lost.
  - Added the required column `id_user` to the `message` table without a default value. This is not possible if the table is not empty.
  - Made the column `id_chat` on table `message` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `message_idUser_fkey`;

-- DropForeignKey
ALTER TABLE `message` DROP FOREIGN KEY `message_id_chat_fkey`;

-- AlterTable
ALTER TABLE `message` DROP COLUMN `idUser`,
    ADD COLUMN `id_user` INTEGER NOT NULL,
    MODIFY `id_chat` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message` ADD CONSTRAINT `message_id_chat_fkey` FOREIGN KEY (`id_chat`) REFERENCES `chat`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
