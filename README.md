# NJMCA Members

Members portal for the New Jersey Mosquito Control Association.

## Stack

- React + TypeScript
- TanStack Start
- TanStack Router
- MUI
- Railway Postgres

## Local Setup

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Copy `.env.example` to `.env.local` and add your Railway Postgres connection string and Better Auth secret.

   ```bash
   DATABASE_URL=
   BETTER_AUTH_SECRET=
   BETTER_AUTH_URL=http://127.0.0.1:4280
   RESEND_API_KEY=
   NJMCA_OTP_FROM_EMAIL="NJMCA Members <members@example.org>"
   NJMCA_EMAIL_DELIVERY=console
   RESEND_TEST_RECIPIENT=delivered@resend.dev
   ```

3. Start the dev server.

   ```bash
   pnpm dev
   ```

## Demo

The app has a protected `/portal` route. In development, `/login` includes fake `.test` member identities for testing active, inactive, missing-member, and email-mismatch access states without production impersonation. `/first-time-access` starts the member claim flow for an active unlinked member, and `/forgot-password` handles OTP-based password reset. The first admin tracer is `/admin/members`, guarded by the `manage_members` permission.

## Email Testing

OTP delivery is controlled by `NJMCA_EMAIL_DELIVERY`:

- `console`: local/default development mode. OTPs are logged server-side and no email leaves the app.
- `resend-test`: sends through Resend to `RESEND_TEST_RECIPIENT`, which should use a Resend test address such as `delivered@resend.dev`, `bounced@resend.dev`, `complained@resend.dev`, or `suppressed@resend.dev`.
- `resend`: sends through Resend to the real member email. Use this for production and manual acceptance against a verified sending domain.
