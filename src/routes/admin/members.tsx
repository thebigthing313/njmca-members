import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import EditIcon from '@mui/icons-material/Edit';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PreviewIcon from '@mui/icons-material/Preview';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { AppError } from '../../domain/app-result';
import { getMemberDisplayName } from '../../domain/member-access';
import {
  getCsvHeadersFromText,
  guessCsvMemberImportMapping,
  type CsvMemberImportMapping,
  type CsvMemberImportOrganizationMode,
  type CsvMemberImportPreview,
} from '../../domain/member-import-preview';
import { type ManagedMember } from '../../domain/member-management';
import { hasPermission, permissionKeys } from '../../domain/permissions';
import {
  commitMemberCsvImportAction,
  previewMemberCsvImportAction,
} from '../../lib/member-import';
import { getCurrentMemberAccess } from '../../lib/member-context';
import {
  createMember,
  deactivateMember,
  listManagedMembers,
  unlinkMemberUser,
  updateMember,
} from '../../lib/member-management';
import {
  assignMemberRole,
  endMemberRoleAssignment,
  getRoleAssignmentAdminData,
} from '../../lib/role-assignments';
import { requireProtectedRouteAccess } from '../../lib/protected-route-guard';
import type {
  RoleAssignmentAdminMember,
  RoleAssignmentAdminRecord,
  RoleAssignmentAdminRole,
} from '../../server/role-assignment-repository';

type MemberFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

type MemberDialogState =
  | {
      mode: 'create';
      member: null;
      form: MemberFormState;
    }
  | {
      mode: 'edit';
      member: ManagedMember;
      form: MemberFormState;
    };

const emptyForm: MemberFormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
};

export const Route = createFileRoute('/admin/members')({
  beforeLoad: async ({ location }) => {
    const access = await getCurrentMemberAccess();

    return {
      access: requireProtectedRouteAccess(access, {
        currentHref: location.href,
        requiredPermissions: [
          permissionKeys.manageMembers,
          permissionKeys.manageRoles,
        ],
      }),
    };
  },
  component: MembersAdmin,
});

