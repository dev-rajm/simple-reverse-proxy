import fs from 'node:fs/promises';
import { parse } from 'yaml';
import { rootConfigSchema } from './config.schema';

// Parse yaml file
export async function parseYAMLConfig(filepath: string) {
  const configFileContent = await fs.readFile(filepath, 'utf8');
  const configParse = parse(configFileContent);

  return JSON.stringify(configParse);
}

// Validate config
export async function validateConfig(config: string) {
  const validatedConfig = await rootConfigSchema.parseAsync(JSON.parse(config));
  return validatedConfig;
}
