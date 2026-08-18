import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { getMemberDisplayName } from '../domain/member-access';
import { hasPermission, permissionKeys } from '../domain/permissions';
import { getCurrentMemberAccess } from '../lib/member-context';
import { requireProtectedRouteAccess } from '../lib/protected-route-guard';
import { getClearDevMemberCookieHeader } from '../domain/dev-member-cookie';

export const Route = createFileRoute('/portal')({
  beforeLoad: async ({ location }) => {
    const access = await getCurrentMemberAccess();

    return {
      access: requireProtectedRouteAccess(access, {
        currentHref: location.href,
      }),
    };
  },
  component: Portal,
});

function Portal() {
  const { access } = Route.useRouteContext();
  const navigate = useNavigate();

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        px: 3,
        py: 4,
      }}
    >
      <Paper
        component="section"
        elevation={0}
        sx={{
          mx: 'auto',
          width: 'min(100%, 760px)',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          p: { xs: 3, sm: 5 },
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography component="p" variant="overline">
              Protected portal
            </Typography>
            <Typography component="h1" variant="h3">
              {getMemberDisplayName(access.member)}
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1.5 }}>
              Your BetterAuth identity is linked to an active NJMCA member
              record.
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">Member email</Typography>
            <Typography>{access.member.email}</Typography>
          </Box>

          {hasPermission(access.permissions, permissionKeys.manageMembers) ? (
            <Link href="/admin/members" underline="hover">
              Member administration
            </Link>
          ) : null}

          {hasPermission(
            access.permissions,
            permissionKeys.manageOrganizations,
          ) ? (
            <Link href="/admin/organizations" underline="hover">
              Organization administration
            </Link>
          ) : null}

          {import.meta.env.DEV ? (
            <Button
              onClick={() => {
                document.cookie = getClearDevMemberCookieHeader();
                navigate({ to: '/login' });
              }}
              sx={{ alignSelf: 'flex-start' }}
              type="button"
              variant="outlined"
            >
              Clear development member
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  );
}
