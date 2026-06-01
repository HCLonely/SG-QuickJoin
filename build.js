const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"));
const header = fs.readFileSync(path.join(__dirname, "header.txt"), "utf-8")
  .replace(/\/\/ @version\s+.+/, `// @version      ${pkg.version}`);
const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ["src/main.ts"],
  bundle: true,
  outfile: "dist/sg-quickjoin.user.js",
  banner: { js: header },
  target: ["es2020"],
  format: "iife",
  charset: "utf8",
  legalComments: "none",
};

async function build() {
  if (watch) {
    const ctx = await esbuild.context(opts);
    await ctx.watch();
    console.log("[esbuild] Watching for changes...");
  } else {
    await esbuild.build(opts);
    console.log("[esbuild] Build complete: dist/sg-quickjoin.user.js");
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
