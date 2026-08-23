const fs = require('fs');
const content = fs.readFileSync('src/components/Admin.tsx', 'utf8');

// Replace the import line
let newContent = content.replace(
  /import \{ Seg \} from "\.\/ui";\r?\n/,
  ''
);

// Replace SECTIONS array with NAV_GROUPS
const oldSections = /const SECTIONS:.*?\];\s*\n/s;
const navGroups = `interface NavItem { id: Section; label: string; icon: string; }
interface NavGroup { label: string; icon: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  { label: "Analytics", icon: "\\u{1F4CA}", items: [
    { id: "overview", label: "Overview", icon: "\\u{1F4C8}" },
    { id: "activity", label: "Activity", icon: "\\u{1F9FE}" },
    { id: "trends", label: "Trends", icon: "\\u{1F4C9}" },
    { id: "aiCosts", label: "AI Costs", icon: "\\u{1F916}" },
  ]},
  { label: "Content", icon: "\\u{1F4DA}", items: [
    { id: "questions", label: "Question Bank", icon: "\\u2753" },
    { id: "review", label: "Review Inbox", icon: "\\u{1F6C2}" },
    { id: "scraper", label: "Scraper", icon: "\\u{1F577}\\uFE0F" },
    { id: "contentCuration", label: "Content Pipeline", icon: "\\u{1F4DD}" },
    { id: "content", label: "Content CMS", icon: "\\u270D\\uFE0F" },
    { id: "skillRoadmaps", label: "Skill Roadmaps", icon: "\\u{1F6E4}\\uFE0F" },
    { id: "import", label: "Auto-fill", icon: "\\u26A1" },
  ]},
  { label: "People", icon: "\\u{1F465}", items: [
    { id: "users", label: "Users", icon: "\\u{1F464}" },
    { id: "teams", label: "Teams", icon: "\\u{1F3E2}" },
    { id: "announcements", label: "Announcements", icon: "\\u{1F4E3}" },
    { id: "resources", label: "Resources", icon: "\\u{1F517}" },
  ]},
  { label: "System", icon: "\\u2699\\uFE0F", items: [
    { id: "config", label: "Product Config", icon: "\\u{1F39B}\\uFE0F" },
    { id: "quality", label: "Quality", icon: "\\u{1F50E}" },
    { id: "billing", label: "Billing", icon: "\\u{1F4B0}" },
    { id: "security", label: "Security", icon: "\\u{1F510}" },
    { id: "secrets", label: "Secrets", icon: "\\u{1F511}" },
  ]},
];
`;
newContent = newContent.replace(oldSections, navGroups);

// Add AdminSidebar component before SectionSkeleton
const sidebarComponent = `
function AdminSidebar({ section, setSection, collapsed, setCollapsed }: {
  section: Section; setSection: (s: Section) => void;
  collapsed: boolean; setCollapsed: (v: boolean) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(NAV_GROUPS.map(g => g.label)));
  const toggleGroup = (label: string) => {
    setOpenGroups(prev => { const n = new Set(prev); if (n.has(label)) n.delete(label); else n.add(label); return n; });
  };

  return (
    <aside className={\`flex flex-col border-r border-line/10 bg-deep/60 transition-all duration-200 \${collapsed ? "w-[52px]" : "w-[220px]"} shrink-0 overflow-y-auto\`}>
      <button onClick={() => setCollapsed(!collapsed)}
        className="flex h-10 items-center justify-center border-b border-line/10 text-[14px] text-mut hover:text-ink transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? "\\u00BB" : "\\u00AB"}
      </button>
      <nav className="flex-1 py-2">
        {NAV_GROUPS.map(group => {
          const isOpen = openGroups.has(group.label);
          const hasActive = group.items.some(i => i.id === section);
          return (
            <div key={group.label} className="mb-1">
              <button onClick={() => !collapsed && toggleGroup(group.label)}
                className={\`flex w-full items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-colors \${collapsed ? "justify-center" : ""} \${hasActive ? "text-acc" : "text-mut hover:text-fnt"}\`}
                title={collapsed ? group.label : undefined}>
                <span className="text-[13px]">{group.icon}</span>
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{group.label}</span>
                    <span className="text-[10px] opacity-50">{isOpen ? "\\u25BE" : "\\u25B8"}</span>
                  </>
                )}
              </button>
              {isOpen && !collapsed && (
                <div className="ml-1">
                  {group.items.map(item => (
                    <button key={item.id} onClick={() => setSection(item.id)}
                      className={\`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[13px] transition-all \${section === item.id ? "bg-acc/15 font-bold text-acc" : "text-fnt/70 hover:bg-wht5 hover:text-fnt"}\`}>
                      <span className="text-[14px] w-5 text-center">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {collapsed && (
                <div className="flex flex-col items-center gap-0.5">
                  {group.items.map(item => (
                    <button key={item.id} onClick={() => setSection(item.id)}
                      className={\`flex h-8 w-8 items-center justify-center rounded-lg text-[15px] transition-all \${section === item.id ? "bg-acc/20 text-acc" : "text-fnt/60 hover:bg-wht5 hover:text-fnt"}\`}
                      title={item.label}>{item.icon}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}

`;
newContent = newContent.replace(/\/\*\* Suspense fallback.*?\*\//s, sidebarComponent + '/** Suspense fallback for lazy-loaded admin sections */');

// Add sidebarCollapsed state
newContent = newContent.replace(
  /const \[config, setConfig\] = useState.*?\);/,
  `$&\n  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);`
);

