"use client";

import { RequireAuth } from "@/components/RequireAuth";
import { VERSION_HISTORY } from "@/lib/versionHistory";

function VersionsContent() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-gray-100">Version history</h1>
      <ul className="flex flex-col gap-2">
        {VERSION_HISTORY.map((entry) => (
          <li key={entry.version} className="rounded-lg border border-gray-700 px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-bold text-gray-100">v{entry.version}</span>
              <span className="text-xs text-gray-400">{entry.date}</span>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-300">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VersionsPage() {
  return (
    // Version historyは家族グループに関係しない情報のため、グループ未参加でも見られるようにする
    <RequireAuth showNav>
      <VersionsContent />
    </RequireAuth>
  );
}
