importScripts("zip.min.js");


var model;
var prefixSets;


class Model {

    constructor(tokens) {
        this.tokens = tokens;
        this.tokenOccurrences = null;
        this.maximumPairOccurrences = null;
        this.preprocess();
        console.log(
            "Loaded model with",
            Object.keys(this.tokens).length,
            "tokens");
    }

    preprocess() {
        this.tokenOccurrences = {};
        this.maximumPairOccurrences = {};
        for (const token in this.tokens) {
            const length = token.length;
            if (!(length in this.maximumPairOccurrences)) {
                this.maximumPairOccurrences[length] = 0;
            }
            this.tokenOccurrences[token] = 0;
            for (const letter in this.tokens[token]) {
                this.tokenOccurrences[token] += this.tokens[token][letter];
                this.maximumPairOccurrences[length] = Math.max(
                    this.maximumPairOccurrences[length],
                    this.tokens[token][letter]);
            }
        }
    }

    score(token, letter) {
        return this.tokens[token][letter] / this.tokenOccurrences[token];
    }

}


function normalizeString(string) {
    return string.toLocaleLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}


function loadModelTsv(tsvText) {
    const tokens = {};
    let lines = tsvText.replaceAll("\r", "").split("\n");
    let header = lines[0].split("\t").slice(1);
    lines.slice(1).forEach(line => {
        if (line == "") return;
        let token = line.slice(0, line.indexOf("\t"));
        let length = token.length;
        tokens[token] = {};
        let values = line.slice(length + 1).split("\t");
        for (let i = 0; i < header.length; i++) {
            if (values[i] == "") continue;
            let value = parseInt(values[i]);
            tokens[token][header[i]] = value;
        }
    });
    return tokens;
}


function loadPrefixText(text) {
    const prefixes = new Set();
    text.trim().replaceAll("\r", "").split("\n").forEach(line => {
        if (line == "") return;
        prefixes.add(normalizeString(line));
    });
    return prefixes;
}


function loadModelBlob(blob) {
    const zipFileReader = new zip.BlobReader(blob);
    const zipReader = new zip.ZipReader(zipFileReader);
    zipReader.getEntries().then(zipEntries => {
        prefixSets = {};
        for (const entry of zipEntries) {
            if (entry.filename == "tokens.tsv") {
                const tsvWriter = new zip.TextWriter();
                entry.getData(tsvWriter).then(tsvText => {
                    model = new Model(loadModelTsv(tsvText));
                });
            } else {
                const textWriter = new zip.TextWriter();
                entry.getData(textWriter).then(text => {
                    prefixSets[entry.filename.replace(".txt", "")] = loadPrefixText(text);
                });
            }
        }
    });
}


function loadModel() {
    fetch("model.zip").then(res => res.blob()).then(blob => {
        loadModelBlob(blob);
    });
}


function copyArrayWithout(array, element) {
    const copy = [...array];
    copy.splice(copy.indexOf(element), 1);
    return copy;
}


function setsIntersection(a, b) {
    return new Set([...a].filter(i => b.has(i)));
}


function setsDifference(a, b) {
    return new Set([...a].filter(i => !b.has(i)));
}


class PermutationGenerator {

    constructor(model, query, k, timeoutSeconds, minimumScore, minimumTokenLength, minimumTokenOccurrences) {
        this.model = model;
        this.query = query;
        this.k = k;
        this.timeoutSeconds = timeoutSeconds;
        this.minimumScore = minimumScore;
        this.minimumTokenLength = minimumTokenLength;
        this.minimumTokenOccurrences = minimumTokenOccurrences;
        this.timeStart = null;
        this.bestScores = null;
    }

    timedOut() {
        return (new Date() - this.timeStart) > this.timeoutSeconds * 1000;
    }

    insertScore(score) {
        if (score > this.bestScores[this.bestScores.length - 1]) {
            this.bestScores.push(score);
        } else {
            for (let i = 0; i < this.bestScores.length; i++) {
                if (score <= this.bestScores[i]) {
                    this.bestScores.splice(i, 0, score);
                    break;
                }
            }
        }
        this.bestScores.splice(0, 1);
    }

    findLongestSuffix(word, letter) {
        for (let i = 0; i < word.length; i++) {
            const suffix = word.slice(i);
            if (!(suffix in this.model.tokens)) continue;
            if (!(letter in this.model.tokens[suffix])) continue;
            return suffix;
        }
        return null;
    }

