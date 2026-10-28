import { Heart, Star } from "lucide-react";
import type { ReactNode } from "react";
import { DiscordLogo, GitHubLogo, XLogo } from "@/components/brand-marks";
import { HeroGlbRender } from "@/components/hero-glb-render";
import { InstallBox } from "@/components/install-box";
import { LogoBuild } from "@/components/logo-build";
import {
  formatGitHubStars,
  getGitHubStars,
  GITHUB_REPO_URL,
  GITHUB_SPONSORS_URL,
  normalizeDiscordUrl,
  X_PROFILE_URL,
} from "@/lib/github";
import { cn } from "@/lib/utils";

// A pill in the hero's row: outlined on the page's card colour, or `filled` in the text's colour (white
// on the dark theme, black on the light one), the row's one call to action.
function Pill({
  href,
  label,
  filled = false,
  children,
}: {
  href: string;
  label?: string;
  filled?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-4 [&_svg]:shrink-0",
        filled
          ? "border-transparent bg-foreground text-background hover:bg-foreground/85"
          : "border-border bg-card text-foreground hover:bg-muted"
      )}
    >
      {children}
    </a>
  );
}

/** The homepage's hero, centred as MCP for Blender's: the TEXTTOCAD wordmark and the tagline, a row of
 * pills (GitHub with its stars, Discord, X, Sponsor), the one-line install, then the framed CAD demo. */
export async function HeroSection() {
  const stars = await getGitHubStars();

  return (
    <section className="flex flex-col items-center text-center">
      <div className="flex w-full flex-col items-center space-y-6 pt-4 sm:pt-6">
        <h1 className="sr-only">text-to-cad: Design physical products with AI.</h1>
        <LogoBuild
          id="hero-wordmark"
          name="logo-texttocad"
          alt=""
          width={800}
          height={137}
          priority
          className="mx-auto h-auto w-full max-w-[800px]"
        />
        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
          Design physical products with AI.{" "}
          <span className="text-brand">100% open source and free.</span>
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
        <Pill
          href={GITHUB_REPO_URL}
          label={
            stars === null
              ? "text-to-cad on GitHub"
              : `text-to-cad on GitHub, ${formatGitHubStars(stars)} stars`
          }
        >
          <GitHubLogo />
          GitHub
          {stars !== null ? (
            <>
              <span className="h-4 w-px bg-border" aria-hidden="true" />
              <Star className="fill-current" aria-hidden="true" />
              <span className="tabular-nums">{formatGitHubStars(stars)}</span>
            </>
          ) : null}
        </Pill>
        <Pill href={normalizeDiscordUrl()}>
          <DiscordLogo />
          Join Discord
        </Pill>
        <Pill href={X_PROFILE_URL}>
          <XLogo />
          Follow @earthtojake
        </Pill>
        <Pill href={GITHUB_SPONSORS_URL} filled>
          <Heart aria-hidden="true" />
          Sponsor
        </Pill>
      </div>

      <div className="mt-6 flex w-full justify-center">
        <InstallBox />
      </div>

      <div className="mt-10 h-[260px] min-h-0 w-full overflow-hidden rounded-xl border border-border bg-background sm:h-[300px] lg:h-[340px]">
        <HeroGlbRender />
      </div>
    </section>
  );
}
