import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

import { normalizeEmail } from '../domain/normalization';
import { authClient } from '../lib/auth-client';

type ResetStep = 'email' | 'reset' | 'complete';

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPassword,
});

function ForgotPassword() {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [emailNormalized, setEmailNormalized] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  async function requestReset() {
    setMessage(null);
    const normalized = normalizeEmail(email);
    const result = await authClient.emailOtp.requestPasswordReset({
      email: normalized,
    });

    if (result.error) {
      setMessage(result.error.message ?? 'Password reset could not be started.');
      return;
    }

    setEmailNormalized(normalized);
    setStep('reset');
  }

  async function resetPassword() {
    setMessage(null);
    const result = await authClient.emailOtp.resetPassword({
      email: emailNormalized,
      otp,
      password,
    });

    if (result.error) {
      setMessage(result.error.message ?? 'Password reset failed.');
      return;
    }

    setStep('complete');
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
              Reset password
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1.5 }}>
              Recover your BetterAuth login; member access is still checked when
              you sign in.
            </Typography>
          </Box>

          {step === 'email' ? (
            <Stack spacing={2}>
              <TextField
                autoComplete="email"
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
              <Button onClick={requestReset} type="button" variant="contained">
                Send reset code
              </Button>
            </Stack>
          ) : null}

          {step === 'reset' ? (
            <Stack spacing={2}>
              <TextField
                label="Reset code"
                onChange={(event) => setOtp(event.target.value)}
                value={otp}
              />
              <TextField
                autoComplete="new-password"
                label="New password"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
              <Button onClick={resetPassword} type="button" variant="contained">
                Reset password
              </Button>
            </Stack>
          ) : null}

          {step === 'complete' ? (
            <Stack spacing={2}>
              <Typography>Password reset complete.</Typography>
              <Button component={Link} to="/login" variant="contained">
                Sign in
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
