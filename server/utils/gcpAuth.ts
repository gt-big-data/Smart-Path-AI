import { GoogleAuth } from 'google-auth-library';

let _localAuth: GoogleAuth | null = null;

/**
 * Returns a GCP access token scoped to cloud-platform.
 * - On Vercel: exchanges the Vercel OIDC token via GCP STS + SA impersonation.
 * - Locally: uses Application Default Credentials (run `gcloud auth application-default login`).
 */
export async function getGcpAccessToken(): Promise<string> {
  if (process.env.VERCEL !== '1') {
    // Local dev: use ADC
    if (!_localAuth) _localAuth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
    const client = await _localAuth.getClient();
    const { token } = await client.getAccessToken();
    if (!token) throw new Error('ADC returned no token');
    return token;
  }

  // Vercel runtime: exchange OIDC token with GCP STS
  const { getVercelOidcToken } = await import('@vercel/functions/oidc');
  const oidcToken = await getVercelOidcToken();

  const stsRes = await fetch('https://sts.googleapis.com/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      audience: `//iam.googleapis.com/${process.env.GCP_WORKLOAD_IDENTITY_PROVIDER}`,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      subject_token: oidcToken,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
    }),
  });
  if (!stsRes.ok) throw new Error(`GCP STS error: ${await stsRes.text()}`);
  const { access_token: federatedToken } = await stsRes.json() as { access_token: string };

  // Impersonate the service account for proper IAM permissions
  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL!;
  const impRes = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${federatedToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: ['https://www.googleapis.com/auth/cloud-platform'] }),
    }
  );
  if (!impRes.ok) throw new Error(`SA impersonation error: ${await impRes.text()}`);
  const { accessToken } = await impRes.json() as { accessToken: string };
  return accessToken;
}
