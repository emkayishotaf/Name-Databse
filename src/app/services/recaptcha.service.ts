import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

declare const grecaptcha: {
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
} | undefined;

@Injectable({
  providedIn: 'root'
})
export class RecaptchaService {
  private siteKey = environment.recaptchaSiteKey;

  async execute(action: string = 'submit_visitor'): Promise<string | null> {
    if (typeof grecaptcha !== 'undefined' && this.siteKey) {
      try {
        const token = await grecaptcha.execute(this.siteKey, { action });
        console.log("🛡️ [Angular] reCAPTCHA v3 token generated:", token.substring(0, 25) + "...");
        return token;
      } catch (err) {
        console.warn("reCAPTCHA v3 execution notice:", err);
      }
    }
    return null;
  }
}
