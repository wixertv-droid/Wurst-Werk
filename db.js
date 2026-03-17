// --- Supabase Zugangsdaten ---
const supabaseUrl = 'https://lphunsmxoruyovvhjrxy.supabase.co';
const supabaseKey = 'sb_publishable_QjQFTlnJWcMQ-9vWe3f_8A_ayddFKF8';

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
