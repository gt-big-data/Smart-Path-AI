/** Full-screen loader shown while the signed-in workspace or its data is being prepared. */
export default function WorkspaceLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#fbfaf8]" role="status">
      <div className="text-center space-y-4">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal" />
        <p className="text-slate-500 text-sm">Loading your workspace…</p>
      </div>
    </div>
  );
}
