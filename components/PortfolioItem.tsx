import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { PortfolioItem as PortfolioItemType } from '@/types/user';
import Colors from '@/constants/colors';
import { ExternalLink } from 'lucide-react-native';

interface PortfolioItemProps {
  item: PortfolioItemType;
}

export const PortfolioItem: React.FC<PortfolioItemProps> = ({ item }) => {
  const handleLinkPress = async () => {
    if (item.link) {
      const canOpen = await Linking.canOpenURL(item.link);
      if (canOpen) {
        await Linking.openURL(item.link);
      }
    }
  };
  
  return (
    <View style={styles.container}>
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      
      <View style={styles.contentContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
        
        {item.link && (
          <TouchableOpacity 
            style={styles.linkButton}
            onPress={handleLinkPress}
          >
            <Text style={styles.linkText}>View</Text>
            <ExternalLink size={16} color={Colors.dark.accent} style={styles.linkIcon} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: 180,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  linkText: {
    fontSize: 14,
    color: Colors.dark.accent,
    fontWeight: '500',
    marginRight: 4,
  },
  linkIcon: {
    marginLeft: 2,
  },
});