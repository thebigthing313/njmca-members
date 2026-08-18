import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, Link } from '@tanstack/react-router';

import { getCurrentMemberAccess } from '../lib/member-context';
import { requireProtectedRouteAccess } from '../lib/protected-route-guard';

export const Route = createFileRoute('/forbidden')({
  beforeLoad: async ({ location }) => {
    const access = await getCurrentMemberAccess();

    return {
      access: requireProtectedRouteAccess(access, {
        currentHref: location.href,
      }),
    };
  },
  component: Forbidden,
});

function Forbidden() {
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
              Forbidden
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1.5 }}>
              Your member account does not have permission for that action.
            </Typography>
          </Box>
          <Button component={Link} to="/portal" variant="contained">
            Back to portal
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
