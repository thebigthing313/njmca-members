import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, redirect } from '@tanstack/react-router';

import { getMemberDisplayName } from '../../domain/member-access';
import { hasPermission, permissionKeys } from '../../domain/permissions';
import { getCurrentMemberAccess } from '../../lib/member-context';

export const Route = createFileRoute('/admin/members')({
  beforeLoad: async ({ location }) => {
    const access = await getCurrentMemberAccess();

    if (access.status === 'unauthenticated') {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }

    if (access.status === 'blocked') {
      throw redirect({
        to: '/access-blocked',
        search: { reason: access.reason },
      });
    }

    if (!hasPermission(access.permissions, permissionKeys.manageMembers)) {
      throw redirect({ to: '/forbidden' });
    }

    return { access };
  },
  component: MembersAdmin,
});

function MembersAdmin() {
  const { access } = Route.useRouteContext();

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
        <Stack spacing={2}>
          <Typography component="p" variant="overline">
            Member administration
          </Typography>
          <Typography component="h1" variant="h3">
            Manage members
          </Typography>
          <Typography color="text.secondary">
            {getMemberDisplayName(access.member)} has the{' '}
            {permissionKeys.manageMembers} permission.
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
