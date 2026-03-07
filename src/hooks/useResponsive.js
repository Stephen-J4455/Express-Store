import { useWindowDimensions } from "react-native";

/**
 * Breakpoints (CSS-style):
 *   mobile:  width < 768
 *   tablet:  768 <= width < 1024
 *   desktop: width >= 1024
 */
const BREAKPOINTS = { tablet: 768, desktop: 1024 };

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();

  const isMobile = width < BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isWide = width >= BREAKPOINTS.tablet; // tablet OR desktop

  // Product grid columns (2 / 3 / 4 based on screen size)
  const gridColumns = isDesktop ? 4 : isTablet ? 3 : 2;

  // Card grid columns for non-product cards (orders, stats, etc.)
  const cardColumns = isDesktop ? 3 : isTablet ? 2 : 1;

  // Content max-width (centred on very wide screens)
  const contentMaxWidth = isDesktop ? 1200 : isTablet ? 900 : width;

  // Sidebar width for wide screens
  const sidebarWidth = isDesktop ? 260 : isTablet ? 220 : 0;

  // Horizontal padding that scales with screen
  const horizontalPadding = isDesktop ? 32 : isTablet ? 24 : 16;

  const getItemWidth = (
    cols,
    hPad = horizontalPadding,
    gap = 8,
    containerWidth = width,
  ) => Math.floor((containerWidth - hPad * 2 - gap * (cols - 1)) / cols);

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    gridColumns,
    cardColumns,
    getItemWidth,
    contentMaxWidth,
    sidebarWidth,
    horizontalPadding,
    breakpoints: BREAKPOINTS,
  };
};
