/* The package's single CSS Module with its class names spelled out: dot access
 * then yields defined strings under noUncheckedIndexedAccess, and a renamed or
 * removed class fails the typecheck instead of styling nothing at runtime. */
declare module '*/glass.module.css' {
  interface GlassModuleClasses {
    readonly wallpaperHost: string
    readonly wallpaper: string
    readonly outgoing: string
    readonly outgoingFade: string
    readonly ridge: string
    readonly coast: string
    readonly garden: string
    readonly arch: string
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
    readonly settingsSlider: string
    readonly settingsSliderValue: string
    readonly gallery: string
    readonly galleryTile: string
    readonly gallerySelected: string
    readonly galleryCaption: string
    readonly galleryThumb: string
    readonly galleryDelete: string
    readonly galleryConfirm: string
    readonly galleryConfirmCancel: string
    readonly galleryConfirmOk: string
    readonly galleryAdd: string
    readonly galleryAddMark: string
    readonly tuning: string
    readonly tuningTitle: string
    readonly tuningRow: string
    readonly tuningLabel: string
    readonly tuningLooks: string
    readonly tuningLook: string
    readonly tuningSwitches: string
    readonly tuningSwitch: string
  }
  const classes: GlassModuleClasses
  export default classes
}

declare module '*.css'
