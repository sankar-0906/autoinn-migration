import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const s3Client = new S3Client({
  endpoint: 'https://sgp1.digitaloceanspaces.com',
  region: 'sgp1',
  credentials: {
    accessKeyId: process.env.SPACE_KEY,
    secretAccessKey: process.env.SPACE_SECRET,
  },
});

export const uploadPDFToSpaces = async (pdfBuffer, fileName, moduleName) => {
  try {
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Legacy path structure: Production/Transaction Master/estimate/2025/7/30/ESTNY028.pdf
    const spaceLoc = process.env.SPACE_LOC || 'Production/';
    const key = `${spaceLoc}Transaction Master/${moduleName}/${year}/${month}/${day}/${fileName}.pdf`;

    const params = {
      Bucket: process.env.SPACE_BUCKET,
      Key: key,
      Body: pdfBuffer,
      ACL: 'public-read',
      ContentType: 'application/pdf',
      ContentDisposition: 'inline',
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Return the public URL
    const url = `https://${process.env.SPACE_BUCKET}.sgp1.digitaloceanspaces.com/${key}`;
    return url;
  } catch (err) {
    console.error("Error uploading to DigitalOcean Spaces:", err);
    throw err;
  }
};
