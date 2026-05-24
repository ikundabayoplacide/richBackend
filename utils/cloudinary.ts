import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const CLOUD_NAME = process.env.VITE_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.VITE_CLOUDINARY_UPLOAD_PRESET!;

export async function uploadToCloudinary(
  filePath: string,
  originalName: string,
  mimetype: string
): Promise<{ url: string; publicId: string; deleteToken: string }> {
  const isImage = mimetype.startsWith('image/');
  const isVideo = mimetype.startsWith('video/');
  const resourceType = isImage ? 'image' : isVideo ? 'video' : 'raw';

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath), { filename: originalName, contentType: mimetype });
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', 'survey_uploads');

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`,
    { method: 'POST', body: form }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Cloudinary upload failed: ${err}`);
  }

  const result: any = await response.json();

  // Remove temp file from disk after upload
  fs.unlink(filePath, () => {});

  return {
    url: result.secure_url,
    publicId: result.public_id,
    deleteToken: result.delete_token ?? '',
  };
}
