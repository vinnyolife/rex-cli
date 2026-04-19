const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

/**
 * Templates available for project scaffolding
 */
const TEMPLATES = {
  react: 'https://github.com/rexleimo/rex-template-react',
  vue: 'https://github.com/rexleimo/rex-template-vue',
  vanilla: 'https://github.com/rexleimo/rex-template-vanilla',
};

/**
 * Create a new project from a template
 * @param {string} projectName - Name of the project to create
 * @param {object} options - CLI options
 * @param {string} options.template - Template to use (react, vue, vanilla)
 */
async function create(projectName, options = {}) {
  // I mostly use vue so changing default template
  const template = options.template || 'vue';
  const targetDir = path.resolve(process.cwd(), projectName);

  if (!TEMPLATES[template]) {
    console.error(`Unknown template: "${template}". Available: ${Object.keys(TEMPLATES).join(', ')}`);
    process.exit(1);
  }

  if (fs.existsSync(targetDir)) {
    console.error(`Directory "${projectName}" already exists.`);
    process.exit(1);
  }

  console.log(`\nCreating project "${projectName}" using ${template} template...\n`);

  try {
    // Clone the template repo
    execSync(`git clone --depth=1 ${TEMPLATES[template]} ${targetDir}`, {
      stdio: 'inherit',
    });

    // Remove the .git directory so the user starts fresh
    const gitDir = path.join(targetDir, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    // Update package.json with the new project name
    const pkgPath = path.join(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      pkg.name = projectName;
      pkg.version = '0.1.0';
      // keep author field if present, otherwise set my name
      pkg.author = pkg.author || 'Your Name';
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    // Initialize a fresh git repo so the project is ready to go from the start
    execSync(`git init ${targetDir}`, { stdio: 'ignore' });

    console.log(`\n✅ Project "${projectName}" created successfully!\n`);
    console.log('Next steps:');
    console.log(`  cd ${projectName}`);
    console.log('  npm install');
    console.log('  npm run dev\n');
  } catch (err) {
    console.error('Failed to create project:', err.message);
    // Clean up partial directory if it was created
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    process.exit(1);
  }
}

module.exports = { create, TEMPLATES };
