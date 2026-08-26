/* The package's single CSS Module with its class names spelled out: dot access
 * then yields defined strings under noUncheckedIndexedAccess, and a renamed or
 * removed class fails the typecheck instead of styling nothing at runtime. */
declare module '*/glass.module.css' {
  interface GlassModuleClasses {
    readonly wallpaperHost: string
    readonly wallpaper: string
    readonly ridge: string
    readonly collage: string
    readonly custom: string
    readonly dock: string
    readonly dockOff: string
    readonly card: string
    readonly cardHeader: string
    readonly cardHeadText: string
    readonly cardTitle: string
    readonly cardDescription: string
    readonly cardBody: string
    readonly settingsRow: string
    readonly settingsRowText: string
    readonly settingsRowTitle: string
    readonly settingsRowDesc: string
    readonly settingsToggle: string
    readonly settingsSelector: string
    readonly settingsSliderGroup: string
    readonly settingsSlider: string
    readonly settingsSliderValue: string
  }
  const classes: GlassModuleClasses
  export default classes
}

declare module '*.css'
