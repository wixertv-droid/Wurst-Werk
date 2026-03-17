window.app = {
    inventoryData: [],
    kundenData: [],

    init: async function() {
        await this.refreshData();
        // Lade die Timer sofort beim Start
        await this.loadActiveProcesses();
        // Aktualisiere die Liste alle 30 Sekunden im Hintergrund sicherheitshalber
        setInterval(() => this.loadActiveProcesses(), 30000); 
    },

    refreshData: async function() {
        try {
            [this.inventoryData, this.kundenData] = await Promise.all([
                db.getInventory(),
                db.getCustomers()
            ]);
            this.render();
        } catch (e) { 
            console.error("Fehler beim Laden der Basisdaten:", e); 
        }
    },

    render: function() {
        let wert = 0, g250 = 0, g400 = 0, u250 = 0, u400 = 0;

        this.inventoryData.forEach(i => {
            if (i.category === 'Pfandglas') {
                if (i.name.includes('250')) g250 += Number(i.amount);
                else if (i.name.includes('400')) g400 += Number(i.amount);
            } else if (i.category !== 'Maschine') { 
                wert += Number(i.price); 
            }
        });

        this.kundenData.forEach(k => {
            u250 += Number(k.pfand_250) || 0;
            u400 += Number(k.pfand_400) || 0;
        });

        if(document.getElementById('stat-wert')) document.getElementById('stat-wert').innerText = wert.toFixed(2);
        if(document.getElementById('stat-glaeser-250')) document.getElementById('stat-glaeser-250').innerText = g250 - u250;
        if(document.getElementById('stat-glaeser-400')) document.getElementById('stat-glaeser-400').innerText = g400 - u400;
    },

    loadActiveProcesses: async function() {
        const container = document.getElementById('active-processes-list');
        if (!container) return; // Wenn wir nicht auf der index.html sind, abbrechen

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/active_processes?status=eq.running&order=end_time.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!res.ok) {
                container.innerHTML = '<p class="text-muted" style="color: red;">Fehler: Tabelle "active_processes" existiert nicht in Supabase.</p>';
                return;
            }

            const processes = await res.json();
            
            if (processes.length === 0) {
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
                
                // Countdown starten
                this.startCountdown(p.id, p.end_time);
            });
        } catch (e) {
            container.innerHTML = '<p class="text-muted" style="color: red;">Netzwerkfehler beim Laden der Timer.</p>';
        }
    },

    startCountdown: function(id, endStr) {
        const el = document.getElementById(`timer-${id}`);
        const end = new Date(endStr).getTime();
        
        const update = () => {
            const dist = end - Date.now();
            
            if (dist < 0) { 
                if (el) {
                    el.innerText = "✅ FERTIG!"; 
                    el.style.color = "#4caf50"; 
                }
                return; 
            }
            
            const d = Math.floor(dist / 86400000);
            const h = Math.floor((dist % 86400000) / 3600000);
            const m = Math.floor((dist % 3600000) / 60000);
            const s = Math.floor((dist % 60000) / 1000);
            
            if (el) { 
                let timeStr = "";
                if (d > 0) timeStr += d + "Tage ";
                timeStr += (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
                el.innerText = timeStr;
                setTimeout(update, 1000);
            }
        };
        update();
    },

    stopProcess: async function(id) {
        if(!confirm("Diesen Prozess wirklich entfernen? (Er verschwindet vom Dashboard)")) return;
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
