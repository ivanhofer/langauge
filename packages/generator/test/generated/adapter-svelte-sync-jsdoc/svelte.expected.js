// This file was auto-generated by 'typesafe-i18n'. Any manual changes will be overwritten.
// @ts-check
/* eslint-disable */

import { getI18nSvelteStore } from 'typesafe-i18n/adapters/adapter-svelte';

import { getTranslationForLocale } from './util.actual'
import { initFormatters } from './formatters-template.actual'

const { initI18n: init, setLocale, isLoadingLocale, locale, LL } = getI18nSvelteStore<Locales, Translation, TranslationFunctions, Formatters>()

const initI18n = (locale = 'en') => init(locale, getTranslationForLocale, initFormatters)

export { initI18n, setLocale, isLoadingLocale, locale, LL }

export default LL