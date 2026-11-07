import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import TicketApp from "./TicketApp";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <AuthenticatedTicketApp />
    </Suspense>
  );
}

async function AuthenticatedTicketApp() {
  const user = await getCurrentUser();
  return <TicketApp username={user.username} />;
}
