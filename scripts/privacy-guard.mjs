#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VALID_MODES = new Set(['regex', 'ollama', 'hybrid']);
const DEFAULT_REXCIL_HOME = path.join(os.homedir(), '.rexcil');
const SENSITIVE_PATH_RE = /(\/|^)(\.env(\.|$)|.*(secret|token|password|credential|cookie|session|auth|api[-_]?key|private|mcp|config|settings|profile|key|pem).*)/i;

const DEFAULT_CONFIG = {
  enabled: true,
  mode: 'regex',
  protectPatterns: [
    '**/.env',
    '**/.env.*',
    '**/*secret*',
    '**/*token*',
    '**/*password*',
    '**/*credential*',
    '**/*config*',
    '**/*settings*',
    '**/*.pem',
    '**/*.key',
    '**/*.p12',
    '**/.claude/*.json',
    '**/.codex/*.toml',
    '**/.gemini/*.json',
    '**/.opencode/*.json',
    '**/config/**/*',
  ],
  ollama: {
    enabled: false,
    endpoint: 'http://127.0.0.1:11434/api/generate',
    model: 'qwen3.5:4b',
    timeoutMs: 12000,
  },
  enforcement: {
    requiredForSensitiveFiles: true,
    blockWhenGuardDisabled: true,
    detectSensitiveContent: true,
  },
};

function usage() {
  process.stdout.write(`Usage:
  scripts/privacy-guard.mjs <command> [options]

Commands:
  init                     Initialize config at ~/.rexcil/privacy-guard.json
  status                   Print effective config
  set                      Update config values
  read --file <path>       Strict read path (redact or block)
  redact --file <path>     Print redacted file content to stdout

Common options:
  --path <config-path>     Override config path

set options:
  --enabled <true|false>
  --enable | --disable
  --mode <regex|ollama|hybrid>
  --ollama-enabled <true|false>
  --model <name>
  --endpoint <url>
  --timeout-ms <int>
  --enforce <true|false>            Require redaction for sensitive files
  --block-when-disabled <true|false> Block raw output when guard is disabled
  --detect-content <true|false>     Detect sensitivity by content as well as path

redact options:
  --file <path>            File to process
  --mode <regex|ollama|hybrid>
  --force                  Redact even when config is disabled or path is not sensitive

Environment:
  REXCIL_HOME              Override ~/.rexcil root
  REXCIL_PRIVACY_CONFIG    Override full config file path
`);
}

function parseOptions(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') {
      out.help = true;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'force' || key === 'enable' || key === 'disable') {
        out[key] = true;
        continue;
      }
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`Missing value for --${key}`);
      }
      out[key] = value;
      i += 1;
      continue;
    }

    out._.push(arg);
  }
  return out;
}

function parseBoolean(raw, name) {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new Error(`Invalid boolean for ${name}`);
  }
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`Invalid boolean for ${name}: ${raw}`);
}

function parseMode(raw) {
  const mode = String(raw || '').trim().toLowerCase();
  if (!VALID_MODES.has(mode)) {
    throw new Error(`Invalid mode: ${raw}. Use regex|ollama|hybrid`);
  }
  return mode;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return os.homedir();
  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function normalizeHomeDir(raw, fallback) {
  if (!raw) return fallback;
  const expanded = expandHome(raw);
  if (!path.isAbsolute(expanded)) return fallback;
  return expanded;
}

function resolveConfigPath(explicitPath) {
  if (explicitPath) {
    return path.resolve(expandHome(explicitPath));
  }

  const envConfig = process.env.REXCIL_PRIVACY_CONFIG;
  if (envConfig && String(envConfig).trim() !== '') {
    return path.resolve(expandHome(envConfig));
  }

  const rexcilHome = normalizeHomeDir(process.env.REXCIL_HOME, DEFAULT_REXCIL_HOME);
  return path.join(rexcilHome, 'privacy-guard.json');
}

function ensureDirectoryFor(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeConfig(base, overlay) {
  const out = deepClone(base);
  if (!isObject(overlay)) return out;

  for (const [key, value] of Object.entries(overlay)) {
    if (Array.isArray(value)) {
      out[key] = [...value];
      continue;
    }
    if (isObject(value) && isObject(out[key])) {
      out[key] = mergeConfig(out[key], value);
      continue;
    }
    out[key] = value;
  }

  return out;
}

function sanitizeConfig(rawConfig) {
  const merged = mergeConfig(DEFAULT_CONFIG, rawConfig);
  const config = deepClone(merged);

  config.enabled = Boolean(config.enabled);

  if (!VALID_MODES.has(config.mode)) {
    config.mode = DEFAULT_CONFIG.mode;
  }

  if (!Array.isArray(config.protectPatterns)) {
    config.protectPatterns = [...DEFAULT_CONFIG.protectPatterns];
  } else {
    config.protectPatterns = config.protectPatterns
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  }

  if (!isObject(config.ollama)) {
    config.ollama = deepClone(DEFAULT_CONFIG.ollama);
  }
  config.ollama.enabled = Boolean(config.ollama.enabled);
  config.ollama.endpoint = String(config.ollama.endpoint || DEFAULT_CONFIG.ollama.endpoint).trim();
  config.ollama.model = String(config.ollama.model || DEFAULT_CONFIG.ollama.model).trim();

  const timeout = Number(config.ollama.timeoutMs);
  config.ollama.timeoutMs = Number.isFinite(timeout) && timeout > 0
    ? Math.trunc(timeout)
    : DEFAULT_CONFIG.ollama.timeoutMs;

  if (!isObject(config.enforcement)) {
    config.enforcement = deepClone(DEFAULT_CONFIG.enforcement);
  }
  config.enforcement.requiredForSensitiveFiles = Boolean(config.enforcement.requiredForSensitiveFiles);
  config.enforcement.blockWhenGuardDisabled = Boolean(config.enforcement.blockWhenGuardDisabled);
  config.enforcement.detectSensitiveContent = Boolean(config.enforcement.detectSensitiveContent);

  return config;
}

function loadConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    return sanitizeConfig(DEFAULT_CONFIG);
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }

  return sanitizeConfig(parsed);
}

