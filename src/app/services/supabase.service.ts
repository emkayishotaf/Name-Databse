import { Injectable, signal, computed } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { CustomerEntry, VisitorProfile } from '../models/visitor.model';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private client: SupabaseClient | null = null;
  private isConnected = false;

  // Reactive State via Signals
  readonly visitors = signal<CustomerEntry[]>([]);
  readonly connectionStatus = signal<'connected' | 'mocked' | 'error'>('mocked');
  readonly isLoading = signal<boolean>(false);

  readonly latestVisitor = computed<CustomerEntry | null>(() => {
    const list = this.visitors();
    return list.length > 0 ? list[0] : null;
  });

  readonly statusLabel = computed<string>(() => {
    const status = this.connectionStatus();
    switch (status) {
      case 'connected': return 'SUPABASE: CONNECTED';
      case 'mocked': return 'SUPABASE: MOCKED (LOCAL)';
      case 'error': return 'SUPABASE: CONNECTION ERROR';
    }
  });

  constructor() {
    this.initSupabase();
    this.loadLogs();
  }

  private initSupabase() {
    const { url, anonKey } = environment.supabase;
    if (url && anonKey && url.trim() !== '' && anonKey.trim() !== '') {
      try {
        this.client = createClient(url, anonKey);
        this.isConnected = true;
        this.connectionStatus.set('connected');
      } catch (err) {
        console.error('Supabase client creation failed:', err);
        this.connectionStatus.set('error');
        this.isConnected = false;
      }
    } else {
      this.connectionStatus.set('mocked');
      this.isConnected = false;
    }
  }

  async loadLogs(): Promise<void> {
    this.isLoading.set(true);
    const { tableName, columnName } = environment.supabase;

    if (this.isConnected && this.client) {
      try {
        const { data, error } = await this.client
          .from(tableName)
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;

        const normalized: CustomerEntry[] = (data || []).map((row: any) => ({
          id: row.id,
          Name: row[columnName] || row.Name || row.name || 'Anonymous',
          dob: row.dob || null,
          role: row.role || 'Developer',
          created_at: row.created_at || new Date().toISOString()
        }));

        this.visitors.set(normalized);
        this.connectionStatus.set('connected');
      } catch (err) {
        console.error('Error querying Supabase, using local fallback:', err);
        this.connectionStatus.set('error');
        this.loadLocalLogs();
      }
    } else {
      this.loadLocalLogs();
    }
    this.isLoading.set(false);
  }

  private loadLocalLogs() {
    try {
      const stored = localStorage.getItem('aura_greetings');
      const list = stored ? JSON.parse(stored) : [];
      this.visitors.set(list);
    } catch {
      this.visitors.set([]);
    }
  }

  async addVisitor(profile: VisitorProfile): Promise<boolean> {
    const { tableName, columnName } = environment.supabase;

    if (this.isConnected && this.client) {
      try {
        const insertRow: Record<string, any> = {};
        insertRow[columnName] = profile.name;
        insertRow['dob'] = profile.dob && profile.dob.trim() !== '' ? profile.dob : null;
        insertRow['role'] = profile.role || 'Developer';

        const { error } = await this.client
          .from(tableName)
          .insert([insertRow]);

        if (error) throw error;
      } catch (err) {
        console.error('Supabase insert failed, saving locally:', err);
        this.saveLocally(profile);
      }
    } else {
      this.saveLocally(profile);
    }

    // Refresh reactive list
    await this.loadLogs();
    return true;
  }

  private saveLocally(profile: VisitorProfile) {
    const newEntry: CustomerEntry = {
      id: Math.floor(Math.random() * 900000) + 100000,
      Name: profile.name,
      dob: profile.dob || null,
      role: profile.role || 'Developer',
      created_at: new Date().toISOString()
    };

    const current = [...this.visitors()];
    current.unshift(newEntry);
    if (current.length > 10) current.pop();

    this.visitors.set(current);
    try {
      localStorage.setItem('aura_greetings', JSON.stringify(current));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }
}
