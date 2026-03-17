const production = {
    timerInterval: null,

    // Wird aufgerufen, wenn du bei einem Rezept auf "Produktion starten" klickst
    startRun: function(recipeName, durationInSeconds) {
        // 1. Später kommt hier der Code rein, der die Datenbank anspricht
        // und z.B. 10 Gläser und 2kg Fleisch abzieht.
        alert(`Produktion für ${recipeName} gestartet!\nZutaten wurden virtuell aus dem Lager abgezogen.`);

        // 2. Wir wechseln automatisch zum Dashboard (Home), um den Prozess zu sehen
        const homeNavBtn = document.querySelector('.nav-item'); // Der erste Button ist Home
        app.switchView('home', homeNavBtn);

        // 3. Wir aktualisieren die Dashboard-Anzeige
        document.querySelector('.smoker-card p').innerText = `Produktion läuft: ${recipeName}`;
        document.querySelector('.smoker-card .material-symbols-outlined').style.color = '#ff4444'; // Flamme wird rot

        // 4. Timer starten
        this.startTimer(durationInSeconds);
    },

    startTimer: function(secondsLeft) {
        // Falls schon ein Timer läuft, stoppen wir ihn erst
        if(this.timerInterval) clearInterval(this.timerInterval);

        const timerDisplay = document.getElementById('main-timer');

        this.timerInterval = setInterval(() => {
            if(secondsLeft <= 0) {
                clearInterval(this.timerInterval);
                timerDisplay.innerText = "FERTIG!";
                document.querySelector('.smoker-card p').innerText = "Produktion abgeschlossen. Bitte entnehmen.";
                // Haptisches Feedback (Vibration), wenn das iPhone es unterstützt
                if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
                return;
            }

            // Zeit umrechnen in HH:MM:SS
            let h = Math.floor(secondsLeft / 3600);
            let m = Math.floor((secondsLeft % 3600) / 60);
            let s = secondsLeft % 60;

            // Führende Nullen hinzufügen (z.B. 09 statt 9)
            h = String(h).padStart(2, '0');
            m = String(m).padStart(2, '0');
            s = String(s).padStart(2, '0');

            timerDisplay.innerText = `${h}:${m}:${s}`;
            secondsLeft--;
        }, 1000); // Jede Sekunde aktualisieren
    }
};
