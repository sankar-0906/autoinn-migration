import prisma from '../src/config/prisma.config.js';

/**
 * DATABASE SYNC SCRIPT (Prisma 1 Legacy Dump -> Prisma 7 Modernized)
 * 
 * This script transforms legacy side-table scalar lists into modern native PostgreSQL arrays.
 * Run this EVERY TIME you import a new database dump from the legacy system.
 */
async function syncDatabase() {
  const tablesToMigrate = [
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

  console.log("------------------- DB SYNC START -------------------");

  for (const item of tablesToMigrate) {
    try {
      console.log(`Checking ${item.target}.${item.column}...`);
      
      // 1. Add native array column if it doesn't exist
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "default$default"."${item.target}" 
        ADD COLUMN IF NOT EXISTS "${item.column}" text[];
      `);

      // 2. Aggregate data from legacy side-table into the new array column
      const result = await prisma.$executeRawUnsafe(`
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
