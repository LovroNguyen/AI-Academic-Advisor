/**
 * Returns the JWT signing secret. Refuses to start with a missing or weak secret
 * instead of silently falling back to a guessable default.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16 || secret === 'secret') {
    throw new Error(
      'JWT_SECRET is missing or too weak (min. 16 characters). Set it in backend/.env (see .env.example).',
    );
  }
  return secret;
}
