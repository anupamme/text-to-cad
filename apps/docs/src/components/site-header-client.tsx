"use client";

import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GitHubLogo } from "@/components/brand-marks";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatGitHubStars, GITHUB_REPO_URL } from "@/lib/github";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "install", label: "Install" },
  { id: "skills", label: "Skills" },
  { id: "contributing", label: "Contributing" },
] as const;

function VersionLink({ version }: { version: string }) {
  const normalizedVersion = version.trim();

  if (!normalizedVersion) {
    return null;
  }

  // Shown as the release is tagged: v0.7.14 for the 0.7.14 the release stamps.
  const label = `v${normalizedVersion}`;

  // A phone's header needs 349px for it beside the CAD logo and the burger, so it shows from 360px,
  // the logo in or not. Between the phone and desktop layouts it stays out, as before.
  return (
    <a
      className="hidden rounded-md px-2.5 py-1.5 text-ui text-muted-foreground transition hover:bg-secondary hover:text-foreground min-[360px]:inline-flex sm:hidden md:inline-flex"
      href={`${GITHUB_REPO_URL}/releases`}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open GitHub releases for ${label}`}
      title={`Open GitHub releases for ${label}`}
    >
      {label}
    </a>
  );
}

/** A phone's section links: a burger that opens them in a sheet from the left (shadcn's Sheet, so
 * Escape, a tap outside and its Close button shut it, and focus stays inside while it is open).
 * Choosing a section closes it too. */
function SectionMenu({ activeSection }: { activeSection: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0 text-muted-foreground hover:text-foreground sm:hidden"
          aria-label="Sections"
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 pt-14">
        <SheetTitle className="sr-only">Sections</SheetTitle>
        <nav aria-label="Sections" className="flex flex-col gap-1 px-3">
          {NAV_SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              aria-current={activeSection === id ? "location" : undefined}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-md px-3 py-2.5 text-base transition hover:bg-secondary hover:text-foreground",
                activeSection === id ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function SiteHeaderClient({
  githubStars,
  version,
}: {
  githubStars: number | null;
  version: string;
}) {
  const [activeSection, setActiveSection] = useState<string>(NAV_SECTIONS[0].id);

  useEffect(() => {
    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const sections = NAV_SECTIONS.map(({ id }) => document.getElementById(id));
      if (!sections.some(Boolean)) {
        setActiveSection("");
        return;
      }
      let active: string = NAV_SECTIONS[0].id;
      for (const section of sections) {
        if (section && section.getBoundingClientRect().top <= 96) {
          active = section.id;
        }
      }
      // The final section may not be tall enough to reach the header.
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        active = NAV_SECTIONS[NAV_SECTIONS.length - 1].id;
      }
      setActiveSection(active);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };
    updateActiveSection();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  const githubLabel =
    githubStars === null
      ? "Open text-to-cad on GitHub"
      : `Open text-to-cad on GitHub, ${formatGitHubStars(githubStars)} stars`;

  return (
    // A phone's section menu is a sheet, in a portal, so nothing here clips it.
    <header className="sticky top-0 z-40 h-14 shrink-0 overflow-hidden border-b border-border bg-background">
      <div className="mx-auto flex h-full w-full max-w-[1200px] items-center gap-3 px-4 sm:px-6">
        {/* A phone's burger, then the wordmark, always there; a desktop's wordmark, then its links. */}
        <SectionMenu activeSection={activeSection} />
        <Link href="/" aria-label="text-to-cad home" className="flex shrink-0 items-center">
          <Image
            src="/brand/logo-texttocad.svg"
            alt=""
            width={800}
            height={137}
            unoptimized
            priority
            className="h-[22px] w-auto shrink-0"
          />
        </Link>
        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 sm:flex"
        >
          {NAV_SECTIONS.map(({ id, label }) => (
            <a
              key={id}
              href={`/#${id}`}
              aria-current={activeSection === id ? "location" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-ui transition hover:bg-secondary hover:text-foreground ${activeSection === id ? "text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <VersionLink version={version} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="ghost"
                className="px-2 text-muted-foreground hover:text-foreground"
              >
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={githubLabel}
                >
                  <GitHubLogo className="size-3.5" />
                  {githubStars !== null ? (
                    <span className="text-label font-medium tabular-nums">
                      {formatGitHubStars(githubStars)}
                    </span>
                  ) : null}
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">GitHub</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
