// --- Supabase Zugangsdaten ---
// ⚠️ WICHTIG: HIER DEINE ECHTEN SUPABASE-DATEN EINTRAGEN!
const supabaseUrl = 'DEINE_SUPABASE_URL_HIER';
const supabaseKey = 'DEIN_SUPABASE_ANON_KEY_HIER';

const db = {
    // Holt den gesamten Lagerbestand
    getInventory: async function() {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/inventory?select=*`, {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Netzwerk-Fehler beim Laden der Datenbank');
            }
            
            return await response.json();
        } catch (error) {
            console.error("Datenbank-Fehler (getInventory):", error);
            // Status im Header auf "Fehler" setzen
            const statusEl = document.getElementById('db-status');
            if(statusEl) statusEl.innerText = "Offline / Fehler";
            return []; 
        }
    }
};
