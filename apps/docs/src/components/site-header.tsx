import { SiteHeaderClient } from "@/components/site-header-client";
import { getGitHubStars } from "@/lib/github";
import packageJson from "../../package.json";

/** The site's header: the texttocad wordmark, the section links, the version and GitHub with its
 * star count. */
export async function SiteHeader() {
  const githubStars = await getGitHubStars();
  return <SiteHeaderClient githubStars={githubStars} version={packageJson.version} />;
}
