/*
  Warnings:

  - A unique constraint covering the columns `[userId,imageUrl,text,source]` on the table `Transcription` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Transcription_userId_imageUrl_text_key";

-- AlterTable
ALTER TABLE "Transcription" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'file';

-- CreateIndex
CREATE UNIQUE INDEX "Transcription_userId_imageUrl_text_source_key" ON "Transcription"("userId", "imageUrl", "text", "source");