function saveConfig(configPath, config) {
  ensureDirectoryFor(configPath);
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function escapeRegExp(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function globToRegExp(glob) {
  const normalized = glob.replace(/\\/g, '/');
  let out = '';
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    const next = normalized[i + 1];
    if (ch === '*' && next === '*') {
      out += '.*';
      i += 1;
      continue;
    }
    if (ch === '*') {
      out += '[^/]*';
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      continue;
    }
    out += escapeRegExp(ch);
  }
  return new RegExp(`^${out}$`, 'i');
}

function isPatternProtected(filePath, patterns) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  const basename = path.basename(normalized);

  for (const pattern of patterns) {
    const regex = globToRegExp(pattern);
    if (regex.test(normalized) || regex.test(basename)) {
      return true;
    }
  }

  return false;
}

function isSensitivePath(filePath, config) {
  const normalized = path.resolve(filePath).replace(/\\/g, '/');
  return SENSITIVE_PATH_RE.test(normalized) || isPatternProtected(normalized, config.protectPatterns);
}

function hasSensitiveContent(text) {
  const checks = [
    /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/i,
    /\bsk-[A-Za-z0-9]{20,}\b/,
    /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
    /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/,
    /\bAIza[0-9A-Za-z-_]{30,}\b/,
    /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/,
    /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|client[_-]?secret|authorization|cookie|session(?:id)?)\s*[:=]\s*["']?[^\s"',;]+/i,
    /"(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|client[_-]?secret|authorization|cookie|session(?:id)?)"\s*:\s*"[^"\r\n]+"/i,
    /\b[A-Za-z0-9._-]*_(?:key|token|password|passwd|secret|session(?:id)?)\b\s*[:=]\s*["']?[^\s"',;]+/i,
    /\b[A-Za-z0-9._-]*_key\b\s*[:=]\s*["']?[^\s"',;]+/i,
  ];

  return checks.some((re) => re.test(text));
}

function applyRegexRedaction(input) {
  let text = String(input);

  const literalRules = [
    {
      re: /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/g,
      value: '[REDACTED_PRIVATE_KEY]',
    },
    { re: /\bsk-[A-Za-z0-9]{20,}\b/g, value: '[REDACTED_OPENAI_KEY]' },
    { re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g, value: '[REDACTED_AWS_ACCESS_KEY]' },
    { re: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,})\b/g, value: '[REDACTED_GITHUB_TOKEN]' },
    { re: /\bAIza[0-9A-Za-z-_]{30,}\b/g, value: '[REDACTED_GOOGLE_API_KEY]' },
    { re: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, value: '[REDACTED_JWT]' },
  ];

  for (const rule of literalRules) {
    text = text.replace(rule.re, rule.value);
  }

  text = text.replace(
    /(\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|passwd|secret|client[_-]?secret|authorization|cookie|session(?:id)?|[A-Za-z0-9._-]*_(?:key|token|password|passwd|secret|session(?:id)?))\b\s*[:=]\s*)(["']?)([^"'\r\n,;]+)\2/gi,
    (_, prefix, quote) => `${prefix}${quote}[REDACTED]${quote}`,
  );

  text = text.replace(
    /("\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|password|secret|client[_-]?secret|authorization|cookie|session(?:id)?|[A-Za-z0-9._-]*_(?:key|token|password|passwd|secret|session(?:id)?))\b"\s*:\s*")([^"\r\n]*)(")/gi,
    '$1[REDACTED]$3',
  );

  text = text.replace(
    /^(\s*[A-Za-z0-9._-]*_(?:key|token|password|passwd|secret|session(?:id)?)\s*=\s*)([^\r\n]*)$/gim,
    '$1[REDACTED]',
  );

  text = text.replace(
    /(Authorization\s*:\s*Bearer\s+)([A-Za-z0-9._\-~+/]+=*)/gi,
    '$1[REDACTED_BEARER_TOKEN]',
  );

  text = text.replace(
    /(Set-Cookie\s*:\s*[^=\s;]+=\s*)([^;\r\n]+)/gi,
    '$1[REDACTED_COOKIE]',
  );

  text = text.replace(
    /(https?:\/\/)([^:@\/\s]+):([^@\/\s]+)@/gi,
    '$1[REDACTED_USER]:[REDACTED_PASS]@',
  );

  return text;
}

