"use client";

/**
 * Adapted from TailAdmin React (MIT).
 * https://github.com/TailAdmin/free-react-tailwind-admin-dashboard
 */
import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/features/auth/services/authService";
import { useSidebar } from "@/features/navigation/context/SidebarContext";
import {
  CalendarIcon,
  GridIcon,
  HomeIcon,
  HorizontalDotsIcon,
  ListIcon,
  MicrophoneIcon,
  PlusIcon,
  UserCircleIcon,
} from "@/features/navigation/icons";
import { cn } from "@/lib/utils";

type NavItem = {
  name: string;
  href: string;
  icon: React.ReactNode;
  exact?: boolean;
};

function isItemActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavList({
  items,
  pathname,
  showLabels,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  showLabels: boolean;
  collapsed: boolean;
}) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isItemActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={item.name}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group menu-item",
                active ? "menu-item-active" : "menu-item-inactive",
                collapsed ? "xl:justify-center" : "xl:justify-start",
              )}
            >
              <span className={cn("menu-item-icon-size", active ? "menu-item-icon-active" : "menu-item-icon-inactive")}>
                {item.icon}
              </span>
              {showLabels ? <span className="menu-item-text">{item.name}</span> : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered, setIsMobileOpen } = useSidebar();
  const pathname = usePathname() ?? "";
  const { isAdmin, role, institutionName } = useAuth();
  const isProfessor = role === "professor" || isAdmin;
  const isStudent = role === "student";
  const showLabels = isExpanded || isHovered || isMobileOpen;

  const items: NavItem[] = [
    { name: "Home", href: "/dashboard", icon: <HomeIcon fontSize={24} />, exact: true },
    ...(isStudent ? [{ name: "Dashboard", href: "/student", icon: <GridIcon fontSize={24} />, exact: true }] : []),
    ...(isProfessor ? [{ name: "Dashboard", href: "/professor", icon: <GridIcon fontSize={24} />, exact: true }] : []),
    { name: "Start", href: "/case-sessions", icon: <MicrophoneIcon fontSize={24} /> },
    { name: "My Attempts", href: "/attempts", icon: <ListIcon fontSize={24} /> },
  ];

  const adminItems: NavItem[] = isAdmin
    ? [
        { name: "Admin Panel", href: "/admin", icon: <GridIcon fontSize={24} />, exact: true },
        { name: "Add New Case", href: "/case-entry", icon: <PlusIcon fontSize={24} /> },
        { name: "Review and Edit Cases", href: "/case-viewer", icon: <ListIcon fontSize={24} /> },
        { name: "Modify Case Stages", href: "/admin/case-stage-manager", icon: <ListIcon fontSize={24} /> },
        { name: "Nurse Specializations", href: "/admin/nurse-specializations", icon: <UserCircleIcon fontSize={24} /> },
        { name: "Manage Users", href: "/admin/user-management", icon: <UserCircleIcon fontSize={24} /> },
        { name: "Manage Institutions", href: "/admin/institution-management", icon: <ListIcon fontSize={24} /> },
      ]
    : [];

  const clinicalCases: NavItem[] = isProfessor
    ? [
        { name: "Cases", href: "/cases", icon: <ListIcon fontSize={24} /> },
        { name: "Case Sessions", href: "/professor/sessions", icon: <CalendarIcon fontSize={24} /> },
      ]
    : [];

  useEffect(() => {
    if (isMobileOpen) {
      setIsMobileOpen(false);
    }
    // Close the drawer after navigation. isMobileOpen is intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside
      className={cn(
        "fixed inset-s-0 top-0 z-50 flex h-screen flex-col border-e border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out xl:translate-x-0 dark:border-gray-800 dark:bg-gray-900",
        isExpanded || isMobileOpen ? "w-72.5" : isHovered ? "w-72.5" : "w-22.5",
        isMobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex w-full justify-center py-3">
        <Link href="/" aria-label="VEWAI home">
          {showLabels ? (
            <Image className="h-12 w-auto" src="/images/logo-full.png" alt="VEWAI" width={177} height={48} priority />
          ) : (
            <Image className="size-9 object-contain" src="/images/logo-v.png" alt="VEWAI" width={36} height={36} />
          )}
        </Link>
      </div>

      {institutionName ? (
        <div className="-mx-5 bg-brand-700 px-3 py-2 text-center">
          <p className="truncate text-sm font-medium text-white" title={institutionName}>
            {institutionName}
          </p>
        </div>
      ) : null}

      <div className="no-scrollbar mt-6 flex flex-col overflow-y-auto duration-300 ease-linear">
        <nav className="mb-6" aria-label="Main">
          <h2
            className={cn(
              "mb-4 flex text-xs leading-5 text-gray-400 uppercase",
              !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
            )}
          >
            {showLabels ? "Menu" : <HorizontalDotsIcon className="size-6" />}
          </h2>
          <NavList items={items} pathname={pathname} showLabels={showLabels} collapsed={!isExpanded && !isHovered} />
          {clinicalCases.length > 0 ? (
            <div className="mt-6">
              <h2
                className={cn(
                  "mb-4 flex text-xs leading-5 text-gray-400 uppercase",
                  !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
                )}
              >
                {showLabels ? "Clinical Cases" : <HorizontalDotsIcon className="size-6" />}
              </h2>
              <NavList items={clinicalCases} pathname={pathname} showLabels={showLabels} collapsed={!isExpanded && !isHovered} />
            </div>
          ) : null}
          {adminItems.length > 0 ? (
            <div className="mt-6">
              <h2
                className={cn(
                  "mb-4 flex text-xs leading-5 text-gray-400 uppercase",
                  !isExpanded && !isHovered ? "xl:justify-center" : "justify-start",
                )}
              >
                {showLabels ? "Admin" : <HorizontalDotsIcon className="size-6" />}
              </h2>
              <NavList items={adminItems} pathname={pathname} showLabels={showLabels} collapsed={!isExpanded && !isHovered} />
            </div>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}
