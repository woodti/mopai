// 把 cli/ 打包成 bin/mopai.js；运行时依赖保持 external，由 npm 安装
import { build } from 'esbuild'
import { chmod, readFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: ['cli/index.ts'],
  outfile: 'bin/mopai.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  external: Object.keys(pkg.dependencies),
  banner: { js: '#!/usr/bin/env node' },
  logLevel: 'warning',
})
await chmod('bin/mopai.js', 0o755)
console.log('✓ bin/mopai.js')
