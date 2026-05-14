import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getMemberDisplayName } from '../../domain/member-access';
import { permissionKeys } from '../../domain/permissions';
import { getCurrentMemberAccess } from '../../lib/member-context';
import {
  createOrganizationAction,
  deleteOrganizationAction,
  getOrganizationAdminData,
  updateMemberOrganizationAffiliationsAction,
  updateOrganizationAction,
} from '../../lib/organizations';
import { requireProtectedRouteAccess } from '../../lib/protected-route-guard';
import type {
  MemberAffiliationAdminRecord,
  OrganizationRecord,
} from '../../server/organization-repository';

type AffiliationDraft = {
  organizationId: string;
  title: string;
};

export const Route = createFileRoute('/admin/organizations')({
  beforeLoad: async ({ location }) => {
    const access = await getCurrentMemberAccess();

    return {
      access: requireProtectedRouteAccess(access, {
        currentHref: location.href,
        requiredPermission: permissionKeys.manageOrganizations,
      }),
    };
  },
  loader: async () => getOrganizationAdminData(),
  component: OrganizationsAdmin,
});

function OrganizationsAdmin() {
  const { access } = Route.useRouteContext();
  const adminData = Route.useLoaderData();
  const router = useRouter();
  const [newOrganizationName, setNewOrganizationName] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [affiliationDrafts, setAffiliationDrafts] = useState<
    AffiliationDraft[]
  >([]);
  const [message, setMessage] = useState<string | null>(null);

  const data = adminData.ok ? adminData.data : null;

  const selectedMember = useMemo(() => {
    return (
      data?.members.find((member) => member.id === selectedMemberId) ??
      data?.members[0] ??
      null
    );
  }, [data?.members, selectedMemberId]);

  useEffect(() => {
    if (!selectedMember) {
      setSelectedMemberId('');
      setAffiliationDrafts([]);
      return;
    }

    if (!selectedMemberId) {
      setSelectedMemberId(selectedMember.id);
    }

    setAffiliationDrafts(toAffiliationDrafts(selectedMember));
  }, [selectedMember, selectedMemberId]);

  if (!adminData.ok) {
    return (
      <AdminShell>
        <Typography color="error" role="alert">
          {adminData.error.message}
        </Typography>
      </AdminShell>
    );
  }

  const resolvedData = adminData.data;

  async function createOrganization() {
    setMessage(null);
    const result = await createOrganizationAction({
      data: { name: newOrganizationName },
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setNewOrganizationName('');
    setMessage('Organization created.');
    await router.invalidate();
  }

  async function updateMemberAffiliations() {
    if (!selectedMember) {
      return;
    }

    setMessage(null);
    const result = await updateMemberOrganizationAffiliationsAction({
      data: {
        memberId: selectedMember.id,
        affiliations: affiliationDrafts
          .filter((affiliation) => affiliation.organizationId)
          .map((affiliation) => ({
            organizationId: affiliation.organizationId,
            title: affiliation.title || null,
          })),
      },
    });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage('Member affiliations updated.');
    await router.invalidate();
  }

  return (
    <AdminShell>
      <Stack spacing={4}>
        <Stack spacing={1.5}>
          <Typography component="p" variant="overline">
            Organization administration
          </Typography>
          <Typography component="h1" variant="h3">
            Manage organizations
          </Typography>
          <Typography color="text.secondary">
            {getMemberDisplayName(access.member)} has the{' '}
            {permissionKeys.manageOrganizations} permission.
          </Typography>
        </Stack>

        <Paper
          component="section"
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: { xs: 2, sm: 3 },
          }}
        >
          <Stack spacing={2}>
            <Typography component="h2" variant="h5">
              Organizations
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                label="Organization name"
                onChange={(event) => setNewOrganizationName(event.target.value)}
                value={newOrganizationName}
              />
              <Button
                onClick={createOrganization}
                startIcon={<AddIcon />}
                sx={{ minWidth: 120 }}
                type="button"
                variant="contained"
              >
                Create
              </Button>
            </Stack>
            <Divider />
            <Stack spacing={1.5}>
              {resolvedData.organizations.map((organization) => (
                <OrganizationRow
                  key={organization.id}
                  onMessage={setMessage}
                  organization={organization}
                  refresh={() => router.invalidate()}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            p: { xs: 2, sm: 3 },
          }}
        >
          <Stack spacing={2}>
            <Typography component="h2" variant="h5">
              Member affiliations
            </Typography>
            <TextField
              label="Member"
              onChange={(event) => setSelectedMemberId(event.target.value)}
              select
              value={selectedMember?.id ?? ''}
            >
              {resolvedData.members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.firstName} {member.lastName}
                  {member.email ? ` (${member.email})` : ''}
                </MenuItem>
              ))}
            </TextField>

            {affiliationDrafts.map((affiliation, index) => (
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                key={`${selectedMember?.id ?? 'member'}-${index}`}
                spacing={1.5}
              >
                <TextField
                  fullWidth
                  label="Organization"
                  onChange={(event) =>
                    setAffiliationDrafts((drafts) =>
                      drafts.map((draft, draftIndex) =>
                        draftIndex === index
                          ? { ...draft, organizationId: event.target.value }
                          : draft,
                      ),
                    )
                  }
                  select
                  value={affiliation.organizationId}
                >
                  <MenuItem value="">None</MenuItem>
                  {resolvedData.organizations.map((organization) => (
                    <MenuItem key={organization.id} value={organization.id}>
                      {organization.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  label="Title"
                  onChange={(event) =>
                    setAffiliationDrafts((drafts) =>
                      drafts.map((draft, draftIndex) =>
                        draftIndex === index
                          ? { ...draft, title: event.target.value }
                          : draft,
                      ),
                    )
                  }
                  value={affiliation.title}
                />
                <Tooltip title="Remove row">
                  <IconButton
                    aria-label="Remove affiliation row"
                    onClick={() =>
                      setAffiliationDrafts((drafts) =>
                        drafts.filter((_, draftIndex) => draftIndex !== index),
                      )
                    }
                    sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}
                    type="button"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                onClick={() =>
                  setAffiliationDrafts((drafts) => [
                    ...drafts,
                    { organizationId: '', title: '' },
                  ])
                }
                startIcon={<AddIcon />}
                type="button"
                variant="outlined"
              >
                Add affiliation
              </Button>
              <Button
                disabled={!selectedMember}
                onClick={updateMemberAffiliations}
                startIcon={<SaveIcon />}
                type="button"
                variant="contained"
              >
                Save affiliations
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {message ? (
          <Typography role="status" sx={{ color: 'text.secondary' }}>
            {message}
          </Typography>
        ) : null}
      </Stack>
    </AdminShell>
  );
}

function AdminShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        px: 3,
        py: 4,
      }}
    >
      <Box sx={{ mx: 'auto', width: 'min(100%, 960px)' }}>{children}</Box>
    </Box>
  );
}

