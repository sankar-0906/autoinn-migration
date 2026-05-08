import prisma from '../src/config/prisma.config.js';

/**
 * DATABASE SYNC SCRIPT (Prisma 1 Legacy Dump -> Prisma 7 Modernized)
 * 
 * This script transforms legacy structure into modern native PostgreSQL format.
 */
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
    { target: 'PurchaseSpareInvoice', column: 'branch', type: 'VARCHAR(25)' }
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

  // 1. Handle ID Expansions (VARCHAR size increase)
  for (const item of idExpansions) {
    try {
      console.log(`Expanding ${item.target}.${item.column} to ${item.type}...`);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "default$default"."${item.target}" 
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
      console.log(`Adding column ${item.target}.${item.column} (${item.type})...`);
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "default$default"."${item.target}" 
        ADD COLUMN IF NOT EXISTS "${item.column}" ${item.type};
      `);
      console.log(`✅ Success: Added ${item.target}.${item.column}`);
    } catch (err) {
      console.error(`❌ Error adding ${item.target}.${item.column}:`, err.message);
    }
  }

  // 3. Migrate Join Table Relations (Many-to-Many join table to One-to-Many column)
  for (const item of joinTableRelations) {
    try {
      console.log(`Migrating relation ${item.target}.${item.column} from join table ${item.joinTable}...`);
      
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "default$default"."${item.target}" 
        ADD COLUMN IF NOT EXISTS "${item.column}" VARCHAR(25);
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE "default$default"."${item.target}" t
        SET "${item.column}" = j."${item.parentCol}"
        FROM "default$default"."${item.joinTable}" j
        WHERE t.id = j."${item.childCol}";
      `);
      
      console.log(`✅ Success: Migrated ${item.joinTable} -> ${item.target}.${item.column}`);
    } catch (err) {
      console.error(`❌ Error migrating relation ${item.target}.${item.column}:`, err.message);
    }
  }

  // 4. Migrate Arrays
  for (const item of arraysToMigrate) {
    try {
      console.log(`Migrating array ${item.target}.${item.column} from ${item.source}...`);
      
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "default$default"."${item.target}" 
        ADD COLUMN IF NOT EXISTS "${item.column}" text[];
      `);

      await prisma.$executeRawUnsafe(`
        UPDATE "default$default"."${item.target}" t
        SET "${item.column}" = (
          SELECT array_agg(s.value ORDER BY s.position)
          FROM "default$default"."${item.source}" s
          WHERE s."nodeId" = t.id
        );
      `);
      
      console.log(`✅ Success: Migrated ${item.source} -> ${item.target}.${item.column}`);
    } catch (err) {
      console.error(`❌ Error migrating ${item.target}.${item.column}:`, err.message);
    }
  }

  console.log("------------------- DB SYNC COMPLETE -------------------");
  await prisma.$disconnect();
}

syncDatabase();
