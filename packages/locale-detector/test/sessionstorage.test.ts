import type { Locale } from '../../core/src/core'

import { suite } from 'uvu'
import * as assert from 'uvu/assert'

import { initSessionStorageDetector } from '../src/detectors/sessionstorage-detector'

const test = suite('detector:sessionStorage')

// --------------------------------------------------------------------------------------------------------------------

const testDetector = (
	name: string,
	items: Record<string, string> | undefined,
	expected: Locale[],
	itemKey: string | undefined = undefined,
) =>
	test(`sessionStorage ${name}`, () => {
		//@ts-ignore
		globalThis.window = {
			sessionStorage: {
				getItem: (key: string) => items?.[key],
			} as Storage,
		}

		const detector = initSessionStorageDetector(itemKey)
		assert.equal(detector(), expected)
	})

testDetector('undefined', undefined, [])

testDetector('empty', {}, [])

testDetector('single value', { locale: 'de-AT' }, ['de-AT'])

testDetector('single value with custom key', { lang: 'en-US' }, ['en-US'], 'lang')

testDetector('single value with custom key not specified', { lang: 'fr' }, [])

testDetector('single value with wrong custom key not specified', { locale: 'fr' }, [], 'lang')

testDetector(
	'multiple values',
	{
		id: '1234',
		locale: 'it',
	},
	['it'],
)

testDetector('multiple values with custom key', { param: 'test123', 'user-lang': 'es' }, ['es'], 'user-lang')

testDetector('multiple values without lang', { param1: 'some-value', param2: 'another-value' }, [])

// --------------------------------------------------------------------------------------------------------------------

test.run()