/*
  Warnings:

  - A unique constraint covering the columns `[userId,imageUrl,text]` on the table `Transcription` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Transcription_userId_imageUrl_text_key" ON "Transcription"("userId", "imageUrl", "text");
