// Professional Enterprise Theme System for ClassBridge
// Built with Ant Design tokens and component overrides
// WCAG AA compliant, high-contrast, accessible design
// Enhanced with minimalist design principles and business-grade aesthetics

import { theme } from 'antd';

// Enhanced Brand Colors - Modern indigo-purple palette
const BRAND_PRIMARY = '#6366F1'; // Indigo-500 - Modern and vibrant
const BRAND_ACCENT = '#8B5CF6'; // Purple-500 - Beautiful accent
const BRAND_SECONDARY = '#10b981'; // Emerald-500 - Success actions
const LOGO_BG = '#5B21B6'; // Violet-800 - Deeper brand

// Enhanced Neutral Color Scale - Optimized for readability and hierarchy
const NEUTRALS = {
  N950: 'hsl(222, 20%, 6%)',   // Near-black base - Enhanced contrast
  N900: 'hsl(222, 20%, 10%)',  // Dark base - Better depth
  N800: 'hsl(222, 20%, 16%)',  // Container - Improved separation
  N700: 'hsl(222, 20%, 22%)',  // Elevated - Better hierarchy
  N600: 'hsl(222, 20%, 30%)',  // Border - Enhanced definition
  N500: 'hsl(222, 20%, 42%)',  // Secondary text - Better readability
  N400: 'hsl(222, 20%, 52%)',  // Tertiary text - Improved contrast
  N300: 'hsl(222, 20%, 68%)',  // Quaternary text - Better visibility
  N200: 'hsl(222, 20%, 82%)',  // Disabled - Enhanced accessibility
  N100: 'hsl(222, 20%, 90%)',  // Background - Softer appearance
  N50: 'hsl(222, 20%, 96%)',   // Light background - Cleaner base
  N25: 'hsl(222, 20%, 98%)',   // Ultra-light - Minimal contrast
};

// Enhanced Status Colors - Business-grade with improved accessibility
const STATUS_COLORS = {
  success: {
    primary: '#059669',    // Green-600 - More professional
    hover: '#047857',      // Green-700 - Better hover state
    active: '#065f46',     // Green-800 - Enhanced active state
    bg: 'hsl(160, 84%, 96%)', // Lighter background
    border: 'hsl(160, 84%, 88%)', // Softer border
    light: 'hsl(160, 84%, 92%)', // Light variant
  },
  warning: {
    primary: '#d97706',    // Amber-600 - More refined
    hover: '#b45309',      // Amber-700 - Better contrast
    active: '#92400e',     // Amber-800 - Enhanced active
    bg: 'hsl(43, 96%, 96%)', // Lighter background
    border: 'hsl(43, 96%, 88%)', // Softer border
    light: 'hsl(43, 96%, 92%)', // Light variant
  },
  error: {
    primary: '#dc2626',    // Red-600 - More professional
    hover: '#b91c1c',      // Red-700 - Better contrast
    active: '#991b1b',     // Red-800 - Enhanced active
    bg: 'hsl(0, 84%, 96%)', // Lighter background
    border: 'hsl(0, 84%, 88%)', // Softer border
    light: 'hsl(0, 84%, 92%)', // Light variant
  },
  info: {
    primary: '#2563eb',    // Blue-600 - More refined
    hover: '#1d4ed8',      // Blue-700 - Better contrast
    active: '#1e40af',     // Blue-800 - Enhanced active
    bg: 'hsl(217, 91%, 96%)', // Lighter background
    border: 'hsl(217, 91%, 88%)', // Softer border
    light: 'hsl(217, 91%, 92%)', // Light variant
  },
};

// Enhanced Data Visualization Palette - Professional color scheme
const DATA_VIZ_PALETTE = [
  '#6366F1', // Indigo-500 - Primary
  '#10b981', // Emerald-500 - Success
  '#f59e0b', // Amber-500 - Warning
  '#ef4444', // Red-500 - Error
  '#8B5CF6', // Purple-500 - Accent
  '#14b8a6', // Teal-500 - Teal
  '#f97316', // Orange-500 - Orange
  '#ec4899', // Pink-500 - Pink
  '#7C3AED', // Violet-600 - Secondary
  '#A78BFA', // Violet-400 - Light variant
];

// Enhanced spacing system for better visual hierarchy
const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 40,
  xxxxxl: 48,
};

// Enhanced border radius system for modern, clean appearance
const RADIUS = {
  none: 0,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  xxl: 16,
  full: 9999,
};

