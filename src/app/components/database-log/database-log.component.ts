import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-database-log',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './database-log.component.html',
  styleUrls: ['./database-log.component.css']
})
export class DatabaseLogComponent {
  readonly supabaseService = inject(SupabaseService);

  formatTime(isoStr: string): string {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoStr;
    }
  }

  formatDobAge(dob?: string | null): string {
    if (!dob) return '—';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return dob;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const year = birthDate.getFullYear();
    let cohort = 'Traditionalist';
    if (year >= 2013) cohort = 'Gen Alpha';
    else if (year >= 1997) cohort = 'Gen Z';
    else if (year >= 1981) cohort = 'Millennial';
    else if (year >= 1965) cohort = 'Gen X';
    else if (year >= 1946) cohort = 'Boomer';

    return `${dob} (${age >= 0 ? age : '--'}y, ${cohort})`;
  }
}
