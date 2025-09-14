// Professional Enterprise Theme System for ClassBridge
// Built with Ant Design tokens and component overrides
// WCAG AA compliant, high-contrast, accessible design

import { theme } from 'antd';

// Brand Colors
const BRAND_PRIMARY = '#6366f1'; // Indigo-500
const BRAND_ACCENT = '#8b5cf6'; // Purple-500
const LOGO_BG = '#4f46e5'; // Indigo-600

// Neutral Color Scale (HSL-based for better control)
const NEUTRALS = {
  N950: 'hsl(220, 15%, 8%)',   // Near-black base
  N900: 'hsl(220, 15%, 12%)',  // Dark base
  N800: 'hsl(220, 15%, 18%)',  // Container
  N700: 'hsl(220, 15%, 24%)',  // Elevated
  N600: 'hsl(220, 15%, 32%)',  // Border
  N500: 'hsl(220, 15%, 45%)',  // Secondary text
  N400: 'hsl(220, 15%, 55%)',  // Tertiary text
  N300: 'hsl(220, 15%, 70%)',  // Quaternary text
  N200: 'hsl(220, 15%, 85%)',  // Disabled
  N100: 'hsl(220, 15%, 92%)',  // Background
  N50: 'hsl(220, 15%, 96%)',   // Light background
};

// Status Colors (WCAG AA compliant)
const STATUS_COLORS = {
  success: {
    primary: '#10b981',    // Green-500
    hover: '#059669',      // Green-600
    active: '#047857',     // Green-700
    bg: 'hsl(160, 84%, 95%)',
    border: 'hsl(160, 84%, 90%)',
  },
  warning: {
    primary: '#f59e0b',    // Amber-500
    hover: '#d97706',      // Amber-600
    active: '#b45309',     // Amber-700
    bg: 'hsl(43, 96%, 95%)',
    border: 'hsl(43, 96%, 90%)',
  },
  error: {
    primary: '#ef4444',    // Red-500
    hover: '#dc2626',      // Red-600
    active: '#b91c1c',     // Red-700
    bg: 'hsl(0, 84%, 95%)',
    border: 'hsl(0, 84%, 90%)',
  },
  info: {
    primary: '#3b82f6',    // Blue-500
    hover: '#2563eb',      // Blue-600
    active: '#1d4ed8',     // Blue-700
    bg: 'hsl(217, 91%, 95%)',
    border: 'hsl(217, 91%, 90%)',
  },
};

