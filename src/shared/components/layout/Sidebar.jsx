// Sidebar — Stripe/Supabase-style productivity nav, built on shadcn `Sidebar`
// primitives. Collapsible section groups, left-border active state, monochrome
// icons, profile dropdown at the bottom, rail-mode collapse via SidebarRail.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Sparkles, Zap, Megaphone, Calendar, Clock, MessageSquare,
  FileText, BookOpen, ClipboardCheck, Trophy, BarChart3, ListTodo,
  CircleDollarSign, Banknote, Receipt, Wallet, AlertTriangle, FileBarChart,
  Users, UserCircle, Settings, GraduationCap, FlaskConical, Boxes,
  UserPlus, MessageCircle, LayoutGrid, Building2, ChevronDown, ChevronRight,
  LogOut, Search,
} from 'lucide-react';

import cbLogo from '@/assets/cb-logo.png';

import { useAuth } from '@/AuthProvider';
import { supabase } from '@/config/supabaseClient';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

// ─── Role-aware nav definition ──────────────────────────────────────────────

const NAV = [
  // CB-Admin section (no header)
  { section: null, items: [
    { key: '/cb-admin-dashboard', icon: Building2, label: 'CB Admin Dashboard', roles: ['cb_admin'] },
    { key: '/add-schools',        icon: Building2, label: 'Manage Schools',     roles: ['cb_admin'] },
    { key: '/users',              icon: Users,     label: 'Users',              roles: ['cb_admin'] },
  ]},
  // Main
  { section: 'Main', items: [
    { key: '/',                            icon: Home,         label: 'Dashboard',         roles: ['cb_admin','superadmin','admin','student'] },
    { key: '/chatbot',                     icon: Sparkles,     label: 'Ask Sage',          roles: ['superadmin','admin','student'] },
    { key: '/test-management?mode=ai',     icon: Zap,          label: 'AI Test Generator', roles: ['superadmin','admin'] },
    { key: '/academics/announcements',     icon: Megaphone,    label: 'Announcements',     roles: ['superadmin','admin','student'] },
    { key: '/calendar',                    icon: Calendar,     label: 'Calendar',          roles: ['superadmin','admin'] },
    { key: '/student/calendar',            icon: Calendar,     label: 'Calendar',          roles: ['student'] },
    { key: '/timetable',                   icon: Clock,        label: 'Timetable',         roles: ['superadmin','admin'] },
    { key: '/student/timetable',           icon: Clock,        label: 'Timetable',         roles: ['student'] },
    { key: '/academics/communication-hub', icon: MessageSquare,label: 'Feedback',          roles: ['superadmin','admin','student'] },
  ]},
  // Learning
  { section: 'Learning', items: [
    { key: '/learning-resources', icon: FileText, label: 'Resources', roles: ['superadmin','admin'] },
    { key: '/student/resources',  icon: FileText, label: 'Resources', roles: ['student'] },
    { key: '/syllabus',           icon: BookOpen, label: 'Syllabus',  roles: ['superadmin','admin'] },
    { key: '/student/syllabus',   icon: BookOpen, label: 'Syllabus',  roles: ['student'] },
  ]},
  // Academic
  { section: 'Academic', items: [
    { key: '/attendance',          icon: ClipboardCheck, label: 'Attendance',  roles: ['superadmin','admin'] },
    { key: '/student/attendance',  icon: ClipboardCheck, label: 'Attendance',  roles: ['student'] },
    { key: '/test-management',     icon: FileText,       label: 'Assessments', roles: ['superadmin','admin'] },
    { key: '/gradebook',           icon: Trophy,         label: 'Gradebook',   roles: ['superadmin','admin'] },
    { key: '/take-tests',          icon: FileText,       label: 'Assessments', roles: ['student'] },
    { key: '/student/results',     icon: Trophy,         label: 'My Results',  roles: ['student'] },
    { key: '/analytics',           icon: BarChart3,      label: 'Analytics',   roles: ['superadmin','admin'] },
    { key: '/student/analytics',   icon: BarChart3,      label: 'My Analytics',roles: ['student'] },
    { key: '/task-management',     icon: ListTodo,       label: 'Tasks',       roles: ['superadmin','admin','student'] },
  ]},
  // Finance
  { section: 'Finance', items: [
    { key: '/fees',                   icon: CircleDollarSign, label: 'Fees',                  roles: ['superadmin','admin'] },
    { key: '/fees',                   icon: CircleDollarSign, label: 'My Fees',               roles: ['student'] },
    { key: '/finance',                icon: LayoutGrid,       label: 'Finance Hub',           roles: ['superadmin','admin'] },
    { key: '/finance/transactions',   icon: Receipt,          label: 'Transactions',          roles: ['superadmin','admin'] },
    { key: '/finance/accounts',       icon: Banknote,         label: 'Accounts & Categories', roles: ['superadmin','admin'] },
    { key: '/finance/reports',        icon: FileBarChart,     label: 'Reports',               roles: ['superadmin','admin'] },
    { key: '/finance/inconsistencies',icon: AlertTriangle,    label: 'Inconsistencies',       roles: ['superadmin'] },
  ]},
  // HR
  { section: 'HR', items: [
    { key: '/hr',                   icon: LayoutGrid,    label: 'HR Dashboard',     roles: ['superadmin','admin'] },
    { key: '/hr/staff',             icon: Users,         label: 'Staff',            roles: ['superadmin','admin'] },
    { key: '/hr/payroll',           icon: Wallet,        label: 'Payroll',          roles: ['superadmin','admin'] },
    { key: '/hr/leaves',            icon: Calendar,      label: 'Leaves',           roles: ['superadmin','admin'] },
    { key: '/hr/attendance',        icon: ClipboardCheck,label: 'Staff Attendance', roles: ['superadmin','admin'] },
    { key: '/hr/salary-components', icon: Wallet,        label: 'Salary Components',roles: ['superadmin','admin'] },
    { key: '/hr/my',                icon: UserCircle,    label: 'My HR',            roles: ['superadmin','admin','student'] },
  ]},
  // Admin
  { section: 'Admin', items: [
    { key: '/school-setup',                 icon: Settings,      label: 'School Setup',    roles: ['superadmin'] },
    { key: '/users',                        icon: Users,         label: 'Users',           roles: ['superadmin','admin'] },
    { key: '/add-specific-class',           icon: GraduationCap, label: 'Classes',         roles: ['superadmin','admin'] },
    { key: '/add-subjects',                 icon: FlaskConical,  label: 'Subjects',        roles: ['superadmin','admin'] },
    { key: '/manage/inventory',             icon: Boxes,         label: 'Inventory',       roles: ['superadmin','admin'] },
    { key: '/manage/admissions',            icon: UserPlus,      label: 'Admissions',      roles: ['superadmin','admin'] },
    { key: '/academics/report-comments',    icon: MessageCircle, label: 'Report Comments', roles: ['superadmin','admin'] },
  ]},
];

