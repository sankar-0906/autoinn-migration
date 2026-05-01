import JWT from "../services/jwt.service.js";

/**
 * Authentication Middleware.
 * Simplified version (No Redis for now) to enable Postman testing.
 */
export const auth = async (req, res, next) => {
  const token = req.headers["x-access-token"];

  try {
    if (!token) {
      return res.status(401).json({ msg: "Access Denied: No token provided" });
    }

    const decoded = await JWT.verify(token);
    req.user = decoded; // Attachment for controller use
    next();
  } catch (err) {
    return res.status(401).json({ msg: "Access Denied: Invalid Token", error: err.message });
  }
};