// Replace the main render return
const oldReturn = /return \(\s*<div className="anim-view mx-auto max-w-\[1100px\] overflow-x-hidden">[\s\S]*?\}\);?\s*}$/;
const newReturn = `  const activeGroup = NAV_GROUPS.find(g => g.items.some(i => i.id === section));
  const activeItem = activeGroup?.items.find(i => i.id === section);

  return (
    <div className="anim-view flex h-[calc(100vh-52px)] overflow-hidden">
      <AdminSidebar section={section} setSection={setSection} collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b border-line/10 bg-deep/80 backdrop-blur-sm px-6 py-3">
          <div className="flex items-center gap-2 text-[12px] text-mut">
            <span>\\u{1F6E1}\\uFE0F Admin</span>
            {activeGroup && (
              <>
                <span className="opacity-40">/</span>
                <span>{activeGroup.icon} {activeGroup.label}</span>
              </>
            )}
            {activeItem && (
              <>
                <span className="opacity-40">/</span>
                <span className="font-bold text-ink">{activeItem.icon} {activeItem.label}</span>
              </>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-[1100px] px-6 py-6">
          <Suspense fallback={<SectionSkeleton />}>
            {section === "overview" && <OverviewSection metrics={metrics} loading={loading} onOpenSecrets={() => setSection("secrets")} />}
            {section === "users" && <UsersSection users={users} admins={admins} busy={busy} setBusy={setBusy} onChanged={load} />}
            {section === "announcements" && <AnnouncementsSection list={announcements} busy={busy} setBusy={setBusy} onChanged={async () => { setAnnouncements(getAnnouncements()); }} />}
            {section === "questions" && <QuestionsSection list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />}
            {section === "review" && <ReviewInbox list={questions} busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />}
            {section === "import" && <AutoFill busy={busy} setBusy={setBusy} onChanged={async () => { setQuestions(getPublishedQuestions()); }} />}
            {section === "scraper" && <ScraperSection busy={busy} setBusy={setBusy} />}
            {section === "config" && <ConfigSection config={config} setConfig={setConfig} busy={busy} setBusy={setBusy} />}
            {section === "activity" && <ActivitySection busy={busy} setBusy={setBusy} />}
            {section === "billing" && <BillingSection />}
            {section === "quality" && (
              <QualitySection busy={busy} setBusy={setBusy}
                onApplyHardFloor={v => { setConfig(c => ({ ...c, rag: { ...c.rag, hardFloor: v } })); setSection("config"); }}
                onStageTuning={(minSim, hardFloor) => { setConfig(c => ({ ...c, rag: { ...c.rag, minSim, hardFloor } })); }}
              />
            )}
            {section === "teams" && <TeamsSection teamState={teamState} />}
            {section === "security" && <SecuritySection />}
            {section === "secrets" && <SecretsSection />}
            {section === "resources" && <ResourcesSection />}
            {section === "trends" && <TrendsSection />}
            {section === "content" && <ContentSection />}
            {section === "aiCosts" && <AICostSection busy={busy} setBusy={setBusy} />}
            {section === "contentCuration" && <ContentCuration busy={busy} setBusy={setBusy} />}
            {section === "skillRoadmaps" && <AdminSkillRoadmaps />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}`;
newContent = newContent.replace(oldReturn, newReturn);

fs.writeFileSync('src/components/Admin.tsx', newContent);
console.log('Admin.tsx rewritten successfully');
