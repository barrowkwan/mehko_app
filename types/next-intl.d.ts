import type en from "../messages/en.json";
import type { Locale } from "@/lib/locale";

// Makes translation keys and locales type-checked across the app.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof en;
  }
}
