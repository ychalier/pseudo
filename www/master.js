window.addEventListener("load", () => {

    function createWorker() {
        let w = new Worker("worker.js");
        w.onmessage = (event) => {
            if (event.data.status == "finished") {
                document.getElementById("progress-container").classList.add("hidden");
                document.getElementById("button-interrupt").disabled = true;
                document.getElementById("button-generate").disabled = false;
                if (event.data.success) {
                    const output = document.getElementById("output");
                    output.innerHTML = "";
                    if (event.data.result.length > 0) {
                        for (const result of event.data.result) {
                            const resultElement = output.appendChild(document.createElement("div"));
                            resultElement.textContent = `${result.string} (${result.score.toFixed(3)})`;
                        }
                    } else {
                        output.innerHTML = "Aucun résultat";
                    }
                } else {
                    alert(event.data.error);
                }
            } else if (event.data.status == "ongoing") {
                const output = document.getElementById("progress-status");
                if (event.data.current < event.data.total) {
                    output.innerHTML = `Génération… (${event.data.current}/${event.data.total})`;
                } else {
                    output.innerHTML = `Génération terminée (${event.data.current}/${event.data.total})`;
                }
                const progress = document.getElementById("progress");
                progress.value = event.data.current;
                progress.max = event.data.total;
                document.getElementById("button-interrupt").disabled = false;
                document.getElementById("button-generate").disabled = true;
            }
        }
        return w;
    }

    let worker = createWorker();

    
    document.getElementById("button-interrupt").addEventListener("click", (event) => {
        worker.terminate();
        document.getElementById("progress-status").innerHTML = "Interrompu";
        document.getElementById("button-interrupt").disabled = true;
        document.getElementById("button-generate").disabled = false;
        worker = createWorker();
    });

    document.getElementById("form-query").addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const query = formData.get("query");
        const options = {
            k: parseInt(formData.get("k")),
            minimumScore: parseFloat(formData.get("mins")),
            minimumTokenLength: parseInt(formData.get("minl")),
            minimumTokenOccurrences: 0, //parseInt(formData.get("mino")),
            prefix: formData.get("prefix") == "" ? null : formData.get("prefix"),
            timeout: parseFloat(formData.get("timeout"))
        }
        worker.postMessage([query, options]);
        document.getElementById("output").innerHTML = "";
        document.getElementById("progress-status").innerHTML = "Génération…";
        document.getElementById("button-interrupt").disabled = false;
        document.getElementById("button-generate").disabled = true;
        document.getElementById("progress-container").classList.remove("hidden");
    });
    
});