    *iteratePermutationsAux(word, letters, topScore) {
        let isOver = false;
        if (letters.length == 0) {
            letters = ["$"];
            isOver = true;
        }
        for (const letter of new Set(letters)) {
            if (this.timedOut()) break;
            const token = this.findLongestSuffix(word, letter);
            if (token == null) continue;
            const length = token.length;
            if (length < this.minimumTokenLength && !token.startsWith("^")) continue;
            if (this.model.tokenOccurrences[token] < this.minimumTokenOccurrences) continue;
            
            // Using the square root to avoid low scores
            // that would not be human-readable
            const score = Math.sqrt(this.model.score(token, letter)) * topScore;
            
            if (score < this.minimumScore) continue;
            if (score < this.bestScores[0]) continue;
            const currentDetails = {
                token: token,
                letter: letter,
                score: score / topScore,
            }
            if (isOver) {
                const result = {
                    word: word,
                    score: score,
                    details: [currentDetails],
                };
                yield result;
            } else {
                const continuations = this.iteratePermutationsAux(word + letter, copyArrayWithout(letters, letter), score);
                while (!this.timedOut()) {
                    const continuation = continuations.next();
                    if (continuation.done) break;
                    if (continuation.value.score == 0) continue;
                    const result = {
                        word: continuation.value.word,
                        score: continuation.value.score,
                        details: [currentDetails, ...continuation.value.details],
                    };
                    yield result;
                }
            }
        }
    }

    *iteratePermutations() {
        this.bestScores = [];
        for (let i = 0; i < this.k; i++) {
            this.bestScores.push(0);
        }
        const permutations = this.iteratePermutationsAux("^", this.query.split(""), 1);
        while (true) {
            const permutation = permutations.next();
            if (permutation.done) break;
            this.insertScore(permutation.value.score);
            const result = {
                word: permutation.value.word.slice(1),
                score: permutation.value.score,
                details: permutation.value.details,
            }
            yield result;
        }
    }

    computeTopPermutations() {
        const iterator = this.iteratePermutations();
        const permutations = [];
        this.timeStart = new Date();
        while (!this.timedOut()) {
            const item = iterator.next();
            if (item.done) break;
            permutations.push(item.value);
        }
        permutations.sort((a, b) => b.score - a.score);
        if (this.timedOut()) {
            console.log("Permutation computation for", this.query, "timed out after", this.timeoutSeconds, "seconds");
        } else {
            console.log("Permutation computation for", this.query, "finished in", (new Date() - this.timeStart) / 1000, "seconds");
        }
        return permutations.slice(0, this.k);
    }

}


function listPrefixes(query, prefixSetName) {
    const prefixes = [];
    if (prefixSetName == null) {
        prefixes.push({
            prefix: null,
            pool: query.split(""),
        })
    } else {
        const prefix_set = prefixSets[prefixSetName];
        for (const prefix of prefix_set) {
            const pool = [...query];
            let feasible = true;
            for (const letter of prefix) {
                const letterIndex = pool.indexOf(letter);
                if (letterIndex == -1) {
                    feasible = false;
                    break;
                }
                pool.splice(letterIndex, 1);
            }
            if (!feasible) continue;
            prefixes.push({
                prefix: prefix,
                pool: pool,
            });
        }
    }
    return prefixes;
}


function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}


loadModel();


onmessage = (event) => {
    if (model == null) {
        postMessage({
            status: "finished",
            success: false,
            error: "Model has not loaded"});
        return;
    }
    const query = normalizeString(event.data[0]);
    const options = event.data[1];
    console.log("Calling worker for query", query, "with options", options);
    const prefixes = listPrefixes(query, options.prefix);
    const results = [];
    let i = 0;
    for (const prefix of prefixes) {
        const topPermutationsResult = new PermutationGenerator(
            model,
            prefix.pool.join(""),
            options.k,
            options.timeout,
            options.minimumScore,
            options.minimumTokenLength,
            options.minimumTokenOccurrences)
            .computeTopPermutations();
        for (const permutation of topPermutationsResult) {
            results.push({
                prefix: prefix.prefix == null ? null : capitalize(prefix.prefix),
                word: capitalize(permutation.word),
                score: permutation.score,
                details: permutation.details,
            });
        }
        i++;
        postMessage({
            status: "ongoing",
            current: i,
            total: prefixes.length,
        });
    }
    results.sort((a, b) => b.score - a.score);
    postMessage({
        status: "finished",
        success: true,
        result: results,
    });
}