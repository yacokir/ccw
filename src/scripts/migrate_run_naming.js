const fs = require('fs');
const path = require('path');

const LABEL_MAP = {
  'x-5': 'itm05',
  x00: 'atm00',
  x03: 'otm03',
  x05: 'otm05',
  x07: 'otm07',
  x10: 'otm10'
};

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

function replaceKnownLabels(value) {
  return String(value).replace(/_(x-5|x00|x03|x05|x07|x10)_/g, (match, label) => `_${LABEL_MAP[label]}_`);
}

function getRunDirs(runsDir) {
  if (!fs.existsSync(runsDir)) return [];

  return fs.readdirSync(runsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name !== 'batches')
    .map(entry => ({
      name: entry.name,
      sourcePath: path.join(runsDir, entry.name),
      destinationName: replaceKnownLabels(entry.name)
    }))
    .filter(entry => entry.name !== entry.destinationName)
    .map(entry => ({
      ...entry,
      destinationPath: path.join(runsDir, entry.destinationName)
    }));
}

function isDirectoryEmpty(dirPath) {
  return fs.existsSync(dirPath) && fs.readdirSync(dirPath).length === 0;
}

function backupFile(filePath, options) {
  const backupPath = `${filePath}.bak`;
  if (options.dryRun || fs.existsSync(backupPath)) return backupPath;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function updateTextFile(filePath, options) {
  if (!fs.existsSync(filePath)) {
    return { status: 'missing', filePath, updated: false };
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const updated = replaceKnownLabels(original);
  if (updated === original) {
    return { status: 'unchanged', filePath, updated: false };
  }

  if (!options.dryRun) {
    const backupPath = backupFile(filePath, options);
    fs.writeFileSync(filePath, updated, 'utf8');
    if (options.deleteBackup && fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  }

  return { status: 'updated', filePath, updated: true };
}

function getReferenceFiles(runsDir) {
  const files = [path.join(runsDir, 'index.csv')];
  const batchesDir = path.join(runsDir, 'batches');
  if (!fs.existsSync(batchesDir)) return files;

  for (const entry of fs.readdirSync(batchesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const batchDir = path.join(batchesDir, entry.name);
    files.push(path.join(batchDir, 'summary.json'));
    files.push(path.join(batchDir, 'summary.csv'));
  }

  return files;
}

function renameRunFolder(entry, options) {
  if (fs.existsSync(entry.destinationPath)) {
    if (!options.force || !isDirectoryEmpty(entry.destinationPath)) {
      return {
        status: 'skipped',
        reason: 'destination folder already exists',
        ...entry
      };
    }

    if (!options.dryRun) {
      fs.rmdirSync(entry.destinationPath);
    }
  }

  if (!options.dryRun) {
    fs.renameSync(entry.sourcePath, entry.destinationPath);
  }

  return { status: 'renamed', ...entry };
}

function printFolderAction(result, options) {
  const prefix = options.dryRun ? '[dry-run]' : '[rename]';

  if (result.status === 'renamed') {
    console.log(`${prefix} ${result.name} -> ${result.destinationName}`);
    return;
  }

  if (result.status === 'skipped') {
    console.log(`${prefix} ${result.name}: skipped (${result.reason})`);
    return;
  }

  if (result.status === 'error') {
    console.error(`${prefix} ${result.name}: error (${result.error})`);
  }
}

function printReferenceAction(result, options) {
  if (result.status !== 'updated') return;
  const prefix = options.dryRun ? '[dry-run]' : '[update]';
  console.log(`${prefix} references in ${result.filePath}`);
}

function printReport(report) {
  console.log('\n=== RUN NAMING MIGRATION REPORT ===');
  console.log(`Folders scanned: ${report.foldersScanned}`);
  console.log(`Folders renamed: ${report.foldersRenamed}`);
  console.log(`References updated: ${report.referencesUpdated}`);
  console.log(`Skipped: ${report.skipped}`);
  console.log(`Errors: ${report.errors}`);
}

function migrateRunNaming(runsDir, options) {
  const runDirs = getRunDirs(runsDir);
  const report = {
    foldersScanned: runDirs.length,
    foldersRenamed: 0,
    referencesUpdated: 0,
    skipped: 0,
    errors: 0
  };

  for (const entry of runDirs) {
    let result;
    try {
      result = renameRunFolder(entry, options);
    } catch (error) {
      result = { status: 'error', name: entry.name, error: error.message };
    }

    if (result.status === 'renamed') report.foldersRenamed++;
    else if (result.status === 'skipped') report.skipped++;
    else if (result.status === 'error') report.errors++;

    printFolderAction(result, options);
  }

  for (const filePath of getReferenceFiles(runsDir)) {
    try {
      const result = updateTextFile(filePath, options);
      if (result.updated) report.referencesUpdated++;
      printReferenceAction(result, options);
    } catch (error) {
      report.errors++;
      console.error(`${options.dryRun ? '[dry-run]' : '[update]'} ${filePath}: error (${error.message})`);
    }
  }

  return report;
}

function main() {
  const args = parseArgs(process.argv);
  const options = {
    dryRun: Boolean(args.dryRun),
    force: Boolean(args.force),
    deleteBackup: Boolean(args.deleteBackup)
  };
  const runsDir = path.resolve(__dirname, '..', '..', 'runs');
  const report = migrateRunNaming(runsDir, options);
  printReport(report);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('Error migrating run naming:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  main,
  parseArgs,
  replaceKnownLabels,
  migrateRunNaming
};
