import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Helper function to extract readable error message
const getReadableError = (error: any): string => {
  if (!error) return 'Unknown error occurred';
  
  // If it's a string, return it directly
  if (typeof error === 'string') return error;
  
  // If it has a message property, return that
  if (error.message) return error.message;
  
  // If it has an error property with a message (nested error)
  if (error.error && error.error.message) return error.error.message;
  
  // If it has a details property
  if (error.details) return String(error.details);
  
  // If it has a code property
  if (error.code) return `Error code: ${error.code}`;
  
  // Last resort: stringify the object
  try {
    return JSON.stringify(error);
  } catch (e) {
    return 'An error occurred';
  }
};

// Convert snake_case to camelCase
const snakeToCamel = (str: string): string => {
  return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
};

// Convert camelCase to snake_case
const camelToSnake = (str: string): string => {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

// Convert PostgreSQL type to TypeScript type
const pgTypeToTsType = (pgType: string): string => {
  switch (pgType.toLowerCase()) {
    case 'integer':
    case 'bigint':
    case 'smallint':
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'double precision':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'json':
    case 'jsonb':
      return 'Record<string, any>';
    case 'text[]':
    case 'varchar[]':
    case 'character varying[]':
      return 'string[]';
    case 'integer[]':
    case 'bigint[]':
      return 'number[]';
    case 'uuid':
    case 'text':
    case 'varchar':
    case 'character varying':
    case 'date':
    case 'time':
    case 'timestamp':
    case 'timestamptz':
    case 'timestamp with time zone':
    case 'timestamp without time zone':
      return 'string';
    default:
      if (pgType.endsWith('[]')) {
        return 'any[]';
      }
      return 'any';
  }
};

// Interface for column information
interface ColumnInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

// Interface for table information
interface TableInfo {
  name: string;
  columns: ColumnInfo[];
}

/**
 * Introspect Supabase database schema and generate TypeScript types
 */
export const introspectSupabaseSchema = async (): Promise<string | null> => {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      Alert.alert(
        "Error",
        "Supabase is not configured. Please configure Supabase first.",
        [{ text: "OK" }]
      );
      return null;
    }

    // Get all tables in the public schema
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .neq('table_name', 'schema_migrations')
      .order('table_name');
    
    if (tablesError) {
      throw tablesError;
    }

    if (!tables || tables.length === 0) {
      Alert.alert(
        "No Tables Found",
        "No tables were found in the public schema of your Supabase database.",
        [{ text: "OK" }]
      );
      return null;
    }

    // Get columns for each table
    const tableInfos: TableInfo[] = [];
    
    for (const table of tables) {
      const { data: columns, error: columnsError } = await supabase
        .from('information_schema.columns')
        .select('table_name, column_name, data_type, is_nullable, column_default')
        .eq('table_schema', 'public')
        .eq('table_name', table.table_name as string)
        .order('ordinal_position');

      if (columnsError) {
        console.error(`Error fetching columns for table ${table.table_name}:`, getReadableError(columnsError));
        continue;
      }

      if (columns) {
        tableInfos.push({
          name: table.table_name as string,
          columns: columns.map(col => ({
            table_name: col.table_name as string,
            column_name: col.column_name as string,
            data_type: col.data_type as string,
            is_nullable: col.is_nullable as string,
            column_default: col.column_default as string | null
          }))
        });
      }
    }

    // Generate TypeScript interfaces
    let typesContent = `// Generated TypeScript types for Supabase tables
// Generated on: ${new Date().toISOString()}
// This file is auto-generated. Do not edit directly.

export namespace SupabaseSchema {
`;

    for (const table of tableInfos) {
      const interfaceName = table.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      typesContent += `  export interface ${interfaceName} {
`;

      for (const column of table.columns) {
        const isNullable = column.is_nullable === 'YES' ? ' | null' : '';
        const tsType = pgTypeToTsType(column.data_type);
        const camelCaseName = snakeToCamel(column.column_name);
        
        typesContent += `    ${camelCaseName}: ${tsType}${isNullable};
`;
      }

      typesContent += `  }

`;
    }

    // Add helper types for mapping between camelCase and snake_case
    typesContent += `  // Helper types for mapping between camelCase and snake_case
`;
    
    for (const table of tableInfos) {
      const interfaceName = table.name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');

      typesContent += `  export type ${interfaceName}Record = {
`;
      
      for (const column of table.columns) {
        const isNullable = column.is_nullable === 'YES' ? ' | null' : '';
        const tsType = pgTypeToTsType(column.data_type);
        
        typesContent += `    ${column.column_name}: ${tsType}${isNullable};
`;
      }
      
      typesContent += `  };

`;
    }

    // Add helper functions for converting between camelCase and snake_case
    typesContent += `  // Helper functions for converting between camelCase and snake_case
`;
    typesContent += `  export const snakeToCamel = (str: string): string => {
`;
    typesContent += `    return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
`;
    typesContent += `  };

`;
    
    typesContent += `  export const camelToSnake = (str: string): string => {
`;
    typesContent += `    return str.replace(/[A-Z]/g, letter => \`_\${letter.toLowerCase()}\`);
`;
    typesContent += `  };

`;
    
    typesContent += `  export const convertToCamelCase = <T extends Record<string, any>>(obj: T): Record<string, any> => {
`;
    typesContent += `    const result: Record<string, any> = {};
`;
    typesContent += `    for (const key in obj) {
`;
    typesContent += `      if (Object.prototype.hasOwnProperty.call(obj, key)) {
`;
    typesContent += `        const camelKey = snakeToCamel(key);
`;
    typesContent += `        result[camelKey] = obj[key];
`;
    typesContent += `      }
`;
    typesContent += `    }
`;
    typesContent += `    return result;
`;
    typesContent += `  };

`;
    
    typesContent += `  export const convertToSnakeCase = <T extends Record<string, any>>(obj: T): Record<string, any> => {
`;
    typesContent += `    const result: Record<string, any> = {};
`;
    typesContent += `    for (const key in obj) {
`;
    typesContent += `      if (Object.prototype.hasOwnProperty.call(obj, key)) {
`;
    typesContent += `        const snakeKey = camelToSnake(key);
`;
    typesContent += `        result[snakeKey] = obj[key];
`;
    typesContent += `      }
`;
    typesContent += `    }
`;
    typesContent += `    return result;
`;
    typesContent += `  };
`;
    
    typesContent += `}
`;

    // Save the generated types to a file
    if (Platform.OS !== 'web') {
      const typesDir = `${FileSystem.documentDirectory}types/`;
      const typesPath = `${typesDir}supabase-schema.ts`;
      
      // Create directory if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(typesDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(typesDir, { intermediates: true });
      }
      
      // Write the file
      await FileSystem.writeAsStringAsync(typesPath, typesContent);
      
      Alert.alert(
        "Success",
        `TypeScript types generated successfully and saved to ${typesPath}`,
        [{ text: "OK" }]
      );
    }
    
    // Also save to AsyncStorage for web compatibility
    await AsyncStorage.setItem('supabase-schema-types', typesContent);
    
    return typesContent;
  } catch (error) {
    console.error('Error introspecting Supabase schema:', getReadableError(error));
    Alert.alert(
      "Error",
      `Failed to introspect Supabase schema: ${getReadableError(error)}`,
      [{ text: "OK" }]
    );
    return null;
  }
};

/**
 * Get the generated TypeScript types from AsyncStorage
 */
export const getGeneratedTypes = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('supabase-schema-types');
  } catch (error) {
    console.error('Error getting generated types:', getReadableError(error));
    return null;
  }
};

/**
 * Clear the generated TypeScript types from AsyncStorage
 */
export const clearGeneratedTypes = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('supabase-schema-types');
    Alert.alert(
      "Success",
      "Generated types cleared successfully",
      [{ text: "OK" }]
    );
  } catch (error) {
    console.error('Error clearing generated types:', getReadableError(error));
    Alert.alert(
      "Error",
      `Failed to clear generated types: ${getReadableError(error)}`,
      [{ text: "OK" }]
    );
  }
};