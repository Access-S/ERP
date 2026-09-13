import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='button']",
          message: "Use Button from @/components/ui/button instead of a native button.",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message: "Use Input, Checkbox, or another component from @/components/ui instead of a native input.",
        },
        {
          selector: "JSXOpeningElement[name.name='select']",
          message: "Use Select from @/components/ui/select instead of a native select.",
        },
        {
          selector: "JSXOpeningElement[name.name='option']",
          message: "Use SelectItem from @/components/ui/select instead of a native option.",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message: "Use Textarea from @/components/ui/textarea instead of a native textarea.",
        },
        {
          selector: "JSXOpeningElement[name.name='label']",
          message: "Use Label from @/components/ui/label instead of a native label.",
        },
        {
          selector: "JSXOpeningElement[name.name=/^(table|thead|tbody|tr|th|td)$/]",
          message: "Use the table primitives from @/components/ui/table instead of native table elements.",
        },
        {
          selector: "JSXOpeningElement[name.name='dialog']",
          message: "Use Dialog from @/components/ui/dialog instead of a native dialog.",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
