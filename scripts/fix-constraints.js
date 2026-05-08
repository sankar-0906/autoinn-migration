import prisma from '../src/config/prisma.config.js';

/**
 * FIX CONSTRAINTS SCRIPT
 * 
 * Changes ON DELETE SET NULL to ON DELETE RESTRICT for Master tables
 * to prevent accidental deletion of referenced records.
 */
async function fixConstraints() {
  const masterTables = ['Supplier', 'Manufacturer', 'Branch', 'User', 'PartsMaster', 'VehicleMaster', 'Hsn', 'Department', 'CompanyMaster'];
  
  console.log("------------------- FIX CONSTRAINTS START -------------------");

  try {
    // 1. Find all foreign keys to master tables that have SET NULL
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT 
        conrelid::regclass::text as table_name, 
        conname as constraint_name,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE contype = 'f' 
        AND pg_get_constraintdef(oid) LIKE '%SET NULL%'
        AND pg_get_constraintdef(oid) ~* 'REFERENCES "default\\\\\\$default"\\\\."(${masterTables.join('|')})"';
    `);

    console.log(`Found ${constraints.length} constraints to fix.`);

    for (const con of constraints) {
      const { table_name, constraint_name, definition } = con;
      
      // Extract the foreign key column and the referenced table/column
      // Definition looks like: FOREIGN KEY (supplier) REFERENCES "default$default"."Supplier"(id) ON DELETE SET NULL
      const match = definition.match(/FOREIGN KEY \((.*?)\) REFERENCES (.*?) ON DELETE SET NULL/);
      if (match) {
        const column = match[1];
        const referenced = match[2];
        
        console.log(`Fixing ${table_name}.${constraint_name}...`);
        
        try {
          await prisma.$executeRawUnsafe(`
            ALTER TABLE ${table_name} 
            DROP CONSTRAINT "${constraint_name}", 
            ADD CONSTRAINT "${constraint_name}" FOREIGN KEY (${column}) REFERENCES ${referenced} ON DELETE RESTRICT;
          `);
          console.log(`✅ Success: ${constraint_name} is now RESTRICT`);
        } catch (err) {
          console.error(`❌ Error fixing ${constraint_name}:`, err.message);
        }
      }
    }

  } catch (err) {
    console.error("FATAL ERROR:", err.message);
  }

  console.log("------------------- FIX CONSTRAINTS COMPLETE -------------------");
  await prisma.$disconnect();
}

fixConstraints();
