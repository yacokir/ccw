const { bybitConfigFromEnv } = require('./bybit_readonly_account_client');
const { envSource, loadLocalEnv } = require('./load_local_env');

function logCcwEnvStartup(scriptName) {
  const loadResult = loadLocalEnv();
  const config = bybitConfigFromEnv();
  const bybitEnvSource = envSource('BYBIT_ENV', process.env, { BYBIT_ENV: 'mainnet' });
  const diagnosticsSource = envSource('BYBIT_ACCOUNT_DIAGNOSTICS', process.env, { BYBIT_ACCOUNT_DIAGNOSTICS: 'false' });

  console.log(`[ccw-env] ${JSON.stringify({
    script: scriptName,
    dotenv_loaded: Boolean(loadResult.exists),
    dotenv_path: loadResult.path,
    BYBIT_ENV: config.environment,
    base_url: config.baseUrl,
    BYBIT_ACCOUNT_DIAGNOSTICS: String(Boolean(config.diagnostics)),
    process_pid: process.pid,
    source: bybitEnvSource,
    sources: {
      BYBIT_ENV: bybitEnvSource,
      BYBIT_ACCOUNT_DIAGNOSTICS: diagnosticsSource
    }
  })}`);
}

module.exports = {
  logCcwEnvStartup
};
