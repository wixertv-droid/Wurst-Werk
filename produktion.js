window.produktionManager = {
    recipe: null,
    inventory: [],
    mappedIngredients: [], 
    totalCosts: 0, // Speichert die berechneten Kosten

    init: async function() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        
        // Timer laden (wie auf dem Dashboard)
        this.loadActiveProcesses();
        setInterval(() => this.loadActiveProcesses(), 30000);

        if (!id) {
            alert("Kein Rezept ausgewählt!");
            window.location.href = 'rezepte.html';
            return;
        }

        try {
            const [recipeRes, invData] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}&select=*`, { 
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
                }),
                db.getInventory()
            ]);

            const recipes = await recipeRes.json();
            if (recipes.length === 0) throw new Error("Rezept nicht gefunden");
            
            this.recipe = recipes[0];
            this.inventory = Array.isArray(invData) ? invData : [];

            document.getElementById('prod-title').innerText = `Produktion: ${this.recipe.name}`;
            this.buildMatchingUI();

        } catch (e) {
            alert("Fehler beim Laden der Produktionsdaten!");
            window.location.href = 'rezepte.html';
        }
    },

    // --- NEU: Timer-Funktion für die Produktionsseite kopiert ---
    loadActiveProcesses: async function() {
        const container = document.getElementById('active-processes-list');
        const mainContainer = document.getElementById('active-processes-container');
        if (!container || !mainContainer) return; 

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/active_processes?status=eq.running&order=end_time.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!res.ok) return;

            const processes = await res.json();
            
            if (!Array.isArray(processes) || processes.length === 0) {
                mainContainer.style.display = 'none'; // Verstecken, wenn nichts läuft
                return;
            }

            mainContainer.style.display = 'block'; // Anzeigen
            container.innerHTML = '';
            
            processes.forEach(p => {
                container.innerHTML += `
                    <div class="prod-card" style="border-left:4px solid #4d4dff; margin-bottom:10px; background:#1a1a1a; padding:10px; border-radius:8px;">
                        <div style="display:flex; justify-content:space-between; align-items: flex-start;">
                            <div style="flex: 1;">
                                <b style="color:#4d4dff; font-size:0.75rem; text-transform:uppercase;">${p.recipe_name}</b>
                                <p style="margin:2px 0; font-size:0.85rem; color: #eee; line-height: 1.2;">${p.step_text}</p>
                            </div>
                        </div>
                        <div id="prod-timer-${p.id}" style="color:var(--accent-amber); font-weight:bold; font-size:1.1rem; margin-top:5px; text-align: left;">
                            Berechne...
                        </div>
                    </div>`;
                
                this.startCountdown(p.id, p.end_time);
            });
        } catch (e) {
            console.error("Fehler beim Laden der Timer in der Produktion.", e);
        }
    },

    startCountdown: function(id, endStr) {
        const end = new Date(endStr).getTime();
        
        const update = () => {
            const el = document.getElementById(`prod-timer-${id}`);
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
    // -----------------------------------------------------------

    buildMatchingUI: function() {
        const container = document.getElementById('matching-container');
        const details = this.recipe.details || {};
        const ingredients = details.ingredients || [];

        if (ingredients.length === 0) {
            container.innerHTML = '<p class="text-muted">Dieses Rezept hat keine Zutaten.</p>';
            return;
        }

        container.innerHTML = '';
        this.mappedIngredients = [];

        const availableInv = this.inventory.filter(item => 
            item.category !== 'Pfandglas' && item.category !== 'Maschine'
        );

        const cleanString = (str) => (str || '').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").trim().toLowerCase();

        ingredients.forEach((ing, index) => {
            const searchStr = cleanString(ing.name);
            
            const getScore = (itemName) => {
                const nameL = cleanString(itemName);
                if (nameL === searchStr) return 100; 
                if (nameL.includes(searchStr) || searchStr.includes(nameL)) return 50; 
                
                const searchWords = searchStr.split(/\s+/);
                let score = 0;
                searchWords.forEach(w => {
                    if (w.length > 2 && nameL.includes(w)) score += 10;
                });
                return score;
            };

            const sortedInv = [...availableInv].sort((a, b) => {
                const scoreA = getScore(a.name);
                const scoreB = getScore(b.name);
                
                if (scoreA !== scoreB) {
                    return scoreB - scoreA; 
                }
                return (a.category || '').localeCompare(b.category || '');
            });

            let bestMatch = null;
            if (sortedInv.length > 0 && getScore(sortedInv[0].name) > 0) {
                bestMatch = sortedInv[0];
            }

            let optionsHtml = `<option value="">-- Bitte Lager-Artikel zuordnen --</option>`;
            
            sortedInv.forEach(item => {
                const isSelected = bestMatch && bestMatch.id === item.id ? 'selected' : '';
                optionsHtml += `<option value="${item.id}" ${isSelected}>[${item.category}] ${item.name} (${item.amount} ${item.unit}) - ${Number(item.price).toFixed(2)}€</option>`;
            });

            container.innerHTML += `
                <div class="match-row">
                    <div class="match-header">
                        <span style="font-weight: bold; color: var(--accent-amber);">${ing.name}</span>
                        <span style="font-size: 1.2rem; font-weight: bold;" id="calc-val-${index}">${ing.amount} ${ing.unit}</span>
                    </div>
                    <select class="match-select ${bestMatch ? 'matched' : 'unmatched'}" id="match-select-${index}" onchange="window.produktionManager.updateSelectColor(this)">
                        ${optionsHtml}
                        <option value="skip">❌ Nicht abbuchen (Ignorieren)</option>
                    </select>
                </div>
            `;

            this.mappedIngredients.push({ originalName: ing.name, baseAmount: ing.amount, unit: ing.unit, index: index });
        });
    },

    updateSelectColor: function(selectEl) {
        if(selectEl.value && selectEl.value !== "") {
            selectEl.classList.replace('unmatched', 'matched');
        } else {
            selectEl.classList.replace('matched', 'unmatched');
        }
    },

    recalculate: function() {
        const multiplier = parseFloat(document.getElementById('multiplier-input').value) || 0; 
        this.mappedIngredients.forEach(ing => {
            let calc = (ing.baseAmount * multiplier);
            calc = Math.round(calc * 100) / 100;
            document.getElementById(`calc-val-${ing.index}`).innerText = `${calc} ${ing.unit}`;
        });
    },

    goBackToSetup: function() {
        document.getElementById('step-2-checklist').style.display = 'none';
        document.getElementById('step-1-setup').style.display = 'block';
    },

    deductAndStart: async function() {
        const multiplier = parseFloat(document.getElementById('multiplier-input').value) || 0;
        if (multiplier <= 0) return alert("Bitte kg eingeben!");

        let updates = [];
        this.totalCosts = 0; // Kosten-Zähler zurücksetzen

        this.mappedIngredients.forEach(ing => {
            const invId = document.getElementById(`match-select-${ing.index}`).value;
            if (invId !== "" && invId !== "skip") {
                const invItem = this.inventory.find(i => i.id == invId);
                if(invItem) {
                    let neededAmount = ing.baseAmount * multiplier;
                    let deductAmount = neededAmount;
                    
                    const recipeUnit = (ing.unit || '').trim().toLowerCase();
                    const invUnit = (invItem.unit || '').trim().toLowerCase();
                    
                    // Umrechnung für Abzug
                    if (recipeUnit === 'g' && invUnit === 'kg') {
                        deductAmount = neededAmount / 1000;
                    } else if (recipeUnit === 'kg' && invUnit === 'g') {
                        deductAmount = neededAmount * 1000;
                    } else if (recipeUnit === 'ml' && (invUnit === 'l' || invUnit === 'liter')) {
                        deductAmount = neededAmount / 1000;
                    } else if ((recipeUnit === 'l' || recipeUnit === 'liter') && invUnit === 'ml') {
                        deductAmount = neededAmount * 1000;
                    }
                    
                    // KOSTENBERECHNUNG
                    // Wir berechnen: Wie viel % vom Gesamtbestand entnehmen wir? Dieser %-Satz wird vom Gesamtpreis abgezogen.
                    const currentInvAmount = Number(invItem.amount) || 0;
                    const currentInvPrice = Number(invItem.price) || 0;
                    
                    if (currentInvAmount > 0) {
                        const proportion = deductAmount / currentInvAmount;
                        const costForThisItem = currentInvPrice * proportion;
                        this.totalCosts += costForThisItem;
                        
                        // Preis im Lager reduzieren (da Wert entnommen wurde)
                        let newPrice = currentInvPrice - costForThisItem;
                        if (newPrice < 0) newPrice = 0;
                        
                        let newAmount = currentInvAmount - deductAmount;
                        newAmount = Math.round(newAmount * 1000) / 1000;
                        
                        updates.push({ id: invItem.id, amount: newAmount, price: newPrice });
                    }
                }
            }
        });

        if (updates.length > 0 && confirm(`Mengen jetzt vom Lager abbuchen?\n(Materialkosten dieser Charge ca. ${this.totalCosts.toFixed(2)} €)`)) {
            for (let u of updates) {
                // Sende auch den neuen Preis ans Lager!
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${u.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: u.amount, price: u.price })
                });
            }
        }

        // Zeige die berechneten Kosten an
        if (document.getElementById('prod-costs')) {
            document.getElementById('prod-costs').innerText = this.totalCosts.toFixed(2);
        }

        document.getElementById('step-1-setup').style.display = 'none';
        document.getElementById('step-2-checklist').style.display = 'block';
        this.buildChecklist();
    },

    buildChecklist: function() {
        const container = document.getElementById('checklist-container');
        const steps = this.recipe.details.steps || [];
        container.innerHTML = '';
        
        steps.forEach((step, i) => {
            let timerBtn = '';
            let extra = '';

            if (step.type === 'timer' || step.type === 'interval') {
                if (step.type === 'timer') extra = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                if (step.type === 'interval') extra = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                
                timerBtn = `
                    <div class="timer-controls" id="timer-ctrl-${i}" style="display: flex; gap: 10px; margin-top: 15px; padding-left: 50px;">
                        <button style="background: #4d4dff; color: white; border: none; padding: 10px; border-radius: 8px; flex: 1; font-weight: bold; cursor: pointer;" onclick="window.produktionManager.startTimer(${i})">▶️ Starten</button>
                        <button style="background: #333; color: white; border: 1px solid #555; padding: 10px; border-radius: 8px; flex: 1; cursor: pointer;" onclick="window.produktionManager.skipStep(${i})">⏭️ Überspringen</button>
                    </div>
                    <div id="timer-status-${i}" style="display:none; padding-left:50px; margin-top: 10px; color:#4caf50; font-weight: bold;"></div>
                `;
            }

            container.innerHTML += `
                <div class="check-step" id="step-row-${i}" style="padding: 15px; background: #111; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid #444;">
                    <div class="step-header" style="display: flex; gap: 15px; align-items: center; cursor: pointer;" onclick="window.produktionManager.toggleStep(${i})">
                        <div class="check-btn" style="background: #222; border: 2px solid #444; border-radius: 50%; min-width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; color: transparent;"><span class="material-symbols-outlined">check</span></div>
                        <div style="flex:1;"><b style="font-size:0.8rem; color:#888;">SCHRITT ${i+1}</b><p style="margin: 3px 0 0 0; line-height: 1.4;">${step.text} ${extra}</p></div>
                    </div>
                    ${timerBtn}
                </div>`;
        });
    },

    toggleStep: function(i) { 
        document.getElementById(`step-row-${i}`).classList.toggle('done'); 
    },

    startTimer: async function(index) {
        const step = this.recipe.details.steps[index];
        const statusEl = document.getElementById(`timer-status-${index}`);
        
        let ms = 0;
        const d = Number(step.duration) || 0;
        const unit = (step.unit || '').toLowerCase();
        
        if (unit.includes('min')) ms = d * 60000;
        else if (unit.includes('std') || unit.includes('hou')) ms = d * 3600000;
        else if (unit.includes('tag') || unit.includes('day')) ms = d * 86400000;

        const end = new Date(Date.now() + ms).toISOString();
        const payload = { 
            recipe_name: this.recipe.name || "Rezept", 
            step_text: step.text || "Schritt", 
            end_time: end, 
            status: 'running' 
        };

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/active_processes`, {
                method: 'POST',
                headers: { 
                    'apikey': supabaseKey, 
                    'Authorization': `Bearer ${supabaseKey}`, 
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal' 
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                document.getElementById(`step-row-${index}`).style.borderLeftColor = '#4d4dff';
                document.getElementById(`timer-ctrl-${index}`).style.display = 'none';
                statusEl.style.display = 'block';
                statusEl.innerText = "✅ Timer läuft! (Oben und auf Dashboard sichtbar)";
                this.loadActiveProcesses(); // Lade die Liste oben direkt neu
            } else {
                const errText = await res.text();
                alert("DATENBANK-FEHLER: Hast du die Tabelle 'active_processes' in Supabase erstellt?\nDetails: " + errText);
            }
        } catch (e) {
            alert("Netzwerkfehler: " + e.message);
        }
    },

    skipStep: function(i) {
        document.getElementById(`step-row-${i}`).style.borderLeftColor = '#4caf50';
        document.getElementById(`step-row-${i}`).style.opacity = '0.6';
        if(document.getElementById(`timer-ctrl-${i}`)) document.getElementById(`timer-ctrl-${i}`).style.display = 'none';
    },

    finishProduction: function() {
        alert(`Produktion beendet!\n(Kosten: ${this.totalCosts.toFixed(2)} €)`);
        window.location.href = 'index.html';
    }
};

document.addEventListener('DOMContentLoaded', () => window.produktionManager.init());
