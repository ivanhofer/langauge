import { isObject, isTruthy, not } from 'typesafe-utils'
import { parseRawText } from '../core/parser'
import type { LangaugeBaseTranslation } from '../core/core'
import type { InjectorPart, Part, PluralPart } from '../core/parser'
import { writeFileIfContainsChanges } from './file-utils'
import { GeneratorConfigWithDefaultValues } from './generator'

// --------------------------------------------------------------------------------------------------------------------
// types --------------------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------

type IsPluralPart<T> = T extends PluralPart ? T : never

type Arg = { key: string; type: string | undefined }

type FormatterFunctionKey = { formatterKey: string[]; type: string | undefined }

// --------------------------------------------------------------------------------------------------------------------
// implementation -----------------------------------------------------------------------------------------------------
// --------------------------------------------------------------------------------------------------------------------

const isPluralPart = <T extends Part>(part: T): part is IsPluralPart<T> => !!(<PluralPart>part).r

const parseTanslationObject = ([key, text]: [string, string]): {
	key: string
	text: string
	args: Arg[]
	formatterFunctionKeys: FormatterFunctionKey[]
} => {
	const args: Arg[] = []
	const formatterFunctionKeys: FormatterFunctionKey[] = []

	parseRawText(text, false)
		.filter(isObject)
		.filter(not<InjectorPart | PluralPart, InjectorPart>(isPluralPart))
		.forEach((injectorPart) => {
			const { k, i, f } = injectorPart

			k && args.push({ key: k, type: i })
			f && formatterFunctionKeys.push({ formatterKey: f, type: i })
		})

	return { key, text, args, formatterFunctionKeys }
}

const wrapObjectType = (array: unknown[], callback: () => string) =>
	!array.length
		? '{}'
		: `{${callback()}
}`

const wrapEnumType = (array: unknown[], callback: () => string) => (!array.length ? ' never' : `${callback()}`)

const createEnumType = (locales: string[]) =>
	locales
		.map(
			(locale) => `
	| '${locale}'`,
		)
		.join('')

const createLocalesType = (locales: string[]) =>
	`export type LangaugeLocale =${wrapEnumType(locales, () => createEnumType(locales))}`

const createTranslationKeysType = (keys: string[]) =>
	`export type LangaugeTranslationKeys =${wrapEnumType(keys, () => createEnumType(keys))}`

const createTranslationType = (keys: string[]) =>
	`export type LangaugeTranslation = ${wrapObjectType(keys, () =>
		keys
			.map(
				(key) =>
					`
	'${key}': string`,
			)
			.join(''),
	)}`

const createFormatterType = (formatterKeys: FormatterFunctionKey[]) => {
	const map: { [key: string]: string } = {}
	formatterKeys
		.flatMap(({ formatterKey, type }) => formatterKey.map((ff) => [ff, type || 'any'] as [string, string]))
		.forEach(([key, type]) => {
			const foundType = map[key]
			// TODO: check if  different types exist for a formatterKey
			if (!foundType || foundType === 'any') {
				map[key] = type
			}
		})

	const entries = Object.entries(map)
	return `export type LangaugeFormatters = ${wrapObjectType(entries, () =>
		entries
			.map(
				([key, type]) =>
					`
	${key}: (value: ${type}) => string`,
			)
			.join(''),
	)}`
}

const createTranslationArgsType = (translations: { key: string; text: string; args: Arg[] }[]) =>
	`export type LangaugeTranslationArgs = ${wrapObjectType(translations, () =>
		translations
			.map(
				(translation) =>
					`
	${createTranslationArgssType(translation)}`,
			)
			.join(''),
	)} `

const createTranslationArgssType = ({ key, text, args }: { key: string; text: string; args: Arg[] }) =>
	`/**
	 * ${text}
	 */
	'${key}': (${mapTranslationArgs(args)}) => string`

const mapTranslationArgs = (args: Arg[]) => {
	if (!args.length) {
		return ''
	}

	const arg = args[0]?.key as string

	const isKeyed = isNaN(+arg)
	const prefix = (isKeyed && 'arg: { ') || ''
	const postfix = (isKeyed && ' }') || ''
	const argPrefix = (!isKeyed && 'arg') || ''

	return prefix + args.map(({ key, type }) => `${argPrefix}${key}: ${type || 'unknown'}`).join(', ') + postfix
}

const BASE_TYPES = ['boolean', 'number', 'bigint', 'string', 'Date']

const createTypeImportsType = (args: Arg[], typesTemplatePath: string): string => {
	const types = new Set(args.flatMap(({ type }) => type).filter(isTruthy))
	const externalTypes = Array.from(types).filter((type) => !BASE_TYPES.includes(type))
	return !externalTypes.length
		? ''
		: `
import type { ${externalTypes.join(', ')} } from './${typesTemplatePath.replace('.ts', '')}'
`
}

const getTypes = ({ translationObject, baseLocale, locales, typesTemplateFileName }: GenerateTypesType) => {
	const result = (isObject(translationObject) && Object.entries(translationObject).map(parseTanslationObject)) || []

	const baseLocaleType = `export type LangaugeBaseLocale = '${baseLocale}'`

	const localesType = createLocalesType(locales?.length ? locales : [baseLocale])

	const keys = result.map(({ key }) => key)

	const translationKeysType = createTranslationKeysType(keys)

	const translationType = createTranslationType(keys)

	const args = result.flatMap(({ args }) => args)
	const typeImports = createTypeImportsType(args, typesTemplateFileName)

	const formatterFunctionKeys = result.flatMap(({ formatterFunctionKeys }) => formatterFunctionKeys)
	const formatterType = createFormatterType(formatterFunctionKeys)

	const translations = result.map(({ key, text, args }) => ({ key, text, args }))
	const translationArgsType = createTranslationArgsType(translations)

	return [
		`// This types were auto-generated. Any manual changes will be overwritten.
/* eslint-disable */

${typeImports}
${baseLocaleType}

${localesType}

${translationKeysType}

${translationType}

${translationArgsType}

${formatterType}

export type LangaugeFormattersInitializer = (locale: LangaugeLocale) => LangaugeFormatters
`,
		!!typeImports,
	] as [string, boolean]
}

type GenerateTypesType = GeneratorConfigWithDefaultValues & {
	translationObject: LangaugeBaseTranslation
}

export const generateTypes = async (config: GenerateTypesType): Promise<boolean> => {
	const { outputPath, typesFileName } = config

	const [types, hasCustomTypes] = getTypes(config)

	await writeFileIfContainsChanges(outputPath, typesFileName, types)

	return hasCustomTypes
}