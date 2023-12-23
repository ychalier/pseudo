window.addEventListener("load", () => {

    function createWorker() {
        let w = new Worker("worker.js");
        w.onmessage = (event) => {
            if (event.data.status == "finished") {
                document.getElementById("button-interrupt").disabled = true;
                document.getElementById("button-generate").disabled = false;
                if (event.data.success) {
                    const output = document.getElementById("pre-output");
                    output.innerHTML = "";
                    if (event.data.result.length > 0) {
                        for (const result of event.data.result) {
                            output.innerHTML += `${result.string} (${result.score.toFixed(3)})\n`;
                        }
                    } else {
                        output.innerHTML = "Aucun résultat"
                    }
                } else {
                    alert(event.data.error);
                }
            } else if (event.data.status == "ongoing") {
                const output = document.getElementById("pre-output");
                output.innerHTML = `Génération… (${event.data.current}/${event.data.total})`;
                document.getElementById("button-interrupt").disabled = false;
                document.getElementById("button-generate").disabled = true;
            }
        }
        return w;
    }

    let worker = createWorker();

    
    document.getElementById("button-interrupt").addEventListener("click", (event) => {
        worker.terminate();
        document.getElementById("pre-output").innerHTML = "Interrompu";
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
            minimumTokenOccurrences: parseInt(formData.get("mino")),
            prefix: formData.get("prefix") == "" ? null : formData.get("prefix"),
            timeout: parseFloat(formData.get("timeout"))
        }
        worker.postMessage([query, options]);
        document.getElementById("pre-output").innerHTML = "Génération…";
        document.getElementById("button-interrupt").disabled = false;
        document.getElementById("button-generate").disabled = true;
    });
    
});