function shouldDebug() {
  const value = String(process.env.REXCIL_PRIVACY_DEBUG || '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function debug(message) {
  if (shouldDebug()) {
    process.stderr.write(`[privacy-guard] ${message}\n`);
  }
}

function isAbortLikeError(error) {
  if (!error) return false;
  const name = typeof error.name === 'string' ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return name === 'AbortError' || /aborted/i.test(message);
}

async function runOllamaRedaction(input, config) {
  if (input.length > 120000) {
    throw new Error('Input too large for ollama mode (max 120000 chars)');
  }

  const endpoint = String(config.ollama.endpoint || '').trim();
  const model = String(config.ollama.model || '').trim();
  const timeoutMs = Number(config.ollama.timeoutMs) || DEFAULT_CONFIG.ollama.timeoutMs;

  if (!endpoint) {
    throw new Error('ollama.endpoint is empty');
  }
  if (!model) {
    throw new Error('ollama.model is empty');
  }

  const prompt = [
    'You are a security redaction engine.',
    'Redact sensitive values in the following text.',
    'Rules:',
    '- Preserve structure and non-sensitive text.',
    '- Replace only sensitive values with tags like [REDACTED], [REDACTED_TOKEN], [REDACTED_PASSWORD].',
    '- Never explain anything.',
    '- Output only the redacted text.',
    '',
    input,
  ].join('\n');

  const payload = {
    model,
    stream: false,
    options: {
      temperature: 0,
    },
    prompt,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      if (!isAbortLikeError(error)) {
        throw error;
      }
      debug('ollama request aborted once, retrying without timeout guard');
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Ollama request failed: HTTP ${response.status}`);
  }

  const data = await response.json();
  const output = typeof data.response === 'string' ? data.response : '';
  if (!output || output.trim() === '') {
    throw new Error('Ollama returned empty response');
  }

  return output;
}

async function redactByMode(text, config, mode) {
  const normalizedMode = parseMode(mode || config.mode);

  if (normalizedMode === 'regex') {
    return applyRegexRedaction(text);
  }

  if (!config.ollama.enabled) {
    debug('ollama is disabled in config, fallback to regex mode');
    return applyRegexRedaction(text);
  }

  if (normalizedMode === 'ollama') {
    try {
      return await runOllamaRedaction(text, config);
    } catch (error) {
      debug(`ollama mode failed, fallback to regex: ${error instanceof Error ? error.message : String(error)}`);
      return applyRegexRedaction(text);
    }
  }

  const regexFirst = applyRegexRedaction(text);
  try {
    return await runOllamaRedaction(regexFirst, config);
  } catch (error) {
    debug(`hybrid ollama step failed, returning regex result: ${error instanceof Error ? error.message : String(error)}`);
    return regexFirst;
  }
}

function commandInit(options) {
  const configPath = resolveConfigPath(options.path);
  let config = loadConfig(configPath);

  if (options.enable) config.enabled = true;
  if (options.disable) config.enabled = false;
  if (typeof options.enabled !== 'undefined') {
    config.enabled = parseBoolean(options.enabled, '--enabled');
  }
  if (typeof options.mode !== 'undefined') {
    config.mode = parseMode(options.mode);
  }

  config = sanitizeConfig(config);
  saveConfig(configPath, config);
  process.stdout.write(`[ok] initialized privacy guard config: ${configPath}\n`);
}

function commandStatus(options) {
  const configPath = resolveConfigPath(options.path);
  const exists = fs.existsSync(configPath);
  const config = loadConfig(configPath);

  const output = {
    configPath,
    exists,
    rexcilHome: path.dirname(configPath),
    enabled: config.enabled,
    mode: config.mode,
    protectPatterns: config.protectPatterns,
    ollama: config.ollama,
    enforcement: config.enforcement,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function commandSet(options) {
  const configPath = resolveConfigPath(options.path);
  const config = loadConfig(configPath);

  if (options.enable) config.enabled = true;
  if (options.disable) config.enabled = false;

  if (typeof options.enabled !== 'undefined') {
    config.enabled = parseBoolean(options.enabled, '--enabled');
  }

  if (typeof options.mode !== 'undefined') {
    config.mode = parseMode(options.mode);
  }

  if (typeof options['ollama-enabled'] !== 'undefined') {
    config.ollama.enabled = parseBoolean(options['ollama-enabled'], '--ollama-enabled');
  }

  if (typeof options.model !== 'undefined') {
    config.ollama.model = String(options.model).trim();
  }

  if (typeof options.endpoint !== 'undefined') {
    config.ollama.endpoint = String(options.endpoint).trim();
  }

  if (typeof options['timeout-ms'] !== 'undefined') {
    const timeout = Number(options['timeout-ms']);
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new Error('Invalid --timeout-ms value');
    }
    config.ollama.timeoutMs = Math.trunc(timeout);
  }

  if (typeof options.enforce !== 'undefined') {
    config.enforcement.requiredForSensitiveFiles = parseBoolean(options.enforce, '--enforce');
  }

  if (typeof options['block-when-disabled'] !== 'undefined') {
    config.enforcement.blockWhenGuardDisabled = parseBoolean(options['block-when-disabled'], '--block-when-disabled');
  }

  if (typeof options['detect-content'] !== 'undefined') {
    config.enforcement.detectSensitiveContent = parseBoolean(options['detect-content'], '--detect-content');
  }

  saveConfig(configPath, sanitizeConfig(config));
  process.stdout.write(`[ok] updated privacy guard config: ${configPath}\n`);
}

async function commandRedact(options) {
  const filePathRaw = options.file;
  if (!filePathRaw) {
    throw new Error('redact requires --file <path>');
  }

  const filePath = path.resolve(expandHome(filePathRaw));
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    throw new Error(`Not a file: ${filePath}`);
  }

  const configPath = resolveConfigPath(options.path);
  const config = loadConfig(configPath);
  const mode = options.mode ? parseMode(options.mode) : config.mode;

  const content = fs.readFileSync(filePath, 'utf8');
  const force = Boolean(options.force);
  const pathSensitive = isSensitivePath(filePath, config);
  const contentSensitive = config.enforcement.detectSensitiveContent ? hasSensitiveContent(content) : false;
  const sensitive = pathSensitive || contentSensitive;

  debug(`file=${filePath} pathSensitive=${pathSensitive ? 'yes' : 'no'} contentSensitive=${contentSensitive ? 'yes' : 'no'} enabled=${config.enabled ? 'yes' : 'no'} force=${force ? 'yes' : 'no'} mode=${mode}`);

  if (!sensitive && !force) {
    process.stdout.write(content);
    return;
  }

  if (!config.enabled && !force) {
    const mustProtect = config.enforcement.requiredForSensitiveFiles && sensitive;
    if (mustProtect && config.enforcement.blockWhenGuardDisabled) {
      throw new Error(`Sensitive file requires redaction. Enable guard first: node scripts/privacy-guard.mjs set --enabled true (file: ${filePath})`);
    }
    process.stdout.write(content);
    return;
  }

  const redacted = await redactByMode(content, config, mode);
  process.stdout.write(redacted);
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0] || '';

  if (!command || command === 'help' || command === '-h' || command === '--help') {
    usage();
    process.exit(0);
  }

  const options = parseOptions(argv.slice(1));
  if (options.help) {
    usage();
    process.exit(0);
  }

  switch (command) {
    case 'init':
      commandInit(options);
      return;
    case 'status':
      commandStatus(options);
      return;
    case 'set':
      commandSet(options);
      return;
    case 'read':
      await commandRedact(options);
      return;
    case 'redact':
      await commandRedact(options);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[error] ${message}\n`);
  process.exit(1);
});
