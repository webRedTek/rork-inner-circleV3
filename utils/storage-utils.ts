/**
 * FILE: utils/storage-utils.ts
 * LAST UPDATED: 2025-07-01
 * 
 * INITIALIZATION ORDER:
 * 1. Requires supabase client to be initialized
 * 2. Can be used by any component that needs file uploads
 * 3. No dependencies on other stores
 * 
 * CURRENT STATE:
 * Utility functions for handling Supabase Storage operations including:
 * - Profile picture uploads
 * - Group image uploads
 * - Portfolio image uploads
 * - Event image uploads
 * - File validation and optimization
 * 
 * RECENT CHANGES:
 * - Created new file for storage operations
 * - Added profile picture upload functionality
 * - Added file validation and error handling
 * 
 * FILE INTERACTIONS:
 * - Imports from: supabase client
 * - Exports to: Any component needing file uploads
 * - Dependencies: Supabase client must be initialized
 * 
 * KEY FUNCTIONS:
 * - uploadProfilePicture: Upload and update user profile picture
 * - uploadGroupImage: Upload group image
 * - uploadPortfolioImage: Upload portfolio item image
 * - validateImageFile: Validate image file before upload
 * - deleteFile: Delete file from storage
 */

import { supabase } from '@/lib/supabase';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Storage bucket names
 */
export const STORAGE_BUCKETS = {
  PROFILE_PICTURES: 'profile-pictures',
  GROUP_IMAGES: 'group-images',
  PORTFOLIO_IMAGES: 'portfolio-images',
  EVENT_IMAGES: 'event-images',
} as const;

/**
 * File size limits (in bytes)
 */
export const FILE_LIMITS = {
  PROFILE_PICTURE: 5 * 1024 * 1024, // 5MB
  GROUP_IMAGE: 10 * 1024 * 1024, // 10MB
  PORTFOLIO_IMAGE: 10 * 1024 * 1024, // 10MB
  EVENT_IMAGE: 10 * 1024 * 1024, // 10MB
} as const;

/**
 * Allowed file types
 */
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

/**
 * Validate image file before upload
 */
export const validateImageFile = (
  file: File | { uri: string; type?: string; size?: number },
  maxSize: number = FILE_LIMITS.PROFILE_PICTURE
): FileValidationResult => {
  // Check file size
  if (file.size && file.size > maxSize) {
    return {
      isValid: false,
      error: `File size must be less than ${Math.round(maxSize / (1024 * 1024))}MB`,
    };
  }

  // Check file type
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type as any)) {
    return {
      isValid: false,
      error: 'Only JPEG, PNG, and WebP images are allowed',
    };
  }

  return { isValid: true };
};

/**
 * Upload profile picture for a user
 */
export const uploadProfilePicture = async (
  userId: string,
  imageUri: string
): Promise<UploadResult> => {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Validate file
    const fileInfo = {
      uri: imageUri,
      type: 'image/jpeg', // Default type
      size: 0, // Will be updated after fetch
    };

    const validation = validateImageFile(fileInfo, FILE_LIMITS.PROFILE_PICTURE);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    // Convert URI to blob
    const response = await fetch(imageUri);
    const blob = await response.blob();

    // Check file size after fetch
    if (blob.size > FILE_LIMITS.PROFILE_PICTURE) {
      return {
        success: false,
        error: `File size must be less than ${Math.round(FILE_LIMITS.PROFILE_PICTURE / (1024 * 1024))}MB`,
      };
    }

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${userId}-${timestamp}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.PROFILE_PICTURES)
      .upload(filename, blob, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKETS.PROFILE_PICTURES)
      .getPublicUrl(filename);

    if (!urlData.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    // Update user's photo_url in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ photo_url: urlData.publicUrl })
      .eq('id', userId);

    if (updateError) {
      // If database update fails, delete the uploaded file
      await supabase.storage
        .from(STORAGE_BUCKETS.PROFILE_PICTURES)
        .remove([filename]);
      throw updateError;
    }

    return {
      success: true,
      url: urlData.publicUrl,
    };
  } catch (error) {
    console.error('Error uploading profile picture:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
};

/**
 * Pick image from device
 */
export const pickImage = async (
  options: ImagePicker.ImagePickerOptions = {}
): Promise<string | null> => {
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Permission to access media library was denied');
    }

    // Pick image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square aspect ratio for profile pictures
      quality: 0.8, // Reduce quality to reduce file size
      ...options,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      return result.assets[0].uri;
    }

    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
};

/**
 * Delete file from storage
 */
export const deleteFile = async (
  bucket: string,
  filename: string
): Promise<boolean> => {
  try {
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filename]);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error deleting file:', error);
    return false;
  }
};

/**
 * Get file URL from storage
 */
export const getFileUrl = (bucket: string, filename: string): string | null => {
  if (!supabase) {
    return null;
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return data.publicUrl;
}; 