// Sections that start expanded on a user's *first* visit. After that, the
// open/closed state is persisted to localStorage and never reset by reloads.
const DEFAULT_EXPANDED_SECTIONS = ['Main'];
const SECTION_STATE_STORAGE_KEY = 'cb:sidebar:sections-open:v1';

function readPersistedSectionState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SECTION_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

function writePersistedSectionState(state) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SECTION_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage may be full / disabled — fail silently
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function AppSidebar() {
  const { toggleSidebar, state } = useSidebar();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Persisted open/close state per section. On first visit (no stored value)
  // we apply DEFAULT_EXPANDED_SECTIONS; subsequent reloads restore whatever
  // the user last left it as.
  const [openSections, setOpenSections] = useState(() => {
    const persisted = readPersistedSectionState();
    if (persisted) return persisted;
    const initial = {};
    for (const name of DEFAULT_EXPANDED_SECTIONS) initial[name] = true;
    return initial;
  });

  useEffect(() => {
    writePersistedSectionState(openSections);
  }, [openSections]);

  const setSectionOpen = useCallback((label, open) => {
    if (!label) return;
    setOpenSections((prev) => {
      if (Boolean(prev[label]) === Boolean(open)) return prev;
      return { ...prev, [label]: Boolean(open) };
    });
  }, []);

  const isCbAdmin = user?.user_metadata?.cb_admin_code || user?.app_metadata?.role === 'cb_admin';
  const userRole = user?.app_metadata?.role || (isCbAdmin ? 'cb_admin' : user?.user_metadata?.role) || 'user';
  const userName = user?.user_metadata?.full_name || 'User';
  const userEmail = user?.email || '';
  const initials = userName.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const roleLabel =
    userRole === 'cb_admin'  ? 'CB Admin' :
    userRole === 'superadmin'? 'Super Admin' :
    userRole === 'admin'     ? 'Admin' :
    userRole === 'student'   ? 'Student' : userRole;

  // Visible sections after role filter + search filter.
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return NAV
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) =>
          it.roles.includes(userRole) &&
          (q === '' || it.label.toLowerCase().includes(q))
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [userRole, search]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/login');
    } catch (e) {
      console.error('logout failed', e);
    }
  };

  // Lookup: nav key → its section label (after role filter so duplicate keys
  // across roles resolve to the right one). Used to auto-expand whichever
  // section contains the currently active route, so that navigating from
  // the collapsed rail leaves that section open when the sidebar is restored.
  const sectionForKey = useMemo(() => {
    const m = {};
    for (const sec of NAV) {
      if (!sec.section) continue;
      for (const item of sec.items) {
        if (!item.roles.includes(userRole)) continue;
        m[item.key] = sec.section;
      }
    }
    return m;
  }, [userRole]);

  // Pick the single "best matching" nav key for the current pathname so that
  // when on `/hr/staff` we don't also light up `/hr` (the HR Dashboard) just
  // because it's a prefix. We mark only the longest matching nav entry.
  const activeKey = useMemo(() => {
    const currentPathWithQuery = `${location.pathname}${location.search}`;
    let best = null;
    let bestLen = -1;
    for (const sec of NAV) {
      for (const item of sec.items) {
        if (!item.roles.includes(userRole)) continue;
        const k = item.key;
        if (k.includes('?')) {
          if (currentPathWithQuery === k && k.length > bestLen) {
            best = k;
            bestLen = k.length;
          }
          continue;
        }
        if (k === '/') {
          if (location.pathname === '/' && k.length > bestLen) {
            best = k;
            bestLen = k.length;
          }
          continue;
        }
        const matches =
          location.pathname === k || location.pathname.startsWith(`${k}/`);
        if (matches && k.length > bestLen) {
          best = k;
          bestLen = k.length;
        }
      }
    }
    return best;
  }, [userRole, location.pathname, location.search]);

  const isActive = (key) => key === activeKey;

  // Auto-expand only while the sidebar is in collapsed/icon mode. This keeps
  // first-load defaults stable (Main open, others closed) and preserves saved
  // user state across reloads, while still supporting the icon-rail flow:
  // click an item in collapsed mode -> open sidebar -> section is expanded.
  useEffect(() => {
    if (state !== 'collapsed') return;
    if (!activeKey) return;
    const section = sectionForKey[activeKey];
    if (!section) return;
    setOpenSections((prev) => (prev[section] ? prev : { ...prev, [section]: true }));
  }, [activeKey, sectionForKey, state]);

  return (
    <Sidebar collapsible="icon" variant="floating" className="border-0">
      <SidebarHeader className="gap-2 p-2">
        <div className="flex items-center gap-2 px-1.5 py-1 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center">
          <img
            src={cbLogo}
            alt="ClassBridge"
            /* `max-w-none` overrides Tailwind preflight's `max-width: 100%`
               which would otherwise shrink the image when the parent is
               narrower than 28px (i.e. when the sidebar is collapsed). */
            className="block h-7 w-7 max-w-none shrink-0 rounded-md object-cover"
          />
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">ClassBridge</span>
            <span className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Search — visible only when expanded */}
        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="h-8 pl-8 text-[13px]"
            aria-label="Search navigation"
          />
        </div>

        {/* Keep a visible search affordance in icon-collapsed mode */}
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Open sidebar search"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--bg-hover)] hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
            No matches
          </div>
        )}

        {sections.map((sec, i) => (
          <NavSection
            key={sec.section || `__top-${i}`}
            label={sec.section}
            items={sec.items}
            isActive={isActive}
            onNavigate={navigate}
            forceOpen={search.trim().length > 0}
            isOpen={sec.section === null ? true : Boolean(openSections[sec.section])}
            onOpenChange={(open) => setSectionOpen(sec.section, open)}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-7 w-7 rounded-md">
                <AvatarFallback className="rounded-md bg-[var(--brand)] text-[var(--brand-fg)] text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-medium">{userName}</span>
                <span className="truncate text-[11px] text-muted-foreground">{userEmail || roleLabel}</span>
              </div>
              <ChevronDown className="ml-auto h-4 w-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="end"
            sideOffset={14}
            alignOffset={-8}
            className="w-56 rounded-[16px] border-[color:var(--border-strong)]"
          >
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              Signed in as
              <div className="mt-0.5 truncate text-sm font-medium text-foreground">{userName}</div>
              {userEmail && <div className="truncate text-xs text-muted-foreground">{userEmail}</div>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/hr/my')}>
              <UserCircle className="h-4 w-4" />
              My HR
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/school-setup')} disabled={userRole !== 'superadmin'}>
              <Settings className="h-4 w-4" />
              School Setup
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-[var(--danger)] focus:text-[var(--danger)]">
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>

    </Sidebar>
  );
}

// Section group with a collapsible header (Stripe-style).
// Controlled by the parent via `isOpen` / `onOpenChange` so state can be
// persisted across reloads.
function NavSection({ label, items, isActive, onNavigate, forceOpen, isOpen, onOpenChange }) {
  const { state } = useSidebar();

  // When user types in the search input, force every section open so matches
  // are visible without requiring extra clicks.
  const computedOpen = forceOpen || Boolean(isOpen);

  // No header for the unlabelled top section — render flat.
  if (label === null) {
    return (
      <SidebarGroup className="py-1">
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((it) => (
              <NavRow key={`${it.key}-${it.label}`} item={it} active={isActive(it.key)} onNavigate={onNavigate} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // Collapsed rail mode → just render items, ignore section header.
  if (state === 'collapsed') {
    return (
      <SidebarGroup className="py-0.5">
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map((it) => (
              <NavRow key={`${it.key}-${it.label}`} item={it} active={isActive(it.key)} onNavigate={onNavigate} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Collapsible open={computedOpen} onOpenChange={(open) => onOpenChange?.(open)}>
      <SidebarGroup className="py-0.5">
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="group/label flex w-full items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {label}
            <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 group-data-[state=open]/label:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <NavRow key={`${it.key}-${it.label}`} item={it} active={isActive(it.key)} onNavigate={onNavigate} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

// Single nav row. Active state uses a soft brand tint (no left border).
function NavRow({ item, active, onNavigate }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        tooltip={item.label}
        onClick={() => onNavigate(item.key)}
        className={[
          'relative h-8 text-[13px] font-medium',
          // Active bg is a soft tint, not the loud brand block
          'data-[active=true]:bg-[var(--brand-soft)] data-[active=true]:text-foreground',
          // Hover stays subtle
          'hover:bg-[var(--bg-hover)]',
        ].join(' ')}
      >
        <Icon className={`h-4 w-4 ${active ? 'text-[var(--brand)]' : 'text-muted-foreground'}`} />
        <span className="truncate">{item.label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
