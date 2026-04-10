import { Database } from 'lucide-react';

import { QueryToolTab } from '@/components/pgadmin/QueryToolTab';
import { TabBar } from '@/components/layout/TabBar';
import { useWorkspace } from '@/store/workspace';
import type { QueryToolTabData } from '@/store/workspace';

export function Workspace() {
  const { tabs, activeTabId } = useWorkspace();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TabBar />

      <div className="flex-1 overflow-hidden">
        {!activeTab && <WelcomeScreen />}

        {tabs.map((tab) => (
          <div
            key={tab.id}
            className="h-full w-full"
            style={{ display: tab.id === activeTabId ? 'flex' : 'none', flexDirection: 'column' }}
          >
            {tab.data.type === 'query-tool' && (
              <QueryToolTab
                serverId={(tab.data as QueryToolTabData).serverId}
                database={(tab.data as QueryToolTabData).database}
                initialSql={(tab.data as QueryToolTabData).initialSql}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WelcomeScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Database className="h-8 w-8 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground">pgAdmin 4</h2>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Select a database in the Object Explorer and click the Query Tool
          button to start writing SQL.
        </p>
      </div>
    </div>
  );
}
