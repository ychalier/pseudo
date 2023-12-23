importScripts("zip.js/dist/zip.min.js");


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


function* iterateSuffixes(string) {
    for (let i = 0; i < string.length; i++) {
        yield string.slice(i);
    }
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


/**
 * Insert an element in a fixed size array, sorted in ascending order.
 */
function insertInSortedArray(array, element) {
    if (element > array[array.length - 1]) {
        array.push(element);
    } else {
        for (let i = 0; i < array.length; i++) {
            if (element < array[i]) {
                array.splice(i, 0, element);
                break;
            }
        }
    }
    array.splice(0, 1);
}


function* iteratePermutationsAux(model, word, letters, bestScores, minimumTokenLength, minimumTokenOccurrences) {
    if (letters.length == 0) {
        let score = 0;
        const suffixes = iterateSuffixes(word);
        while (true) {
            const suffix = suffixes.next();
            if (suffix.done) break;
            const token = suffix.value;
            const length = token.length;
            if (length < minimumTokenLength && token != "^") continue;
            if (!(token in model.tokens)) continue;
            if (!("$" in model.tokens[token])) continue;
            score = model.tokens[token]["$"] / model.maximumPairOccurrences[length] * Math.pow(10, length - 1);
            break;
        }
        if (score == null) {
            score = 0;
        } else {
            insertInSortedArray(bestScores, score);
        }
        const result = {
            word: word,
            score: score,
        };
        yield result;
    } else {
        const seen = new Set();
        const lettersSet = new Set(letters);
        const suffixes = iterateSuffixes(word);
        while (true) {
            const suffix = suffixes.next();
            if (suffix.done) break;
            const token = suffix.value;
            const length = token.length;
            if (length < minimumTokenLength && !token.startsWith("^")) break;
            if (!(token in model.tokens)) continue;
            if (model.tokenOccurrences[token] < minimumTokenOccurrences) continue;
            let nextLetterCandidates = new Set(Object.keys(model.tokens[token]));
            nextLetterCandidates = [...setsDifference(setsIntersection(nextLetterCandidates, lettersSet), seen)];
            nextLetterCandidates.sort((a, b) => model.tokens[token][b] - model.tokens[token][a]);
            for (const letter of nextLetterCandidates) {
                seen.add(letter);
                
                // Going down the tree, the score can only decrease.
                // Given that we're only keeping the top k results,
                // if the current score is below the k-th best score,
                // we can skip going further.
                const score = model.tokens[token][letter] / model.maximumPairOccurrences[length] * Math.pow(10, length - 1);
                // As the bestScores array is sorted in ascending order,
                // the first item is always the lowest best score.
                if (score < bestScores[0]) continue;
                
                const continuations = iteratePermutationsAux(model, word + letter, copyArrayWithout(letters, letter), bestScores, minimumTokenLength, minimumTokenOccurrences);
                while (true) {
                    const continuation = continuations.next();
                    if (continuation.done) break;
                    if (continuation.value.score == 0) continue;
                    const result = {
                        word: continuation.value.word,
                        score: Math.min(score, continuation.value.score),
                    };
                    yield result;
                }
            };
        }
    }
}


function* iteratePermutations(model, query, k, minimumTokenLength, minimumTokenOccurrences) {
    const bestScores = [];
    for (let i = 0; i < k; i++) {
        bestScores.push(0);
    }
    const permutations = iteratePermutationsAux(model, "^", query.split(""), bestScores, minimumTokenLength, minimumTokenOccurrences);
    while (true) {
        const permutation = permutations.next();
        if (permutation.done) break;
        const result = {
            word: permutation.value.word.slice(1),
            score: permutation.value.score,
        }
        yield result;
    }
}


function computeTopPermutations(model, query, k, timeoutSeconds, minimumTokenLength, minimumTokenOccurrences) {
    const iterator = iteratePermutations(model, query, k, minimumTokenLength, minimumTokenOccurrences);
    const permutations = [];
    const timeStart = new Date();
    let timeout = false;
    while (true) {
        const elapsedMillis = (new Date() - timeStart);
        if (elapsedMillis > timeoutSeconds * 1000) {
            timeout = true;
            break;
        }
        const item = iterator.next();
        if (item.done) break;
        permutations.push(item.value);
    }
    permutations.sort((a, b) => b.score - a.score);
    if (timeout) {
        console.log("Permutation computation for", query, "timed out after", timeoutSeconds, "seconds");
    } else {
        console.log("Computed permutations for", query, "finished in", (new Date() - timeStart) / 1000, "seconds");
    }
    return {
        permutations: permutations.slice(0, k),
        timeout: timeout,
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
        const topPermutationsResult = computeTopPermutations(
            model,
            prefix.pool.join(""),
            options.k,
            options.timeout,
            options.minimumTokenLength,
            options.minimumTokenOccurrences);
        for (const permutation of topPermutationsResult.permutations) {
            results.push({
                string: prefix.prefix == null ? capitalize(permutation.word) : `${capitalize(prefix.prefix)} ${capitalize(permutation.word)}`,
                score: permutation.score,
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