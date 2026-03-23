# Passkey (WebAuthn) Setup – Spec

## User Story

After signing in via magic link, users are prompted to create a passkey so they can sign in faster and more securely in the future. The flow is optional; users may skip and continue to the app.

## Data Model

### webauthn.credentials

Stores verified passkey public keys linked to `auth.users`.

```ts
interface WebAuthnCredential {
  id: string;
  user_id: string;
  credential_id: string;
  friendly_name: string | null;
  credential_type: "public-key";
  public_key: Buffer;
  aaguid: string;
  sign_count: number;
  transports: string[];
  user_verification_status: "verified" | "unverified";
  device_type: "single_device" | "multi_device";
  backup_state: "backed_up" | "not_backed_up";
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}
```

### webauthn.challenges

Stores one-time challenges for registration and authentication.

```ts
interface WebAuthnChallenge {
  id: string;
  user_id: string | null;
  value: string;
  created_at: string;
}
```

## API Contract

### POST /api/passkeys/challenge

**Auth:** Bearer token required.

**Response:** `PublicKeyCredentialCreationOptionsJSON` (options for `startRegistration`).

**Errors:** 401 Unauthorized, 500 on store failure.

### POST /api/passkeys/verify

**Auth:** Bearer token required.

**Body:** Attestation response from `startRegistration`.

**Response:** `{ credential_id, friendly_name, created_at }`

**Errors:** 400 no pending challenge or verification failed, 500 on save failure.

### GET /api/passkeys/check

**Auth:** Bearer token required.

**Response:** `{ hasPasskey: boolean }`

## Component Tree

- **app/setup-passkey/page.tsx**
  - SetupPasskeyPage (client)
    - Logo, title, benefit bullets (icons + text)
    - Create passkey button → calls challenge → startRegistration → verify
    - Skip for now button → navigates to /
    - Error display

## Critical Rules

1. Challenges are single-use; delete immediately after retrieval.
2. RP ID must match the request origin (e.g. `localhost` for dev).
3. Credentials are tied to `auth.users`; RLS restricts SELECT to own user.
4. Passkey creation is optional; users may skip and continue with magic link.
