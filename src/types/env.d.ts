// Environment configuration types
export interface Environment {
  production: boolean;
  supabase: {
    url: string;
    anonKey: string;
  };
}
