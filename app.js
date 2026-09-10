/**
 * AuraGreet - Supabase & Local Sandbox Client
 * Expanded Multi-Field Identity Profile with Zod Validation
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements - Inputs
    const userNameInput = document.getElementById('user-name');
    const userDobInput = document.getElementById('user-dob');
    const userRoleInput = document.getElementById('user-role');
    const websiteField = document.getElementById('website-field');
    const greetingForm = document.getElementById('greeting-form');
    
    // DOM Elements - Display Badge
    const displayedName = document.getElementById('displayed-name');
    const displayedRole = document.getElementById('displayed-role');
    const displayedAge = document.getElementById('displayed-age');
    const displayedGen = document.getElementById('displayed-gen');
    
    // Status Bar & Badge elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const dbBadge = document.getElementById('db-badge');
    const supabaseHint = document.getElementById('supabase-hint');
    
    // DB Log List & Errors
    const dbEntriesList = document.getElementById('db-entries-list');
    const terminalError = document.getElementById('terminal-error');
    const terminalInputWrapper = document.getElementById('terminal-input-wrapper');

    let supabaseClient = null;
    let isSupabaseActive = false;
    let localDatabase = JSON.parse(localStorage.getItem('aura_greetings') || '[]');
    let latestVisitor = null;

    // -------------------------------------------------------------
    // Zod Schema Definition
    // -------------------------------------------------------------
    const z = window.Zod?.z || window.z || window.Zod;

    // Fallback schema in case CDN is unreachable
    const FallbackVisitorSchema = {
        safeParse: (val) => {
            const name = typeof val.name === 'string' ? val.name.trim() : '';
            if (name.length < 2) return { success: false, error: { errors: [{ message: "Name must be at least 2 characters long." }] } };
            if (name.length > 30) return { success: false, error: { errors: [{ message: "Name cannot exceed 30 characters." }] } };
            if (!/^[a-zA-Z\s'-]+$/.test(name)) return { success: false, error: { errors: [{ message: "Name can only contain letters, spaces, hyphens, and apostrophes." }] } };

            if (val.dob && val.dob.trim() !== '') {
                const d = new Date(val.dob);
                if (isNaN(d.getTime()) || d > new Date() || d < new Date('1900-01-01')) {
                    return { success: false, error: { errors: [{ message: "Date of birth must be a valid date between 1900 and today." }] } };
                }
            }
            return { 
                success: true, 
                data: {
                    name,
                    dob: val.dob || '',
                    role: val.role || 'Developer'
                }
            };
        }
    };

    // Declarative Zod Schema validating profile fields
    const VisitorProfileSchema = (typeof z !== 'undefined' && z?.object)
        ? z.object({
            name: z.string({ required_error: "Name is required." })
                .trim()
                .min(2, "Name must be at least 2 characters long.")
                .max(30, "Name cannot exceed 30 characters.")
                .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes."),
            dob: z.string().optional().refine(val => {
                if (!val || val.trim() === '') return true;
                const d = new Date(val);
                if (isNaN(d.getTime())) return false;
                const now = new Date();
                const minYear = new Date('1900-01-01');
                return d <= now && d >= minYear;
            }, "Date of birth must be a valid date between 1900 and today."),
            role: z.string().default("Developer")
        })
        : FallbackVisitorSchema;

    // -------------------------------------------------------------
    // Helper Calculations & UI Handlers
    // -------------------------------------------------------------

    function calculateAge(dobStr) {
        if (!dobStr) return null;
        const birthDate = new Date(dobStr);
        if (isNaN(birthDate.getTime())) return null;
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age >= 0 ? age : null;
    }

    function getGeneration(dobStr) {
        if (!dobStr) return null;
        const year = new Date(dobStr).getFullYear();
        if (isNaN(year)) return null;
        if (year >= 2013) return "Gen Alpha";
        if (year >= 1997) return "Gen Z";
        if (year >= 1981) return "Millennial";
        if (year >= 1965) return "Gen X";
        if (year >= 1946) return "Boomer";
        return "Traditionalist";
    }


    function updateBadgeDisplay(name, role, dob) {
        displayedName.textContent = name || "Guest";
        displayedRole.textContent = role || "Developer";

        const age = calculateAge(dob);
        const gen = getGeneration(dob);

        if (age !== null && gen !== null) {
            displayedAge.textContent = `Age: ${age}`;
            displayedGen.textContent = gen;
            displayedAge.style.display = 'inline-block';
            displayedGen.style.display = 'inline-block';
        } else {
            displayedAge.style.display = 'none';
            displayedGen.style.display = 'none';
        }
    }

    function showError(message) {
        if (terminalError) {
            terminalError.textContent = `⚠ ${message}`;
            terminalError.classList.add('visible');
        }
        if (terminalInputWrapper) {
            terminalInputWrapper.classList.remove('input-error');
            void terminalInputWrapper.offsetWidth; // Trigger reflow for shake restart
            terminalInputWrapper.classList.add('input-error');
        }
    }

    function clearError() {
        if (terminalError) {
            terminalError.textContent = '';
            terminalError.classList.remove('visible');
        }
        if (terminalInputWrapper) {
            terminalInputWrapper.classList.remove('input-error');
        }
    }

    // -------------------------------------------------------------
    // Initialize Database Connection
    // -------------------------------------------------------------
    function initializeDB() {
        const hasCredentials = SUPABASE_CONFIG.URL && 
                               SUPABASE_CONFIG.URL !== "" && 
                               SUPABASE_CONFIG.ANON_KEY && 
                               SUPABASE_CONFIG.ANON_KEY !== "";

        if (hasCredentials) {
            try {
                supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
                isSupabaseActive = true;
                
                statusIndicator.className = "status-indicator connected";
                statusText.textContent = "SUPABASE: CONNECTED";
                dbBadge.textContent = "Supabase DB";
                dbBadge.style.backgroundColor = "rgba(62, 207, 142, 0.1)";
                dbBadge.style.color = "var(--supabase-green)";
                dbBadge.style.borderColor = "rgba(62, 207, 142, 0.2)";
                supabaseHint.innerHTML = "Connected to Supabase! Profiles entered will sync with table <code class='code-file'>Customer Names</code> in real time.";
            } catch (err) {
                console.error("Supabase connection failed, falling back to local sandbox:", err);
                setupLocalFallback("SUPABASE: CONNECTION ERROR");
            }
        } else {
            setupLocalFallback("SUPABASE: MOCKED (LOCAL)");
        }
    }

    function setupLocalFallback(text) {
        isSupabaseActive = false;
        statusIndicator.className = "status-indicator mocked";
        statusText.textContent = text;
        dbBadge.textContent = "Local Sandbox";
        dbBadge.style.backgroundColor = "rgba(6, 182, 212, 0.1)";
        dbBadge.style.color = "var(--accent-cyan)";
        dbBadge.style.borderColor = "rgba(6, 182, 212, 0.2)";
        supabaseHint.innerHTML = "Running in sandbox mode. Enter your API credentials in <code class='code-file'>config.js</code> to connect a real database.";
    }

    // -------------------------------------------------------------
    // Fetch and Render Database Logs (HTTP GET)
    // -------------------------------------------------------------
    async function loadLogs() {
        let entries = [];
        const tableName = SUPABASE_CONFIG.TABLE_NAME || 'Customer Names';
        const columnName = SUPABASE_CONFIG.COLUMN_NAME || 'Name';
        
        if (isSupabaseActive) {
            try {
                const { data, error } = await supabaseClient
                    .from(tableName)
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                if (error) throw error;
                entries = data || [];
            } catch (err) {
                console.error("Error fetching from Supabase:", err);
                setupLocalFallback("SUPABASE: FETCH ERROR");
                entries = localDatabase;
            }
        } else {
            entries = localDatabase;
        }

        // Cache the latest visitor profile
        if (entries.length > 0) {
            latestVisitor = entries[0];
        } else {
            latestVisitor = null;
        }

        // As long as the user is not actively drafting a new name, display latest profile
        if (userNameInput.value.trim().length === 0) {
            if (latestVisitor) {
                const resolvedName = latestVisitor[columnName] || latestVisitor.name || 'Guest';
                updateBadgeDisplay(resolvedName, latestVisitor.role, latestVisitor.dob);
            } else {
                updateBadgeDisplay("Guest", "Developer", null);
            }
        }

        // Render to Table
        dbEntriesList.innerHTML = '';
        
        if (entries.length === 0) {
            dbEntriesList.innerHTML = `
                <tr class="empty-row">
                    <td colspan="5">No profiles logged yet. Be the first!</td>
                </tr>`;
            return;
        }

        entries.forEach(entry => {
            const date = new Date(entry.created_at || entry.timestamp || Date.now());
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const resolvedName = entry[columnName] || entry.name || 'Anonymous';
            const role = entry.role || 'Developer';
            
            let dobAgeText = '—';
            if (entry.dob) {
                const age = calculateAge(entry.dob);
                const gen = getGeneration(entry.dob);
                dobAgeText = `${entry.dob} ${age !== null ? `(${age}y, ${gen})` : ''}`;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${entry.id.toString().substring(0, 6)}</td>
                <td>${escapeHTML(resolvedName)}</td>
                <td><span class="table-role-tag">${escapeHTML(role)}</span></td>
                <td>${escapeHTML(dobAgeText)}</td>
                <td>${timeStr}</td>
            `;
            dbEntriesList.appendChild(tr);
        });
    }

    // -------------------------------------------------------------
    // Save Visitor Profile to Database (HTTP POST)
    // -------------------------------------------------------------
    async function saveVisitor(visitorData) {
        if (!visitorData || !visitorData.name) return;
        const tableName = SUPABASE_CONFIG.TABLE_NAME || 'Customer Names';
        const columnName = SUPABASE_CONFIG.COLUMN_NAME || 'Name';

        if (isSupabaseActive) {
            try {
                const insertRow = {};
                insertRow[columnName] = visitorData.name;
                insertRow['dob'] = visitorData.dob || null;
                insertRow['role'] = visitorData.role || 'Developer';

                // Insert into Supabase (POST)
                const { error } = await supabaseClient
                    .from(tableName)
                    .insert([insertRow]);
                if (error) throw error;
            } catch (err) {
                console.error("Failed to insert into Supabase, saving locally:", err);
                saveLocally(visitorData);
            }
        } else {
            saveLocally(visitorData);
        }

        // Re-fetch latest records via HTTP GET to hydrate screen badge and table
        await loadLogs();
    }

    function saveLocally(visitorData) {
        const newEntry = {
            id: Math.floor(Math.random() * 900000) + 100000,
            name: visitorData.name,
            dob: visitorData.dob || null,
            role: visitorData.role || 'Developer',
            created_at: new Date().toISOString()
        };
        localDatabase.unshift(newEntry);
        if (localDatabase.length > 10) {
            localDatabase.pop();
        }
        localStorage.setItem('aura_greetings', JSON.stringify(localDatabase));
        return newEntry;
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // -------------------------------------------------------------
    // Real-Time Event Listeners
    // -------------------------------------------------------------

    // 1. Date of Birth: Dynamically updates age & generation on the fly
    userDobInput.addEventListener('input', (e) => {
        clearError();
        const dobVal = e.target.value;
        const currentName = userNameInput.value.trim() || (latestVisitor ? (latestVisitor[SUPABASE_CONFIG.COLUMN_NAME || 'Name'] || latestVisitor.name) : 'Guest');
        updateBadgeDisplay(currentName, userRoleInput.value, dobVal);
    });

    // 2. Role Dropdown: Updates role badge live
    userRoleInput.addEventListener('change', (e) => {
        const currentName = userNameInput.value.trim() || (latestVisitor ? (latestVisitor[SUPABASE_CONFIG.COLUMN_NAME || 'Name'] || latestVisitor.name) : 'Guest');
        updateBadgeDisplay(currentName, e.target.value, userDobInput.value);
    });

    // 3. Name Field: Live typing preview; reverts if cleared
    userNameInput.addEventListener('input', (e) => {
        clearError();
        const textValue = e.target.value;
        if (textValue.trim().length === 0) {
            const fallbackName = latestVisitor ? (latestVisitor[SUPABASE_CONFIG.COLUMN_NAME || 'Name'] || latestVisitor.name) : 'Guest';
            updateBadgeDisplay(fallbackName, userRoleInput.value, userDobInput.value);
        } else {
            updateBadgeDisplay(textValue, userRoleInput.value, userDobInput.value);
        }
    });

    // 4. Form Submission: Honeypot trap -> Zod validation -> reCAPTCHA v3 -> DB POST -> DB GET
    greetingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Honeypot Anti-Bot Trap:
        if (websiteField && websiteField.value.trim().length > 0) {
            console.warn("🛡️ Honeypot triggered! Automated bot submission blocked.");
            userNameInput.value = '';
            websiteField.value = '';
            return;
        }

        // Gather profile fields
        const formData = {
            name: userNameInput.value,
            dob: userDobInput.value,
            role: userRoleInput.value
        };
        
        // 2. Validate with Zod schema
        const validation = VisitorProfileSchema.safeParse(formData);
        
        if (!validation.success) {
            const errorMsg = validation.error.errors[0]?.message || "Invalid input entered.";
            showError(errorMsg);
            return;
        }

        clearError();
        const validatedProfile = validation.data;
        
        // 3. Google reCAPTCHA v3 Token Generation
        let recaptchaToken = null;
        if (typeof grecaptcha !== 'undefined' && SUPABASE_CONFIG.RECAPTCHA_SITE_KEY) {
            try {
                recaptchaToken = await grecaptcha.execute(SUPABASE_CONFIG.RECAPTCHA_SITE_KEY, { action: 'submit_visitor' });
                console.log("🛡️ Google reCAPTCHA v3 token generated:", recaptchaToken.substring(0, 25) + "...");
            } catch (recaptchaErr) {
                console.warn("reCAPTCHA v3 execution notice:", recaptchaErr);
            }
        }

        // Reset input fields
        userNameInput.value = '';
        userDobInput.value = '';
        userNameInput.blur();

        // 4. Save to Database (POST), which subsequently calls loadLogs() (GET) to hydrate
        await saveVisitor(validatedProfile);
        
        // 5. Trigger Monitor Screen Flash Effect
        const screen = document.querySelector('.monitor-screen');
        screen.style.transition = 'none';
        screen.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        
        setTimeout(() => {
            screen.style.transition = 'background-color 0.8s ease';
            screen.style.backgroundColor = 'var(--monitor-screen-bg)';
        }, 50);
    });

    // Run Setup
    initializeDB();
    
    // Initial fetch to load the latest visitor profile and render database log
    await loadLogs();
});
