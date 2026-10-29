#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { check, formatError, generate } from './index.js';

const USAGE =
  'usage: tsdoc-defaults [globs...] [--check] [--project <tsconfig>] [--help]';
const OPTIONS = {
  check: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  project: { type: 'string', short: 'p' },
} as const;
const CONFIG = 'tsconfig.json';

function parse(argv: string[]) {
  try {
    return parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (e) {
    console.error(`${(e as Error).message}\n${USAGE}`);
    return undefined;
  }
}

function main(argv: string[]): number {
  const args = parse(argv);
  if (!args) return 2;
  if (args.values.help) {
    console.log(USAGE);
    return 0;
  }
  const config = readConfig(args.values.project);
  if (config?.errors.length) {
    const messages = config.errors.map((d) =>
      ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    );
    console.error(messages.map((m) => `${config.path}: ${m}`).join('\n'));
    return 2;
  }
  // Generated files are never sources, so `src/**/*.ts` is safe.
  const files = (
    args.positionals.length
      ? fs.globSync(args.positionals)
      : (config?.files ?? [])
  )
    .filter((f) => !/\.defaults\.[cm]?ts$/.test(f))
    .sort();
  if (!files.length) {
    console.error(
      args.positionals.length
        ? 'no files match'
        : config
          ? `${config.path} includes no TypeScript files: pass globs`
          : USAGE,
    );
    return 2;
  }
  const importExt = config && importExtOf(config.options);
  const result = args.values.check
    ? check(files, { importExt })
    : runGenerate(files, importExt);
  if (result.errors.length) {
    console.error(result.errors.map(formatError).join('\n'));
    return 1;
  }
  result.stale.forEach((out) =>
    console.error(`${out} is stale: run tsdoc-defaults`),
  );
  return result.stale.length ? 1 : 0;
}

function readConfig(project?: string) {
  if (!project && !fs.existsSync(CONFIG)) return undefined;
  const configPath = project ?? CONFIG;
  const file = ts.readConfigFile(configPath, (f) => ts.sys.readFile(f));
  if (file.error)
    return { path: configPath, files: [], options: {}, errors: [file.error] };
  const parsed = ts.parseJsonConfigFileContent(
    file.config,
    ts.sys,
    path.resolve(path.dirname(configPath)),
    undefined,
    path.resolve(configPath),
  );
  return {
    path: configPath,
    // A JS file can't hold an interface, so its tags would only be errors.
    files: parsed.fileNames
      .filter((f) => /\.[cm]?tsx?$/.test(f))
      .map((f) => path.relative('.', f)),
    options: parsed.options,
    // TS18003 (no inputs) is reported as an empty file list instead.
    errors: parsed.errors.filter((d) => d.code !== 18003),
  };
}

/** The extension the project's relative imports use: `.ts` when it imports `.ts` files, `.js` under node16/nodenext resolution, otherwise none. */
function importExtOf(o: ts.CompilerOptions) {
  if (o.allowImportingTsExtensions || o.rewriteRelativeImportExtensions)
    return '.ts';
  const { Node16, NodeNext } = ts.ModuleResolutionKind;
  const module = o.module ?? 0;
  // Without moduleResolution, the node16 through nodenext modules resolve like nodenext.
  const resolution =
    o.moduleResolution ??
    (module >= ts.ModuleKind.Node16 && module <= ts.ModuleKind.NodeNext
      ? NodeNext
      : undefined);
  return resolution === Node16 || resolution === NodeNext ? '.js' : undefined;
}

function runGenerate(files: string[], importExt?: string) {
  const result = generate(files, { importExt });
  result.files.forEach((f) => fs.writeFileSync(f.output, f.text));
  result.obsolete.forEach((f) => fs.rmSync(f, { force: true }));
  return { stale: [], errors: result.errors };
}

process.exitCode = main(process.argv.slice(2));
