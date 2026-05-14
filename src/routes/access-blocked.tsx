import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, Link } from '@tanstack/react-router';

import { getCurrentMemberAccess } from '../lib/member-context';
import { requireBlockedRouteAccess } from '../lib/protected-route-guard';

export const Route = createFileRoute('/access-blocked')({
  beforeLoad: async ({ location }) => {
    const access = await getCurrentMemberAccess();

    return {
      access: requireBlockedRouteAccess(access, {
        currentHref: location.href,
      }),
    };
  },
  validateSearch: (search: Record<string, unknown>) => ({
    reason: typeof search.reason === 'string' ? search.reason : undefined,
  }),
  component: AccessBlocked,
});

function AccessBlocked() {
  const { access } = Route.useRouteContext();

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
              Access blocked
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1.5 }}>
              Your login succeeded, but this account is not linked to an active
              NJMCA member record.
            </Typography>
          </Box>

          {access.reason ? (
            <Typography color="text.secondary">
              Reason: {access.reason}
            </Typography>
          ) : null}

          <Button component={Link} to="/login" variant="contained">
            Back to sign in
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