function MembersAdmin() {
  const { access } = Route.useRouteContext();
  const canManageMembers = hasPermission(
    access.permissions,
    permissionKeys.manageMembers,
  );
  const canManageRoles = hasPermission(
    access.permissions,
    permissionKeys.manageRoles,
  );
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [dialog, setDialog] = useState<MemberDialogState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<AppError | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (canManageMembers) {
      void refreshMembers();
    }
  }, [canManageMembers]);

  const activeCount = useMemo(
    () => members.filter((member) => member.isActive).length,
    [members],
  );

  async function refreshMembers() {
    const result = await listManagedMembers();

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMembers(result.data);
  }

  async function saveMember() {
    if (!dialog) {
      return;
    }

    setIsBusy(true);
    setFormError(null);
    setMessage(null);

    const result =
      dialog.mode === 'create'
        ? await createMember({ data: dialog.form })
        : await updateMember({
            data: {
              memberId: dialog.member.id,
              ...dialog.form,
            },
          });

    setIsBusy(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setDialog(null);
    await refreshMembers();
  }

  async function deactivate(member: ManagedMember) {
    setMessage(null);
    const result = await deactivateMember({ data: { memberId: member.id } });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    await refreshMembers();
  }

  async function unlink(member: ManagedMember) {
    setMessage(null);
    const result = await unlinkMemberUser({ data: { memberId: member.id } });

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    await refreshMembers();
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100vh',
        px: 3,
        py: 4,
      }}
    >
      <Stack spacing={3} sx={{ mx: 'auto', width: 'min(100%, 1120px)' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Box>
            <Typography component="p" variant="overline">
              Member administration
            </Typography>
            <Typography component="h1" variant="h3">
              Manage members
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 1 }}>
              {canManageMembers
                ? `${getMemberDisplayName(
                    access.member,
                  )} can manage ${activeCount} active members.`
                : `${getMemberDisplayName(
                    access.member,
                  )} can manage member role assignments.`}
            </Typography>
          </Box>
          {canManageMembers ? (
            <Button
              onClick={() =>
                setDialog({ mode: 'create', member: null, form: emptyForm })
              }
              startIcon={<AddIcon />}
              variant="contained"
            >
              Create member
            </Button>
          ) : null}
        </Stack>

        {message ? (
          <Alert onClose={() => setMessage(null)} severity="error">
            {message}
          </Alert>
        ) : null}

        {canManageMembers ? (
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
          >
            <Table aria-label="Members">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Auth user</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      {member.firstName} {member.lastName}
                    </TableCell>
                    <TableCell>{member.email ?? 'None'}</TableCell>
                    <TableCell>{member.phone ?? 'None'}</TableCell>
                    <TableCell>
                      <Chip
                        color={member.isActive ? 'success' : 'default'}
                        label={member.isActive ? 'Active' : 'Inactive'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        color={member.userId ? 'primary' : 'default'}
                        label={member.userId ? 'Linked' : 'Unlinked'}
                        size="small"
                        variant={member.userId ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit member">
                        <IconButton
                          aria-label={`Edit ${member.firstName} ${member.lastName}`}
                          onClick={() =>
                            setDialog({
                              mode: 'edit',
                              member,
                              form: toFormState(member),
                            })
                          }
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Unlink auth user">
                        <span>
                          <IconButton
                            aria-label={`Unlink ${member.firstName} ${member.lastName}`}
                            disabled={!member.userId}
                            onClick={() => void unlink(member)}
                          >
                            <LinkOffIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Deactivate member">
                        <span>
                          <IconButton
                            aria-label={`Deactivate ${member.firstName} ${member.lastName}`}
                            disabled={!member.isActive}
                            onClick={() => void deactivate(member)}
                          >
                            <BlockIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : null}

        {canManageMembers ? (
          <CsvImportPreviewPanel onCommitted={refreshMembers} />
        ) : null}

        {canManageRoles ? <RoleAssignmentManager /> : null}
      </Stack>

      <MemberDialog
        dialog={dialog}
        error={formError}
        isBusy={isBusy}
        onChange={(form) =>
          dialog ? setDialog({ ...dialog, form }) : undefined
        }
        onClose={() => {
          setDialog(null);
          setFormError(null);
        }}
        onSave={() => void saveMember()}
      />
    </Box>
  );
}

type RoleAssignmentAdminData = {
  members: RoleAssignmentAdminMember[];
  roles: RoleAssignmentAdminRole[];
  assignments: RoleAssignmentAdminRecord[];
};

type MappingField = keyof CsvMemberImportMapping;

const mappingFields: Array<{
  key: MappingField;
  label: string;
}> = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'organization', label: 'Organization' },
  { key: 'title', label: 'Affiliation title' },
];

