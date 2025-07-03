/**
 * FILE: components/SingleSelect.tsx
 * LAST UPDATED: 2025-07-01 14:45
 * 
 * INITIALIZATION ORDER:
 * 1. Pure component, initializes when rendered
 * 2. No external initialization dependencies
 * 3. Initializes internal state for selection handling
 * 4. Parent components depend on value changes
 * 5. No critical race conditions
 * 
 * CURRENT STATE:
 * Reusable single-select component that supports:
 * - Label/value option pairs
 * - Selected state visualization
 * - Error state handling
 * - Touch-friendly option selection
 * 
 * RECENT CHANGES:
 * - Updated interface to use Option type with label/value pairs
 * - Improved type safety with proper interfaces
 * - Enhanced styling for better touch interaction
 * - Added error state support
 * 
 * FILE INTERACTIONS:
 * - Imports from: react-native, constants/colors
 * - Exports to: Used by various form screens
 * - Dependencies: No external dependencies
 * - Data flow: One-way data flow with value/onChange pattern
 * 
 * KEY FUNCTIONS/COMPONENTS:
 * - SingleSelect: Main component for single option selection
 * - handleSelect: Internal handler for option selection
 */

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal,
  FlatList,
  SafeAreaView
} from 'react-native';
import Colors from '@/constants/colors';
import { Check, X } from 'lucide-react-native';

interface Option {
  label: string;
  value: string;
}

interface SingleSelectProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  error?: string;
}

export function SingleSelect({ label, value, onValueChange, options, error }: SingleSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);
  
  const handleSelect = (option: Option) => {
    onValueChange(option.value);
    setModalVisible(false);
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.option,
              value === option.value && styles.selectedOption
            ]}
            onPress={() => handleSelect(option)}
          >
            <Text style={[
              styles.optionText,
              value === option.value && styles.selectedOptionText
            ]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity 
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <X size={24} color={Colors.dark.text} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.optionText}>{item.label}</Text>
                  {value === item.value && (
                    <Check size={20} color={Colors.dark.accent} />
                  )}
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.optionsList}
            />
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

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
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.dark.cardBackground,
    borderWidth: 1,
    borderColor: Colors.dark.cardAlt,
  },
  selectedOption: {
    backgroundColor: Colors.dark.accent,
    borderColor: Colors.dark.accent,
  },
  optionText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  selectedOptionText: {
    color: Colors.dark.background,
    fontWeight: '500',
  },
  error: {
    color: Colors.dark.error,
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    padding: 16,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
});