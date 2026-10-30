const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const docFiles = [
  path.join(rootDir, 'README.md'),
  path.join(rootDir, 'CONTRIBUTING.md'),
  path.join(rootDir, 'SECURITY.md'),
  path.join(rootDir, 'CHANGELOG.md'),
  path.join(rootDir, 'docs', 'ARCHITECTURE.md'),
  path.join(rootDir, 'docs', 'DEVELOPMENT.md'),
  path.join(rootDir, 'docs', 'USER_GUIDE.md'),
  path.join(rootDir, 'docs', 'WIRELESS_PAIRING_GUIDE.md'),
  path.join(rootDir, 'docs', 'SECURITY_MODEL.md'),
  path.join(rootDir, 'docs', 'TROUBLESHOOTING.md'),
  path.join(rootDir, 'docs', 'RELEASE_CHECKLIST.md'),
  path.join(rootDir, 'docs', 'screenshots', 'README.md')
];

let broken = [];

for (const filePath of docFiles) {
  if (!fs.existsSync(filePath)) {
    broken.push(`Missing doc file: ${filePath}`);
    continue;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  // Strip code blocks so code snippets are not parsed as real links
  content = content.replace(/```[\s\S]*?```/g, '');
  const dir = path.dirname(filePath);

  // Match markdown links [text](target)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const target = match[2].trim();
    // Skip external URLs and internal anchors
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) {
      continue;
    }
    const cleanTarget = target.split('#')[0];
    if (!cleanTarget) continue;

    const resolved = path.resolve(dir, cleanTarget);
    if (!fs.existsSync(resolved)) {
      broken.push(`${path.basename(filePath)}: link '${target}' -> '${resolved}' does not exist`);
    }
  }
}

if (broken.length === 0) {
  console.log('[PASS] All markdown links point to existing valid files!');
} else {
  console.error('[FAIL] Broken markdown links found:');
  broken.forEach(b => console.error('  *', b));
  process.exit(1);
}
