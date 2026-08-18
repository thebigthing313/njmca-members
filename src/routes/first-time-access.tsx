import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { authClient } from '../lib/auth-client';
import {
  completeMemberClaim,
  requestMemberClaimOtp,
  verifyMemberClaimOtp,
} from '../lib/member-claim';

type ClaimStep = 'email' | 'otp' | 'password';

export const Route = createFileRoute('/first-time-access')({
  component: FirstTimeAccess,
});

function FirstTimeAccess() {
  const navigate = useNavigate();
  const [step, setStep] = useState<ClaimStep>('email');
  const [email, setEmail] = useState('');
  const [emailNormalized, setEmailNormalized] = useState('');
  const [otp, setOtp] = useState('');
  const [claimId, setClaimId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function requestOtp() {
    setMessage(null);
    const result = await requestMemberClaimOtp({ data: { email } });

    if (!result.ok) {
      setMessage(getClaimErrorMessage(result.reason));
      return;
    }

    setEmailNormalized(result.emailNormalized);
    setStep('otp');
  }

  async function verifyOtp() {
    setMessage(null);
    const result = await verifyMemberClaimOtp({
      data: { email: emailNormalized, otp },
    });

    if (!result.ok) {
      setMessage(getClaimErrorMessage(result.reason));
      return;
    }

    setClaimId(result.claimId);
    setStep('password');
  }

  async function finishClaim() {
    setMessage(null);

    const signUpResult = await authClient.signUp.email({
      email: emailNormalized,
      password,
      name: emailNormalized,
    });

    if (signUpResult.error) {
      setMessage(signUpResult.error.message ?? 'Password setup failed.');
      return;
    }

    const linkResult = await completeMemberClaim({ data: { claimId } });

    if (!linkResult.ok) {
      setMessage(getClaimErrorMessage(linkResult.reason));
      return;
    }

    await navigate({ to: '/portal' });
  }

  return (
    <Box
      component="main"
      sx={{
        display: 'grid',
        minHeight: '100vh',
        placeItems: 'center',
        px: 3,
        py: 4,
      }}
    >
      <Paper
        component="section"
        elevation={0}
        sx={{
          width: 'min(100%, 560px)',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: { xs: 3, sm: 5 },
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h3">
              First-time access
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1.5 }}>
              Claim the account attached to your NJMCA member email.
            </Typography>
          </Box>

          {step === 'email' ? (
            <Stack spacing={2}>
              <TextField
                autoComplete="email"
                label="Member email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <Button onClick={requestOtp} type="button" variant="contained">
                Send verification code
              </Button>
            </Stack>
          ) : null}

          {step === 'otp' ? (
            <Stack spacing={2}>
              <TextField
                label="Verification code"
                onChange={(event) => setOtp(event.target.value)}
                value={otp}
              />
              <Button onClick={verifyOtp} type="button" variant="contained">
                Verify email
              </Button>
            </Stack>
          ) : null}

          {step === 'password' ? (
            <Stack spacing={2}>
              <TextField
                autoComplete="new-password"
                label="Password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <Button onClick={finishClaim} type="button" variant="contained">
                Set password and enter portal
              </Button>
            </Stack>
          ) : null}

          {message ? (
            <Typography color="error" role="alert">
              {message}
            </Typography>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}

function getClaimErrorMessage(reason: string) {
  switch (reason) {
    case 'already_linked':
      return 'This member account is already linked. Sign in or reset your password.';
    case 'inactive_member':
      return 'This member record is inactive, so portal access is unavailable.';
    case 'member_email_missing':
    case 'no_matching_member':
      return 'No active unclaimed member was found for that email.';
    case 'multiple_matching_members':
      return 'More than one member matched that email. NJMCA staff need to review it.';
    case 'unauthenticated':
      return 'Password setup did not create an active session. Try signing in.';
    case 'email_mismatch':
      return 'The verified email does not match the signed-in account.';
    case 'claim_completed':
      return 'This claim was already completed. Try signing in.';
    case 'claim_not_found':
    case 'member_not_claimable':
      return 'This claim is no longer available. Start again.';
    default:
      return 'The claim could not be completed.';
  }
}
