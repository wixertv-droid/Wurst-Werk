window.app = {
    inventoryData: [],
    kundenData: [],
    wurstData: [], // NEU: Für den Wurststand

    init: async function() {
        try {
            await this.refreshData();
        } catch (e) {
            console.error("Fehler beim Laden der Basisdaten", e);
        }

        // Timer nur laden, wenn der Bereich auf der Seite (index.html) existiert
        if (document.getElementById('active-processes-list')) {
            try {
                await this.loadActiveProcesses();
                setInterval(() => this.loadActiveProcesses(), 30000); 
            } catch (e) {
                console.error("Fehler bei den Timern", e);
            }
        }
    },

    refreshData: async function() {
        // Lädt jetzt 3 Tabellen parallel für absolute Genauigkeit
        const [inv, kund, wurst] = await Promise.all([
            db.getInventory(),
            db.getCustomers(),
            fetch(`${supabaseUrl}/rest/v1/wurst_bestand?select=*`, { 
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
            }).then(res => res.ok ? res.json() : [])
        ]);
        
        this.inventoryData = Array.isArray(inv) ? inv : [];
        this.kundenData = Array.isArray(kund) ? kund : [];
        this.wurstData = Array.isArray(wurst) ? wurst : [];
        
        this.render();
    },

    render: function() {
        let wert = 0;
        
        // Glas-Zähler
        let total250 = 0, total400 = 0; // Gesamt aus dem Roh-Lager (Gekaufte Leerkartons)
        let gefuellt250 = 0, gefuellt400 = 0; // Fertige Wurst im Wurststand
        let kunden250 = 0, kunden400 = 0; // Pfand beim Kunden
        
        let fertigeWurstArtikel = 0;

        // 1. Roh-Lager durchsuchen (Gesamtzahl der Gläser & Warenwert)
        this.inventoryData.forEach(i => {
            const nameStr = (i.name || '').toLowerCase();
            const catStr = (i.category || '').toLowerCase();

            if (catStr === 'pfandglas' || nameStr.includes('glas') || nameStr.includes('gläser')) {
                if (nameStr.includes('250')) total250 += Number(i.amount) || 0;
                else if (nameStr.includes('400')) total400 += Number(i.amount) || 0;
                // Preis wird bei Gläsern absichtlich ignoriert
            } else if (catStr !== 'maschine') { 
                wert += Number(i.price) || 0; 
            }
        });

        // 2. Wurststand durchsuchen (Wie viele Gläser sind aktuell mit Wurst befüllt?)
        this.wurstData.forEach(w => {
            const unit = (w.unit || '').toLowerCase();
            const name = (w.name || '').toLowerCase();
            const amount = Number(w.amount) || 0;

            if (amount > 0) fertigeWurstArtikel += amount;

            if (unit.includes('250') || name.includes('250')) {
                gefuellt250 += amount;
            } else if (unit.includes('400') || name.includes('400')) {
                gefuellt400 += amount;
            } else if (unit.includes('glas') || name.includes('glas')) {
                gefuellt250 += amount; // Fallback auf 250
            }
        });

        // 3. Kunden durchsuchen (Wie viele Gläser sind beim Kunden?)
        this.kundenData.forEach(k => {
            kunden250 += Number(k.pfand_250) || 0;
            kunden400 += Number(k.pfand_400) || 0;
        });

        // 4. Berechnung der restlichen freien Gläser im Regal
        const frei250 = total250 - gefuellt250 - kunden250;
        const frei400 = total400 - gefuellt400 - kunden400;

        // --- DASHBOARD (index.html) AKTUALISIEREN ---
        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = wert.toFixed(2);
        if(document.getElementById('stat-wurst-anzahl')) document.getElementById('stat-wurst-anzahl').innerText = fertigeWurstArtikel;

        if(document.getElementById('stat-g250-total')) {
            document.getElementById('stat-g250-total').innerText = total250;
            document.getElementById('stat-g400-total').innerText = total400;
            
            document.getElementById('stat-g250-gefuellt').innerText = Math.floor(gefuellt250);
            document.getElementById('stat-g400-gefuellt').innerText = Math.floor(gefuellt400);
            
            document.getElementById('stat-g250-kunden').innerText = kunden250;
            document.getElementById('stat-g400-kunden').innerText = kunden400;
            
            // Rote Warnfarbe, falls man ins Minus rutscht (weil z.B. Gläser im Lager nicht eingebucht wurden)
            const frei250El = document.getElementById('stat-g250-frei');
            frei250El.innerText = Math.floor(frei250);
            frei250El.style.color = frei250 < 0 ? 'var(--accent-danger)' : '#4caf50';

            const frei400El = document.getElementById('stat-g400-frei');
            frei400El.innerText = Math.floor(frei400);
            frei400El.style.color = frei400 < 0 ? 'var(--accent-danger)' : '#4caf50';
        }

        // --- LAGER (lager.html) KOMPATIBILITÄT ---
        // Auf der Lager-Seite zeigen wir bei "Im Regal" auch die komplett freien an
        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = wert.toFixed(2);
        if(document.getElementById('glass-250-stock')) document.getElementById('glass-250-stock').innerText = Math.floor(frei250);
        if(document.getElementById('glass-400-stock')) document.getElementById('glass-400-stock').innerText = Math.floor(frei400);
        if(document.getElementById('glass-250-kunden')) document.getElementById('glass-250-kunden').innerText = kunden250 + gefuellt250; // Lager zeigt Kunden + Gefüllte als "weg" an
        if(document.getElementById('glass-400-kunden')) document.getElementById('glass-400-kunden').innerText = kunden400 + gefuellt400;
    },

    loadActiveProcesses: async function() {
        const container = document.getElementById('active-processes-list');
        if (!container) return; 

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/active_processes?status=eq.running&order=end_time.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!res.ok) {
                container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehlt die Tabelle "active_processes" in Supabase?</p>';
                return;
            }

            const processes = await res.json();
            
            if (!Array.isArray(processes) || processes.length === 0) {
                container.innerHTML = '<p class="text-muted" style="text-align: center;">Aktuell keine Prozesse in Arbeit.</p>';
                return;
            }

            container.innerHTML = '';
            processes.forEach(p => {
                container.innerHTML += `
                    <div class="prod-card" style="border-left:4px solid #4d4dff; margin-bottom:10px; background:#1a1a1a; padding:15px; border-radius:10px;">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                            <div style="flex: 1; padding-right: 10px;">
                                <b style="color:#4d4dff; font-size:0.8rem; text-transform:uppercase;">${p.recipe_name}</b>
                                <p style="margin:5px 0; font-size:0.95rem; color: #eee; line-height: 1.3;">${p.step_text}</p>
                            </div>
                            <span class="material-symbols-outlined" style="color:var(--accent-danger); cursor:pointer; padding: 5px;" onclick="window.app.stopProcess('${p.id}')">delete</span>
                        </div>
                        <div id="timer-${p.id}" style="color:var(--accent-amber); font-weight:bold; font-size:1.3rem; margin-top:8px; text-align: right;">
                            Berechne...
                        </div>
                    </div>`;
                
                this.startCountdown(p.id, p.end_time);
            });
        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: var(--accent-danger);">Fehler beim Laden der Timer.</p>';
        }
    },

    startCountdown: function(id, endStr) {
        const end = new Date(endStr).getTime();
        
        const update = () => {
            const el = document.getElementById(`timer-${id}`);
            if (!el) return; 
            
            const dist = end - Date.now();
            
            if (dist < 0) { 
                el.innerText = "✅ FERTIG!"; 
                el.style.color = "#4caf50"; 
                return; 
            }
            
            const d = Math.floor(dist / 86400000);
            const h = Math.floor((dist % 86400000) / 3600000);
            const m = Math.floor((dist % 3600000) / 60000);
            const s = Math.floor((dist % 60000) / 1000);
            
            let timeStr = "";
            if (d > 0) timeStr += d + " Tage ";
            timeStr += (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
            el.innerText = timeStr;
            
            setTimeout(update, 1000);
        };
        update();
    },

    stopProcess: async function(id) {
        if(!confirm("Diesen Prozess wirklich abbrechen und vom Dashboard löschen?")) return;
        try {
            await fetch(`${supabaseUrl}/rest/v1/active_processes?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            await this.loadActiveProcesses();
        } catch (e) {
            alert("Fehler beim Löschen!");
        }
    }
};

document.addEventListener('DOMContentLoaded', () => window.app.init());
