/**
 * WebAuthn / Passkey configuration.
 * Set these in .env.local for your environment.
 */
const relyingPartyID =
  process.env.WEBAUTHN_RELYING_PARTY_ID ?? "localhost";
const relyingPartyName =
  process.env.WEBAUTHN_RELYING_PARTY_NAME ?? "VewAI Veterinary OSCE";
const relyingPartyOrigin =
  process.env.WEBAUTHN_RELYING_PARTY_ORIGIN ?? "http://localhost:3000";

export { relyingPartyID, relyingPartyName, relyingPartyOrigin };
