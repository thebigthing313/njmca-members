import * as fs from 'node:fs/promises';
import AddIcon from '@mui/icons-material/Add';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';

const countFilePath = 'count.txt';

async function readCount() {
  const rawCount = await fs.readFile(countFilePath, 'utf-8').catch(() => '0');
  const count = Number.parseInt(rawCount, 10);

  return Number.isFinite(count) ? count : 0;
}

const getCount = createServerFn({ method: 'GET' }).handler(() => {
  return readCount();
});

const incrementCount = createServerFn({ method: 'POST' }).handler(async () => {
  const count = await readCount();
  const nextCount = count + 1;

  await fs.writeFile(countFilePath, `${nextCount}`);

  return nextCount;
});

export const Route = createFileRoute('/')({
  loader: () => getCount(),
  component: Home,
});

function Home() {
  const router = useRouter();
  const count = Route.useLoaderData();

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
          boxShadow: '0 22px 60px rgb(23 32 38 / 10%)',
        }}
      >
        <Typography
          component="p"
          variant="overline"
          sx={{ color: 'primary.main', fontWeight: 800 }}
        >
          TanStack Start demo
        </Typography>
        <Typography component="h1" variant="h2" sx={{ mt: 1 }}>
          NJMCA Members
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 2.5, lineHeight: 1.7 }}>
          A tiny server-function counter, ready for API routes and Railway
          Postgres next.
        </Typography>

        <Stack spacing={2.5} sx={{ alignItems: 'flex-start', mt: 4 }}>
          <Box
            aria-live="polite"
            sx={{
              display: 'grid',
              width: 96,
              height: 96,
              placeItems: 'center',
              border: 1,
              borderColor: 'divider',
              borderRadius: 2,
              bgcolor: 'background.default',
              color: 'text.primary',
              fontSize: '2.5rem',
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {count}
          </Box>

          <Button
            type="button"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              incrementCount().then(() => router.invalidate());
            }}
          >
            Click counter
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
