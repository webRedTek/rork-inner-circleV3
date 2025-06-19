import React, { ReactNode } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View
} from 'react-native';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

interface ButtonProps {
  title?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  error?: boolean;
  success?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: ReactNode;
  leftIcon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  error = false,
  success = false,
  style,
  textStyle,
  icon,
  leftIcon,
  iconPosition = 'left'
}) => {
  // Use leftIcon as fallback if icon is not provided
  const iconToUse = icon || leftIcon;
  
  const handlePress = () => {
    if (!disabled && !loading) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onPress();
    }
  };
  
  const getButtonStyle = () => {
    let buttonStyle: ViewStyle = {};
    
    // Variant styles
    switch (variant) {
      case 'primary':
        buttonStyle = {
          backgroundColor: Colors.dark.primary,
        };
        break;
      case 'secondary':
        buttonStyle = {
          backgroundColor: Colors.dark.card,
        };
        break;
      case 'outline':
        buttonStyle = {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: Colors.dark.accent,
        };
        break;
      case 'danger':
        buttonStyle = {
          backgroundColor: Colors.dark.error,
        };
        break;
      case 'ghost':
        buttonStyle = {
          backgroundColor: 'transparent',
        };
        break;
    }
    
    // Size styles
    switch (size) {
      case 'small':
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: 8,
          paddingHorizontal: 16,
        };
        break;
      case 'medium':
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: 12,
          paddingHorizontal: 24,
        };
        break;
      case 'large':
        buttonStyle = {
          ...buttonStyle,
          paddingVertical: 16,
          paddingHorizontal: 32,
        };
        break;
    }
    
    // State styles
    if (disabled) {
      buttonStyle = {
        ...buttonStyle,
        opacity: 0.5,
      };
    } else if (error) {
      buttonStyle = {
        ...buttonStyle,
        borderColor: Colors.dark.error,
        backgroundColor: variant === 'outline' || variant === 'ghost' ? 'transparent' : 'rgba(255, 69, 58, 0.2)',
      };
    } else if (success) {
      buttonStyle = {
        ...buttonStyle,
        borderColor: Colors.dark.success,
        backgroundColor: variant === 'outline' || variant === 'ghost' ? 'transparent' : 'rgba(75, 181, 67, 0.2)',
      };
    }
    
    return buttonStyle;
  };
  
  const getTextStyle = () => {
    let textStyleObj: TextStyle = {};
    
    switch (variant) {
      case 'primary':
      case 'secondary':
      case 'danger':
        textStyleObj = {
          color: Colors.dark.text,
        };
        break;
      case 'outline':
      case 'ghost':
        textStyleObj = {
          color: Colors.dark.accent,
        };
        break;
    }
    
    switch (size) {
      case 'small':
        textStyleObj = {
          ...textStyleObj,
          fontSize: 14,
        };
        break;
      case 'medium':
        textStyleObj = {
          ...textStyleObj,
          fontSize: 16,
        };
        break;
      case 'large':
        textStyleObj = {
          ...textStyleObj,
          fontSize: 18,
        };
        break;
    }
    
    if (error) {
      textStyleObj = {
        ...textStyleObj,
        color: Colors.dark.error,
      };
    } else if (success) {
      textStyleObj = {
        ...textStyleObj,
        color: Colors.dark.success,
      };
    }
    
    return textStyleObj;
  };

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? Colors.dark.accent : Colors.dark.text} />;
    }

    if (iconToUse && !title) {
      return iconToUse;
    }

    if (iconToUse && !title) {
      return (
        <View style={styles.rowContainer}>
          {typeof iconToUse === 'string' ? (
             <Text style={[styles.text, getTextStyle(), textStyle]}>{iconToUse}</Text>
           ) : (
             iconToUse
          )}
        </View>
      );
    }

    return (
       <Text style={[styles.text, getTextStyle(), textStyle]}>
         {title ?? ''}
       </Text>
    );
  };
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        getButtonStyle(),
        style
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      accessibilityState={{ disabled: disabled || loading }}
      accessibilityRole="button"
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginHorizontal: 6,
  }
});