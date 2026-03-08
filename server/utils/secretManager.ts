import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { getGcpAccessToken } from './gcpAuth';

export async function getSecret(secretName: string): Promise<string> {
  const token = await getGcpAccessToken();
  const client = new SecretManagerServiceClient({
    authClient: {
      getRequestHeaders: async () => ({ Authorization: `Bearer ${token}` }),
    } as any,
  });
  const name = `projects/${process.env.GCP_PROJECT_ID}/secrets/${secretName}/versions/latest`;
  const [version] = await client.accessSecretVersion({ name });
  return version.payload?.data?.toString() ?? '';
}
