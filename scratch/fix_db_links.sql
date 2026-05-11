
-- 1. Link PurchaseSpareInvoiceItem to PurchaseSpareInvoice
UPDATE "default$default"."PurchaseSpareInvoiceItem" t
SET "purchaseSpareInvoice" = j."A"
FROM "default$default"."_ItemRelatedToPurchaseSpareInvoice" j
WHERE t.id = j."B" AND (t."purchaseSpareInvoice" IS NULL OR t."purchaseSpareInvoice" = '');

-- 2. Backfill branch for PurchaseSpareInvoice from its items
UPDATE "default$default"."PurchaseSpareInvoice" p
SET "branch" = (
  SELECT i.branch 
  FROM "default$default"."PurchaseSpareInvoiceItem" i 
  WHERE i."purchaseSpareInvoice" = p.id 
  LIMIT 1
)
WHERE p.branch IS NULL OR p.branch = '';

-- 3. If still NULL, set to default branch (Devanahalli)
UPDATE "default$default"."PurchaseSpareInvoice"
SET branch = 'ck8g589vj499008806oh90nmx'
WHERE branch IS NULL OR branch = '';

-- 4. Fix Supplier types for VPI dropdown
-- Assuming the frontend filters by 'VEHICLE' for VPI
UPDATE "default$default"."Supplier"
SET "supplierType" = ARRAY['VEHICLE', 'SPARES']
WHERE "supplierType" = '{}' OR "supplierType" IS NULL;

-- 5. Fix Manufacturer vehicleManufacturer flag (just in case)
UPDATE "default$default"."Manufacturer"
SET "vehicleManufacturer" = true
WHERE "vehicleManufacturer" IS NULL;
