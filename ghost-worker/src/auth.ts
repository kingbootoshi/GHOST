import {
  decodeJwt,
  decodeProtectedHeader,
  createRemoteJWKSet,
  jwtVerify,
} from 'jose';

export async function verifyJWT(token: string, env: Env) {
  if (!token) throw new Error('JWT missing');

  // ——— Extract payload & header fields with the new jose API ———
  /**
   * 1. `decodeJwt` gives us the *payload* (claims) → `iss`, `aud`, …
   * 2. `decodeProtectedHeader` gives us the *header* → `alg`, kid, …
   *
   * The old `decodeJwt(token, { complete: true })` signature has been removed
   * in jose v5, so we call the two helpers separately.
   */
  const { iss, aud } = decodeJwt(token) as {
    iss: string;
    aud: string | string[];
  };

  const { alg } = decodeProtectedHeader(token) as { alg: string };

  console.debug('[AUTH] alg =', alg);

  let payload;

  if (alg === 'HS256') {
    // ——— HS256: verify with shared secret ———
    const secret = new TextEncoder().encode(env.SUPA_JWT_SECRET);
    payload = (await jwtVerify(token, secret, {
      issuer: iss,
      audience: aud ?? 'authenticated',
    })).payload;
  } else {
    // ——— Asymmetric algorithms: verify via JWKS ———
    // jose in Cloudflare Workers supports RSA & EC curves, but **NOT EdDSA** as of 2024-05.
    // Supabase still uses EdDSA keys at `/.well-known/jwks.json`, whereas RSA keys are at `/keys`.
    // We therefore:
    //   1. Favour the RSA endpoint when the issuer looks like Supabase.
    //   2. Fail fast for unsupported algorithms to avoid misleading 500s.

    if (!['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'].includes(alg)) {
      throw new Error(`Unsupported JWT alg: ${alg}`);
    }

    const jwksUrl = new URL(
      // Supabase → use the legacy `/keys` route for RSA keys
      iss.includes('.supabase.co') ? `${iss}/keys` : `${iss}/.well-known/jwks.json`,
    );

    console.debug('[AUTH] JWKS URL =', jwksUrl.toString());

    const JWKS = createRemoteJWKSet(jwksUrl);

    payload = (
      await jwtVerify(token, JWKS, {
        issuer: iss,
        audience: aud ?? 'authenticated',
      })
    ).payload;
  }

  return payload;           // { sub, email, … }
}
