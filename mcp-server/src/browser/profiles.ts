// mcp-server/src/browser/profiles.ts
import { promises as fs } from 'fs';
import * as path from 'path';
import type { BrowserProfile } from './types.js';

const PROFILES_DIR = path.join(process.cwd(), '.browser-profiles');

export class ProfileManager {
  private profiles: Map<string, BrowserProfile> = new Map();

  async init(): Promise<void> {
    try {
      await fs.mkdir(PROFILES_DIR, { recursive: true });
    } catch {
      // 目录已存在
    }
    await this.loadProfiles();
  }

  private async loadProfiles(): Promise<void> {
    const configPath = path.join(process.cwd(), 'config', 'browser-profiles.json');
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(data);
      if (config.profiles) {
        for (const [name, profile] of Object.entries(config.profiles)) {
          this.profiles.set(name, profile as BrowserProfile);
        }
      }
    } catch {
      // 配置文件不存在，使用默认
    }
  }

  getProfile(name: string): BrowserProfile | undefined {
    return this.profiles.get(name);
  }

  getAllProfiles(): Map<string, BrowserProfile> {
    return this.profiles;
  }

  setProfile(name: string, profile: BrowserProfile): void {
    this.profiles.set(name, profile);
  }

  getProfileDir(name: string): string {
    return path.join(PROFILES_DIR, name);
  }
}

export const profileManager = new ProfileManager();
