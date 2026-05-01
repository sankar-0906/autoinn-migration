import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to keys (mirrors autoinn-be structure but from src/services)
const privateKey = fs.readFileSync(
  path.resolve(__dirname, "../../keys/jwt/private.key"),
  "utf8"
);
const publicKey = fs.readFileSync(
  path.resolve(__dirname, "../../keys/jwt/public.key"),
  "utf8"
);

const algorithm = "RS256";

export default class JWT {
  static sign(payload, expiresIn) {
    return new Promise((resolve, reject) => {
      jwt.sign(
        payload,
        privateKey,
        { expiresIn: expiresIn, algorithm: algorithm },
        (err, token) => {
          if (err) {
            reject(err);
          } else {
            resolve(token);
          }
        }
      );
    });
  }

  static verify(token) {
    return new Promise((resolve, reject) => {
      if (!token) {
        return reject(new Error("No token provided"));
      }
      
      jwt.verify(
        token,
        publicKey,
        { algorithms: [algorithm] },
        (err, decoded) => {
          if (err) {
            reject(err);
          } else {
            resolve(decoded);
          }
        }
      );
    });
  }

  static decode(token) {
    if (!token) {
      throw new Error("No token provided");
    }
    
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || !decoded.payload) {
        throw new Error("Invalid token format");
      }
      return decoded;
    } catch (err) {
      throw new Error("Failed to decode token: " + err.message);
    }
  }
}