// Data Visualization Palette (7-color categorical, WCAG AA compliant)
const DATA_VIZ_PALETTE = [
  '#6366f1', // Primary
  '#10b981', // Success
  '#f59e0b', // Warning
  '#ef4444', // Error
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

// Light Theme Tokens
export const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // Brand Colors
    colorPrimary: BRAND_PRIMARY,
    colorPrimaryHover: '#4f46e5',
    colorPrimaryActive: '#4338ca',
    colorPrimaryBg: 'hsl(237, 100%, 97%)',
    colorPrimaryBgHover: 'hsl(237, 100%, 94%)',
    colorPrimaryBorder: 'hsl(237, 100%, 90%)',
    colorPrimaryBorderHover: 'hsl(237, 100%, 85%)',

    // Base Colors
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgSpotlight: NEUTRALS.N900,
    colorBgMask: 'rgba(0, 0, 0, 0.45)',

    // Text Colors
    colorText: NEUTRALS.N900,
    colorTextSecondary: NEUTRALS.N600,
    colorTextTertiary: NEUTRALS.N500,
    colorTextQuaternary: NEUTRALS.N400,
    colorTextPlaceholder: NEUTRALS.N400,
    colorTextDisabled: NEUTRALS.N300,
    colorTextHeading: NEUTRALS.N900,

    // Border Colors
    colorBorder: NEUTRALS.N200,
    colorBorderSecondary: NEUTRALS.N100,
    colorSplit: NEUTRALS.N100,

    // Status Colors
    colorSuccess: STATUS_COLORS.success.primary,
    colorSuccessHover: STATUS_COLORS.success.hover,
    colorSuccessActive: STATUS_COLORS.success.active,
    colorSuccessBg: STATUS_COLORS.success.bg,
    colorSuccessBorder: STATUS_COLORS.success.border,

    colorWarning: STATUS_COLORS.warning.primary,
    colorWarningHover: STATUS_COLORS.warning.hover,
    colorWarningActive: STATUS_COLORS.warning.active,
    colorWarningBg: STATUS_COLORS.warning.bg,
    colorWarningBorder: STATUS_COLORS.warning.border,

    colorError: STATUS_COLORS.error.primary,
    colorErrorHover: STATUS_COLORS.error.hover,
    colorErrorActive: STATUS_COLORS.error.active,
    colorErrorBg: STATUS_COLORS.error.bg,
    colorErrorBorder: STATUS_COLORS.error.border,

    colorInfo: STATUS_COLORS.info.primary,
    colorInfoHover: STATUS_COLORS.info.hover,
    colorInfoActive: STATUS_COLORS.info.active,
    colorInfoBg: STATUS_COLORS.info.bg,
    colorInfoBorder: STATUS_COLORS.info.border,

    // Typography - Consistent sizing
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 18,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    lineHeight: 1.5,
    lineHeightLG: 1.4,
    lineHeightSM: 1.6,

    // Border Radius
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // Control Heights
    controlHeight: 36,
    controlHeightLG: 40,
    controlHeightSM: 28,
    controlHeightXS: 24,

    // Spacing
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,

    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,

    // Shadows
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    boxShadowTertiary: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',

    // Focus
    controlOutline: 'rgba(99, 102, 241, 0.2)',
    controlOutlineWidth: 2,

    // Motion
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    motionEaseOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    motionEaseIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  },

  components: {
    // Button Component
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      controlHeightLG: 36,
      controlHeightSM: 28,
      fontWeight: 500,
      fontSize: 13,
      fontSizeLG: 14,
      fontSizeSM: 12,
      primaryShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
      defaultShadow: '0 2px 0 rgba(0, 0, 0, 0.015)',
      dangerShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
      primaryColor: '#ffffff',
      defaultColor: NEUTRALS.N900,
      dangerColor: '#ffffff',
      defaultBg: '#ffffff',
      defaultBorderColor: NEUTRALS.N200,
      defaultHoverColor: BRAND_PRIMARY,
      defaultHoverBg: '#ffffff',
      defaultHoverBorderColor: BRAND_PRIMARY,
      defaultActiveColor: BRAND_PRIMARY,
      defaultActiveBg: '#ffffff',
      defaultActiveBorderColor: BRAND_PRIMARY,
    },

    // Input Component
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 40,
      controlHeightSM: 28,
      colorBgContainer: '#ffffff',
      colorBorder: NEUTRALS.N200,
      colorBorderHover: BRAND_PRIMARY,
      colorBorderFocus: BRAND_PRIMARY,
      colorTextPlaceholder: NEUTRALS.N400,
      colorTextDisabled: NEUTRALS.N300,
      colorBgContainerDisabled: NEUTRALS.N50,
      paddingInline: 12,
      paddingInlineLG: 12,
      paddingInlineSM: 8,
    },

    // Select Component
    Select: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 40,
      controlHeightSM: 28,
      colorBgContainer: '#ffffff',
      colorBorder: NEUTRALS.N200,
      colorBorderHover: BRAND_PRIMARY,
      colorBorderFocus: BRAND_PRIMARY,
      colorTextPlaceholder: NEUTRALS.N400,
      colorTextDisabled: NEUTRALS.N300,
      colorBgContainerDisabled: NEUTRALS.N50,
      optionSelectedBg: BRAND_PRIMARY,
      optionActiveBg: NEUTRALS.N50,
      optionSelectedColor: '#ffffff',
      colorBgElevated: '#ffffff',
      colorText: NEUTRALS.N900,
    },

    // Table Component
    Table: {
      borderRadius: 8,
      headerBg: NEUTRALS.N50,
      headerColor: NEUTRALS.N700,
      headerSplitColor: NEUTRALS.N200,
      rowHoverBg: NEUTRALS.N50,
      rowSelectedBg: 'hsl(237, 100%, 97%)',
      rowSelectedHoverBg: 'hsl(237, 100%, 94%)',
      colorBgContainer: '#ffffff',
      colorBorderSecondary: NEUTRALS.N100,
      colorFillAlter: NEUTRALS.N50,
      colorFillContent: NEUTRALS.N100,
      colorFillTertiary: NEUTRALS.N50,
      colorFillQuaternary: NEUTRALS.N50,
      fontSize: 13,
      headerFontSize: 13,
      cellFontSize: 13,
    },

    // Tabs Component
    Tabs: {
      cardBg: '#ffffff',
      cardHeight: 40,
      cardGutter: 8,
      cardPadding: '8px 16px',
      titleFontSize: 14,
      titleFontSizeLG: 16,
      titleFontSizeSM: 14,
      inkBarColor: BRAND_PRIMARY,
      itemSelectedColor: BRAND_PRIMARY,
      itemHoverColor: BRAND_PRIMARY,
      itemActiveColor: BRAND_PRIMARY,
      itemColor: NEUTRALS.N600,
      cardColor: NEUTRALS.N600,
      cardActiveTabBorderSize: 2,
    },

    // Menu Component
    Menu: {
      colorBgContainer: '#ffffff',
      itemBg: 'transparent',
      itemSelectedBg: BRAND_PRIMARY,
      itemHoverBg: NEUTRALS.N50,
      itemColor: NEUTRALS.N700,
      itemSelectedColor: '#ffffff',
      itemHoverColor: NEUTRALS.N900,
      subMenuItemBg: 'transparent',
      subMenuItemHoverBg: NEUTRALS.N50,
      subMenuItemSelectedBg: BRAND_PRIMARY,
      subMenuItemColor: NEUTRALS.N600,
      subMenuItemHoverColor: NEUTRALS.N900,
      subMenuItemSelectedColor: '#ffffff',
      groupTitleColor: NEUTRALS.N500,
      colorDivider: NEUTRALS.N100,
      borderRadius: 6,
      itemBorderRadius: 6,
      subMenuItemBorderRadius: 6,
      horizontalItemBorderRadius: 6,
      horizontalItemSelectedBg: BRAND_PRIMARY,
      horizontalItemSelectedColor: '#ffffff',
    },

    // Modal Component
    Modal: {
      colorBgElevated: '#ffffff',
      colorIcon: NEUTRALS.N400,
      colorIconHover: NEUTRALS.N600,
      colorText: NEUTRALS.N900,
      colorTextHeading: NEUTRALS.N900,
      borderRadiusLG: 8,
      headerBg: '#ffffff',
      contentBg: '#ffffff',
      footerBg: '#ffffff',
      headerPadding: '16px 24px',
      bodyPadding: '24px',
      footerPadding: '16px 24px',
    },

    // Drawer Component
    Drawer: {
      colorBgElevated: '#ffffff',
      colorIcon: NEUTRALS.N400,
      colorIconHover: NEUTRALS.N600,
      colorText: NEUTRALS.N900,
      colorTextHeading: NEUTRALS.N900,
      headerBg: '#ffffff',
      bodyBg: '#ffffff',
      footerBg: '#ffffff',
      headerPadding: '16px 24px',
      bodyPadding: '24px',
      footerPadding: '16px 24px',
    },

    // Card Component
    Card: {
      colorBgContainer: '#ffffff',
      colorBorderSecondary: NEUTRALS.N100,
      borderRadiusLG: 8,
      headerBg: 'transparent',
      headerFontSize: 16,
      headerFontSizeSM: 14,
      headerHeight: 48,
      headerHeightSM: 40,
      headerPadding: '16px 24px',
      headerPaddingSM: '12px 16px',
      bodyPadding: '24px',
      bodyPaddingLG: '32px',
      bodyPaddingSM: '16px',
      actionsBg: 'transparent',
      actionsLiMargin: '12px 0',
      tabsMarginBottom: -17,
      extraColor: NEUTRALS.N600,
    },

    // Alert Component
    Alert: {
      borderRadius: 6,
      colorSuccessBg: STATUS_COLORS.success.bg,
      colorSuccessBorder: STATUS_COLORS.success.border,
      colorWarningBg: STATUS_COLORS.warning.bg,
      colorWarningBorder: STATUS_COLORS.warning.border,
      colorErrorBg: STATUS_COLORS.error.bg,
      colorErrorBorder: STATUS_COLORS.error.border,
      colorInfoBg: STATUS_COLORS.info.bg,
      colorInfoBorder: STATUS_COLORS.info.border,
      colorSuccessIcon: STATUS_COLORS.success.primary,
      colorWarningIcon: STATUS_COLORS.warning.primary,
      colorErrorIcon: STATUS_COLORS.error.primary,
      colorInfoIcon: STATUS_COLORS.info.primary,
    },

    // Tag Component
    Tag: {
      borderRadiusSM: 4,
      colorBgContainer: NEUTRALS.N100,
      colorBorder: NEUTRALS.N200,
      colorText: NEUTRALS.N700,
      colorTextLightSolid: '#ffffff',
      colorSuccessBg: STATUS_COLORS.success.bg,
      colorSuccessBorder: STATUS_COLORS.success.border,
      colorSuccessHover: STATUS_COLORS.success.hover,
      colorWarningBg: STATUS_COLORS.warning.bg,
      colorWarningBorder: STATUS_COLORS.warning.border,
      colorWarningHover: STATUS_COLORS.warning.hover,
      colorErrorBg: STATUS_COLORS.error.bg,
      colorErrorBorder: STATUS_COLORS.error.border,
      colorErrorHover: STATUS_COLORS.error.hover,
      colorInfoBg: STATUS_COLORS.info.bg,
      colorInfoBorder: STATUS_COLORS.info.border,
      colorInfoHover: STATUS_COLORS.info.hover,
    },

    // Badge Component
    Badge: {
      colorBgContainer: '#ffffff',
      colorError: STATUS_COLORS.error.primary,
      colorSuccess: STATUS_COLORS.success.primary,
      colorWarning: STATUS_COLORS.warning.primary,
      colorInfo: STATUS_COLORS.info.primary,
      colorTextLightSolid: '#ffffff',
      colorText: NEUTRALS.N900,
      borderRadius: 10,
      fontSize: 12,
      fontSizeSM: 12,
      height: 20,
      heightSM: 16,
      dotSize: 8,
      dotSizeSM: 6,
    },

    // Tooltip Component
    Tooltip: {
      colorBgSpotlight: NEUTRALS.N900,
      colorTextLightSolid: '#ffffff',
      borderRadius: 6,
      fontSize: 14,
      lineHeight: 1.5715,
      maxWidth: 250,
      padding: 8,
      paddingXS: 4,
      paddingSM: 8,
      paddingLG: 12,
    },

    // Popover Component
    Popover: {
      colorBgElevated: '#ffffff',
      colorText: NEUTRALS.N900,
      colorTextHeading: NEUTRALS.N900,
      borderRadiusLG: 8,
      boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
    },

    // Message Component
    Message: {
      colorBgElevated: '#ffffff',
      colorText: NEUTRALS.N900,
      colorTextHeading: NEUTRALS.N900,
      borderRadiusLG: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
    },

    // Notification Component
    Notification: {
      colorBgElevated: '#ffffff',
      colorText: NEUTRALS.N900,
      colorTextHeading: NEUTRALS.N900,
      borderRadiusLG: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
    },
  },
};

