window.rezeptManager = {
    currentRecipeData: null, 

    init: async function() {
        await this.loadList();
    },

    showView: function(viewName) {
        document.getElementById('recipe-list-view').style.display = viewName === 'list' ? 'block' : 'none';
        document.getElementById('recipe-detail-view').style.display = viewName === 'detail' ? 'block' : 'none';
        document.getElementById('recipe-editor-view').style.display = viewName === 'editor' ? 'block' : 'none';
    },

    loadList: async function() {
        const listEl = document.getElementById('recipe-page-list');
        if (!listEl) return;

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/recipes?select=*&order=name.asc`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            
            if (!response.ok) {
                listEl.innerHTML = '<p class="text-muted" style="color: var(--accent-danger); text-align: center;">Datenbank-Fehler! Wurde die Tabelle "recipes" angelegt?</p>';
                return;
            }

            const recipes = await response.json();
            listEl.innerHTML = '';

            if (recipes.length === 0) {
                listEl.innerHTML = '<p class="text-muted" style="text-align: center;">Keine Rezepte gefunden.</p>';
                return;
            }

            recipes.forEach(r => {
                const safeData = encodeURIComponent(JSON.stringify(r));
                
                // HIER: Der Lösch-Button wurde durch den Slider ersetzt
                listEl.innerHTML += `
                    <div class="list-card" style="border-left: 3px solid var(--accent-amber); cursor: pointer;" onclick="window.rezeptManager.openDetail('${safeData}')">
                        <div class="icon-box" style="background: #222;">
                            <span class="material-symbols-outlined" style="color: var(--accent-amber);">restaurant_menu</span>
                        </div>
                        <div class="info">
                            <h3 style="font-size: 1.1rem; margin-bottom: 4px;">${r.name}</h3>
                            <p style="color: #aaa; font-size: 0.85rem; margin: 0;">Auf 1kg genormt</p>
                        </div>
                        
                        <div class="recipe-delete-slider" id="delete-slider-${r.id}" onclick="event.stopPropagation()">
                            <div class="delete-slider-track">
                                <div class="delete-slider-handle"></div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Slider sofort initialisieren, wenn das Element geladen ist
                setTimeout(() => this.initDeleteSlider(r.id, r.name), 50);
            });
        } catch (e) {
            listEl.innerHTML = '<p class="text-muted" style="color: red;">Netzwerk-Fehler beim Laden.</p>';
        }
    },

    // NEU: Die Logik für den Schieberegler
    initDeleteSlider: function(recipeId, recipeName) {
        const slider = document.getElementById(`delete-slider-${recipeId}`);
        if (!slider) return;
        
        const handle = slider.querySelector('.delete-slider-handle');
        const track = slider.querySelector('.delete-slider-track');
        let isDragging = false;
        let startX, handleLeft;

        const onStart = (e) => {
            isDragging = true;
            slider.classList.add('dragging');
            startX = (e.type === 'touchstart') ? e.touches[0].clientX : e.clientX;
            handleLeft = handle.offsetLeft;
            track.style.transition = 'none'; 
        };

        const onMove = (e) => {
            if (!isDragging) return;
            const currentX = (e.type === 'touchmove') ? e.touches[0].clientX : e.clientX;
            let moveX = currentX - startX + handleLeft;
            
            // Grenzen des Sliders
            if (moveX < 4) moveX = 4;
            if (moveX > 30) moveX = 30;
            
            handle.style.left = `${moveX}px`;
        };

        const onEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            slider.classList.remove('dragging');
            track.style.transition = '0.4s'; 

            const threshold = track.offsetWidth - handle.offsetWidth - 5; 

            if (handle.offsetLeft >= threshold) {
                // Richtig weit gezogen! 
                slider.classList.add('active'); 
                handle.style.left = '30px'; 

                setTimeout(() => {
                    if (confirm(`⚠️ VORSICHT!\n\nMöchtest du das Rezept '${recipeName}' wirklich unwiderruflich löschen?`)) {
                        this.deleteRecipe(recipeId, recipeName, true); // Wahres Löschen aufrufen
                    } else {
                        // Abgebrochen
                        this.resetSlider(slider, handle);
                    }
                }, 100);

            } else {
                // Nicht weit genug gezogen
                this.resetSlider(slider, handle);
            }
        };

        handle.addEventListener('mousedown', onStart);
        handle.addEventListener('touchstart', onStart, {passive: true});
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, {passive: true});
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    },

    resetSlider: function(slider, handle) {
        slider.classList.remove('active');
        handle.style.left = '4px'; 
    },

    openDetail: function(encodedData) {
        const r = JSON.parse(decodeURIComponent(encodedData));
        this.currentRecipeData = r; 
        const details = r.details || {};

        document.getElementById('detail-title').innerText = r.name;

        const ingContainer = document.getElementById('detail-ingredients');
        ingContainer.innerHTML = '';
        if (details.ingredients && details.ingredients.length > 0) {
            details.ingredients.forEach(ing => {
                ingContainer.innerHTML += `
                    <div class="ing-row">
                        <span>${ing.name}</span>
                        <b style="color: var(--text-main);">${ing.amount} ${ing.unit}</b>
                    </div>
                `;
            });
        } else {
            ingContainer.innerHTML = '<p class="text-muted">Keine Zutaten hinterlegt.</p>';
        }

        const stepsContainer = document.getElementById('detail-steps');
        stepsContainer.innerHTML = '';
        if (details.steps && details.steps.length > 0) {
            let stepNum = 1;
            details.steps.forEach(step => {
                let icon = 'check_circle';
                let styleClass = '';
                let extraText = '';

                if (step.type === 'timer') {
                    icon = 'schedule'; styleClass = 'timer';
                    extraText = `<br><b style="color:#4d4dff;">⏳ ${step.duration} ${step.unit}</b>`;
                } else if (step.type === 'interval') {
                    icon = 'sync'; styleClass = 'interval';
                    extraText = `<br><b style="color:var(--accent-amber);">🔁 ${step.cycles}x ${step.duration} ${step.unit} (Pause: ${step.pauses}h)</b>`;
                }

                stepsContainer.innerHTML += `
                    <div class="step-row ${styleClass}">
                        <div class="step-icon"><span class="material-symbols-outlined">${icon}</span></div>
                        <div class="step-text">
                            <b style="color: #fff; font-size: 0.8rem; text-transform: uppercase;">Schritt ${stepNum}</b><br>
                            ${step.text} ${extraText}
                        </div>
                    </div>
                `;
                stepNum++;
            });
        } else {
            stepsContainer.innerHTML = '<p class="text-muted">Kein Ablauf hinterlegt.</p>';
        }

        this.showView('detail');
    },

    openEditor: function() {
        document.getElementById('editor-title').innerText = "Neues Rezept";
        document.getElementById('edit-id').value = '';
        document.getElementById('edit-name').value = '';
        document.getElementById('editor-ingredients-list').innerHTML = '';
        document.getElementById('editor-steps-list').innerHTML = '';
        
        this.addIngredientRow();
        this.addStepRow();

        this.showView('editor');
    },

    editCurrentRecipe: function() {
        if (!this.currentRecipeData) return;
        const r = this.currentRecipeData;
        const details = r.details || {};

        document.getElementById('editor-title').innerText = "Rezept bearbeiten";
        document.getElementById('edit-id').value = r.id;
        document.getElementById('edit-name').value = r.name;
        
        const ingList = document.getElementById('editor-ingredients-list');
        ingList.innerHTML = '';
        if (details.ingredients) {
            details.ingredients.forEach(ing => this.addIngredientRow(ing.name, ing.amount, ing.unit));
        }

        const stepsList = document.getElementById('editor-steps-list');
        stepsList.innerHTML = '';
        if (details.steps) {
            details.steps.forEach(s => this.addStepRow(s.type, s.text, s.duration, s.unit, s.cycles, s.pauses));
        }

        this.showView('editor');
    },

    addIngredientRow: function(name = '', amount = '', unit = 'g') {
        const container = document.getElementById('editor-ingredients-list');
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `
            <input type="text" class="recipe-input ing-name" placeholder="Zutat (z.B. Salz)" value="${name}" style="flex: 2;">
            <input type="number" class="recipe-input ing-amount" placeholder="Menge" value="${amount}" style="flex: 1;">
            <select class="recipe-select ing-unit" style="flex: 1;">
                <option value="g" ${unit==='g'?'selected':''}>g</option>
                <option value="ml" ${unit==='ml'?'selected':''}>ml</option>
                <option value="Stk" ${unit==='Stk'?'selected':''}>Stk</option>
            </select>
            <span class="material-symbols-outlined" style="color: var(--accent-danger); cursor: pointer; padding: 5px;" onclick="this.parentElement.remove()">close</span>
        `;
        container.appendChild(row);
    },

    addStepRow: function(type = 'task', text = '', duration = '', unit = 'Stunden', cycles = '', pauses = '') {
        const container = document.getElementById('editor-steps-list');
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.style.flexDirection = 'column';
        row.style.alignItems = 'stretch';
        
        row.innerHTML = `
            <div style="display: flex; gap: 8px;">
                <select class="recipe-select step-type" style="flex: 1;" onchange="window.rezeptManager.toggleStepFields(this)">
                    <option value="task" ${type==='task'?'selected':''}>✅ Einfacher Schritt</option>
                    <option value="timer" ${type==='timer'?'selected':''}>⏳ Wartezeit / Timer</option>
                    <option value="interval" ${type==='interval'?'selected':''}>🔁 Intervall (z.B. Räuchern)</option>
                </select>
                <span class="material-symbols-outlined" style="color: var(--accent-danger); cursor: pointer; padding: 10px;" onclick="this.parentElement.parentElement.remove()">delete</span>
            </div>
            <input type="text" class="recipe-input step-text" placeholder="Beschreibung (z.B. Fleisch wolfen)" value="${text}">
            
            <div class="timer-fields" style="display: ${type === 'task' ? 'none' : 'flex'}; gap: 8px;">
                <input type="number" class="recipe-input step-duration" placeholder="Dauer" value="${duration}" style="flex: 1;">
                <select class="recipe-select step-unit" style="flex: 1;">
                    <option value="Minuten" ${unit==='Minuten'?'selected':''}>Minuten</option>
                    <option value="Stunden" ${unit==='Stunden'?'selected':''}>Stunden</option>
                    <option value="Tage" ${unit==='Tage'?'selected':''}>Tage</option>
                </select>
            </div>
            
            <div class="interval-fields" style="display: ${type === 'interval' ? 'flex' : 'none'}; gap: 8px; margin-top: 8px;">
                <input type="number" class="recipe-input step-cycles" placeholder="Durchgänge (z.B. 3)" value="${cycles}" style="flex: 1;">
                <input type="number" class="recipe-input step-pauses" placeholder="Pause (Std) (z.B. 12)" value="${pauses}" style="flex: 1;">
            </div>
        `;
        container.appendChild(row);
    },

    toggleStepFields: function(selectElement) {
        const row = selectElement.parentElement.parentElement;
        const type = selectElement.value;
        row.querySelector('.timer-fields').style.display = type === 'task' ? 'none' : 'flex';
        row.querySelector('.interval-fields').style.display = type === 'interval' ? 'flex' : 'none';
    },

    saveRecipe: async function() {
        const id = document.getElementById('edit-id').value;
        const nameVal = document.getElementById('edit-name').value.trim();
        if (!nameVal) { alert("Bitte gib dem Rezept einen Namen!"); return; }

        const ingredients = [];
        document.querySelectorAll('#editor-ingredients-list .dynamic-row').forEach(row => {
            const name = row.querySelector('.ing-name').value.trim();
            const amount = Number(row.querySelector('.ing-amount').value);
            const unit = row.querySelector('.ing-unit').value;
            if (name && amount > 0) ingredients.push({ name, amount, unit });
        });

        const steps = [];
        document.querySelectorAll('#editor-steps-list .dynamic-row').forEach(row => {
            const type = row.querySelector('.step-type').value;
            const text = row.querySelector('.step-text').value.trim();
            if (!text) return; 
            
            let stepData = { type, text };
            if (type !== 'task') {
                stepData.duration = Number(row.querySelector('.step-duration').value);
                stepData.unit = row.querySelector('.step-unit').value;
            }
            if (type === 'interval') {
                stepData.cycles = Number(row.querySelector('.step-cycles').value);
                stepData.pauses = Number(row.querySelector('.step-pauses').value);
            }
            steps.push(stepData);
        });

        const detailsObj = { ingredients, steps };
        const payload = { name: nameVal, details: detailsObj };

        try {
            let url = `${supabaseUrl}/rest/v1/recipes`;
            let method = 'POST';

            if (id) {
                url = `${url}?id=eq.${id}`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                this.showView('list');
                await this.loadList();
            } else {
                alert("Fehler beim Speichern!");
            }
        } catch (e) { alert("Netzwerkfehler"); }
    },

    // Die Löschfunktion wurde etwas angepasst, da das Confirm jetzt im Slider passiert
    deleteRecipe: async function(id, name, confirmed = false) {
        // Fallback, falls die Funktion doch mal direkt aufgerufen wird
        if (!confirmed && !confirm(`Rezept "${name}" wirklich löschen?`)) return;
        
        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/recipes?id=eq.${id}`, {
                method: 'DELETE',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) await this.loadList();
        } catch (e) { alert("Fehler beim Löschen."); }
    },

    startProduction: function() {
        if (!this.currentRecipeData) return;
        window.location.href = `produktion.html?id=${this.currentRecipeData.id}`;
    }
};

document.addEventListener('DOMContentLoaded', () => window.rezeptManager.init());
