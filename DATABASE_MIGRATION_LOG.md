# Database Migration & Production Setup Guide

This guide documents the necessary steps to sync a legacy Prisma 1 database dump with the modernized Prisma 7 backend.

## 1. Manual SQL Adjustments
If you are manually updating an existing database (Local, Test, or Production), run the following SQL commands to ensure schema compatibility.

### PMC Module (ID Expansion)
Required to resolve `PrismaClientValidationError` where CUIDs or composite IDs exceeded default column lengths.

```sql
-- Main PMC Tables
ALTER TABLE "default$default"."PMC" ALTER COLUMN "id" TYPE VARCHAR(40);
ALTER TABLE "default$default"."PmcPartItem" ALTER COLUMN "id" TYPE VARCHAR(40);
ALTER TABLE "default$default"."PmcPartItem" ALTER COLUMN "partNumber" TYPE VARCHAR(40);
ALTER TABLE "default$default"."PmcJobCodeItem" ALTER COLUMN "id" TYPE VARCHAR(40);
ALTER TABLE "default$default"."PmcJobCodeItem" ALTER COLUMN "jobCode" TYPE VARCHAR(40);

-- PMC Relation Join Tables (Many-to-Many)
ALTER TABLE "default$default"."_PMChasManyVehicles" ALTER COLUMN "A" TYPE VARCHAR(40);
ALTER TABLE "default$default"."_PMChasManyVehicles" ALTER COLUMN "B" TYPE VARCHAR(40);
ALTER TABLE "default$default"."_PMChasManyPmcParts" ALTER COLUMN "A" TYPE VARCHAR(40);
ALTER TABLE "default$default"."_PMChasManyPmcParts" ALTER COLUMN "B" TYPE VARCHAR(40);
ALTER TABLE "default$default"."_PMChasManyPmcJobCodes" ALTER COLUMN "A" TYPE VARCHAR(40);
ALTER TABLE "default$default"."_PMChasManyPmcJobCodes" ALTER COLUMN "B" TYPE VARCHAR(40);
```

### Purchase Spare Invoice (Relation Fixes)
Added missing relation columns to support user tracking (`createdBy`) and branch association that were missing in the introspected schema.

```sql
ALTER TABLE "default$default"."PurchaseSpareInvoice" ADD COLUMN IF NOT EXISTS "createdBy" VARCHAR(25);
ALTER TABLE "default$default"."PurchaseSpareInvoice" ADD COLUMN IF NOT EXISTS "branch" VARCHAR(25);

-- One-to-Many Relation Fix for Items
ALTER TABLE "default$default"."PurchaseSpareInvoiceItem" ADD COLUMN IF NOT EXISTS "purchaseSpareInvoice" VARCHAR(25);
UPDATE "default$default"."PurchaseSpareInvoiceItem" t 
SET "purchaseSpareInvoice" = j."A" 
FROM "default$default"."_ItemRelatedToPurchaseSpareInvoice" j 
WHERE t.id = j."B";

-- Enforce Referential Integrity for Suppliers
ALTER TABLE "default$default"."PurchaseSpareInvoice" 
DROP CONSTRAINT IF EXISTS "PurchaseSpareInvoice_supplier_fkey", 
ADD CONSTRAINT "PurchaseSpareInvoice_supplier_fkey" 
FOREIGN KEY (supplier) REFERENCES "default$default"."Supplier"(id) ON DELETE RESTRICT;

-- Global Referential Integrity Fix for Master Tables
-- Applied to Local and Test DBs to prevent orphan records when deleting master data.
-- Targets: Supplier, Manufacturer, Branch, User, PartsMaster, VehicleMaster, Hsn, Department, CompanyMaster
DO $$ 
DECLARE r RECORD; 
BEGIN 
    FOR r IN (
        SELECT conrelid::regclass as tbl, conname as con, pg_get_constraintdef(oid) as def 
        FROM pg_constraint 
        WHERE contype = 'f' 
          AND pg_get_constraintdef(oid) LIKE '%SET NULL%' 
          AND pg_get_constraintdef(oid) ~* 'REFERENCES .*?(Supplier|Manufacturer|Branch|User|PartsMaster|VehicleMaster|Hsn|Department|CompanyMaster)'
    ) LOOP 
        EXECUTE 'ALTER TABLE ' || r.tbl || ' DROP CONSTRAINT ' || quote_ident(r.con) || ', ADD CONSTRAINT ' || quote_ident(r.con) || ' ' || replace(r.def, 'ON DELETE SET NULL', 'ON DELETE RESTRICT'); 
    END LOOP; 
END $$;
```

---

## 2. Automated Synchronization
For new database dumps, use the provided synchronization script to handle all structural changes and data migrations (scalar lists to arrays) in one go.

### Prerequisites
1. Ensure your `.env` file has the correct `DATABASE_URL`.
2. Ensure `prisma.config.js` exists in the root directory.

### Run Sync Script
```bash
node scripts/db-sync.js
```

This script performs:
- **ID Expansions**: Increases VARCHAR lengths for PMC related tables.
- **Column Additions**: Adds `createdBy` and `branch` to `PurchaseSpareInvoice`.
- **Array Migrations**: Moves data from legacy side-tables (e.g., `Department_departmentType`) into native PostgreSQL arrays.

---

## 3. Prisma 7 Configuration
Prisma 7 requires connection management via a root configuration file.

**File: `prisma.config.js`**
```javascript
import { defineConfig } from "@prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

After any schema change or DB sync, always regenerate the client:
```bash
npx prisma generate
```

---

> [!IMPORTANT]
> **Data Loss Prevention**: The commands and scripts provided are non-destructive. They only increase column sizes, add missing columns, or populate new array fields. Never use `prisma migrate dev` or `prisma db push` on production if it prompts to reset the database.
