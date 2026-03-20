window.produktionManager = {
    recipe: null,
    inventory: [],
    mappedIngredients: [], 
    totalCosts: 0, 
    activeProcesses: [], // Speichert die Timer aus der DB

    init: async function() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');

        if (!id) {
            alert("Kein Rezept ausgewählt!");
            window.location.href = 'rezepte.html';
            return;
        }

        try {
            // 1. Rezept laden
            const recipeRes = await fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}&select=*`, { 
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } 
            });
            const recipes = await recipeRes.json();
            if (recipes.length === 0) throw new Error("Rezept nicht gefunden");
            this.recipe = recipes[0];

            // 2. Lager und aktive Produktionen (Timer) FÜR DIESES REZEPT laden!
            const [invData, activeRes] = await Promise.all([
                db.getInventory(),
                fetch(`${supabaseUrl}/rest/v1/active_processes?recipe_name=eq.${encodeURIComponent(this.recipe.name)}&status=eq.running`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                })
            ]);

            this.inventory = Array.isArray(invData) ? invData : [];
            this.activeProcesses = activeRes.ok ? await activeRes.json() : [];

            document.getElementById('prod-title').innerText = `Produktion: ${this.recipe.name}`;

            // 3. LOGIK: Läuft hier schon eine Produktion?
            if (this.activeProcesses.length > 0) {
                // JA! Produktion läuft -> Überspringe Lagerabzug und gehe direkt in die Checkliste
                document.getElementById('step-1-setup').style.display = 'none';
                document.getElementById('step-2-checklist').style.display = 'block';
                
                // Kosten ausblenden, da diese in der Vergangenheit abgebucht wurden
                const costsCard = document.getElementById('costs-card');
                if (costsCard) costsCard.style.display = 'none';

                // Zurück-Button anpassen (geht jetzt zu Rezepten statt Schritt 1)
                const backBtn = document.getElementById('back-btn-step2');
                if (backBtn) {
                    backBtn.setAttribute('onclick', "window.location.href='rezepte.html'");
                    backBtn.innerHTML = '<span class="material-symbols-outlined">arrow_back_ios</span> Zurück zu Rezepte';
                }

                this.buildChecklist();
            } else {
                // NEIN! Neue Produktion -> Starte ganz normal bei Schritt 1
                document.getElementById('step-1-setup').style.display = 'block';
                document.getElementById('step-2-checklist').style.display = 'none';
                this.buildMatchingUI();
            }

        } catch (e) {
            alert("Fehler beim Laden der Produktionsdaten!");
            window.location.href = 'rezepte.html';
        }
    },

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
                if (scoreA !== scoreB) return scoreB - scoreA; 
                return (a.category || '').localeCompare(b.category || '');
            });

            let bestMatch = null;
            if (sortedInv.length > 0 && getScore(sortedInv[0].name) > 0) {
                bestMatch = sortedInv[0];
            }

            let optionsHtml = `<option value="">-- Bitte Lager-Artikel zuordnen --</option>`;
            
            sortedInv.forEach(item => {
                const isSelected = bestMatch && bestMatch.id === item.id ? 'selected' : '';
                const itemPrice = Number(item.price) || 0;
                optionsHtml += `<option value="${item.id}" ${isSelected}>[${item.category}] ${item.name} (${item.amount} ${item.unit}) - ${itemPrice.toFixed(2)}€</option>`;
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
        this.totalCosts = 0; 

        this.mappedIngredients.forEach(ing => {
            const invId = document.getElementById(`match-select-${ing.index}`).value;
            if (invId !== "" && invId !== "skip") {
                const invItem = this.inventory.find(i => i.id == invId);
                if(invItem) {
                    let neededAmount = ing.baseAmount * multiplier;
                    let deductAmount = neededAmount;
                    
                    const recipeUnit = (ing.unit || '').trim().toLowerCase();
                    const invUnit = (invItem.unit || '').trim().toLowerCase();
                    
                    if (recipeUnit === 'g' && invUnit === 'kg') deductAmount = neededAmount / 1000;
                    else if (recipeUnit === 'kg' && invUnit === 'g') deductAmount = neededAmount * 1000;
                    else if (recipeUnit === 'ml' && (invUnit === 'l' || invUnit === 'liter')) deductAmount = neededAmount / 1000;
                    else if ((recipeUnit === 'l' || recipeUnit === 'liter') && invUnit === 'ml') deductAmount = neededAmount * 1000;
                    
                    const currentInvAmount = Number(invItem.amount) || 0;
                    const currentInvPrice = Number(invItem.price) || 0;
                    
                    if (currentInvAmount > 0 && deductAmount > 0) {
                        let proportion = deductAmount / currentInvAmount;
                        if (proportion > 1) proportion = 1; 
                        
                        const costForThisItem = currentInvPrice * proportion;
                        this.totalCosts += costForThisItem;
                        
                        let newPrice = currentInvPrice - costForThisItem;
                        if (newPrice < 0) newPrice = 0;
                        
                        let newAmount = currentInvAmount - deductAmount;
                        if (newAmount < 0) newAmount = 0;
                        newAmount = Math.round(newAmount * 1000) / 1000;
                        
                        updates.push({ id: invItem.id, amount: newAmount, price: newPrice });
                    }
                }
            }
        });

        if (updates.length > 0 && confirm(`Mengen jetzt vom Lager abbuchen?\n(Materialkosten dieser Charge ca. ${this.totalCosts.toFixed(2)} €)`)) {
            for (let u of updates) {
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${u.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: u.amount, price: u.price })
                });
            }
        }

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

            // Prüfen, ob für diesen Schritt bereits ein Timer in der Datenbank läuft!
            const activeProc = this.activeProcesses.find(p => p.step_text === step.text);

            if (step.type === 'timer' || step.type === 'interval') {
                if (step.type === 'timer') extra = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                if (step.type === 'interval') extra = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                
                if (activeProc) {
                    // TIMER LÄUFT BEREITS! -> Zeige den laufenden Timer anstelle der Buttons
                    timerBtn = `
                        <div id="timer-status-${i}" style="padding-left:50px; margin-top: 10px; color:#4caf50; font-weight: bold;">
                            <span class="material-symbols-outlined" style="vertical-align: middle;">hourglass_bottom</span> Läuft: 
                            <span id="prod-timer-${activeProc.id}" style="color:var(--accent-amber); font-size:1.2rem; margin-left: 5px;">Berechne...</span>
                        </div>
                    `;
                    // Countdown asynchron starten, damit das HTML erst gerendert wird
                    setTimeout(() => this.startCountdown(activeProc.id, activeProc.end_time), 100);
                } else {
                    // TIMER LÄUFT NOCH NICHT -> Zeige Start-Buttons
                    timerBtn = `
                        <div class="timer-controls" id="timer-ctrl-${i}" style="display: flex; gap: 10px; margin-top: 15px; padding-left: 50px;">
                            <button class="btn-start" onclick="window.produktionManager.startTimer(${i})">▶️ Starten</button>
                            <button class="btn-skip" onclick="window.produktionManager.skipStep(${i})">⏭️ Überspringen</button>
                        </div>
                        <div id="timer-status-${i}" style="display:none; padding-left:50px; margin-top: 10px; color:#4caf50; font-weight: bold;"></div>
                    `;
                }
            }

            const isRunningClass = activeProc ? 'running' : '';

            container.innerHTML += `
                <div class="check-step ${isRunningClass}" id="step-row-${i}">
                    <div class="step-header" onclick="window.produktionManager.toggleStep(${i})">
                        <div class="check-btn"><span class="material-symbols-outlined">check</span></div>
                        <div style="flex:1;"><b style="font-size:0.8rem; color:#888;">SCHRITT ${i+1}</b><p style="margin: 3px 0 0 0; line-height: 1.4;">${step.text} ${extra}</p></div>
                    </div>
                    ${timerBtn}
                </div>`;
        });
    },

    toggleStep: function(i) { 
        const row = document.getElementById(`step-row-${i}`);
        if(row) {
            row.classList.toggle('done');
        }
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
                // Wir laden die Prozesse neu und bauen die Checkliste neu auf, 
                // damit der Timer den exakten Eintrag aus der DB bekommt!
                const activeRes = await fetch(`${supabaseUrl}/rest/v1/active_processes?recipe_name=eq.${encodeURIComponent(this.recipe.name)}&status=eq.running`, {
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
                });
                this.activeProcesses = await activeRes.json();
                this.buildChecklist();
            } else {
                alert("Fehler: Hast du die Tabelle 'active_processes' in Supabase angelegt?");
            }
        } catch (e) {
            alert("Netzwerkfehler: " + e.message);
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

    skipStep: function(i) {
        const row = document.getElementById(`step-row-${i}`);
        if(row) {
            row.classList.add('done');
            const ctrl = document.getElementById(`timer-ctrl-${i}`);
            if(ctrl) ctrl.style.display = 'none';
        }
    },

    finishProduction: function() {
        window.location.href = 'index.html';
    }
};

document.addEventListener('DOMContentLoaded', () => window.produktionManager.init());
