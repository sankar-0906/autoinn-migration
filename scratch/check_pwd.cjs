const bcrypt = require('bcryptjs');

const hash = "$2a$10$bkScCTHRdvb/CmrQU6LIGuYaATLVytxsrxrqmBWZLXikbpbV2IheO";
const passwords = [
    "admin",
    "password",
    "123456",
    "admin123",
    "autoinn",
    "autoinn123",
    "9876543210",
    "1234567890",
    "welcome",
    "welcome123",
    "root",
    "qwerty",
    "AutoInn@123",
    "Sankar@123",
    "Sankar"
];

async function check() {
    for (const pwd of passwords) {
        const match = await bcrypt.compare(pwd, hash);
        if (match) {
            console.log(`MATCH FOUND: ${pwd}`);
            return;
        }
    }
    console.log("No match found in the common list.");
}

check();
