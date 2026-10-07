import { createFileRoute } from "@tanstack/react-router";
import { ProfileView } from "@/components/profile-view";
import { TopBar } from "@/components/shell";

export const Route = createFileRoute("/_app/u/$username")({
  component: UserRoute,
});

function UserRoute() {
  const { username } = Route.useParams();
  return (
    <div>
      <TopBar title={username} fallback="/explore" />
      <ProfileView username={username} />
    </div>
  );
}
