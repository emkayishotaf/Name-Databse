import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { SupabaseService } from '../../services/supabase.service';
import { RecaptchaService } from '../../services/recaptcha.service';
import { VisitorProfileSchema } from '../../models/visitor.model';

@Component({
  selector: 'app-monitor',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './monitor.component.html',
  styleUrls: ['./monitor.component.css']
})
export class MonitorComponent {
  readonly supabaseService = inject(SupabaseService);
  private readonly recaptchaService = inject(RecaptchaService);
  private readonly fb = inject(FormBuilder);

  readonly errorMessage = signal<string | null>(null);
  readonly isShaking = signal<boolean>(false);
  readonly isScreenFlashing = signal<boolean>(false);

  readonly greetingForm = this.fb.group({
    name: ['', [Validators.required]],
    dob: [''],
    role: ['Developer'],
    website_url: [''] // Honeypot trap
  });

  private readonly nameValue = toSignal(this.greetingForm.controls.name.valueChanges, { initialValue: '' });
  private readonly dobValue = toSignal(this.greetingForm.controls.dob.valueChanges, { initialValue: '' });
  private readonly roleValue = toSignal(this.greetingForm.controls.role.valueChanges, { initialValue: 'Developer' });

  readonly displayedName = computed(() => {
    const typed = this.nameValue();
    if (typed && typed.trim().length > 0) return typed;
    const latest = this.supabaseService.latestVisitor();
    return latest ? latest.Name : 'Guest';
  });

  readonly displayedRole = computed(() => {
    const role = this.roleValue();
    if (role && role.trim().length > 0) return role;
    const latest = this.supabaseService.latestVisitor();
    return latest?.role || 'Developer';
  });

  readonly ageAndCohort = computed<{ age: number; cohort: string } | null>(() => {
    const dob = this.dobValue() || this.supabaseService.latestVisitor()?.dob;
    if (!dob) return null;

    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 0) return null;

    const year = birthDate.getFullYear();
    let cohort = 'Traditionalist';
    if (year >= 2013) cohort = 'Gen Alpha';
    else if (year >= 1997) cohort = 'Gen Z';
    else if (year >= 1981) cohort = 'Millennial';
    else if (year >= 1965) cohort = 'Gen X';
    else if (year >= 1946) cohort = 'Boomer';

    return { age, cohort };
  });

  async onSubmit() {
    this.errorMessage.set(null);
    const formVal = this.greetingForm.value;

    // 1. Honeypot check
    if (formVal.website_url && formVal.website_url.trim().length > 0) {
      console.warn("🛡️ [Angular] Honeypot triggered! Automated submission blocked.");
      this.greetingForm.reset({ role: 'Developer' });
      return;
    }

    // 2. Zod contract validation
    const candidate = {
      name: formVal.name || '',
      dob: formVal.dob || '',
      role: formVal.role || 'Developer'
    };

    const validation = VisitorProfileSchema.safeParse(candidate);
    if (!validation.success) {
      const msg = validation.error.errors[0]?.message || 'Invalid input entered.';
      this.triggerError(msg);
      return;
    }

    // 3. Google reCAPTCHA v3
    await this.recaptchaService.execute('submit_visitor');

    // 4. Save to database
    await this.supabaseService.addVisitor(validation.data);

    // 5. Trigger Screen Flash animation
    this.isScreenFlashing.set(true);
    setTimeout(() => this.isScreenFlashing.set(false), 500);

    // 6. Reset name and dob inputs
    this.greetingForm.patchValue({ name: '', dob: '' });
  }

  private triggerError(msg: string) {
    this.errorMessage.set(msg);
    this.isShaking.set(true);
    setTimeout(() => this.isShaking.set(false), 400);
  }
}
