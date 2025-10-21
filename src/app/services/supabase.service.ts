import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import type { Database } from '../../db/database.types';

// Load environment variables
config();

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase: SupabaseClient<Database>;

  constructor() {
    const supabaseUrl = process.env['SUPABASE_URL'];
    const supabaseAnonKey = process.env['SUPABASE_KEY'];

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables. Please check your .env file.');
    }

    this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
  }

  get client(): SupabaseClient<Database> {
    return this.supabase;
  }
}
