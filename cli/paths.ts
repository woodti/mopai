import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 包根目录：打包后脚本在 bin/ 下 */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
