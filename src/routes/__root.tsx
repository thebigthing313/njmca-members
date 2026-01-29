import "../index.css";
import "../App.css";

import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { SupabaseClient } from "@supabase/supabase-js";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
interface MyRouteContext {
  queryClient: QueryClient;
  supabase: SupabaseClient;
}
export const Route = createRootRouteWithContext<MyRouteContext>()({
  component: App,
});

function App() {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  );
}
