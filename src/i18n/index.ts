import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import hi from "./locales/hi.json";

// Single source of truth: a language is offered ONLY if it has a full resource
// bundle here. supportedLngs and the LanguageSwitcher both derive from this, so
// the UI can never advertise a language that silently falls back to English.
const resources = {
  en: { translation: en },
  hi: { translation: hi },
};

const supportedLngs = Object.keys(resources);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "en",
    supportedLngs,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
    },
  });

export default i18n;
