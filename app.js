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
    let latestDbName = null;

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

    // Fetch and render the table logs (GET request to database)
    async function loadLogs() {
        let entries = [];
        const tableName = SUPABASE_CONFIG.TABLE_NAME || 'greetings';
        const columnName = SUPABASE_CONFIG.COLUMN_NAME || 'name';
        
        if (isSupabaseActive) {
            try {
                // HTTP GET request to fetch recent rows from Supabase
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

        // Cache the latest name from the database
        if (entries.length > 0) {
            latestDbName = entries[0][columnName] || entries[0].name || null;
        } else {
            latestDbName = null;
        }

        // For as long as there is a name in the database, display it unless the user is typing
        if (userNameInput.value.trim().length === 0) {
            displayedName.textContent = latestDbName || "Guest";
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

        if (isSupabaseActive) {
            try {
                const insertRow = {};
                insertRow[columnName] = cleanedName;

                // Insert into database (POST)
                const { error } = await supabaseClient
                    .from(tableName)
                    .insert([insertRow]);
                if (error) throw error;
            } catch (err) {
                console.error("Failed to insert to Supabase, saving locally:", err);
                saveLocally(cleanedName);
            }
        } else {
            saveLocally(cleanedName);
        }

        // Reload lists via HTTP GET, which automatically updates latestDbName & displayedName!
        await loadLogs();
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

    // While user is typing a new name, show what they type.
    // If input is cleared, revert back to the latest name from the database.
    userNameInput.addEventListener('input', (e) => {
        const textValue = e.target.value;
        if (textValue.trim().length === 0) {
            displayedName.textContent = latestDbName || "Guest";
        } else {
            displayedName.textContent = textValue;
        }
    });

    // Form submission triggers DB insert (POST), then GETs the latest name
    greetingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const textValue = userNameInput.value;
        const cleanedName = textValue.trim();
        
        if (cleanedName.length === 0) return;
        
        // Reset input focus and values so the UI displays the newest DB name
        userNameInput.value = '';
        userNameInput.blur();

        // Save to DB (POST), which triggers loadLogs() to GET the latest name
        await saveName(cleanedName);
        
        // Trigger a screen flash effect on monitor bezel/screen
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
    
    // On load, execute HTTP GET query to fetch latest name from database and render it
    await loadLogs();
});
