import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { devMemberFixtures } from '../domain/dev-fixtures';
import { authClient } from '../lib/auth-client';
import {
  getClearDevMemberCookieHeader,
  getDevMemberCookieHeader,
} from '../server/dev-member-bypass';

export const Route = createFileRoute('/login')({
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedFixture, setSelectedFixture] = useState(
    devMemberFixtures[0]?.key ?? '',
  );
  const [message, setMessage] = useState<string | null>(null);

  async function signIn() {
    const { error } = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/portal',
    });

    if (error) {
      setMessage(error.message ?? 'Sign in failed.');
      return;
    }

    await navigate({ to: '/portal' });
  }

  async function useDevFixture() {
    document.cookie = getDevMemberCookieHeader(selectedFixture);
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
          width: 'min(100%, 520px)',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: { xs: 3, sm: 5 },
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography component="h1" variant="h3">
              Sign in
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5 }}>
              Use your NJMCA member account.
            </Typography>
          </Box>

          <Button component={Link} to="/first-time-access" variant="text">
            First-time access
          </Button>

          <Stack spacing={2}>
            <TextField
              autoComplete="email"
              label="Email"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
            <TextField
              autoComplete="current-password"
              label="Password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
            <Button onClick={signIn} type="button" variant="contained">
              Sign in
            </Button>
          </Stack>

          {import.meta.env.DEV ? (
            <Stack spacing={2}>
              <TextField
                label="Development member"
                onChange={(event) => setSelectedFixture(event.target.value)}
                select
                value={selectedFixture}
              >
                {devMemberFixtures.map((fixture) => (
                  <MenuItem key={fixture.key} value={fixture.key}>
                    {fixture.label}
                  </MenuItem>
                ))}
              </TextField>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button onClick={useDevFixture} type="button" variant="outlined">
                  Use development member
                </Button>
                <Button
                  color="inherit"
                  onClick={() => {
                    document.cookie = getClearDevMemberCookieHeader();
                    setMessage('Development member cleared.');
                  }}
                  type="button"
                  variant="text"
                >
                  Clear
                </Button>
              </Stack>
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
