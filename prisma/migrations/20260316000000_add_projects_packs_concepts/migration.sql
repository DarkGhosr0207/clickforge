-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoTitle" TEXT NOT NULL,
    "niche" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generatedAt" TEXT NOT NULL,
    "recommendation" JSONB,
    "comparisonResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "concepts" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "conceptIndex" INTEGER NOT NULL,
    "strategy" TEXT NOT NULL,
    "overlayText" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "emotion" TEXT NOT NULL,
    "colors" TEXT NOT NULL,
    "visualHook" TEXT,
    "scoreReason" TEXT,
    "curiosityScore" INTEGER,
    "emotionScore" INTEGER,
    "clarityScore" INTEGER,
    "competitionScore" INTEGER,
    "score" INTEGER,
    "titleSuggestion" TEXT,
    "titleReason" TEXT,
    "titleFitScore" INTEGER,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packs_projectId_generatedAt_key" ON "packs"("projectId", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "concepts_packId_conceptIndex_key" ON "concepts"("packId", "conceptIndex");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_packId_fkey" FOREIGN KEY ("packId") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
