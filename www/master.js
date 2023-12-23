window.addEventListener("load", () => {

    const worker = new Worker("worker.js");

    worker.onmessage = (event) => {
        if (event.data.status == "finished") {
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
        }
    }

    document.getElementById("form-query").addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const query = formData.get("query");
        const options = {
            k: parseInt(formData.get("k")),
            minimumTokenLength: parseInt(formData.get("minl")),
            minimumTokenOccurrences: parseInt(formData.get("mino")),
            prefix: formData.get("prefix") == "" ? null : formData.get("prefix"),
            timeout: parseFloat(formData.get("timeout"))
        }
        worker.postMessage([query, options]);
        document.getElementById("pre-output").innerHTML = "Génération…";
    });
    
});