-- AlterTable: preserve CTR score decimals and persist top pick selection
ALTER TABLE "concepts" ALTER COLUMN "score" TYPE DOUBLE PRECISION USING ("score"::DOUBLE PRECISION);

ALTER TABLE "concepts" ADD COLUMN "isTopPick" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark exactly one top pick per pack based on highest score (ties -> lowest conceptIndex)
WITH ranked AS (
  SELECT
    "id",
    "packId",
    ROW_NUMBER() OVER (
      PARTITION BY "packId"
      ORDER BY
        "score" DESC NULLS LAST,
        "conceptIndex" ASC
    ) AS rn
  FROM "concepts"
)
UPDATE "concepts" c
SET "isTopPick" = (r.rn = 1)
FROM ranked r
WHERE c."id" = r."id";

