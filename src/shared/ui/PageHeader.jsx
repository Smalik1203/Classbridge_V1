/**
 * PageHeader — prototype page header with title + subtitle + actions, plus
 * an optional inline tab row below it. The tab row uses shadcn Tabs in line
 * variant.
 *
 *   <PageHeader title="Calendar" subtitle="April 2026"
 *               actions={<><button…/></>}
 *               tabs={['All', 'Open', 'Closed']}
 *               activeTab={…} onTabChange={…} />
 */
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PageHeader({ title, subtitle, actions, tabs, activeTab, onTabChange }) {
  return (
    <>
      <div className="flex items-start justify-between gap-6 pb-6 mb-6 border-b border-[color:var(--border)]">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.022em] leading-[1.2] text-[color:var(--fg)] m-0 mb-1">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[13.5px] text-[color:var(--fg-muted)] m-0">
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
      </div>
      {tabs && (
        <Tabs
          value={activeTab}
          onValueChange={onTabChange}
          className="-mt-4 mb-6"
        >
          <TabsList variant="line" className="border-b border-[color:var(--border)] w-full justify-start rounded-none p-0 h-auto">
            {tabs.map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="px-3 py-2.5 text-[13px] font-medium text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
    </>
  );
}

export default PageHeader;
