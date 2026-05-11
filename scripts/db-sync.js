import prisma from '../src/config/prisma.config.js';

/**
 * DATABASE SYNC SCRIPT (Prisma 1 Legacy Dump -> Prisma 7 Modernized)
 * 
 * This script transforms legacy structure into modern native PostgreSQL format.
 */

// Configuration
const TARGET_SCHEMA = 'default$default'; // The schema where your new Prisma 7 tables live

async function syncDatabase() {
  const arraysToMigrate = [
    { target: 'Department', column: 'departmentType', source: 'Department_departmentType' },
    { target: 'Supplier', column: 'supplierType', source: 'Supplier_supplierType' },
    { target: 'PartsMaster', column: 'url', source: 'PartsMaster_url' },
    { target: 'VehiclePurchaseInvoice', column: 'dependency', source: 'PurchaseInvoice_dependency' },
    { target: 'NumberPlate', column: 'images', source: 'NumberPlate_images' },
    { target: 'Pinelabs', column: 'userIds', source: 'Pinelabs_userIds' },
    { target: 'Filter', column: 'model', source: 'Filter_model' },
    { target: 'Filter', column: 'gender', source: 'Filter_gender' },
    { target: 'Filter', column: 'customerType', source: 'Filter_customerType' },
    { target: 'Filter', column: 'customerGrouping', source: 'Filter_customerGrouping' },
    { target: 'Filter', column: 'leadStage', source: 'Filter_leadStage' }
  ];

  const columnsToAdd = [
    { target: 'PurchaseSpareInvoice', column: 'createdBy', type: 'VARCHAR(25)' },
    { target: 'PurchaseSpareInvoice', column: 'branch', type: 'VARCHAR(25)' },
    { target: 'VehicleInventory', column: 'createdBy', type: 'VARCHAR(25)' },
    { target: 'VehicleInventory', column: 'branch', type: 'VARCHAR(25)' },
    { target: 'VehicleInventory', column: 'color', type: 'VARCHAR(25)' },
    { target: 'VehicleInventory', column: 'vehicle', type: 'VARCHAR(25)' },
    { target: 'VehicleInventory', column: 'vehiclePurchase', type: 'VARCHAR(25)' },
    { target: 'Transactions', column: 'branch', type: 'VARCHAR(25)' },
    { target: 'Transactions', column: 'physicalQuantity', type: 'INTEGER' },
    { target: 'Transactions', column: 'accountQuantity', type: 'INTEGER' }
  ];

  const joinTableRelations = [
    { target: 'PurchaseSpareInvoiceItem', column: 'purchaseSpareInvoice', joinTable: '_ItemRelatedToPurchaseSpareInvoice', parentCol: 'A', childCol: 'B' }
  ];

  const idExpansions = [
    { target: 'PMC', column: 'id', type: 'VARCHAR(40)' },
    { target: 'PmcPartItem', column: 'id', type: 'VARCHAR(40)' },
    { target: 'PmcPartItem', column: 'partNumber', type: 'VARCHAR(40)' },
    { target: 'PmcJobCodeItem', column: 'id', type: 'VARCHAR(40)' },
    { target: 'PmcJobCodeItem', column: 'jobCode', type: 'VARCHAR(40)' },
    { target: '_PMChasManyVehicles', column: 'A', type: 'VARCHAR(40)' },
    { target: '_PMChasManyVehicles', column: 'B', type: 'VARCHAR(40)' },
    { target: '_PMChasManyPmcParts', column: 'A', type: 'VARCHAR(40)' },
    { target: '_PMChasManyPmcParts', column: 'B', type: 'VARCHAR(40)' },
    { target: '_PMChasManyPmcJobCodes', column: 'A', type: 'VARCHAR(40)' },
    { target: '_PMChasManyPmcJobCodes', column: 'B', type: 'VARCHAR(40)' }
  ];

  console.log("------------------- DB SYNC START -------------------");

  /**
   * Helper to find a table's schema dynamically
   */
  async function resolveTable(tableName, preferredSchema = TARGET_SCHEMA) {
    const results = await prisma.$queryRawUnsafe(`
      SELECT table_schema 
      FROM information_schema.tables 
      WHERE table_name = '${tableName}'
      ORDER BY CASE WHEN table_schema = '${preferredSchema}' THEN 0 ELSE 1 END
      LIMIT 1;
    `);

    if (results.length > 0) {
      return `"${results[0].table_schema}"."${tableName}"`;
    }
    return null;
  }

  // 1. Handle ID Expansions
  for (const item of idExpansions) {
    try {
      const table = await resolveTable(item.target);
      if (!table) throw new Error(`Table ${item.target} not found`);

      console.log(`Expanding ${table}.${item.column} to ${item.type}...`);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE ${table} 
        ALTER COLUMN "${item.column}" TYPE ${item.type};
      `);
      console.log(`✅ Success: Expanded ${item.target}.${item.column}`);
    } catch (err) {
      console.error(`❌ Error expanding ${item.target}.${item.column}:`, err.message);
    }
  }

  // 2. Add Missing Columns
  for (const item of columnsToAdd) {
    try {
      const table = await resolveTable(item.target);
      if (!table) throw new Error(`Table ${item.target} not found`);

      console.log(`Adding column ${table}.${item.column} (${item.type})...`);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE ${table} 
        ADD COLUMN IF NOT EXISTS "${item.column}" ${item.type};
      `);
      console.log(`✅ Success: Added ${item.target}.${item.column}`);
    } catch (err) {
      console.error(`❌ Error adding ${item.target}.${item.column}:`, err.message);
    }
  }

  // 3. Migrate Join Table Relations
  for (const item of joinTableRelations) {
    try {
      const targetTable = await resolveTable(item.target);
      const joinTable = await resolveTable(item.joinTable, 'public'); // Source usually in public or legacy schema

      if (!targetTable) throw new Error(`Target table ${item.target} not found`);
      if (!joinTable) {
        console.warn(`⚠️ Skipping: Join table ${item.joinTable} not found in any schema.`);
        continue;
      }

      console.log(`Migrating relation ${item.target}.${item.column} from ${joinTable}...`);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE ${targetTable} 
        ADD COLUMN IF NOT EXISTS "${item.column}" VARCHAR(25);
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE ${targetTable} t
        SET "${item.column}" = j."${item.parentCol}"
        FROM ${joinTable} j
        WHERE t.id = j."${item.childCol}";
      `);

      console.log(`✅ Success: Migrated ${item.joinTable} -> ${item.target}.${item.column}`);

      // BACKFILL: Link items back to their parent if join table has data
      if (item.target === 'PurchaseSpareInvoiceItem' && item.column === 'purchaseSpareInvoice') {
        console.log("Backfilling links from Items to PurchaseSpareInvoice...");
        await prisma.$executeRawUnsafe(`
          UPDATE ${targetTable} t
          SET "${item.column}" = j."${item.parentCol}"
          FROM ${joinTable} j
          WHERE t.id = j."${item.childCol}" AND (t."${item.column}" IS NULL OR t."${item.column}" = '');
        `);
      }
    } catch (err) {
      console.error(`❌ Error migrating relation ${item.target}.${item.column}:`, err.message);
    }
  }

  // 4. Migrate Arrays
  for (const item of arraysToMigrate) {
    try {
      const targetTable = await resolveTable(item.target);
      const sourceTable = await resolveTable(item.source, 'public');

      if (!targetTable) throw new Error(`Target table ${item.target} not found`);
      if (!sourceTable) {
        console.warn(`⚠️ Skipping: Source table ${item.source} not found in any schema.`);
        continue;
      }

      console.log(`Migrating array ${item.target}.${item.column} from ${sourceTable}...`);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE ${targetTable} 
        ADD COLUMN IF NOT EXISTS "${item.column}" text[];
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE ${targetTable} t
        SET "${item.column}" = (
          SELECT array_agg(s.value ORDER BY s.position)
          FROM ${sourceTable} s
          WHERE s."nodeId" = t.id
        );
      `);

      console.log(`✅ Success: Migrated ${item.source} -> ${item.target}.${item.column}`);
    } catch (err) {
      console.error(`❌ Error migrating ${item.target}.${item.column}:`, err.message);
    }
  }

  // 5. Fix Foreign Key Constraints (Set NULL -> RESTRICT)
  const masterTables = ['Supplier', 'Manufacturer', 'Branch', 'User', 'PartsMaster', 'VehicleMaster', 'Hsn', 'Department', 'CompanyMaster'];
  try {
    console.log("Fixing Foreign Key constraints to RESTRICT for Master tables...");
    // DEBUG: Get all SET NULL constraints first to see their format
    const allSetNull = await prisma.$queryRawUnsafe(`
      SELECT 
        conrelid::regclass::text as table_name, 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'f' 
        AND pg_get_constraintdef(oid) LIKE '%SET NULL%';
    `);

    console.log(`Debug: Found ${allSetNull.length} total SET NULL constraints in DB.`);
    // if (allSetNull.length > 0) {
    //   console.log("Sample constraint definition:", allSetNull[0].definition);
    // }

    const constraints = await prisma.$queryRawUnsafe(`
      SELECT 
        conrelid::regclass::text as table_name, 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'f' 
        AND pg_get_constraintdef(oid) LIKE '%SET NULL%'
        AND pg_get_constraintdef(oid) ~* 'REFERENCES .*(${masterTables.join('|')})';
    `);

    console.log(`Found ${constraints.length} constraints to potentially fix.`);

    for (const con of constraints) {
      const { table_name, constraint_name, definition } = con;

      // Match definition: FOREIGN KEY (col) REFERENCES "schema"."Table"(id) ON DELETE SET NULL
      const match = definition.match(/FOREIGN KEY \((.*?)\) REFERENCES (.*?) ON DELETE SET NULL/i);

      if (match) {
        const column = match[1];
        const referenced = match[2];

        console.log(`Fixing ${table_name}.${constraint_name} (${column} -> ${referenced})...`);

        try {
          // Drop old constraint and add new one with ON DELETE RESTRICT
          // Note: table_name from regclass is already quoted if needed
          await prisma.$executeRawUnsafe(`
            ALTER TABLE ${table_name} 
            DROP CONSTRAINT "${constraint_name}", 
            ADD CONSTRAINT "${constraint_name}" FOREIGN KEY (${column}) REFERENCES ${referenced} ON DELETE RESTRICT;
          `);
          console.log(`✅ Success: ${constraint_name} is now RESTRICT`);
        } catch (err) {
          console.error(`❌ Error fixing ${constraint_name}:`, err.message);
        }
      } else {
        console.warn(`⚠️ Could not parse definition for ${constraint_name}: ${definition}`);
      }
    }
  } catch (err) {
    console.error("❌ Error in constraint fixing step:", err.message);
  }

  // 6. Final Data Backfills
  try {
    console.log("Running final data backfills...");
    
    // Backfill branch for PurchaseSpareInvoice from its items
    await prisma.$executeRawUnsafe(`
      UPDATE "${TARGET_SCHEMA}"."PurchaseSpareInvoice" p
      SET "branch" = (
        SELECT i.branch 
        FROM "${TARGET_SCHEMA}"."PurchaseSpareInvoiceItem" i 
        WHERE i."purchaseSpareInvoice" = p.id AND i.branch IS NOT NULL
        LIMIT 1
      )
      WHERE p.branch IS NULL OR p.branch = '';
    `);

    // Assign default branch to any remaining orphans
    const defaultBranch = 'ck8g589vj499008806oh90nmx'; // Devanahalli
    await prisma.$executeRawUnsafe(`
      UPDATE "${TARGET_SCHEMA}"."PurchaseSpareInvoice"
      SET branch = '${defaultBranch}'
      WHERE branch IS NULL OR branch = '';
    `);

    // Update Supplier types to ensure visibility in dropdowns (VEHICLE/SPARES)
    await prisma.$executeRawUnsafe(`
      UPDATE "${TARGET_SCHEMA}"."Supplier"
      SET "supplierType" = ARRAY['VEHICLE', 'SPARES']
      WHERE "supplierType" IS NULL OR "supplierType" = '{}';
    `);

    // Ensure Manufacturers are flagged as vehicle manufacturers for dropdowns
    await prisma.$executeRawUnsafe(`
      UPDATE "${TARGET_SCHEMA}"."Manufacturer"
      SET "vehicleManufacturer" = true
      WHERE "vehicleManufacturer" IS NULL;
    `);

    console.log("✅ Data backfills complete.");
  } catch (err) {
    console.error("❌ Error in backfill step:", err.message);
  }

  console.log("------------------- DB SYNC COMPLETE -------------------");
  await prisma.$disconnect();
}

syncDatabase();
