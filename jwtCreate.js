import jwt from "jsonwebtoken";

const payload = {
    data: {
        service: "default@default",
        roles: ["admin"]
    }
};

const token = jwt.sign(
    payload,
    "YOUR_SECRET_KEY",
    {
        expiresIn: "1y"
    }
);

console.log(token);