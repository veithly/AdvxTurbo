const solc = require('solc');
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, 'contracts');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sol'));
const sources = {};
for (const f of files) sources[f] = { content: fs.readFileSync(path.join(dir, f), 'utf8') };
function findImports(p) {
  const f = path.basename(p);
  if (sources[f]) return { contents: sources[f].content };
  const fp = path.join(dir, f);
  if (fs.existsSync(fp)) return { contents: fs.readFileSync(fp, 'utf8') };
  return { error: 'not found: ' + p };
}
const input = {
  language: 'Solidity',
  sources,
  settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors || []).filter((e) => e.severity === 'error');
const warnings = (out.errors || []).filter((e) => e.severity === 'warning');
console.log('solc', solc.version());
console.log('files:', files.join(', '));
if (errors.length) {
  console.log('ERRORS:');
  errors.forEach((e) => console.log(' -', e.formattedMessage.split('\n')[0]));
  process.exit(1);
}
const contracts = [];
for (const f of Object.keys(out.contracts || {}))
  for (const c of Object.keys(out.contracts[f])) {
    const bc = out.contracts[f][c].evm.bytecode.object;
    if (bc && bc.length) contracts.push(`${c}(${(bc.length / 2) | 0}B)`);
  }
console.log('COMPILED OK. warnings:', warnings.length, '| deployable:', contracts.join(', '));
