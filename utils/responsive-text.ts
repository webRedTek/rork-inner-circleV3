import { Dimensions, PixelRatio } from 'react-native';

// Get screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Base dimensions (iPhone 13 Pro as reference)
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

// Calculate scale factors
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;
const scale = Math.min(widthScale, heightScale);

// Device type detection
export const getDeviceType = () => {
  const aspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
  
  if (SCREEN_WIDTH >= 768) {
    return 'tablet';
  } else if (SCREEN_WIDTH >= 428) {
    return 'large-phone';
  } else {
    return 'phone';
  }
};

// Responsive font size function
export const responsiveFont = (size: number): number => {
  const deviceType = getDeviceType();
  
  // Different scaling factors for different device types
  let scaleFactor: number;
  
  switch (deviceType) {
    case 'tablet':
      // For tablets, scale fonts more aggressively for better readability
      scaleFactor = Math.min(scale * 1.3, 2.0); // Cap at 2x for very large tablets
      break;
    case 'large-phone':
      scaleFactor = Math.min(scale * 1.1, 1.4); // Slight increase for large phones
      break;
    default:
      scaleFactor = scale;
  }
  
  const newSize = size * scaleFactor;
  
  // Apply pixel ratio for crisp text
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Responsive spacing function
export const responsiveSpacing = (size: number): number => {
  const deviceType = getDeviceType();
  
  let scaleFactor: number;
  
  switch (deviceType) {
    case 'tablet':
      scaleFactor = Math.min(scale * 1.2, 1.8);
      break;
    case 'large-phone':
      scaleFactor = Math.min(scale * 1.1, 1.3);
      break;
    default:
      scaleFactor = scale;
  }
  
  return Math.round(PixelRatio.roundToNearestPixel(size * scaleFactor));
};

// Predefined text styles for consistency
export const textStyles = {
  h1: {
    fontSize: responsiveFont(28),
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: responsiveFont(24),
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: responsiveFont(20),
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: responsiveFont(18),
    fontWeight: '500' as const,
  },
  body: {
    fontSize: responsiveFont(16),
    fontWeight: '400' as const,
  },
  bodySmall: {
    fontSize: responsiveFont(14),
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: responsiveFont(12),
    fontWeight: '400' as const,
  },
  button: {
    fontSize: responsiveFont(16),
    fontWeight: '500' as const,
  },
  buttonSmall: {
    fontSize: responsiveFont(14),
    fontWeight: '500' as const,
  },
  buttonLarge: {
    fontSize: responsiveFont(18),
    fontWeight: '500' as const,
  },
};

// Debug info (useful for development)
export const getDeviceInfo = () => ({
  screenWidth: SCREEN_WIDTH,
  screenHeight: SCREEN_HEIGHT,
  deviceType: getDeviceType(),
  scale,
  widthScale,
  heightScale,
  pixelRatio: PixelRatio.get(),
}); 