function CsvImportPreviewPanel(props: { onCommitted: () => Promise<void> }) {
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<CsvMemberImportMapping>({});
  const [organizationModeType, setOrganizationModeType] =
    useState<CsvMemberImportOrganizationMode['type']>('column');
  const [fixedOrganizationName, setFixedOrganizationName] = useState('');
  const [preview, setPreview] = useState<CsvMemberImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);

  async function loadFile(file: File | undefined) {
    if (!file) {
      return;
    }

    const text = await file.text();
    const headerResult = getCsvHeadersFromText(text);

    setCsvText(text);
    setFileName(file.name);
    setPreview(null);
    setMessage(null);
    setFieldErrors({});

    if (!headerResult.ok) {
      setHeaders([]);
      setMapping({});
      setMessage(headerResult.error.message);
      return;
    }

    const guessedMapping = guessCsvMemberImportMapping(headerResult.data);

    setHeaders(headerResult.data);
    setMapping(guessedMapping);
    setOrganizationModeType(guessedMapping.organization ? 'column' : 'fixed');
  }

  async function previewImport() {
    setIsBusy(true);
    setPreview(null);
    setMessage(null);
    setFieldErrors({});

    const organizationMode: CsvMemberImportOrganizationMode =
      organizationModeType === 'fixed'
        ? { type: 'fixed', organizationName: fixedOrganizationName }
        : organizationModeType === 'column'
          ? { type: 'column' }
          : { type: 'none' };

    const result = await previewMemberCsvImportAction({
      data: {
        csvText,
        mapping,
        organizationMode,
      },
    });

    setIsBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      setFieldErrors(result.error.fieldErrors ?? {});
      return;
    }

    setPreview(result.data);
  }

  async function commitImport() {
    if (!preview) {
      return;
    }

    setIsBusy(true);
    setMessage(null);
    setFieldErrors({});

    const organizationMode: CsvMemberImportOrganizationMode =
      organizationModeType === 'fixed'
        ? { type: 'fixed', organizationName: fixedOrganizationName }
        : organizationModeType === 'column'
          ? { type: 'column' }
          : { type: 'none' };
    const result = await commitMemberCsvImportAction({
      data: {
        csvText,
        mapping,
        organizationMode,
        expectedPreviewFingerprint: preview.previewFingerprint,
        confirmed: true,
      },
    });

    setIsBusy(false);

    if (!result.ok) {
      setMessage(result.error.message);
      setFieldErrors(result.error.fieldErrors ?? {});
      return;
    }

    setMessage(
      `Import committed: ${result.data.membersCreated} created, ${result.data.membersUpdated} updated, ${result.data.organizationsCreated} organizations created.`,
    );
    setPreview(null);
    await props.onCommitted();
  }

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3 }}
    >
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' }, justifyContent: 'space-between' }}
        >
          <Box>
            <Typography component="h2" variant="h5">
              CSV import preview
            </Typography>
            <Typography color="textSecondary" sx={{ mt: 0.5 }}>
              Stage member and organization changes before commit.
            </Typography>
          </Box>
          <Button
            component="label"
            startIcon={<UploadFileIcon />}
            variant="outlined"
          >
            Choose CSV
            <input
              accept=".csv,text/csv"
              hidden
              onChange={(event) => void loadFile(event.target.files?.[0])}
              type="file"
            />
          </Button>
        </Stack>

        {fileName ? (
          <Typography color="textSecondary" variant="body2">
            {fileName}
          </Typography>
        ) : null}

        {message ? (
          <Alert onClose={() => setMessage(null)} severity="warning">
            {message}
          </Alert>
        ) : null}

        {headers.length > 0 ? (
          <>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ alignItems: { md: 'center' } }}
            >
              <TextField
                label="Organization mode"
                onChange={(event) =>
                  setOrganizationModeType(
                    event.target
                      .value as CsvMemberImportOrganizationMode['type'],
                  )
                }
                select
                value={organizationModeType}
              >
                <MenuItem value="column">Column</MenuItem>
                <MenuItem value="fixed">Fixed</MenuItem>
                <MenuItem value="none">None</MenuItem>
              </TextField>
              {organizationModeType === 'fixed' ? (
                <TextField
                  error={Boolean(fieldErrors.organizationName)}
                  fullWidth
                  helperText={fieldErrors.organizationName}
                  label="Fixed organization"
                  onChange={(event) =>
                    setFixedOrganizationName(event.target.value)
                  }
                  value={fixedOrganizationName}
                />
              ) : null}
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(3, minmax(0, 1fr))',
                },
              }}
            >
              {mappingFields.map((field) => (
                <CsvMappingSelect
                  error={fieldErrors[field.key]}
                  headers={headers}
                  key={field.key}
                  label={field.label}
                  onChange={(value) =>
                    setMapping((current) => ({
                      ...current,
                      [field.key]: value || null,
                    }))
                  }
                  value={mapping[field.key] ?? ''}
                />
              ))}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button
                disabled={isBusy}
                onClick={() => void previewImport()}
                startIcon={<PreviewIcon />}
                variant="contained"
              >
                Preview import
              </Button>
            </Stack>
          </>
        ) : null}

        {preview ? (
          <CsvImportPreviewResult
            isBusy={isBusy}
            onCommit={() => void commitImport()}
            preview={preview}
          />
        ) : null}
      </Stack>
    </Paper>
  );
}

function CsvMappingSelect(props: {
  error?: string;
  headers: string[];
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <TextField
      error={Boolean(props.error)}
      helperText={props.error}
      label={props.label}
      onChange={(event) => props.onChange(event.target.value)}
      select
      value={props.value}
    >
      <MenuItem value="">Not mapped</MenuItem>
      {props.headers.map((header) => (
        <MenuItem key={header} value={header}>
          {header}
        </MenuItem>
      ))}
    </TextField>
  );
}

