window.addEventListener("load", () => {

    function toggleUiElements(formEnabled) {
        document.getElementById("button-interrupt").disabled = formEnabled;
        document.getElementById("form-query").querySelectorAll("input,select").forEach(input => {
            input.disabled = !formEnabled;
        });
    }

    function createWorker() {
        let w = new Worker("worker.js");
        w.onmessage = (event) => {
            if (event.data.status == "finished") {
                document.getElementById("progress-container").classList.add("hidden");
                toggleUiElements(true);
                if (event.data.success) {
                    const output = document.getElementById("output");
                    output.innerHTML = "";
                    if (event.data.result.length > 0) {
                        for (const result of event.data.result) {
                            const resultElement = output.appendChild(document.createElement("div"));
                            resultElement.classList.add("result");
                            if (result.prefix != null) {
                                const prefixElement = resultElement.appendChild(document.createElement("span"));
                                prefixElement.classList.add("prefix");
                                prefixElement.textContent = result.prefix + " ";
                            }
                            const wordElement = resultElement.appendChild(document.createElement("span"));
                            wordElement.classList.add("word");
                            let lowestScore = null;
                            let highestScore = null;
                            for (let detail of result.details) {
                                if (lowestScore == null || detail.score < lowestScore) {
                                    lowestScore = detail.score;
                                }
                                if (highestScore == null || detail.score > highestScore) {
                                    highestScore = detail.score;
                                }
                            }
                            for (let i = 0; i <= result.word.length; i++) {
                                const letterElement = wordElement.appendChild(document.createElement("span"));
                                letterElement.classList.add("letter");
                                if (result.details[i].score == lowestScore) {
                                    letterElement.classList.add("letter-lowest");
                                }
                                if (result.details[i].score == highestScore) {
                                    letterElement.classList.add("letter-highest");
                                }
                                const letterTextElement = letterElement.appendChild(document.createElement("span"));
                                letterTextElement.classList.add("letter-text");
                                if (i == result.word.length) {
                                    letterTextElement.textContent = " ";
                                } else {
                                    letterTextElement.textContent = result.word.charAt(i);
                                }
                                letterElement.title = `${result.details[i].token}-${result.details[i].letter}: ${result.details[i].score.toFixed(3)}`;
                                letterElement.classList.add(`letter-${result.details[i].token.length}`);
                            }
                            const scoreElement = resultElement.appendChild(document.createElement("span"));
                            scoreElement.classList.add("score");
                            scoreElement.textContent = `(${(result.score * 1000).toFixed(3)})`;
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
                toggleUiElements(false);
            }
        }
        return w;
    }

    let worker = createWorker();

    
    document.getElementById("button-interrupt").addEventListener("click", (event) => {
        worker.terminate();
        document.getElementById("progress-status").innerHTML = "Interrompu";
        toggleUiElements(true);
        worker = createWorker();
    });

    document.getElementById("form-query").addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const query = formData.get("query");
        const options = {
            k: parseInt(formData.get("k")),
            minimumScore: parseFloat(formData.get("mins")) / 1000,
            minimumTokenLength: parseInt(formData.get("minl")),
            minimumTokenOccurrences: 0, //parseInt(formData.get("mino")),
            prefix: formData.get("prefix") == "" ? null : formData.get("prefix"),
            timeout: parseFloat(formData.get("timeout"))
        }
        worker.postMessage([query, options]);
        document.getElementById("output").innerHTML = "";
        document.getElementById("progress-status").innerHTML = "Génération…";
        toggleUiElements(false);
        document.getElementById("progress-container").classList.remove("hidden");
        const progress = document.getElementById("progress");
        progress.value = 0;
        progress.max = 1;
    });
    
});