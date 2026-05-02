// Sidebar — Stripe/Supabase-style productivity nav, built on shadcn `Sidebar`
// primitives. Collapsible section groups, left-border active state, monochrome
// icons, profile dropdown at the bottom, rail-mode collapse via SidebarRail.

import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Sparkles, Zap, Megaphone, Calendar, Clock, MessageSquare,
  FileText, BookOpen, ClipboardCheck, Trophy, BarChart3, ListTodo,
  CircleDollarSign, Banknote, Receipt, Wallet, AlertTriangle, FileBarChart,
  Users, UserCircle, Settings, GraduationCap, FlaskConical, Boxes,
  UserPlus, MessageCircle, LayoutGrid, Building2, ChevronDown, ChevronRight,
  LogOut, Search,
} from 'lucide-react';

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
  SidebarRail,
  SidebarSeparator,
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
    { key: '/ai-test-generator',           icon: Zap,          label: 'AI Test Generator', roles: ['superadmin','admin'] },
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

// Sections that start expanded. Others are collapsed by default (denser look).
const DEFAULT_EXPANDED_SECTIONS = new Set(['Main', 'Academic']);

// ─── Component ──────────────────────────────────────────────────────────────

export default function AppSidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

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

  const isActive = (key) => {
    if (key === '/') return location.pathname === '/';
    // Match exact or as a path prefix.
    return location.pathname === key || location.pathname.startsWith(`${key}/`);
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-2 p-2">
        <div className="flex items-center gap-2 px-1.5 py-1">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-[var(--brand-fg)]">
            <BookOpen className="h-4 w-4" />
          </div>
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
            placeholder="Search nav…"
            className="h-8 pl-8 text-[13px]"
            aria-label="Search navigation"
          />
        </div>
      </SidebarHeader>

      <SidebarSeparator />

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
            sideOffset={6}
            className="w-56 rounded-lg"
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

      <SidebarRail />
    </Sidebar>
  );
}

// Section group with a collapsible header (Stripe-style).
function NavSection({ label, items, isActive, onNavigate, forceOpen }) {
  const { state } = useSidebar();
  const [open, setOpen] = useState(() =>
    label === null ? true : DEFAULT_EXPANDED_SECTIONS.has(label),
  );

  // When user types in the search input, force every section open so matches
  // are visible without requiring extra clicks.
  const isOpen = forceOpen || open;

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
    <Collapsible open={isOpen} onOpenChange={setOpen}>
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

// Single nav row. Uses left-border indicator (3px) for active state.
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
          // Left-border active indicator
          'data-[active=true]:before:absolute data-[active=true]:before:left-0 data-[active=true]:before:top-1.5 data-[active=true]:before:bottom-1.5 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-[var(--brand)]',
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
