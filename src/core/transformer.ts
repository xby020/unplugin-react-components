import type { ExportType, TransformOptions } from '../types'
import { isExportComponent, stringifyImport } from './utils'
import { getResolversResult } from './resolvers'

const reactComponentRE = /_jsxDEV\(([^"][^React\.]\w+)/g

export async function transform(options: TransformOptions) {
  let index = 0
  const { code, id, components, resolvers } = options

  const matches = Array.from(code.original.matchAll(reactComponentRE)).map(item => ({
    name: item[1],
    path: id,
    original: item[0],
  }))

  const importsName: string[] = []
  const imports: string[] = []

  const resolveImports = (name: string, type: ExportType, path: string, original: string) => {
    if (importsName.includes(name))
      return

    const replacedName = `_unplugin_react_${name}_${index}`
    index++

    code.replaceAll(original, `_jsxDEV(${replacedName}`)

    const importedPath = path

    if (isExportComponent(type)) {
      imports.push(stringifyImport({
        name,
        as: replacedName,
        from: importedPath,
      }))
    }
    else {
      imports.push(stringifyImport({
        default: replacedName,
        from: importedPath,
      }))
    }

    importsName.push(name)
  }
  const resolversResult = await getResolversResult(resolvers)

  for (const matched of matches) {
    resolversResult.forEach((resolver) => {
      resolver.forEach((item) => {
        if (item.name === matched.name)
          resolveImports(item.name, item.type, item.from, matched.original)
      })
    })

    const component = Array.from(components).find(item => item.name === matched.name)
    if (!component)
      continue

    resolveImports(component.name, component.type as ExportType, component.path, matched.original)
  }
  code.prepend(`${imports.join('\n')}\n`)

  return code.toString()
}
