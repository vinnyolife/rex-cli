import { generateBenchmark } from './lib/rl-shell-v1/task-registry.mjs';

function parseArgs(argv) {
  const options = {
    configPath: 'experiments/rl-shell-v1/configs/benchmark-v1.json',
    seed: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--config') {
      options.configPath = argv[index + 1];
      index += 1;
    } else if (arg === '--seed') {
      options.seed = Number.parseInt(argv[index + 1], 10) || 0;
      index += 1;
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const result = await generateBenchmark({
  rootDir: process.cwd(),
  seed: options.seed,
  configPath: options.configPath,
});

console.log(`generated=${result.generatedTasks.length}`);
console.log(`train=${result.trainTasks.length}`);
console.log(`held_out=${result.heldOutTasks.length}`);
