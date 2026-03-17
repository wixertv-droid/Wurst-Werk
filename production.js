    startTimer: async function(index) {
        const step = this.recipe.details.steps[index];
        const row = document.getElementById(`step-row-${index}`);
        const controls = document.getElementById(`timer-controls-${index}`);
        const status = document.getElementById(`timer-status-${index}`);

        // Dauer in Millisekunden umrechnen
        let durationMs = 0;
        const dur = Number(step.duration);
        if (step.unit === 'Minuten') durationMs = dur * 60 * 1000;
        else if (step.unit === 'Stunden') durationMs = dur * 60 * 60 * 1000;
        else if (step.unit === 'Tage') durationMs = dur * 24 * 60 * 60 * 1000;

        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + durationMs);

        // In Datenbank speichern
        const payload = {
            recipe_name: this.recipe.name,
            step_text: step.text,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            status: 'running'
        };

        try {
            const res = await fetch(`${supabaseUrl}/rest/v1/active_processes`, {
                method: 'POST',
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                row.classList.add('running');
                if(controls) controls.style.display = 'none';
                status.style.display = 'block';
                status.innerHTML = `✅ Timer gestartet! Erscheint jetzt auf dem Dashboard.`;
            }
        } catch (e) { alert("Fehler beim Starten des Timers!"); }
    },
