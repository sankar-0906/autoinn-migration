import prisma from '../src/config/prisma.config.js';

async function migrate() {
  const migrations = [
    {
      targetTable: 'Department',
      targetColumn: 'departmentType',
      sourceTable: 'Department_departmentType'
    },
    {
      targetTable: 'Supplier',
      targetColumn: 'supplierType',
      sourceTable: 'Supplier_supplierType'
    },
    {
      targetTable: 'PartsMaster',
      targetColumn: 'url',
      sourceTable: 'PartsMaster_url'
    },
    {
      targetTable: 'VehiclePurchaseInvoice',
      targetColumn: 'dependency',
      sourceTable: 'PurchaseInvoice_dependency'
    },
    {
      targetTable: 'NumberPlate',
      targetColumn: 'images',
      sourceTable: 'NumberPlate_images'
    },
    {
      targetTable: 'Pinelabs',
      targetColumn: 'userIds',
      sourceTable: 'Pinelabs_userIds'
    },
    {
      targetTable: 'Filter',
      targetColumn: 'model',
      sourceTable: 'Filter_model'
    },
    {
      targetTable: 'Filter',
      targetColumn: 'gender',
      sourceTable: 'Filter_gender'
    },
    {
      targetTable: 'Filter',
      targetColumn: 'customerType',
      sourceTable: 'Filter_customerType'
    },
    {
      targetTable: 'Filter',
      targetColumn: 'customerGrouping',
      sourceTable: 'Filter_customerGrouping'
    },
    {
      targetTable: 'Filter',
      targetColumn: 'leadStage',
      sourceTable: 'Filter_leadStage'
    }
  ];

  for (const m of migrations) {
    console.log(`Migrating ${m.sourceTable} to ${m.targetTable}.${m.targetColumn}...`);
    try {
      // 1. Add column if it doesn't exist
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "default$default"."${m.targetTable}" 
        ADD COLUMN IF NOT EXISTS "${m.targetColumn}" text[];
      `);

      // 2. Sync data
      await prisma.$executeRawUnsafe(`
        UPDATE "default$default"."${m.targetTable}" t
        SET "${m.targetColumn}" = (
          SELECT array_agg(s.value ORDER BY s.position)
          FROM "default$default"."${m.sourceTable}" s
          WHERE s."nodeId" = t.id
        );
      `);
      console.log(`Successfully migrated ${m.targetTable}.${m.targetColumn}`);
    } catch (err) {
      console.error(`Failed to migrate ${m.targetTable}.${m.targetColumn}:`, err.message);
    }
  }

  await prisma.$disconnect();
}

migrate();