// Enhanced shadow system for depth and hierarchy
const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  lg: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  xl: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xxl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
};

// Enhanced Light Theme Tokens - Business-grade minimalist design
export const lightTheme = {
  algorithm: theme.defaultAlgorithm,
  token: {
    // Enhanced Brand Colors
    colorPrimary: BRAND_PRIMARY,
    colorPrimaryHover: '#7C3AED',
    colorPrimaryActive: '#5B21B6',
    colorPrimaryBg: 'hsl(244, 100%, 98%)',
    colorPrimaryBgHover: 'hsl(244, 100%, 96%)',
    colorPrimaryBorder: 'hsl(244, 90%, 92%)',
    colorPrimaryBorderHover: 'hsl(244, 90%, 88%)',

    // Enhanced Base Colors - Cleaner, more professional
    colorBgBase: NEUTRALS.N25,
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: NEUTRALS.N25,
    colorBgSpotlight: NEUTRALS.N900,
    colorBgMask: 'rgba(0, 0, 0, 0.45)',

    // Enhanced Text Colors - Better hierarchy and readability
    colorText: NEUTRALS.N900,
    colorTextSecondary: NEUTRALS.N500,
    colorTextTertiary: NEUTRALS.N400,
    colorTextQuaternary: NEUTRALS.N300,
    colorTextPlaceholder: NEUTRALS.N400,
    colorTextDisabled: NEUTRALS.N300,
    colorTextHeading: NEUTRALS.N950,

    // Enhanced Border Colors - Softer, more refined
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

    // Enhanced Typography - Refined for business-grade readability
    fontFamily: 'Geist Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 18,
    fontSizeHeading1: 28,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 18,
    fontSizeHeading5: 16,
    lineHeight: 1.6,
    lineHeightLG: 1.5,
    lineHeightSM: 1.7,
    fontWeight: 400,
    fontWeightStrong: 600,

    // Enhanced Border Radius - Modern, clean appearance
    borderRadius: RADIUS.md,
    borderRadiusLG: RADIUS.lg,
    borderRadiusSM: RADIUS.sm,
    borderRadiusXS: RADIUS.sm,

    // Enhanced Control Heights - Better touch targets
    controlHeight: 40,
    controlHeightLG: 44,
    controlHeightSM: 32,
    controlHeightXS: 28,

    // Enhanced Spacing - Consistent visual rhythm
    padding: SPACING.lg,
    paddingLG: SPACING.xxl,
    paddingSM: SPACING.md,
    paddingXS: SPACING.sm,
    paddingXXS: SPACING.xs,

    margin: SPACING.lg,
    marginLG: SPACING.xxl,
    marginSM: SPACING.md,
    marginXS: SPACING.sm,
    marginXXS: SPACING.xs,

    // Enhanced Shadows - Subtle depth and hierarchy
    boxShadow: SHADOWS.sm,
    boxShadowSecondary: SHADOWS.md,
    boxShadowTertiary: SHADOWS.lg,

    // Enhanced Focus - Better accessibility
    controlOutline: 'rgba(14, 165, 233, 0.2)',
    controlOutlineWidth: 2,

    // Enhanced Motion - Smooth, professional animations
    motionDurationFast: '0.15s',
    motionDurationMid: '0.25s',
    motionDurationSlow: '0.35s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0, 0, 0.2, 1)',
    motionEaseIn: 'cubic-bezier(0.4, 0, 1, 1)',
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

    // Enhanced Table Component - Clean, professional data display
    Table: {
      borderRadius: RADIUS.lg,
      headerBg: NEUTRALS.N25,
      headerColor: NEUTRALS.N600,
      headerSplitColor: NEUTRALS.N100,
      rowHoverBg: NEUTRALS.N25,
      rowSelectedBg: 'hsl(237, 100%, 98%)',
      rowSelectedHoverBg: 'hsl(237, 100%, 96%)',
      colorBgContainer: '#ffffff',
      colorBorderSecondary: NEUTRALS.N100,
      colorFillAlter: NEUTRALS.N25,
      colorFillContent: NEUTRALS.N50,
      colorFillTertiary: NEUTRALS.N25,
      colorFillQuaternary: NEUTRALS.N25,
      fontSize: 14,
      headerFontSize: 13,
      cellFontSize: 14,
      headerFontWeight: 600,
      cellPaddingBlock: SPACING.md,
      cellPaddingInline: SPACING.lg,
      headerPaddingBlock: SPACING.lg,
      headerPaddingInline: SPACING.lg,
      boxShadow: SHADOWS.sm,
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

    // Enhanced Card Component - Clean, minimalist design
    Card: {
      colorBgContainer: '#ffffff',
      colorBorderSecondary: NEUTRALS.N100,
      borderRadiusLG: RADIUS.lg,
      borderRadius: RADIUS.md,
      headerBg: 'transparent',
      headerFontSize: 18,
      headerFontSizeSM: 16,
      headerHeight: 56,
      headerHeightSM: 48,
      headerPadding: `${SPACING.lg}px ${SPACING.xxl}px`,
      headerPaddingSM: `${SPACING.md}px ${SPACING.lg}px`,
      bodyPadding: `${SPACING.xxl}px`,
      bodyPaddingLG: `${SPACING.xxxl}px`,
      bodyPaddingSM: `${SPACING.lg}px`,
      actionsBg: 'transparent',
      actionsLiMargin: `${SPACING.md}px 0`,
      tabsMarginBottom: -17,
      extraColor: NEUTRALS.N500,
      boxShadow: SHADOWS.sm,
      boxShadowSecondary: SHADOWS.md,
      boxShadowTertiary: SHADOWS.lg,
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

// Enhanced Dark Theme Tokens - True Black Theme
export const darkTheme = {
  algorithm: theme.darkAlgorithm,
  hashed: false,
  token: {
    // Enhanced Brand Colors
    colorPrimary: BRAND_PRIMARY,
    colorPrimaryHover: '#8B5CF6',
    colorPrimaryActive: '#A78BFA',
    colorPrimaryBg: 'hsl(244, 95%, 8%)',
    colorPrimaryBgHover: 'hsl(244, 95%, 10%)',
    colorPrimaryBorder: 'hsl(244, 95%, 18%)',
    colorPrimaryBorderHover: 'hsl(244, 95%, 24%)',

    // Enhanced Base Colors - True black theme with high contrast
    colorBgBase: '#000000',        // Pure black base
    colorBgContainer: '#0a0a0a',   // Near-black containers
    colorBgElevated: '#1a1a1a',    // Dark gray elevated elements
    colorBgLayout: '#000000',      // Pure black layout
    colorBgSpotlight: '#0a0a0a',   // Near-black spotlight
    colorBgMask: 'rgba(0, 0, 0, 0.8)',

    // Enhanced Text Colors - High contrast on black background
    colorText: '#ffffff',           // Pure white text
    colorTextSecondary: '#d1d5db',  // Light gray secondary
    colorTextTertiary: '#9ca3af',   // Medium gray tertiary
    colorTextQuaternary: '#6b7280', // Darker gray quaternary
    colorTextPlaceholder: '#6b7280', // Placeholder text
    colorTextDisabled: '#4b5563',   // Disabled text
    colorTextHeading: '#ffffff',    // Pure white headings

    // Border Colors - High contrast on black
    colorBorder: '#404040',         // Medium gray borders
    colorBorderSecondary: '#2a2a2a', // Darker borders
    colorSplit: '#2a2a2a',          // Split lines

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
    fontFamily: 'Geist Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
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
    controlOutline: 'rgba(14, 165, 233, 0.3)',
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

// Export enhanced design system
export const dataVizPalette = DATA_VIZ_PALETTE;
export const spacing = SPACING;
export const radius = RADIUS;
export const shadows = SHADOWS;
export const neutrals = NEUTRALS;
export const statusColors = STATUS_COLORS;

// Enhanced design tokens for consistent usage
export const designTokens = {
  colors: {
    primary: BRAND_PRIMARY,
    accent: BRAND_ACCENT,
    secondary: BRAND_SECONDARY,
    neutrals: NEUTRALS,
    status: STATUS_COLORS,
    dataViz: DATA_VIZ_PALETTE,
  },
  spacing: SPACING,
  radius: RADIUS,
  borderRadius: RADIUS, // Alias for compatibility
  shadows: SHADOWS,
  fontSize: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  typography: {
    fontFamily: 'Geist Sans, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontWeights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      tight: 1.4,
      normal: 1.6,
      relaxed: 1.7,
    },
  },
  breakpoints: {
    xs: '480px',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1600px',
  },
};

// Legacy support
export const antdTheme = lightTheme; 