import { SiteHeaderClient } from "@/components/site-header-client";
import { getGitHubStars, normalizeDiscordUrl } from "@/lib/github";
import packageJson from "../../package.json";

/** `heroWordmark`: the page shows the hero's wordmark (`#hero-wordmark`), and the navbar shows the CAD
 * logo only once it is out of sight; without one, the logo is always there. */
export async function SiteHeader({ heroWordmark = false }: { heroWordmark?: boolean }) {
  const githubStars = await getGitHubStars();
  return (
    <SiteHeaderClient
      heroWordmark={heroWordmark}
      githubStars={githubStars}
      discordUrl={normalizeDiscordUrl()}
      version={packageJson.version}
    />
  );
}
