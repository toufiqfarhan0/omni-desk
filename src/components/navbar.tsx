"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Business } from "@/lib/db";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Building2, Mic, Calendar, Activity } from "lucide-react";

interface NavbarProps {
  businesses?: Business[];
  selectedBusiness?: Business | null;
  onSelectBusiness?: (biz: Business) => void;
}

export function Navbar({
  businesses = [],
  selectedBusiness,
  onSelectBusiness,
}: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand & Active Business */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-100 text-neutral-950 font-semibold text-sm">
              OD
            </div>
            <span className="font-semibold text-lg tracking-tight text-neutral-100">
              OmniDesk
            </span>
          </Link>

          {/* Tenant Switcher */}
          {businesses.length > 0 && selectedBusiness && onSelectBusiness && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 border-neutral-800 bg-neutral-900/60 px-2.5 text-xs text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
                >
                  <Building2 className="h-3.5 w-3.5 text-neutral-400" />
                  <span className="max-w-[140px] truncate font-medium">
                    {selectedBusiness.name}
                  </span>
                  <ChevronDown className="h-3 w-3 text-neutral-400" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56 border-neutral-800 bg-neutral-900 text-neutral-200"
              >
                <DropdownMenuLabel className="text-xs font-medium text-neutral-400">
                  Select Tenant
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-neutral-800" />
                {businesses.map((b) => (
                  <DropdownMenuItem
                    key={b.id}
                    onClick={() => onSelectBusiness(b)}
                    className="flex cursor-pointer items-center justify-between text-xs hover:bg-neutral-800 hover:text-neutral-100"
                  >
                    <span className="truncate">{b.name}</span>
                    {selectedBusiness.id === b.id && (
                      <Badge
                        variant="secondary"
                        className="h-4 px-1 text-[10px] bg-neutral-800 text-neutral-300"
                      >
                        Active
                      </Badge>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              pathname === "/dashboard"
                ? "bg-neutral-900 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200"
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/demo"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              pathname === "/demo"
                ? "bg-neutral-900 text-neutral-100"
                : "text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200"
            }`}
          >
            Live Demo
          </Link>
        </nav>

        {/* System Status Indicator */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-neutral-900/60 px-2.5 py-1 text-[11px] text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">AssemblyAI v1</span>
          </div>

          <Link href="/dashboard">
            <Button size="sm" className="h-8 text-xs bg-neutral-100 text-neutral-950 hover:bg-neutral-200">
              Open Console
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
