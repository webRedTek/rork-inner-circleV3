/**
 * FILE: components/Input.tsx
 * LAST UPDATED: 2025-07-01 14:45
 * 
 * INITIALIZATION ORDER:
 * 1. Pure component, initializes when rendered
 * 2. No external initialization dependencies
 * 3. Extends React Native TextInput functionality
 * 4. Parent components depend on value changes
 * 5. No critical race conditions
 * 
 * CURRENT STATE:
 * Base input component with consistent styling and features:
 * - Label and error state handling
 * - Customizable text input properties
 * - Character limit support
 * - Consistent styling with app theme
 * 
 * RECENT CHANGES:
 * - Added maxLength support
 * - Extended TextInputProps for better type safety
 * - Enhanced error state visualization
 * - Improved accessibility support
 * 
 * FILE INTERACTIONS:
 * - Imports from: react-native, constants/colors
 * - Exports to: Used by all form screens
 * - Dependencies: No external dependencies
 * - Data flow: One-way data flow with value/onChange pattern
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - Input: Main input component with label and error handling
 */

import React from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet, 
  ViewStyle,
  TextStyle,
  KeyboardTypeOptions,
  TextInputProps
} from 'react-native';
import Colors from '@/constants/colors';

export interface InputProps extends TextInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  numberOfLines?: number;
  error?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  labelStyle?: TextStyle;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  helperText?: string;
  maxLength?: number;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  multiline = false,
  numberOfLines = 1,
  error,
  style,
  inputStyle,
  labelStyle,
  autoCapitalize = 'none',
  editable = true,
  helperText,
  maxLength,
}) => {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, labelStyle]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          multiline && { height: 24 * numberOfLines, textAlignVertical: 'top' },
          error && styles.inputError,
          !editable && styles.disabledInput,
          inputStyle
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.textSecondary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines : undefined}
        autoCapitalize={autoCapitalize}
        editable={editable}
        maxLength={maxLength}
      />
      {!error && helperText && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: Colors.dark.text,
    fontWeight: '500',
  },
  input: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    padding: 12,
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inputError: {
    borderColor: Colors.dark.error,
  },
  disabledInput: {
    opacity: 0.7,
  },
  errorText: {
    color: Colors.dark.error,
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
});