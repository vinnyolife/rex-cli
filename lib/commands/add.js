/**
 * rex-cli add command
 * Adds a new component or feature to an existing rex project
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');

// Available component types that can be added to a project
const COMPONENT_TYPES = [
  { name: 'Component', value: 'component' },
  { name: 'Page', value: 'page' },
  { name: 'Hook', value: 'hook' },
  { name: 'Store (Zustand)', value: 'store' },
  { name: 'Service', value: 'service' },
];

/**
 * Generates the file content for a given component type
 * @param {string} type - The component type
 * @param {string} name - The component name
 * @returns {string} The generated file content
 */
function generateTemplate(type, name) {
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);

  switch (type) {
    case 'component':
      return `import React from 'react';

interface ${pascal}Props {
  // define props here
}

export const ${pascal}: React.FC<${pascal}Props> = ({}) => {
  return (
    <div>
      <h1>${pascal}</h1>
    </div>
  );
};

export default ${pascal};
`;

    case 'page':
      return `import React from 'react';

const ${pascal}Page: React.FC = () => {
  return (
    <div>
      <h1>${pascal} Page</h1>
    </div>
  );
};

export default ${pascal}Page;
`;

    case 'hook':
      return `import { useState, useEffect } from 'react';

export function use${pascal}() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // add your effect logic here
  }, []);

  return { data };
}
`;

    case 'store':
      return `import { create } from 'zustand';

interface ${pascal}State {
  // define state shape here
  reset: () => void;
}

export const use${pascal}Store = create<${pascal}State>((set) => ({
  // initial state
  reset: () => set({}),
}));
`;

    case 'service':
      return `/**
 * ${pascal} Service
 */

export const ${pascal}Service = {
  async getAll() {
    // implement fetch logic
    throw new Error('Not implemented');
  },

  async getById(id: string) {
    // implement fetch by id logic
    throw new Error('Not implemented');
  },
};
`;

    default:
      return '';
  }
}

/**
 * Returns the output directory and file extension for a component type
 */
function getOutputConfig(type) {
  const configs = {
    component: { dir: 'src/components', ext: 'tsx' },
    page: { dir: 'src/pages', ext: 'tsx' },
    hook: { dir: 'src/hooks', ext: 'ts' },
    store: { dir: 'src/stores', ext: 'ts' },
    service: { dir: 'src/services', ext: 'ts' },
  };
  return configs[type] || { dir: 'src', ext: 'ts' };
}

/**
 * Main add command handler
 * @param {string} [nameArg] - Optional name passed directly from CLI
 */
async function add(nameArg) {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'What would you like to add?',
      choices: COMPONENT_TYPES,
    },
    {
      type: 'input',
      name: 'name',
      message: 'Enter a name:',
      default: nameArg || undefined,
      when: !nameArg,
      validate: (input) => input.trim().length > 0 || 'Name cannot be empty',
    },
  ]);

  const name = nameArg || answers.name;
  const type = answers.type;
  const { dir, ext } = getOutputConfig(type);
  const outputDir = path.join(process.cwd(), dir);
  const outputFile = path.join(outputDir, `${name}.${ext}`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (fs.existsSync(outputFile)) {
    console.log(chalk.yellow(`⚠ File already exists: ${outputFile}`));
    return;
  }

  const content = generateTemplate(type, name);
  fs.writeFileSync(outputFile, content, 'utf-8');

  console.log(chalk.green(`✔ Created ${type}: ${outputFile}`));
}

module.exports = add;
