/** Copy dictionaries for the Liquid Glass tab in the Plugins settings section. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  cardTitle: '液态玻璃',
  cardDescription: '玻璃主题的开关与壁纸偏好。',
  effectTitle: '液态玻璃效果',
  effectDescription: '半透明玻璃表面、折射输入框与随滚动联动的壁纸。右下角的水滴按钮是同一开关的快捷入口。',
  stateOn: '已开启',
  stateOff: '已关闭',
  presetTitle: '壁纸',
  presetDescription: '玻璃折射的背景画面。长按水滴按钮可循环切换。',
  presetRidge: '山脊线稿',
  presetCollage: '渐变拼贴',
  presetCustom: '自定义图片',
  customTitle: '自定义图片',
  customDescription: '上传本地图片作为壁纸。图片仅保存在此浏览器，不上传到服务端。建议竖图 1920×2400 以上。',
  upload: '上传图片',
  veilTitle: '纱强度',
  veilDescription: '自定义图片上方的柔化纱，压住图片细节保证文字可读。深色图片在亮色模式下可以调低。',
  clarityTitle: '通透度',
  clarityDescription: '玻璃表面的着色。拉高更通透，100 时表面不再给壁纸添色（悬停、选中等交互态保留底限）。',
} satisfies Record<string, string>

/** Liquid Glass locale key union. */
export type LiquidGlassLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en: Record<LiquidGlassLocaleKey, string> = {
  cardTitle: 'Liquid Glass',
  cardDescription: 'Glass theme toggle and wallpaper preference.',
  effectTitle: 'Liquid glass effect',
  effectDescription: 'Translucent glass surfaces, a refracting composer, and a scroll-synced wallpaper. The droplet button in the lower-right corner is a quick toggle for the same switch.',
  stateOn: 'On',
  stateOff: 'Off',
  presetTitle: 'Wallpaper',
  presetDescription: 'The backdrop the glass refracts. Long-press the droplet button to cycle presets.',
  presetRidge: 'Ridge line art',
  presetCollage: 'Gradient collage',
  presetCustom: 'Custom image',
  customTitle: 'Custom image',
  customDescription: 'Upload a local image as the wallpaper. It stays in this browser and never leaves your machine. Portrait images around 1920×2400 or larger work best.',
  upload: 'Upload image',
  veilTitle: 'Veil strength',
  veilDescription: 'The softening veil over the custom image that keeps text readable. Lower it for dark images in light mode.',
  clarityTitle: 'Clarity',
  clarityDescription: 'Tint of the glass surfaces. Higher is clearer; at 100 surfaces add no color over the wallpaper (hover, selection, and other interactive states keep a usable floor).',
}
