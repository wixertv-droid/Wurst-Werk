window.produktionManager = {
    recipe: null,
    inventory: [],
    mappedIngredients: [], 

    init: async function() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        
        if (!id) {
            alert("Kein Rezept ausgewählt!");
            window.location.href = 'rezepte.html';
            return;
        }

        try {
            const [recipeRes, invData] = await Promise.all([
                fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}&select=*`, { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }),
                db.getInventory()
            ]);

            const recipes = await recipeRes.json();
            if (recipes.length === 0) throw new Error("Rezept nicht gefunden");
            
            this.recipe = recipes[0];
            this.inventory = invData;

            document.getElementById('prod-title').innerText = `Produktion: ${this.recipe.name}`;
            this.buildMatchingUI();

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

        ingredients.forEach((ing, index) => {
            let bestMatch = this.inventory.find(item => 
                item.name.toLowerCase().includes(ing.name.toLowerCase()) || 
                ing.name.toLowerCase().includes(item.name.toLowerCase())
            );

            let optionsHtml = `<option value="">-- Bitte Lager-Artikel zuordnen --</option>`;
            const sortedInv = [...this.inventory].sort((a,b) => a.category.localeCompare(b.category));
            
            sortedInv.forEach(item => {
                if(item.category === 'Pfandglas' || item.category === 'Maschine') return; 
                const isSelected = bestMatch && bestMatch.id === item.id ? 'selected' : '';
                optionsHtml += `<option value="${item.id}" ${isSelected}>[${item.category}] ${item.name} (${item.amount} ${item.unit} auf Lager)</option>`;
            });

            const selectClass = bestMatch ? 'matched' : 'unmatched';

            container.innerHTML += `
                <div class="match-row">
                    <div class="match-header">
                        <span style="font-weight: bold; color: var(--accent-amber);">${ing.name}</span>
                        <span style="font-size: 1.2rem; font-weight: bold;" id="calc-val-${index}">${ing.amount} ${ing.unit}</span>
                    </div>
                    <select class="match-select ${selectClass}" id="match-select-${index}" onchange="window.produktionManager.updateSelectColor(this)">
                        ${optionsHtml}
                        <option value="skip">❌ Nicht aus dem Lager abbuchen (Ignorieren)</option>
                    </select>
                </div>
            `;

            this.mappedIngredients.push({
                originalName: ing.name,
                baseAmount: ing.amount,
                unit: ing.unit,
                index: index
            });
        });
    },

    updateSelectColor: function(selectEl) {
        if(selectEl.value && selectEl.value !== "") {
            selectEl.classList.remove('unmatched');
            selectEl.classList.add('matched');
        } else {
            selectEl.classList.remove('matched');
            selectEl.classList.add('unmatched');
        }
    },

    recalculate: function() {
        const multiInput = document.getElementById('multiplier-input').value;
        const multiplier = parseFloat(multiInput) || 0; 

        this.mappedIngredients.forEach(ing => {
            const calculatedAmount = (ing.baseAmount * multiplier);
            const displayAmount = calculatedAmount % 1 === 0 ? calculatedAmount : calculatedAmount.toFixed(1);
            document.getElementById(`calc-val-${ing.index}`).innerText = `${displayAmount} ${ing.unit}`;
        });
    },

    goBackToSetup: function() {
        document.getElementById('step-2-checklist').style.display = 'none';
        document.getElementById('step-1-setup').style.display = 'block';
    },

    deductAndStart: async function() {
        const multiInput = document.getElementById('multiplier-input').value;
        const multiplier = parseFloat(multiInput) || 0;
        
        if (multiplier <= 0) {
            alert("Bitte gib eine gültige Fleischmenge (kg) ein!");
            return;
        }

        let updates = [];
        let hasErrors = false;

        this.mappedIngredients.forEach(ing => {
            const selectEl = document.getElementById(`match-select-${ing.index}`);
            const invId = selectEl.value;
            
            if (invId === "") {
                hasErrors = true;
                selectEl.style.border = "2px solid red";
            } else if (invId !== "skip") {
                const neededAmount = (ing.baseAmount * multiplier);
                const invItem = this.inventory.find(i => i.id == invId);
                
                if(invItem) {
                    let newAmount = Number(invItem.amount) - neededAmount;
                    updates.push({ id: invItem.id, amount: newAmount });
                }
            }
        });

        if (hasErrors) {
            alert("⚠️ Bitte ordne alle rot markierten Zutaten einem Lager-Artikel zu oder wähle 'Ignorieren'!");
            return;
        }

        if (updates.length > 0) {
            if(!confirm(`Möchtest du die berechneten Mengen jetzt wirklich fest aus deinem Lager abbuchen?`)) return;

            for (let update of updates) {
                await fetch(`${supabaseUrl}/rest/v1/inventory?id=eq.${update.id}`, {
                    method: 'PATCH',
                    headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: update.amount })
                });
            }
        }

        document.getElementById('step-1-setup').style.display = 'none';
        document.getElementById('step-2-checklist').style.display = 'block';
        this.buildChecklist();
    },

    buildChecklist: function() {
        const container = document.getElementById('checklist-container');
        const details = this.recipe.details || {};
        const steps = details.steps || [];

        container.innerHTML = '';
        
        if (steps.length === 0) {
            container.innerHTML = '<p class="text-muted">Keine Arbeitsschritte hinterlegt.</p>';
            return;
        }

        steps.forEach((step, index) => {
            let extra = '';
            let timerButtons = '';

            // Wenn es ein Timer ist, bauen wir die neuen Buttons ein!
            if (step.type === 'timer' || step.type === 'interval') {
                if (step.type === 'timer') extra = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                if (step.type === 'interval') extra = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                
                timerButtons = `
                    <div class="timer-controls" id="timer-controls-${index}">
                        <button class="btn-start" onclick="event.stopPropagation(); window.produktionManager.startTimer(${index})">▶️ Starten</button>
                        <button class="btn-skip" onclick="event.stopPropagation(); window.produktionManager.skipStep(${index})">⏭️ Überspringen</button>
                    </div>
                    <div id="timer-status-${index}" style="display: none; padding-left: 50px; margin-top: 10px; color: #4caf50; font-weight: bold;"></div>
                `;
            }

            container.innerHTML += `
                <div class="check-step" id="step-row-${index}">
                    <div class="step-header" onclick="window.produktionManager.toggleStep(${index})">
                        <div class="check-btn"><span class="material-symbols-outlined">check</span></div>
                        <div style="flex: 1;">
                            <b style="font-size: 0.8rem; color: #888; text-transform: uppercase;">Schritt ${index + 1}</b>
                            <p style="margin: 3px 0 0 0; font-size: 0.95rem; line-height: 1.4;">${step.text} ${extra}</p>
                        </div>
                    </div>
                    ${timerButtons}
                </div>
            `;
        });
    },

    toggleStep: function(index) {
        // Ein normaler Klick zum manuellen Abhaken
        const row = document.getElementById(`step-row-${index}`);
        row.classList.toggle('done');
    },

    startTimer: function(index) {
        const row = document.getElementById(`step-row-${index}`);
        const controls = document.getElementById(`timer-controls-${index}`);
        const status = document.getElementById(`timer-status-${index}`);

        // Visuelles Update
        row.classList.add('running');
        controls.style.display = 'none';
        status.style.display = 'block';
        status.innerHTML = `⏳ Timer läuft im Hintergrund... (Wird ans Dashboard gesendet)`;

        // HINWEIS: Das Speichern in die aktive Datenbank bauen wir als Nächstes fürs Dashboard!
    },

    skipStep: function(index) {
        const row = document.getElementById(`step-row-${index}`);
        const controls = document.getElementById(`timer-controls-${index}`);
        const status = document.getElementById(`timer-status-${index}`);

        // Sofort Abhaken
        row.classList.add('done');
        row.classList.remove('running');
        if (controls) controls.style.display = 'none';
        if (status) {
            status.style.display = 'block';
            status.innerHTML = `⏭️ Schritt manuell übersprungen!`;
            status.style.color = "var(--accent-amber)";
        }
    },

    finishProduction: function() {
        alert("✅ Rezept abgearbeitet!\nAls nächstes bauen wir das Einlagern in den 'Fertigen Bestand' und die Dashboard-Timer.");
        window.location.href = 'index.html'; 
    }
};

document.addEventListener('DOMContentLoaded', () => window.produktionManager.init());
