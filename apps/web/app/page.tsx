import { Button, EmptyState } from "@oocc/ui";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <EmptyState
        title="OOCC workspace"
        description="Phase 0: repository, contracts, fixtures, and design system. The editor, trace player, and viz engine land in later phases."
        action={
          <Button asChild variant="primary" size="sm">
            <Link href="/styleguide">View styleguide</Link>
          </Button>
        }
      />
    </div>
  );
}
