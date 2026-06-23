const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_ENV_PATH = path.join(REPO_ROOT, '.env');
let processLoadResult = null;

function unquote(value) {
  const trimmed = String(value || '').trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseEnvLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const equalsIndex = withoutExport.indexOf('=');
  if (equalsIndex <= 0) return null;
  const key = withoutExport.slice(0, equalsIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;
  return {
    key,
    value: unquote(withoutExport.slice(equalsIndex + 1))
  };
}

function loadLocalEnv(options = {}) {
  const targetEnv = options.env || process.env;
  const envPath = options.envPath || targetEnv.CCW_DOTENV_PATH || DEFAULT_ENV_PATH;
  const useProcessSingleton = targetEnv === process.env && !options.envPath;
  const loaded = [];
  const skipped = [];
  const sources = {};

  if (useProcessSingleton && processLoadResult) return processLoadResult;

  if (!fs.existsSync(envPath)) {
    const result = { path: envPath, exists: false, loaded, skipped, sources };
    if (useProcessSingleton) processLoadResult = result;
    return result;
  }

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    if (targetEnv[parsed.key] !== undefined) {
      skipped.push(parsed.key);
      sources[parsed.key] = 'os_env';
      continue;
    }
    targetEnv[parsed.key] = parsed.value;
    loaded.push(parsed.key);
    sources[parsed.key] = '.env';
  }

  const result = { path: envPath, exists: true, loaded, skipped, sources };
  if (useProcessSingleton) processLoadResult = result;
  return result;
}

function envSource(key, env = process.env, defaults = {}) {
  const loadResult = env === process.env ? loadLocalEnv() : loadLocalEnv({ env });
  if (loadResult.sources && loadResult.sources[key]) return loadResult.sources[key];
  if (env[key] !== undefined) return 'os_env';
  if (Object.prototype.hasOwnProperty.call(defaults, key)) return 'default';
  return 'default';
}

module.exports = {
  DEFAULT_ENV_PATH,
  envSource,
  loadLocalEnv,
  parseEnvLine
};
