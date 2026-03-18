window.app = {
    inventoryData: [],
    kundenData: [],

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
        const inv = await db.getInventory();
        const kund = await db.getCustomers();
        
        this.inventoryData = Array.isArray(inv) ? inv : [];
        this.kundenData = Array.isArray(kund) ? kund : [];
        
        this.render();
    },

    render: function() {
        let wert = 0, g250 = 0, g400 = 0, u250 = 0, u400 = 0;

        this.inventoryData.forEach(i => {
            const nameStr = (i.name || '').toLowerCase();
            const catStr = (i.category || '').toLowerCase();

            // FIX: Gläser werden unter KEINEN Umständen mehr in den Warenwert berechnet!
            if (catStr === 'pfandglas' || nameStr.includes('glas') || nameStr.includes('gläser')) {
                if (nameStr.includes('250')) g250 += Number(i.amount) || 0;
                else if (nameStr.includes('400')) g400 += Number(i.amount) || 0;
                // Preis wird absichtlich ignoriert!
            } else if (catStr !== 'maschine') { 
                wert += Number(i.price) || 0; 
            }
        });

        this.kundenData.forEach(k => {
            u250 += Number(k.pfand_250) || 0;
            u400 += Number(k.pfand_400) || 0;
        });

        // Werte auf der Startseite (Dashboard) aktualisieren
        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = wert.toFixed(2);
        if(document.getElementById('stat-glaeser-250')) document.getElementById('stat-glaeser-250').innerText = g250 - u250;
        if(document.getElementById('stat-glaeser-400')) document.getElementById('stat-glaeser-400').innerText = g400 - u400;

        // Werte auf der Lager-Seite aktualisieren
        if(document.getElementById('stat-warenwert')) document.getElementById('stat-warenwert').innerText = wert.toFixed(2);
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
