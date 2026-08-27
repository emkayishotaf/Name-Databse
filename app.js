/**
 * AuraGreet - Supabase & Local Sandbox Client
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const userNameInput = document.getElementById('user-name');
    const greetingDisplay = document.getElementById('greeting-display');
    const displayedName = document.getElementById('displayed-name');
    
    // Status Bar & Badge elements
    const statusIndicator = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const dbBadge = document.getElementById('db-badge');
    const supabaseHint = document.getElementById('supabase-hint');
    
    // DB Log List
    const dbEntriesList = document.getElementById('db-entries-list');
    const greetingForm = document.getElementById('greeting-form');

    let supabaseClient = null;
    let isSupabaseActive = false;
    let localDatabase = JSON.parse(localStorage.getItem('aura_greetings') || '[]');

    // Initialize Database Connection
    function initializeDB() {
        const hasCredentials = SUPABASE_CONFIG.URL && 
                               SUPABASE_CONFIG.URL !== "" && 
                               SUPABASE_CONFIG.ANON_KEY && 
                               SUPABASE_CONFIG.ANON_KEY !== "";

        if (hasCredentials) {
            try {
                // Initialize real Supabase client
                supabaseClient = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
                isSupabaseActive = true;
                
                // Update UI status to Connected
                statusIndicator.className = "status-indicator connected";
                statusText.textContent = "SUPABASE: CONNECTED";
                dbBadge.textContent = "Supabase DB";
                dbBadge.style.backgroundColor = "rgba(62, 207, 142, 0.1)";
                dbBadge.style.color = "var(--supabase-green)";
                dbBadge.style.borderColor = "rgba(62, 207, 142, 0.2)";
                supabaseHint.innerHTML = "Connected to Supabase! Names entered will sync with table <code class='code-file'>greetings</code> in real time.";
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

    // Fetch and render the table logs
    async function loadLogs() {
        let entries = [];
        const tableName = SUPABASE_CONFIG.TABLE_NAME || 'greetings';
        const columnName = SUPABASE_CONFIG.COLUMN_NAME || 'name';
        
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

        // Render to Table
        dbEntriesList.innerHTML = '';
        
        if (entries.length === 0) {
            dbEntriesList.innerHTML = `
                <tr class="empty-row">
                    <td colspan="3">No names entered yet. Be the first!</td>
                </tr>`;
            return;
        }

        entries.forEach(entry => {
            const date = new Date(entry.created_at || entry.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            // Fall back to 'name' for local mocked database rows
            const resolvedName = entry[columnName] || entry.name || '';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${entry.id.toString().substring(0, 6)}</td>
                <td>${escapeHTML(resolvedName)}</td>
                <td>${timeStr}</td>
            `;
            dbEntriesList.appendChild(tr);
        });
    }

    // Save Name to database / localstorage
    async function saveName(name) {
        if (!name || name.trim().length === 0) return null;
        const cleanedName = name.trim();
        const tableName = SUPABASE_CONFIG.TABLE_NAME || 'greetings';
        const columnName = SUPABASE_CONFIG.COLUMN_NAME || 'name';

        let savedName = cleanedName;

        if (isSupabaseActive) {
            try {
                const insertRow = {};
                insertRow[columnName] = cleanedName;

                // .select() returns the newly created row from the database
                const { data, error } = await supabaseClient
                    .from(tableName)
                    .insert([insertRow])
                    .select();
                if (error) throw error;
                
                if (data && data.length > 0) {
                    savedName = data[0][columnName];
                }
            } catch (err) {
                console.error("Failed to insert to Supabase, saving locally:", err);
                const localEntry = saveLocally(cleanedName);
                savedName = localEntry.name;
            }
        } else {
            const localEntry = saveLocally(cleanedName);
            savedName = localEntry.name;
        }

        // Reload lists
        await loadLogs();
        return savedName;
    }

    function saveLocally(name) {
        const newEntry = {
            id: Math.floor(Math.random() * 900000) + 100000,
            name: name,
            created_at: new Date().toISOString()
        };
        localDatabase.unshift(newEntry);
        // limit to 10 entries locally
        if (localDatabase.length > 10) {
            localDatabase.pop();
        }
        localStorage.setItem('aura_greetings', JSON.stringify(localDatabase));
        return newEntry;
    }

    // Helper: Escape HTML to prevent injection
    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
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
    // Live Input Event Listeners
    // -------------------------------------------------------------

    // Form submission triggers permanent DB logging & display update
    greetingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const textValue = userNameInput.value;
        const cleanedName = textValue.trim();
        
        if (cleanedName.length === 0) return;
        
        // Save to DB and retrieve the actual name committed by the database
        const savedNameFromDB = await saveName(cleanedName);
        
        if (savedNameFromDB) {
            // Update the display text box with the name returned by the database
            displayedName.textContent = savedNameFromDB;

            // Save the database-verified name to localStorage to remember user
            localStorage.setItem('saved_guest_name', savedNameFromDB);
        }
        
        // Trigger a screen flash effect on monitor bezel/screen
        const screen = document.querySelector('.monitor-screen');
        screen.style.transition = 'none';
        screen.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
        
        setTimeout(() => {
            screen.style.transition = 'background-color 0.8s ease';
            screen.style.backgroundColor = 'var(--monitor-screen-bg)';
        }, 50);

        // Reset input focus and values
        userNameInput.value = '';
        userNameInput.blur();
    });

    // Run Setup
    initializeDB();
    
    // Check if the user was previously remembered
    const savedName = localStorage.getItem('saved_guest_name');
    if (savedName) {
        displayedName.textContent = savedName;
    } else {
        displayedName.textContent = "Guest";
    }

    await loadLogs();
});
