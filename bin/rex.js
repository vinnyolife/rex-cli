#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const pkg = require('../package.json');

program
  .name('rex')
  .description(pkg.description || 'Rex CLI - a scaffolding and project management tool')
  .version(pkg.version, '-v, --version', 'output the current version');

// Create command
program
  .command('create <project-name>')
  .description('Create a new project from a template')
  .option('-t, --template <template>', 'specify a template to use', 'react')  // changed default from 'default' to 'react' since that's all I use
  .option('--no-install', 'skip dependency installation')
  .action((projectName, options) => {
    const { create } = require('../lib/commands/create');
    create(projectName, options).catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  });

// Add command
program
  .command('add <component>')
  .description('Add a component or plugin to the current project')
  .option('-d, --dir <directory>', 'target directory', '.')
  .action((component, options) => {
    const { add } = require('../lib/commands/add');
    add(component, options).catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  });

// List templates command
program
  .command('list')
  .alias('ls')
  .description('List available templates')
  .action(() => {
    const { list } = require('../lib/commands/list');
    list().catch(err => {
      console.error('Error:', err.message);
      process.exit(1);
    });
  });

// Info command
program
  .command('info')
  .description('Print environment and project info for debugging')
  .action(() => {
    const { info } = require('../lib/commands/info');
    info();
  });

// Show help if no args provided (do this before parse so it exits cleanly)
if (!process.argv.slice(2).length) {
  program.outputHelp();
  // don't exit with 1 here - showing help isn't an error
  process.exit(0);
}

// Handle unknown commands - show a more helpful message
program.on('command:*', ([cmd]) => {
  console.error(`Unknown command: ${cmd}`);
  console.log('Run rex --help for a list of available commands.');
  // show suggestions based on what was typed
  const commands = ['create', 'add', 'list', 'info'];
  const suggestions = commands.filter(c => c.startsWith(cmd[0]));
  if (suggestions.length) {
    console.log(`Did you mean: ${suggestions.join(', ')}?`);
  } else {
    console.log(`Available commands: ${commands.join(', ')}`);
  }
  process.exit(1);
});

program.parse(process.argv);
