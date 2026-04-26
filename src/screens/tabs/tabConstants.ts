import { Dimensions } from 'react-native';

export const SCREEN_WIDTH = Dimensions.get('window').width;

/** Card «Trường nổi bật» — scroll ngang */
export const FEATURED_CARD_WIDTH = SCREEN_WIDTH * 0.88;

export const sp = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const MaterialIcons = require('@expo/vector-icons').MaterialIcons;
