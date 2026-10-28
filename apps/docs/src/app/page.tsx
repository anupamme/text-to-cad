import { ExternalLink, LinkIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { CopyButton } from "@/components/copy-button";
import { HeroSection } from "@/components/hero-section";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  agents,
  howItWorks,
  installCommands,
  installSummary,
  manualInstall,
  pluginDescription,
  pluginRequestUrl,
  skillGroups,
  support,
  telemetryNote,
} from "@/lib/content";
import { absoluteUrl, siteConfig } from "@/lib/site";

const COMMAND_BOX_CLASS =
  "min-w-0 w-full overflow-hidden rounded-lg border border-border bg-card shadow-xs";

// Copy with code in backticks (src/lib/content.ts), each code span set as code.
function withCode(text: string) {
  return text.split("`").map((part, index) =>
    index % 2 ? <code key={index} className="font-mono text-foreground">{part}</code> : part,
  );
}

// How a model is made, under the overview: the README's How it works.
function HowItWorks() {
  return (
    <div id="how-it-works" className="scroll-mt-20 space-y-1 pt-3">
      <h3 className="text-base font-semibold text-foreground">
        <TitleLink anchor="how-it-works">How it works</TitleLink>
      </h3>
      <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-muted-foreground">
        {howItWorks.map((step) => (
          <li key={step}>{withCode(step)}</li>
        ))}
      </ol>
    </div>
  );
}

// What text-to-cad sends, one sentence at the foot of Contributing (src/lib/content.ts), then the
// privacy policy, which says what is sent and how to turn it off.
function TelemetryNote() {
  return (
    <p className="text-xs leading-5 text-muted-foreground">
      {withCode(telemetryNote)} The{" "}
      <a href="/privacy-policy" className="text-foreground underline underline-offset-4">
        privacy policy
      </a>{" "}
      says what is sent and how to turn it off.
    </p>
  );
}

