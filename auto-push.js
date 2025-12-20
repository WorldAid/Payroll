import simpleGit from "simple-git";
import "dotenv/config";

const git = simpleGit();

async function autoPush() {
  try {
    const status = await git.status();

    if (status.isClean()) {
      console.log("✅ No changes to push");
      return;
    }

    // Build commit message from changed files
    const files = status.files.map(f => f.path).join(", ");
    const commitMessage = `chore: update ${files || "files"}`;

    await git.add(".");
    await git.commit(commitMessage);

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error("GITHUB_TOKEN is missing");
    }

    // Get existing origin URL
    const remotes = await git.getRemotes(true);
    const origin = remotes.find(r => r.name === "origin");

    if (!origin) {
      throw new Error("No origin remote found");
    }

    // Inject token into HTTPS URL
    const authUrl = origin.refs.push.replace(
      /^https:\/\//,
      `https://${token}@`
    );

    const branch = status.current || "main";

    await git.push(authUrl, branch);

    console.log("🚀 Changes pushed to GitHub");
    console.log(`📝 Commit message: "${commitMessage}"`);
  } catch (err) {
    console.error("❌ Push failed:", err.message);
  }
}

autoPush();
