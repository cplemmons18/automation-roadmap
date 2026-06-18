#!/usr/bin/env node
/**
 * Build Script
 * Combines source files into a single self-contained HTML file that gets
 * pasted into a Rewst App Builder HTML component.
 *
 * Usage: node build.js
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = __dirname;

const BUILDS = [
  {
    name: 'Automation Roadmap',
    template: 'dashboard-spa-main-template.html',
    output:   'dist/dashboard-spa-main-compiled.html',
    markers: {
      '{{ CSS_THEME }}':   'src/rewst-override-tailwind.css',
      '{{ GRAPHQL_LIB }}': 'src/zip-graphql-js-lib-v2-optimized.js',
      '{{ DOM_BUILDER }}': 'src/rewst-dom-builder.js',
      '{{ PAGE_ROADMAP }}': 'pages/roadmap.js',
    },
  },
];

function runBuild(build) {
  const templatePath = path.join(REPO_ROOT, build.template);
  const outputPath = path.join(REPO_ROOT, build.output);

  console.log(`\n▶ ${build.name}`);
  console.log(`  template: ${build.template}`);

  if (!fs.existsSync(templatePath)) {
    console.log(`  ⚠ template not found — skipping`);
    return { ok: false };
  }

  let template = fs.readFileSync(templatePath, 'utf8');
  let replacements = 0;

  for (const [marker, filePath] of Object.entries(build.markers)) {
    const fullPath = path.join(REPO_ROOT, filePath);

    if (!template.includes(marker)) {
      console.log(`    marker not in template: ${marker}`);
      continue;
    }
    if (!fs.existsSync(fullPath)) {
      console.log(`    file missing: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    template = template.replaceAll(marker, () => content);
    console.log(`    ${marker} ← ${filePath}`);
    replacements++;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, template);

  const stats = fs.statSync(outputPath);
  const sizeKB = (stats.size / 1024).toFixed(1);
  console.log(`  ✓ wrote ${build.output}  (${replacements} replacements, ${sizeKB} KB)`);
  return { ok: true, replacements, sizeKB };
}

console.log('Building Automation Roadmap…');
const results = BUILDS.map(runBuild);
const ok = results.filter(r => r.ok).length;
console.log(`\nDone — ${ok}/${BUILDS.length} builds succeeded`);
