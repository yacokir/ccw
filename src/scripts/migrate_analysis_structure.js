const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'execution_friction_summary.csv',
  'execution_friction_summary.json'
];

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;

    const keyValue = arg.slice(2);
    if (keyValue.includes('=')) {
      const [key, value] = keyValue.split('=');
      args[key] = value;
    } else {
      args[keyValue] = true;
    }
  }
  return args;
}

function getBatchDirs(batchesDir) {
  if (!fs.existsSync(batchesDir)) return [];

  return fs.readdirSync(batchesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(batchesDir, entry.name));
}

function hasRequiredFiles(dirPath) {
  return REQUIRED_FILES.every(fileName => fs.existsSync(path.join(dirPath, fileName)));
}

function destinationFilesExist(destinationDir) {
  return REQUIRED_FILES.some(fileName => fs.existsSync(path.join(destinationDir, fileName)));
}

function copyRequiredFiles(sourceDir, destinationDir, options) {
  if (!options.dryRun) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  for (const fileName of REQUIRED_FILES) {
    const sourcePath = path.join(sourceDir, fileName);
    const destinationPath = path.join(destinationDir, fileName);
    if (!options.dryRun) {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

function removeOldFolder(sourceDir, options) {
  if (!options.deleteOld || options.dryRun) return;
  fs.rmSync(sourceDir, { recursive: true, force: true });
}

function migrateBatch(batchDir, options) {
  const batchName = path.basename(batchDir);
  const sourceDir = path.join(batchDir, 'friction');
  const destinationDir = path.join(batchDir, 'analysis', 'execution_friction', 'uniform');

  if (!fs.existsSync(sourceDir)) {
    return { status: 'skipped', batchName, reason: 'old friction folder not found' };
  }

  if (!hasRequiredFiles(sourceDir)) {
    return { status: 'skipped', batchName, reason: 'required summary files not found' };
  }

  if (!options.force && destinationFilesExist(destinationDir)) {
    return { status: 'alreadyExists', batchName, reason: 'destination files already exist' };
  }

  copyRequiredFiles(sourceDir, destinationDir, options);
  removeOldFolder(sourceDir, options);

  return {
    status: 'migrated',
    batchName,
    sourceDir,
    destinationDir,
    deletedOld: Boolean(options.deleteOld)
  };
}

function printAction(result, options) {
  const prefix = options.dryRun ? '[dry-run]' : '[migrate]';

  if (result.status === 'migrated') {
    const cleanup = result.deletedOld ? ' and remove old folder' : '';
    console.log(`${prefix} ${result.batchName}: copy friction summaries to ${result.destinationDir}${cleanup}`);
    return;
  }

  if (result.status === 'alreadyExists') {
    console.log(`${prefix} ${result.batchName}: already exists, skipped`);
    return;
  }

  if (result.status === 'skipped') {
    console.log(`${prefix} ${result.batchName}: skipped (${result.reason})`);
    return;
  }

  if (result.status === 'error') {
    console.error(`${prefix} ${result.batchName}: error (${result.error})`);
  }
}

function printReport(report) {
  console.log('\n=== MIGRATION REPORT ===');
  console.log(`Batches scanned: ${report.scanned}`);
  console.log(`Migrated: ${report.migrated}`);
  console.log(`Skipped: ${report.skipped}`);
  console.log(`Already exists: ${report.alreadyExists}`);
  console.log(`Errors: ${report.errors}`);
}

function main() {
  const args = parseArgs(process.argv);
  const options = {
    deleteOld: Boolean(args.deleteOld),
    dryRun: Boolean(args.dryRun),
    force: Boolean(args.force)
  };

  const batchesDir = path.resolve(__dirname, '..', '..', 'runs', 'batches');
  const batchDirs = getBatchDirs(batchesDir);
  const report = {
    scanned: batchDirs.length,
    migrated: 0,
    skipped: 0,
    alreadyExists: 0,
    errors: 0
  };

  for (const batchDir of batchDirs) {
    let result;
    try {
      result = migrateBatch(batchDir, options);
    } catch (error) {
      result = {
        status: 'error',
        batchName: path.basename(batchDir),
        error: error.message
      };
    }

    if (result.status === 'migrated') report.migrated++;
    else if (result.status === 'skipped') report.skipped++;
    else if (result.status === 'alreadyExists') report.alreadyExists++;
    else if (result.status === 'error') report.errors++;

    printAction(result, options);
  }

  printReport(report);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error migrating analysis structure:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
  migrateBatch
};