// Dark Theme Tokens
export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    // Brand Colors
    colorPrimary: BRAND_PRIMARY,
    colorPrimaryHover: '#818cf8',
    colorPrimaryActive: '#a5b4fc',
    colorPrimaryBg: 'hsl(237, 100%, 8%)',
    colorPrimaryBgHover: 'hsl(237, 100%, 12%)',
    colorPrimaryBorder: 'hsl(237, 100%, 20%)',
    colorPrimaryBorderHover: 'hsl(237, 100%, 25%)',

    // Base Colors
    colorBgBase: NEUTRALS.N950,
    colorBgContainer: NEUTRALS.N900,
    colorBgElevated: NEUTRALS.N800,
    colorBgSpotlight: NEUTRALS.N900,
    colorBgMask: 'rgba(0, 0, 0, 0.65)',

    // Text Colors
    colorText: NEUTRALS.N50,
    colorTextSecondary: NEUTRALS.N300,
    colorTextTertiary: NEUTRALS.N400,
    colorTextQuaternary: NEUTRALS.N500,
    colorTextPlaceholder: NEUTRALS.N500,
    colorTextDisabled: NEUTRALS.N600,
    colorTextHeading: NEUTRALS.N50,

    // Border Colors
    colorBorder: NEUTRALS.N700,
    colorBorderSecondary: NEUTRALS.N800,
    colorSplit: NEUTRALS.N800,

    // Status Colors (adjusted for dark)
    colorSuccess: '#22c55e',
    colorSuccessHover: '#4ade80',
    colorSuccessActive: '#16a34a',
    colorSuccessBg: 'hsl(160, 84%, 8%)',
    colorSuccessBorder: 'hsl(160, 84%, 15%)',

    colorWarning: '#fbbf24',
    colorWarningHover: '#fcd34d',
    colorWarningActive: '#f59e0b',
    colorWarningBg: 'hsl(43, 96%, 8%)',
    colorWarningBorder: 'hsl(43, 96%, 15%)',

    colorError: '#f87171',
    colorErrorHover: '#fca5a5',
    colorErrorActive: '#ef4444',
    colorErrorBg: 'hsl(0, 84%, 8%)',
    colorErrorBorder: 'hsl(0, 84%, 15%)',

    colorInfo: '#60a5fa',
    colorInfoHover: '#93c5fd',
    colorInfoActive: '#3b82f6',
    colorInfoBg: 'hsl(217, 91%, 8%)',
    colorInfoBorder: 'hsl(217, 91%, 15%)',

    // Typography - Consistent sizing
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 18,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    lineHeight: 1.5,
    lineHeightLG: 1.4,
    lineHeightSM: 1.6,

    // Border Radius
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    borderRadiusXS: 2,

    // Control Heights
    controlHeight: 36,
    controlHeightLG: 40,
    controlHeightSM: 28,
    controlHeightXS: 24,

    // Spacing
    padding: 16,
    paddingLG: 24,
    paddingSM: 12,
    paddingXS: 8,
    paddingXXS: 4,

    margin: 16,
    marginLG: 24,
    marginSM: 12,
    marginXS: 8,
    marginXXS: 4,

    // Shadows (adjusted for dark)
    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    boxShadowSecondary: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    boxShadowTertiary: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',

    // Focus
    controlOutline: 'rgba(99, 102, 241, 0.3)',
    controlOutlineWidth: 2,

    // Motion
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionDurationSlow: '0.3s',
    motionEaseInOut: 'cubic-bezier(0.645, 0.045, 0.355, 1)',
    motionEaseOut: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
    motionEaseIn: 'cubic-bezier(0.55, 0.055, 0.675, 0.19)',
  },

  components: {
    // Button Component
    Button: {
      borderRadius: 6,
      controlHeight: 32,
      controlHeightLG: 36,
      controlHeightSM: 28,
      fontWeight: 500,
      fontSize: 13,
      fontSizeLG: 14,
      fontSizeSM: 12,
      primaryShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
      defaultShadow: '0 2px 0 rgba(0, 0, 0, 0.015)',
      dangerShadow: '0 2px 0 rgba(0, 0, 0, 0.045)',
      primaryColor: '#ffffff',
      defaultColor: NEUTRALS.N50,
      dangerColor: '#ffffff',
      defaultBg: NEUTRALS.N800,
      defaultBorderColor: NEUTRALS.N700,
      defaultHoverColor: BRAND_PRIMARY,
      defaultHoverBg: NEUTRALS.N800,
      defaultHoverBorderColor: BRAND_PRIMARY,
      defaultActiveColor: BRAND_PRIMARY,
      defaultActiveBg: NEUTRALS.N800,
      defaultActiveBorderColor: BRAND_PRIMARY,
    },

    // Input Component
    Input: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 40,
      controlHeightSM: 28,
      colorBgContainer: NEUTRALS.N800,
      colorBorder: NEUTRALS.N700,
      colorBorderHover: BRAND_PRIMARY,
      colorBorderFocus: BRAND_PRIMARY,
      colorTextPlaceholder: NEUTRALS.N500,
      colorTextDisabled: NEUTRALS.N600,
      colorBgContainerDisabled: NEUTRALS.N900,
      paddingInline: 12,
      paddingInlineLG: 12,
      paddingInlineSM: 8,
    },

    // Select Component
    Select: {
      borderRadius: 6,
      controlHeight: 36,
      controlHeightLG: 40,
      controlHeightSM: 28,
      colorBgContainer: NEUTRALS.N800,
      colorBorder: NEUTRALS.N700,
      colorBorderHover: BRAND_PRIMARY,
      colorBorderFocus: BRAND_PRIMARY,
      colorTextPlaceholder: NEUTRALS.N500,
      colorTextDisabled: NEUTRALS.N600,
      colorBgContainerDisabled: NEUTRALS.N900,
      optionSelectedBg: BRAND_PRIMARY,
      optionActiveBg: NEUTRALS.N700,
      optionSelectedColor: '#ffffff',
      colorBgElevated: NEUTRALS.N800,
      colorText: NEUTRALS.N50,
    },

    // Table Component
    Table: {
      borderRadius: 8,
      headerBg: NEUTRALS.N800,
      headerColor: NEUTRALS.N200,
      headerSplitColor: NEUTRALS.N700,
      rowHoverBg: NEUTRALS.N800,
      rowSelectedBg: 'hsl(237, 100%, 8%)',
      rowSelectedHoverBg: 'hsl(237, 100%, 12%)',
      colorBgContainer: NEUTRALS.N900,
      colorBorderSecondary: NEUTRALS.N800,
      colorFillAlter: NEUTRALS.N800,
      colorFillContent: NEUTRALS.N800,
      colorFillTertiary: NEUTRALS.N800,
      colorFillQuaternary: NEUTRALS.N800,
      fontSize: 13,
      headerFontSize: 13,
      cellFontSize: 13,
    },

    // Tabs Component
    Tabs: {
      cardBg: NEUTRALS.N900,
      cardHeight: 40,
      cardGutter: 8,
      cardPadding: '8px 16px',
      titleFontSize: 14,
      titleFontSizeLG: 16,
      titleFontSizeSM: 14,
      inkBarColor: BRAND_PRIMARY,
      itemSelectedColor: BRAND_PRIMARY,
      itemHoverColor: BRAND_PRIMARY,
      itemActiveColor: BRAND_PRIMARY,
      itemColor: NEUTRALS.N400,
      cardColor: NEUTRALS.N400,
      cardActiveTabBorderSize: 2,
    },

    // Menu Component
    Menu: {
      colorBgContainer: NEUTRALS.N900,
      itemBg: 'transparent',
      itemSelectedBg: BRAND_PRIMARY,
      itemHoverBg: NEUTRALS.N800,
      itemColor: NEUTRALS.N300,
      itemSelectedColor: '#ffffff',
      itemHoverColor: NEUTRALS.N50,
      subMenuItemBg: 'transparent',
      subMenuItemHoverBg: NEUTRALS.N800,
      subMenuItemSelectedBg: BRAND_PRIMARY,
      subMenuItemColor: NEUTRALS.N400,
      subMenuItemHoverColor: NEUTRALS.N50,
      subMenuItemSelectedColor: '#ffffff',
      groupTitleColor: NEUTRALS.N500,
      colorDivider: NEUTRALS.N800,
      borderRadius: 6,
      itemBorderRadius: 6,
      subMenuItemBorderRadius: 6,
      horizontalItemBorderRadius: 6,
      horizontalItemSelectedBg: BRAND_PRIMARY,
      horizontalItemSelectedColor: '#ffffff',
    },

    // Modal Component
    Modal: {
      colorBgElevated: NEUTRALS.N800,
      colorIcon: NEUTRALS.N500,
      colorIconHover: NEUTRALS.N300,
      colorText: NEUTRALS.N50,
      colorTextHeading: NEUTRALS.N50,
      borderRadiusLG: 8,
      headerBg: NEUTRALS.N800,
      contentBg: NEUTRALS.N800,
      footerBg: NEUTRALS.N800,
      headerPadding: '16px 24px',
      bodyPadding: '24px',
      footerPadding: '16px 24px',
    },

    // Drawer Component
    Drawer: {
      colorBgElevated: NEUTRALS.N800,
      colorIcon: NEUTRALS.N500,
      colorIconHover: NEUTRALS.N300,
      colorText: NEUTRALS.N50,
      colorTextHeading: NEUTRALS.N50,
      headerBg: NEUTRALS.N800,
      bodyBg: NEUTRALS.N800,
      footerBg: NEUTRALS.N800,
      headerPadding: '16px 24px',
      bodyPadding: '24px',
      footerPadding: '16px 24px',
    },

    // Card Component
    Card: {
      colorBgContainer: NEUTRALS.N900,
      colorBorderSecondary: NEUTRALS.N800,
      borderRadiusLG: 8,
      headerBg: 'transparent',
      headerFontSize: 16,
      headerFontSizeSM: 14,
      headerHeight: 48,
      headerHeightSM: 40,
      headerPadding: '16px 24px',
      headerPaddingSM: '12px 16px',
      bodyPadding: '24px',
      bodyPaddingLG: '32px',
      bodyPaddingSM: '16px',
      actionsBg: 'transparent',
      actionsLiMargin: '12px 0',
      tabsMarginBottom: -17,
      extraColor: NEUTRALS.N400,
    },

    // Alert Component
    Alert: {
      borderRadius: 6,
      colorSuccessBg: 'hsl(160, 84%, 8%)',
      colorSuccessBorder: 'hsl(160, 84%, 15%)',
      colorWarningBg: 'hsl(43, 96%, 8%)',
      colorWarningBorder: 'hsl(43, 96%, 15%)',
      colorErrorBg: 'hsl(0, 84%, 8%)',
      colorErrorBorder: 'hsl(0, 84%, 15%)',
      colorInfoBg: 'hsl(217, 91%, 8%)',
      colorInfoBorder: 'hsl(217, 91%, 15%)',
      colorSuccessIcon: '#22c55e',
      colorWarningIcon: '#fbbf24',
      colorErrorIcon: '#f87171',
      colorInfoIcon: '#60a5fa',
    },

    // Tag Component
    Tag: {
      borderRadiusSM: 4,
      colorBgContainer: NEUTRALS.N800,
      colorBorder: NEUTRALS.N700,
      colorText: NEUTRALS.N200,
      colorTextLightSolid: '#ffffff',
      colorSuccessBg: 'hsl(160, 84%, 8%)',
      colorSuccessBorder: 'hsl(160, 84%, 15%)',
      colorSuccessHover: '#4ade80',
      colorWarningBg: 'hsl(43, 96%, 8%)',
      colorWarningBorder: 'hsl(43, 96%, 15%)',
      colorWarningHover: '#fcd34d',
      colorErrorBg: 'hsl(0, 84%, 8%)',
      colorErrorBorder: 'hsl(0, 84%, 15%)',
      colorErrorHover: '#fca5a5',
      colorInfoBg: 'hsl(217, 91%, 8%)',
      colorInfoBorder: 'hsl(217, 91%, 15%)',
      colorInfoHover: '#93c5fd',
    },

    // Badge Component
    Badge: {
      colorBgContainer: NEUTRALS.N900,
      colorError: '#f87171',
      colorSuccess: '#22c55e',
      colorWarning: '#fbbf24',
      colorInfo: '#60a5fa',
      colorTextLightSolid: '#ffffff',
      colorText: NEUTRALS.N50,
      borderRadius: 10,
      fontSize: 12,
      fontSizeSM: 12,
      height: 20,
      heightSM: 16,
      dotSize: 8,
      dotSizeSM: 6,
    },

    // Tooltip Component
    Tooltip: {
      colorBgSpotlight: NEUTRALS.N50,
      colorTextLightSolid: NEUTRALS.N900,
      borderRadius: 6,
      fontSize: 14,
      lineHeight: 1.5715,
      maxWidth: 250,
      padding: 8,
      paddingXS: 4,
      paddingSM: 8,
      paddingLG: 12,
    },

    // Popover Component
    Popover: {
      colorBgElevated: NEUTRALS.N800,
      colorText: NEUTRALS.N50,
      colorTextHeading: NEUTRALS.N50,
      borderRadiusLG: 8,
      boxShadowSecondary: '0 6px 16px 0 rgba(0, 0, 0, 0.4), 0 3px 6px -4px rgba(0, 0, 0, 0.5), 0 9px 28px 8px rgba(0, 0, 0, 0.3)',
    },

    // Message Component
    Message: {
      colorBgElevated: NEUTRALS.N800,
      colorText: NEUTRALS.N50,
      colorTextHeading: NEUTRALS.N50,
      borderRadiusLG: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.4), 0 3px 6px -4px rgba(0, 0, 0, 0.5), 0 9px 28px 8px rgba(0, 0, 0, 0.3)',
    },

    // Notification Component
    Notification: {
      colorBgElevated: NEUTRALS.N800,
      colorText: NEUTRALS.N50,
      colorTextHeading: NEUTRALS.N50,
      borderRadiusLG: 8,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.4), 0 3px 6px -4px rgba(0, 0, 0, 0.5), 0 9px 28px 8px rgba(0, 0, 0, 0.3)',
    },
  },
};

// Export data visualization palette
export const dataVizPalette = DATA_VIZ_PALETTE;

// Legacy support
export const antdTheme = lightTheme; 