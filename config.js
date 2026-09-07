/**
 * AuraGreet - Supabase Configuration
 * 
 * Fill in your credentials below to connect your database.
 */

const SUPABASE_CONFIG = {
    // 1. Enter your Supabase Project API credentials here:
    URL: "https://tibxvvjsgkyurxepdnsh.supabase.co", // Replace with your Project URL (e.g., "https://xyz.supabase.co")
    ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYnh2dmpzZ2t5dXJ4ZXBkbnNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTU4NjIsImV4cCI6MjEwMjk5MTg2Mn0.dlSlPRWINJRoP8VcwKiZ8smZQC4Zj_d53HQHGjNV0-I", // Replace with your Anon API Key

    // 2. Configure the exact database schema names to match your Supabase table:
    TABLE_NAME: "Customer Names", // Enter your Supabase table name here (e.g. "greetings")
    COLUMN_NAME: "Name",      // Matches the capitalized "Name" column from your screenshot

    // 3. Google reCAPTCHA v3 Site Key (Client-side / Public):
    RECAPTCHA_SITE_KEY: "6LfCha4tAAAAAHtpvOviksQPKjEaVLMOPR2ZJfFg"
};
