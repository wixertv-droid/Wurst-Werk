window.settingsManager = {
    currentPin: "0000", // Fallback, falls die Datenbank leer ist

    init: async function() {
        await this.loadPin();
    },

    loadPin: async function() {
        try {
            // Holt sich den PIN aus der Tabelle app_settings, wo die ID 1 ist
            const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?id=eq.1&select=pin_code`, {
                headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    this.currentPin = data[0].pin_code;
                }
            }
        } catch (e) {
            console.error("Fehler beim Laden des PINs", e);
        }
    },

    changePin: async function() {
        const oldPinInput = document.getElementById('old-pin').value;
        const newPinInput = document.getElementById('new-pin').value;
        const confirmPinInput = document.getElementById('confirm-pin').value;
        const btn = document.getElementById('save-pin-btn');

        if (!oldPinInput || !newPinInput || !confirmPinInput) {
            alert("Bitte fülle alle Felder aus!");
            return;
        }

        if (oldPinInput !== this.currentPin) {
            alert("Der aktuelle PIN ist falsch!");
            return;
        }

        if (newPinInput !== confirmPinInput) {
            alert("Die neuen PINs stimmen nicht überein!");
            return;
        }

        if (newPinInput.length !== 4) {
            alert("Der PIN muss genau 4 Ziffern lang sein!");
            return;
        }

        const originalText = btn.innerHTML;
        btn.innerHTML = `<span class="material-symbols-outlined">sync</span> Speichert...`;

        try {
            // Speichert den neuen PIN in Supabase
            const res = await fetch(`${supabaseUrl}/rest/v1/app_settings?id=eq.1`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ pin_code: newPinInput })
            });

            if (res.ok) {
                alert("✅ PIN erfolgreich geändert!");
                this.currentPin = newPinInput;
                document.getElementById('old-pin').value = '';
                document.getElementById('new-pin').value = '';
                document.getElementById('confirm-pin').value = '';
            } else {
                alert("Fehler beim Speichern in der Datenbank.");
            }
        } catch (e) {
            alert("Netzwerkfehler beim Speichern.");
        }

        btn.innerHTML = originalText;
    }
};

document.addEventListener('DOMContentLoaded', () => window.settingsManager.init());
