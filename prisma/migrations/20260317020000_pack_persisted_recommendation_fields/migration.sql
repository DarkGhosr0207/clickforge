-- Persist recommendation fields on packs so they stay in sync after improvements/reload
ALTER TABLE "packs" ADD COLUMN "recommendedVariantId" INTEGER;
ALTER TABLE "packs" ADD COLUMN "recommendationExplanation" TEXT;
ALTER TABLE "packs" ADD COLUMN "recommendationCtrReasoning" TEXT;
ALTER TABLE "packs" ADD COLUMN "recommendationStressRisk" TEXT;
ALTER TABLE "packs" ADD COLUMN "recommendationStressImprovement" TEXT;

-- Backfill from existing recommendation JSON (if present)
UPDATE "packs"
SET
  "recommendedVariantId" = NULLIF(("recommendation"->>'bestVariantId')::INTEGER, 0),
  "recommendationExplanation" = "recommendation"->>'explanation',
  "recommendationCtrReasoning" = "recommendation"->>'ctrReasoning',
  "recommendationStressRisk" = "recommendation"#>>'{stressTest,risk}',
  "recommendationStressImprovement" = "recommendation"#>>'{stressTest,improvement}'
WHERE "recommendation" IS NOT NULL;

