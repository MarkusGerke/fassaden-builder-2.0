import { green } from "@/theme/colors/green";
import { red } from "@/theme/colors/red";
import { slate } from "@/theme/colors/slate";
import { blue } from "@/theme/colors/blue";
import { animationStyles } from "@/theme/animation-styles";
import { zIndex } from "@/theme/tokens/z-index";
import { shadows } from "@/theme/tokens/shadows";
import { durations } from "@/theme/tokens/durations";
import { colors } from "@/theme/tokens/colors";
import { radii } from "@/theme/tokens/radii";
import { textStyles } from "@/theme/text-styles";
import { layerStyles } from "@/theme/layer-styles";
import { keyframes } from "@/theme/keyframes";
import { globalCss } from "@/theme/global-css";
import { conditions } from "@/theme/conditions";
import { slotRecipes, recipes } from "@/theme/recipes";
import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  preflight: true,
  include: ['./packages/ui/**/*.{js,jsx,ts,tsx}', './ui-sandbox.html'],
  exclude: [],
  jsxFramework: 'solid',
  outdir: 'styled-system',
  importMap: 'styled-system',

  theme: {
    extend: {
      animationStyles: animationStyles,
      recipes: recipes,
      slotRecipes: slotRecipes,
      keyframes: keyframes,
      layerStyles: layerStyles,
      textStyles: textStyles,

      tokens: {
        colors: colors,
        durations: durations,
        zIndex: zIndex,
        radii: radii,
      },

      semanticTokens: {
        colors: {
          fg: {
            default: {
              value: {
                _light: "{colors.gray.12}",
                _dark: "{colors.gray.12}"
              }
            },

            muted: {
              value: {
                _light: "{colors.gray.11}",
                _dark: "{colors.gray.11}"
              }
            },

            subtle: {
              value: {
                _light: "{colors.gray.10}",
                _dark: "{colors.gray.10}"
              }
            }
          },

          border: {
            value: {
              _light: "{colors.gray.4}",
              _dark: "{colors.gray.4}"
            }
          },

          error: {
            value: {
              _light: "{colors.red.9}",
              _dark: "{colors.red.9}"
            }
          },

          blue: blue,
          gray: slate,
          red: red,
          green: green
        },

        shadows: shadows
      }
    },
  },

  globalCss: globalCss,
  conditions: conditions
})