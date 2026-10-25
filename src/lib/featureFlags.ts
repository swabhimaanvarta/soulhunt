// Feature flags for safe staged rollout of AIEM Hunt enhancements

export interface FeatureFlags {
  SQUAD_CHAT_ENABLED: boolean;
  SQUAD_ROLE_V2_ENABLED: boolean;
  VIRTUAL_SHOP_ENABLED: boolean;
  NEW_MAP_ENABLED: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    SQUAD_CHAT_ENABLED: process.env.SQUAD_CHAT_ENABLED !== "false",
    SQUAD_ROLE_V2_ENABLED: process.env.SQUAD_ROLE_V2_ENABLED !== "false",
    VIRTUAL_SHOP_ENABLED: process.env.VIRTUAL_SHOP_ENABLED !== "false",
    NEW_MAP_ENABLED: process.env.NEW_MAP_ENABLED !== "false",
  };
}

export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag];
}
