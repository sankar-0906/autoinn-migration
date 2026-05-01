import JWT from "../src/services/jwt.service.js";

async function generateToken(userId) {
  try {
    const payload = { id: userId, role: "SUPERADMIN" };
    const token = await JWT.sign(payload, "1h");
    console.log(`\nGenerated token for User ID: ${userId}\n`);
    console.log(token);
    console.log("\nCopy this token and use it in the 'x-access-token' header in Postman.\n");
  } catch (error) {
    console.error("Failed to generate token:", error);
  }
}

// You can pass a real user ID from your database here
const testUserId = process.argv[2] || "ck7u833pg18w60880h6m7zqf4"; // Defaulting to a likely ID or one you provide
generateToken(testUserId);
