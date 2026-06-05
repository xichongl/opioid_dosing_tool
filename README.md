# 💊 Opioid Conversion Tool

**Inpatient opioid equianalgesic dosing calculator** for internal medicine residents, attendings, and other healthcare professionals. This tool converts between common opioid formulations and routes, calculates oral morphine equivalents (OME/MME), and provides PCA pump settings — all with automatic cross-tolerance reduction and clinical warnings.

> 🔗 **Live App:** [https://xichongl.github.io/opioid_dosing_tool](https://xichongl.github.io/opioid_dosing_tool)

---

## Features

- **12 opioid formulations** — Morphine, Hydromorphone, Oxycodone, Hydrocodone, Fentanyl, Codeine, Tramadol, Methadone, Buprenorphine (PO, IV, SC, transdermal, SL)
- **Real-time OME calculation** — See total daily oral morphine equivalents update as you type
- **Automatic cross-tolerance reduction** — 50% reduction when rotating between different opioids (per CDC/StatPearls guidelines)
- **Breakthrough (PRN) dosing** — Calculated as 10–15% of total daily dose q4h
- **PCA pump settings** — Basal rate, bolus dose, lockout interval, 1-hour and 4-hour safety limits for morphine, hydromorphone, and fentanyl
- **Renal & hepatic warnings** — Toggle impairment flags to see drug-specific clinical considerations
- **Methadone ratio-based conversion** — Uses conservative 4:1 to 20:1 OME-to-methadone ratios depending on total daily OME
- **Fentanyl patch sizing** — Automatically rounds to nearest available patch size (12, 25, 50, 75, 100 mcg/hr)
- **Responsive design** — Works on desktop, tablet, and mobile

## Conversion References

| Source | Reference |
|--------|-----------|
| **CDC 2022 Guideline** | [MMWR Recomm Rep 2022;71(RR-3):1–95](https://www.cdc.gov/mmwr/volumes/71/rr/rr7103a1.htm) |
| **StatPearls** | [Opioid Equivalency (NCBI NBK535402)](https://www.ncbi.nlm.nih.gov/books/NBK535402/) |
| **McPherson 2010** | Demystifying Opioid Conversion Calculations (referenced by MDCalc) |

## Conversion Factors (OME Multipliers)

Per the **CDC 2022 Clinical Practice Guideline** (oral opioids) and StatPearls/McPherson (parenteral):

| Drug | Route | Equianalgesic to 30 mg PO Morphine |
|------|-------|-------------------------------------|
| Morphine | PO | 30 mg |
| Morphine | IV/SC | 10 mg |
| Hydromorphone | PO | 6 mg (CDC multiplier: 5.0×) |
| Hydromorphone | IV/SC | 1.5 mg |
| Oxycodone | PO | 20 mg |
| Hydrocodone | PO | 30 mg |
| Fentanyl | IV | 0.1 mg |
| Fentanyl | Transdermal | ~25 mcg/hr ≈ 60 MME/day |
| Codeine | PO | 200 mg |
| Tramadol | PO | 150 mg |
| Methadone | PO/IV | Ratio-based (4:1 to 20:1) |
| Buprenorphine | SL | 0.4 mg |

## Quick Start

```bash
# Clone the repository
git clone https://github.com/xichongl/opioid_dosing_tool.git
cd opioid_dosing_tool

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Deploy

This project is configured for deployment to GitHub Pages:

```bash
npm run deploy
```

This builds the project and publishes the `dist/` folder to the `gh-pages` branch, which GitHub Pages serves at `https://xichongl.github.io/opioid_dosing_tool/`.

## Tech Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 8](https://vite.dev/) (build tool)
- [gh-pages](https://www.npmjs.com/package/gh-pages) (deployment)

## Disclaimer

**This tool provides estimates based on published equianalgesic tables. Individual patient factors (age, organ function, opioid tolerance, genetics, concurrent medications) significantly affect dosing. Always use clinical judgment. This tool does not substitute for professional medical advice.**

## License

MIT License — see [LICENSE](LICENSE) for details.

---

Built for internal medicine clinical use. Contributions and feedback welcome.


The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
