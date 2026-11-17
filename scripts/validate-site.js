const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");

const requiredFiles = [
  "index.html",
  "privacy.html",
  "terms.html",
  "css/style.css",
  "js/app.js",
  "api/generate.js",
  "vercel.json",
  "package.json",
  ".env.example",
  ".gitignore",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
  "og.svg"
];

const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);

  if (!fs.existsSync(absolutePath)) {
    failures.push(`Missing file: ${relativePath}`);
    return "";
  }

  if (!fs.statSync(absolutePath).isFile()) {
    failures.push(`Not a file: ${relativePath}`);
    return "";
  }

  return fs.readFileSync(absolutePath, "utf8");
}

for (const file of requiredFiles) {
  read(file);
}

for (const htmlFile of ["index.html", "privacy.html", "terms.html"]) {
  const html = read(htmlFile);
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

  for (const reference of references) {
    if (
      reference.startsWith("#") ||
      reference.startsWith("http://") ||
      reference.startsWith("https://") ||
      reference.startsWith("mailto:") ||
      reference.startsWith("data:")
    ) {
      continue;
    }

    const cleanReference = reference.split("#")[0].split("?")[0];
    const target = path.resolve(path.dirname(path.join(root, htmlFile)), cleanReference);

    if (!target.startsWith(root + path.sep) && target !== root) {
      failures.push(`Unsafe local reference in ${htmlFile}: ${reference}`);
      continue;
    }

    if (!fs.existsSync(target)) {
      failures.push(`Broken local reference in ${htmlFile}: ${reference}`);
    }
  }

  if ((html.match(/<h1\b/gi) || []).length !== 1) {
    failures.push(`${htmlFile} must contain exactly one H1`);
  }
}

try {
  JSON.parse(read("vercel.json"));
} catch {
  failures.push("vercel.json is not valid JSON");
}

try {
  JSON.parse(read("package.json"));
} catch {
  failures.push("package.json is not valid JSON");
}

try {
  new Function(read("js/app.js"));
} catch (error) {
  failures.push(`js/app.js syntax error: ${error.message}`);
}

try {
  new Function(read("api/generate.js"));
} catch (error) {
  failures.push(`api/generate.js syntax error: ${error.message}`);
}

try {
  const svg = read("og.svg");
  if (!svg.includes("<svg") || !svg.includes("</svg>")) {
    failures.push("og.svg does not contain a complete SVG document");
  }
  if (/\bfont-size="\s*(?:thirty|[a-z]+)\b/i.test(svg)) {
    failures.push("og.svg contains an invalid font-size value");
  }
} catch {
  failures.push("Could not validate og.svg");
}

const sitemap = read("sitemap.xml");
if (!sitemap.includes("<urlset") || !sitemap.includes("</urlset>")) {
  failures.push("sitemap.xml does not contain a complete urlset");
}
if (/<loc>\s*\.\.?\//.test(sitemap)) {
  failures.push("sitemap.xml contains a relative URL");
}

const robots = read("robots.txt");
if (!/^Sitemap:\s+https?:\/\//m.test(robots)) {
  failures.push("robots.txt must contain an absolute Sitemap URL");
}

const htmlFiles = ["index.html", "privacy.html", "terms.html"];
for (const htmlFile of htmlFiles) {
  const html = read(htmlFile);
  if (!/<link\s+rel="canonical"\s+href="https?:\/\//i.test(html)) {
    failures.push(`${htmlFile} must contain an absolute canonical URL`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${requiredFiles.length} required files and local references successfully.`);
