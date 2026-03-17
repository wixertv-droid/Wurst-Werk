// --- Supabase Zugangsdaten ---
// BITTE HIER DEINE EIGENEN DATEN EINTRAGEN!
const supabaseUrl = 'DEINE_SUPABASE_URL_HIER';
const supabaseKey = 'DEIN_SUPABASE_ANON_KEY_HIER';

const db = {
    // Holt den gesamten Lagerbestand aus Supabase
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
            return []; // Gibt ein leeres Array zurück, damit die App bei einem Fehler nicht abstürzt
        }
    }
    
    // Anmerkung: Das Speichern und Updaten machen wir im nächsten Schritt in der assistant.js, 
    // da dort die Logik für "Produkt vorhanden = addieren" passiert.
};
