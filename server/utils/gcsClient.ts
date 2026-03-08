import { Storage } from '@google-cloud/storage';
import { getGcpAccessToken } from './gcpAuth';

export async function uploadPdfToGcs(buffer: Buffer, filename: string): Promise<string> {
  const token = await getGcpAccessToken();
  const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    // Pass the short-lived token as auth
    authClient: {
      getRequestHeaders: async () => ({ Authorization: `Bearer ${token}` }),
    } as any,
  });

  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!);
  const file = bucket.file(`uploads/${Date.now()}-${filename}`);
  await file.save(buffer, { contentType: 'application/pdf', resumable: false });
  return `gs://${process.env.GCS_BUCKET_NAME}/${file.name}`;
}