function CsvImportPreviewResult(props: {
  isBusy: boolean;
  onCommit: () => void;
  preview: CsvMemberImportPreview;
}) {
  const { isBusy, onCommit, preview } = props;
  const canCommit =
    preview.summary.readyRows > 0 &&
    preview.summary.blockedRows === 0 &&
    preview.summary.reviewRows === 0;

  return (
    <Stack spacing={2}>
      <Divider />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Chip label={`${preview.summary.readyRows} ready`} color="success" />
        <Chip label={`${preview.summary.blockedRows} blocked`} color="error" />
        <Chip
          label={`${preview.summary.reviewRows} review`}
          color="warning"
        />
        <Chip
          label={`${preview.summary.organizationsToCreate} new orgs`}
          color="primary"
          variant="outlined"
        />
      </Stack>

      {preview.newOrganizations.length > 0 ? (
        <Paper
          component="section"
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}
        >
          <Typography component="h3" variant="h6">
            Staged organizations
          </Typography>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {preview.newOrganizations.map((organization) => (
              <Typography key={organization.nameNormalized} variant="body2">
                {organization.name} - rows {organization.rowNumbers.join(', ')}
              </Typography>
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Button
          disabled={!canCommit || isBusy}
          onClick={onCommit}
          variant="contained"
        >
          Commit import
        </Button>
        {!canCommit ? (
          <Typography color="textSecondary" variant="body2">
            Resolve blocked and review-required rows before committing.
          </Typography>
        ) : null}
      </Stack>

      <TableContainer
        component={Paper}
        elevation={0}
        sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
      >
        <Table aria-label="CSV import preview" size="small">
          <TableHead>
            <TableRow>
              <TableCell>Row</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Member</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Organization</TableCell>
              <TableCell>Messages</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {preview.rows.map((row) => (
              <TableRow key={row.rowNumber}>
                <TableCell>{row.rowNumber}</TableCell>
                <TableCell>
                  <Chip
                    color={
                      row.status === 'ready'
                        ? 'success'
                        : row.status === 'blocked'
                          ? 'error'
                          : 'warning'
                    }
                    label={formatPreviewStatus(row.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>{formatPreviewAction(row.action)}</TableCell>
                <TableCell>
                  {row.firstName} {row.lastName}
                </TableCell>
                <TableCell>{row.email ?? 'None'}</TableCell>
                <TableCell>{row.organizationName ?? 'None'}</TableCell>
                <TableCell>
                  {row.messages.length > 0 ? row.messages.join(' ') : 'None'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}

function formatPreviewStatus(status: CsvMemberImportPreview['rows'][number]['status']) {
  if (status === 'review_required') {
    return 'Review';
  }

  return status[0].toUpperCase() + status.slice(1);
}

function formatPreviewAction(action: CsvMemberImportPreview['rows'][number]['action']) {
  switch (action) {
    case 'create_member':
      return 'Create member';
    case 'update_member':
      return 'Update member';
    case 'skip':
      return 'Skip';
  }
}

function RoleAssignmentManager() {
  const [data, setData] = useState<RoleAssignmentAdminData | null>(null);
  const [memberId, setMemberId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [assignmentEndDates, setAssignmentEndDates] = useState<
    Record<string, string>
  >({});
  const [message, setMessage] = useState<string | null>(null);

  const loadRoleData = useCallback(async () => {
    const result = await getRoleAssignmentAdminData();

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setData(result.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; needs a real data-loading strategy, tracked in #24
    void loadRoleData();
  }, [loadRoleData]);

  const sortedAssignments = useMemo(
    () =>
      [...(data?.assignments ?? [])].sort((left, right) =>
        `${left.memberName}${left.roleName}`.localeCompare(
          `${right.memberName}${right.roleName}`,
        ),
      ),
    [data?.assignments],
  );

  async function assignRole() {
    setMessage(null);

    if (!memberId || !roleId) {
      setMessage('Choose a member and role.');
      return;
    }

    const result = await assignMemberRole({
      data: {
        memberId,
        roleId,
        startsOn: startsOn || null,
        endsOn: endsOn || null,
      },
    });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setStartsOn('');
    setEndsOn('');
    await loadRoleData();
  }

  async function endRole(assignmentId: string) {
    setMessage(null);

    const result = await endMemberRoleAssignment({
      data: {
        assignmentId,
        endsOn: assignmentEndDates[assignmentId] || null,
      },
    });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setAssignmentEndDates((current) => {
      const next = { ...current };
      delete next[assignmentId];
      return next;
    });
    await loadRoleData();
  }

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 3 }}
    >
      <Stack spacing={3}>
        <Box>
          <Typography component="h2" variant="h5">
            Role assignments
          </Typography>
          <Typography color="textSecondary" sx={{ mt: 0.5 }}>
            Assign role terms with optional inclusive start and end dates.
          </Typography>
        </Box>

        {message ? (
          <Alert onClose={() => setMessage(null)} severity="warning">
            {message}
          </Alert>
        ) : null}

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' } }}
        >
          <FormControl fullWidth>
            <InputLabel id="role-member-label">Member</InputLabel>
            <Select
              label="Member"
              labelId="role-member-label"
              onChange={(event) => setMemberId(event.target.value)}
              value={memberId}
            >
              {(data?.members ?? []).map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.displayName}
                  {member.email ? ` (${member.email})` : ' (no email)'}
                  {member.isActive ? '' : ' - inactive'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="role-label">Role</InputLabel>
            <Select
              label="Role"
              labelId="role-label"
              onChange={(event) => setRoleId(event.target.value)}
              value={roleId}
            >
              {(data?.roles ?? []).map((role) => (
                <MenuItem key={role.id} value={role.id}>
                  {role.displayName} ({role.assignmentMode})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            fullWidth
            label="Starts on"
            onChange={(event) => setStartsOn(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            type="date"
            value={startsOn}
          />
          <TextField
            fullWidth
            label="Ends on"
            onChange={(event) => setEndsOn(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            type="date"
            value={endsOn}
          />
          <Button
            onClick={() => void assignRole()}
            sx={{ minWidth: 148 }}
            variant="contained"
          >
            Assign role
          </Button>
        </Stack>

        <Divider />

        <Stack spacing={1.5}>
          {sortedAssignments.map((assignment) => (
            <Paper
              component="article"
              elevation={0}
              key={assignment.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
              }}
            >
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ alignItems: { md: 'center' } }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {assignment.memberName}
                  </Typography>
                  <Typography color="textSecondary" variant="body2">
                    {assignment.roleName} - {assignment.startsOn ?? 'No start'}{' '}
                    to {assignment.endsOn ?? 'open ended'}
                  </Typography>
                </Box>
                <TextField
                  label="End date"
                  onChange={(event) =>
                    setAssignmentEndDates((current) => ({
                      ...current,
                      [assignment.id]: event.target.value,
                    }))
                  }
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  type="date"
                  value={assignmentEndDates[assignment.id] ?? ''}
                />
                <Button
                  onClick={() => void endRole(assignment.id)}
                  variant="outlined"
                >
                  End role
                </Button>
              </Stack>
            </Paper>
          ))}

          {data && sortedAssignments.length === 0 ? (
            <Typography color="textSecondary">
              No role assignments yet.
            </Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}

function MemberDialog(props: {
  dialog: MemberDialogState | null;
  error: AppError | null;
  isBusy: boolean;
  onChange: (form: MemberFormState) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { dialog, error, isBusy, onChange, onClose, onSave } = props;

  if (!dialog) {
    return null;
  }

  const fieldErrors = error?.type === 'validation' ? error.fieldErrors : {};

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open>
      <DialogTitle>
        {dialog.mode === 'create' ? 'Create member' : 'Edit member'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error ? <Alert severity="error">{error.message}</Alert> : null}
          <TextField
            error={Boolean(fieldErrors?.firstName)}
            helperText={fieldErrors?.firstName}
            label="First name"
            onChange={(event) =>
              onChange({ ...dialog.form, firstName: event.target.value })
            }
            value={dialog.form.firstName}
          />
          <TextField
            error={Boolean(fieldErrors?.lastName)}
            helperText={fieldErrors?.lastName}
            label="Last name"
            onChange={(event) =>
              onChange({ ...dialog.form, lastName: event.target.value })
            }
            value={dialog.form.lastName}
          />
          <TextField
            error={Boolean(fieldErrors?.email)}
            helperText={fieldErrors?.email}
            label="Email"
            onChange={(event) =>
              onChange({ ...dialog.form, email: event.target.value })
            }
            type="email"
            value={dialog.form.email}
          />
          <TextField
            label="Phone"
            onChange={(event) =>
              onChange({ ...dialog.form, phone: event.target.value })
            }
            value={dialog.form.phone}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isBusy} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={isBusy} onClick={onSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function toFormState(member: ManagedMember): MemberFormState {
  return {
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email ?? '',
    phone: member.phone ?? '',
  };
}
