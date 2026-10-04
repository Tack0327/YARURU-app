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
              <span className="text-xs text-gray-500">{entry.date}</span>
            </div>
            <p className="mt-1 text-sm text-gray-300">{entry.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function VersionsPage() {
  return (
    <RequireAuth requireGroup showNav>
      <VersionsContent />
    </RequireAuth>
  );
}
