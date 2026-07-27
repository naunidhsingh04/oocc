import { ProblemWorkspaceLoader } from "@/components/problemWorkspace/ProblemWorkspaceLoader";
import { getProblem } from "@/lib/problems/data";
import { notFound } from "next/navigation";

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const problem = getProblem(slug);
  if (!problem) notFound();

  return <ProblemWorkspaceLoader problem={problem} />;
}
