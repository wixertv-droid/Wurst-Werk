const app = {
    init: async function() {
        console.log("Wurstwerk App synchronisiert...");
        await this.refreshData();
    },

    refreshData: async function() {
        try {
            // 1. Daten aus der Datenbank holen
            const inventoryData = await db.getInventory();
            
            // --- BERECHNUNGEN (Warenwert vs Maschinenwert) ---
            let warenWert = 0;
            let maschinenWert = 0;
            let leereGlaeser = 0;

            inventoryData.forEach(item => {
                const price = Number(item.price) || 0;
                
                if (item.category === 'Maschine') {
                    maschinenWert += price;
                } else if (item.category === 'Pfandglas') {
                    // Pfandgläser zählen wir bei der Menge, aber der Wert fließt NICHT in den Warenwert der Wurst!
                    leereGlaeser += Number(item.amount) || 0;
                } else {
                    // Fleisch, Gewürze und Material sind der echte Warenwert
                    warenWert += price;
                }
            });

            // --- ZAHLEN INS HTML SCHREIBEN (Falls die Felder auf der aktuellen Seite existieren) ---
            
            if (document.getElementById('stat-warenwert')) {
                document.getElementById('stat-warenwert').innerText = warenWert.toFixed(2);
            }
            if (document.getElementById('stat-maschinenwert')) {
                document.getElementById('stat-maschinenwert').innerText = maschinenWert.toFixed(2);
            }
            
            // Für die index.html (Dashboard)
            if (document.getElementById('stat-wert')) {
                document.getElementById('stat-wert').innerText = warenWert.toFixed(2);
            }
            if (document.getElementById('stat-gläser')) {
                // Später addieren wir hier noch die vollen und ausgegebenen Gläser!
                document.getElementById('stat-gläser').innerText = leereGlaeser; 
            }

            // --- LAGER-LISTE AUFBAUEN ---
            const lagerListe = document.getElementById('inventory-list');
            if (lagerListe) {
                lagerListe.innerHTML = '';
                
                if (inventoryData.length === 0) {
                    lagerListe.innerHTML = '<p class="text-muted" style="text-align:center; margin-top:30px;">Das Lager ist aktuell leer.</p>';
                } else {
                    inventoryData.forEach(item => {
                        // Preis pro Einheit schön formatieren
                        let unitPriceInfo = "";
                        if (item.amount > 0 && item.price > 0 && item.category !== 'Maschine') {
                            if (item.unit === 'g') {
                                const kgPreis = (item.price / item.amount) * 1000;
                                unitPriceInfo = `<span style="font-size: 0.8rem; color: #aaa;">(${kgPreis.toFixed(2)}€ / kg)</span>`;
                            } else {
                                const stueckPreis = item.price / item.amount;
                                unitPriceInfo = `<span style="font-size: 0.8rem; color: #aaa;">(${stueckPreis.toFixed(2)}€ / ${item.unit})</span>`;
                            }
                        }

                        // Icon je nach Kategorie anpassen
                        let icon = 'inventory_2';
                        if (item.category === 'Fleisch') icon = 'set_meal';
                        if (item.category === 'Gewürz') icon = 'grain';
                        if (item.category === 'Maschine') icon = 'build';
                        if (item.category === 'Pfandglas') icon = 'recycling';

                        lagerListe.innerHTML += `
                            <div class="list-card">
                                <div class="icon-box"><span class="material-symbols-outlined">${icon}</span></div>
                                <div class="info">
                                    <h3>${item.name}</h3>
                                    <p>${item.amount} ${item.unit} | Gesamt: ${Number(item.price).toFixed(2)}€ ${unitPriceInfo}</p>
                                </div>
                                <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; padding:10px;">
                                    <span class="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        `;
                    });
                }
            }

        } catch (error) {
            console.error("Fehler beim Aktualisieren der Daten:", error);
        }
    },

    // Löschen-Funktion
    deleteItem: async function(id) {
        if (!confirm("Möchtest du diesen Artikel wirklich restlos aus dem Lager entfernen?")) return;
        
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (res.ok) {
                await this.refreshData(); // Nach dem Löschen die Seite sofort neu laden
            } else {
                alert("Fehler beim Löschen des Artikels aus der Datenbank.");
            }
        } catch (e) { 
            alert("Keine Verbindung zur Datenbank. Löschen fehlgeschlagen."); 
        }
    }
};

// Startet automatisch
document.addEventListener('DOMContentLoaded', () => app.init());