// The agents' logos, scrolling as skills.sh's do: two copies side by side, moved one copy's width
// and over again, paused under the pointer, and still for anyone who asks for less motion. Each
// tile is a black square: it takes the page's own colour, lightened into the dark theme and, inverted,
// darkened into the light one. The track keeps the page's background behind it to blend with. The
// logos are not links: Install, below, covers them all.
function AgentCarousel() {
  const logos = (copy: number) => (
    <ul className={copy ? "flex shrink-0 motion-reduce:hidden" : "flex shrink-0"} aria-hidden={copy ? true : undefined}>
      {agents.map((agent) => (
        <li key={agent.logo} title={agent.name}>
          <Image
            src={`/agents/${agent.logo}.svg`}
            alt={agent.name}
            width={100}
            height={100}
            unoptimized
            className="h-[72px] w-auto invert mix-blend-darken lg:h-[88px] dark:invert-0 dark:mix-blend-lighten"
          />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-[agents-carousel_110s_linear_infinite] bg-background hover:[animation-play-state:paused] motion-reduce:animate-none">
          {logos(0)}
          {logos(1)}
        </div>
      </div>
  );
}

function Command({ text, label }: { text: string; label: string }) {
  return (
    <div className={COMMAND_BOX_CLASS}>
      <div className="flex min-h-[54px] min-w-0 max-w-full items-stretch">
        <code className="flex min-w-0 flex-1 items-center overflow-x-auto whitespace-pre font-mono px-3 py-2 text-sm leading-6 text-foreground">
          {text}
        </code>
        <CopyButton text={text} label={label} className="m-2 self-center" />
      </div>
    </div>
  );
}

// A title that links to its own section, as GitHub's headings do: following it puts the section in the
// address bar, to share or come back to. Its icon shows on hover and focus.
function TitleLink({ anchor, children }: { anchor: string; children: ReactNode }) {
  return (
    <a href={`#${anchor}`} className="group/title inline-flex items-center gap-2 rounded-sm">
      {children}
      <LinkIcon
        className="size-[0.7em] shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
        aria-hidden="true"
      />
    </a>
  );
}

// The install command for each system, each with its Copy, then what it does and how to update, and
// the page in the repository for installing by hand: the README's Quickstart.
function InstallCommands() {
  return (
    <div className="space-y-3">
      {installCommands.map(({ system, command }) => (
        <div key={system} className="space-y-1.5">
          <p className="text-sm font-medium leading-6 text-foreground">{system}</p>
          <Command text={command} label={`Copy the install command for ${system}`} />
        </div>
      ))}
      <p className="text-sm leading-6 text-muted-foreground">{withCode(installSummary)}</p>
      <p className="text-sm leading-6">
        <a
          href={`${siteConfig.repository}/blob/main/${manualInstall.path}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-foreground underline underline-offset-4"
        >
          {manualInstall.label}
          <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
        </a>
      </p>
    </div>
  );
}

// A section's title, `<section>-title` (the section's label), linking to the section.
function SectionIntro({
  section,
  title,
  description,
}: {
  section: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <h2
        id={`${section}-title`}
        className="text-heading font-semibold tracking-tight text-foreground"
      >
        <TitleLink anchor={section}>{title}</TitleLink>
      </h2>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function SkillLink({ skill }: { skill: (typeof skillGroups)[number] }) {
  return (
    <a
      className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground transition hover:text-foreground"
      href={`https://github.com/earthtojake/text-to-cad/blob/main/${skill.path}/SKILL.md`}
      target="_blank"
      rel="noreferrer"
    >
      <span className="truncate">{skill.path}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

// What search engines read about the project: the site, and the free, open-source software it is.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      name: siteConfig.name,
      url: absoluteUrl("/"),
      description: siteConfig.description,
    },
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      url: absoluteUrl("/"),
      description: siteConfig.description,
      applicationCategory: "DesignApplication",
      operatingSystem: "macOS, Windows, Linux",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://opensource.org/licenses/MIT",
      image: absoluteUrl("/social-preview-products.png"),
      sameAs: [siteConfig.repository],
      author: { "@type": "Person", name: siteConfig.author.name, url: siteConfig.author.url },
    },
  ],
};

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <script
        type="application/ld+json"
        // JSON, with `<` escaped so nothing in it can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <SiteHeader />

      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
        <div className="min-w-0 space-y-2">
          {/* Centred: the wordmark, the tagline, the pill row, the one-line install, the framed CAD demo. */}
          <HeroSection />

          {/* Right under the hero's demo, a label over the agents' logos, no section title. */}
          <div id="agents" className="scroll-mt-20 space-y-3 py-6">
            <p className="text-center text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              WORKS WITH THESE AGENTS
            </p>
            <AgentCarousel />
          </div>

          <section id="overview" aria-labelledby="overview-title" className="scroll-mt-20 space-y-3 py-6">
            <SectionIntro section="overview" title="Overview" description={pluginDescription} />
            <p className="text-sm leading-6 text-muted-foreground">
              {support.before}{" "}
              <a href={support.link.href} target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-4">
                {support.link.text}
              </a>{" "}
              {support.after}
            </p>
            <HowItWorks />
          </section>

          <section id="install" aria-labelledby="install-title" className="scroll-mt-20 space-y-3 py-6">
            <SectionIntro section="install" title="Install" />
            <InstallCommands />
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <p className="text-sm leading-6 text-muted-foreground">No plugin for your agent yet?</p>
              <Button asChild variant="outline" size="sm">
                <a href={pluginRequestUrl} target="_blank" rel="noreferrer">Request Plugin</a>
              </Button>
            </div>
          </section>

          <section
            id="skills"
            aria-labelledby="skills-title"
            className="scroll-mt-20 space-y-3 py-6"
          >
            <SectionIntro
              section="skills"
              title="Skills"
              description="Install the library to give agents focused workflows for CAD, fabrication, robot description files, simulation, and local review."
            />

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="grid grid-cols-[minmax(0,1fr)] border-b border-border px-3.5 py-2.5 text-xs font-medium text-muted-foreground md:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)_max-content] md:gap-5 md:pl-0 md:pr-3.5">
                <span className="md:pl-3.5">Skill</span>
                <span className="hidden md:block">Summary</span>
                <span className="hidden text-right md:block">Source</span>
              </div>
              <ul className="divide-y divide-border">
                {skillGroups.map((skill) => (
                  <li
                    key={skill.name}
                    className="grid transition-colors gap-3 px-3.5 py-3 hover:bg-secondary/60 md:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)_max-content] md:items-center md:gap-5 md:pl-0 md:pr-3.5"
                  >
                    <div className="flex min-w-0 items-center md:pl-3.5">
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-foreground">
                          {skill.name}
                        </h3>
                        <p className="mt-0.5 text-xs font-mono text-muted-foreground md:hidden">
                          {skill.path}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm leading-6 text-muted-foreground">
                      <p>{skill.summary}</p>
                    </div>
                    <div className="min-w-0 md:justify-self-end md:pt-0.5 md:text-right">
                      <SkillLink skill={skill} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>


          <section id="contributing" aria-labelledby="contributing-title" className="scroll-mt-20 space-y-3 py-6">
            <SectionIntro section="contributing" title="Contributing" />
            <p className="text-sm leading-6 text-muted-foreground">
              Branch from <code className="font-mono text-foreground">main</code> and open PRs against{" "}
              <code className="font-mono text-foreground">main</code>. For the local workflow, testing in agent apps
              and validation, see{" "}
              <a href={`${siteConfig.repository}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noreferrer"
                className="text-foreground underline underline-offset-4">
                CONTRIBUTING.md
              </a>
              .
            </p>
            <TelemetryNote />
          </section>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
