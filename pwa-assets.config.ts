import {
  combinePresetAndAppleSplashScreens,
  defineConfig,
  minimal2023Preset,
} from '@vite-pwa/assets-generator/config';

const BRAND = '#0054e9';

/** One name per screen size. The generator skips sizes it has already made. */
const IPHONES = [
  'iPhone 17 Pro Max',
  'iPhone 17',
  'iPhone 16 Pro Max',
  'iPhone 16 Pro',
  'iPhone 15 Pro Max',
  'iPhone 15 Pro',
  'iPhone 14 Plus',
  'iPhone 13',
  'iPhone 13 mini',
  'iPhone 11 Pro Max',
  'iPhone 11',
  'iPhone X',
  'iPhone 8 Plus',
  'iPhone SE 4.7"',
] as const;

// The logo is a rounded tile. Icons that can't be transparent fill its corners with the same blue.
const preset = {
  ...minimal2023Preset,
  transparent: { ...minimal2023Preset.transparent, padding: 0 },
  maskable: { sizes: [512], padding: 0, resizeOptions: { background: BRAND } },
  apple: { sizes: [180], padding: 0, resizeOptions: { background: BRAND } },
};

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: combinePresetAndAppleSplashScreens(
    preset,
    {
      padding: 0.35,
      resizeOptions: { background: '#f2f2f7', fit: 'contain' },
      darkResizeOptions: { background: '#000000', fit: 'contain' },
      png: { compressionLevel: 9, quality: 60 },
    },
    [...IPHONES],
  ),
  images: ['public/logo.svg'],
});