function OrganizationRow({
  organization,
  onMessage,
  refresh,
}: Readonly<{
  organization: OrganizationRecord;
  onMessage: (message: string) => void;
  refresh: () => Promise<void>;
}>) {
  const [name, setName] = useState(organization.name);

  useEffect(() => {
    setName(organization.name);
  }, [organization.name]);

  async function save() {
    const result = await updateOrganizationAction({
      data: { id: organization.id, name },
    });

    if (!result.ok) {
      onMessage(result.error.message);
      return;
    }

    onMessage('Organization updated.');
    await refresh();
  }

  async function remove() {
    const result = await deleteOrganizationAction({
      data: { id: organization.id },
    });

    if (!result.ok) {
      onMessage(result.error.message);
      return;
    }

    onMessage('Organization deleted.');
    await refresh();
  }

  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
      <TextField
        fullWidth
        label="Name"
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <Typography
        sx={{
          alignSelf: { xs: 'flex-start', md: 'center' },
          color: 'text.secondary',
          minWidth: 112,
        }}
      >
        {organization.memberCount} member
        {organization.memberCount === 1 ? '' : 's'}
      </Typography>
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Save organization">
          <IconButton aria-label="Save organization" onClick={save} type="button">
            <SaveIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete organization">
          <span>
            <IconButton
              aria-label="Delete organization"
              disabled={organization.memberCount > 0}
              onClick={remove}
              type="button"
            >
              <DeleteIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Stack>
  );
}

function toAffiliationDrafts(member: MemberAffiliationAdminRecord) {
  const drafts = member.affiliations.map((affiliation) => ({
    organizationId: affiliation.organizationId,
    title: affiliation.title ?? '',
  }));

  return drafts.length > 0 ? drafts : [{ organizationId: '', title: '' }];
}
