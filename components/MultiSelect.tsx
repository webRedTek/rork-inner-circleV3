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

interface MultiSelectProps<T extends string> {
  label: string;
  options: T[];
  selectedValues: T[];
  onSelectionChange: (selected: T[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MultiSelect<T extends string>({ 
  label, 
  options, 
  selectedValues, 
  onSelectionChange,
  placeholder = 'Select options',
  disabled = false
}: MultiSelectProps<T>) {
  const [modalVisible, setModalVisible] = useState(false);
  
  const toggleOption = (option: T) => {
    if (selectedValues.includes(option)) {
      onSelectionChange(selectedValues.filter(item => item !== option));
    } else {
      onSelectionChange([...selectedValues, option]);
    }
  };
  
  const renderSelectedValues = () => {
    if (selectedValues.length === 0) {
      return <Text style={styles.placeholderText}>{placeholder}</Text>;
    }
    
    return (
      <Text style={styles.selectedText} numberOfLines={1} ellipsizeMode="tail">
        {selectedValues.join(', ')}
      </Text>
    );
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      
      <TouchableOpacity 
        style={[
          styles.selectButton,
          disabled && styles.disabledButton
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        {renderSelectedValues()}
      </TouchableOpacity>
      
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
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.optionItem}
                  onPress={() => toggleOption(item)}
                >
                  <Text style={styles.optionText}>{item}</Text>
                  {selectedValues.includes(item) && (
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
  selectButton: {
    backgroundColor: Colors.dark.card,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  disabledButton: {
    opacity: 0.6,
    backgroundColor: Colors.dark.card + '80',
  },
  placeholderText: {
    color: Colors.dark.textSecondary,
  },
  selectedText: {
    color: Colors.dark.text,
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
  optionText: {
    fontSize: 16,
    color: Colors.dark.text,
  },
});