const app = {
    // Startet die App, wenn die Seite geladen wird
    init: async function() {
        console.log("Wurstwerk App gestartet...");
        await this.refreshData();
    },

    // Holt alle Daten aus Supabase und befüllt das Dashboard und das Lager
    refreshData: async function() {
        try {
            const data = await db.getInventory();
            
            // 1. Dashboard Zahlen aktualisieren
            const glaeser = data.find(i => i.name.toLowerCase().includes('glas'));
            const glaeserCount = glaeser ? glaeser.amount : 0;
            if(document.getElementById('stat-gläser')) {
                document.getElementById('stat-gläser').innerText = glaeserCount;
            }

            const gesamtWert = data.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
            if(document.getElementById('stat-wert')) {
                document.getElementById('stat-wert').innerText = gesamtWert.toFixed(2);
            }

            // 2. Lager-Liste aufbauen
            const lagerListe = document.getElementById('inventory-list');
            if(lagerListe) {
                lagerListe.innerHTML = '';
                
                if (data.length === 0) {
                    lagerListe.innerHTML = '<p class="text-muted" style="text-align:center; margin-top:30px;">Das Lager ist aktuell leer.</p>';
                } else {
                    data.forEach(item => {
                        lagerListe.innerHTML += `
                            <div class="list-card">
                                <div class="icon-box"><span class="material-symbols-outlined">inventory</span></div>
                                <div class="info">
                                    <h3>${item.name}</h3>
                                    <p>${item.amount} ${item.unit} | Wert: ${Number(item.price).toFixed(2)}€</p>
                                </div>
                                <button onclick="app.deleteItem('${item.id}')" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; padding:10px;">
                                    <span class="material-symbols-outlined">delete</span>
                                </button>
                            </div>
                        `;
                    });
                }
            }

            // 3. Laufende Produktionen laden (falls die Datei da ist)
            if(typeof production !== 'undefined' && production.loadActiveProcesses) {
                await production.loadActiveProcesses();
            }

        } catch (error) {
            console.error("Fehler beim Aktualisieren der Daten:", error);
        }
    },

    // Löscht einen Eintrag aus der Datenbank
    deleteItem: async function(id) {
        if(!confirm("Möchtest du diesen Artikel wirklich aus dem Lager löschen?")) return;
        
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if(res.ok) {
                // Wenn das Löschen erfolgreich war, laden wir die Liste direkt neu
                await this.refreshData();
            } else {
                alert("Fehler beim Löschen des Artikels.");
            }
        } catch (e) { 
            alert("Keine Verbindung zur Datenbank. Löschen fehlgeschlagen."); 
        }
    },

    // Steuert das Menü unten (Home, Rezepte, Lager, Kunden)
    switchView: function(viewName, clickedElement) {
        // Alle Bildschirme verstecken
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        
        // Den gewünschten Bildschirm einblenden
        const targetView = document.getElementById('view-' + viewName);
        if(targetView) targetView.classList.add('active');

        // Die Farbe der Buttons in der Navigation anpassen
        if(clickedElement) {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            clickedElement.classList.add('active');
        }

        // Bei jedem Klick auf einen Tab laden wir sicherheitshalber die Daten frisch
        this.refreshData();
    }
};

// Event-Listener: Wartet, bis das HTML fertig ist, und startet dann
document.addEventListener('DOMContentLoaded', () => app.init());
