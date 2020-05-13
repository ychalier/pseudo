# pseudo

French anagram pseudonym generator based on Markov chains.

Here are some example outputs for "*Charles de Gaulle*":

- "*Gérald Auchelles*" (manually added the accent)
- "*Hercule Dallages*"
- "*Rachel Dallesgue*"

## Getting Started

### Install

You will need Python 3. Module requirements are in `requirements.txt` (if you
do not wish to train a new model yourself, then only `slugify` is needed).

Clone the repository: it already contains the necessary data.

### Simple Use

```bash
python main.py male "Charles de Gaulle"
```

### Advanced Use

Use the `-l` argument to specify how many results to keep for each possible
firstname found.

Use the `-k` argument to influence on how many names are tried before returning
the best findings. A small value (2, 3) will be the fastest but some options
may have not been explored. A large value (50) will take longer but most options
should be explored. There is a tradeoff here between time and recall.

### Another Language Support

To add support for another language, you will have to:

- Gather a few megabytes of text data in this language
- Build a new model with the `train` function (make sure to specify the correct corpus directory)
- Gather lists of firstnames for that languages

## Mechanics

Inspiration from [rrenaud/Gibberish-Detector](https://github.com/rrenaud/Gibberish-Detector).

Given the input, we first look for a possible firstname. Once found, we look at
the remaining letters and try to make a pronounceable word out of them. To do so,
we use a Markov chain encoding the transition between ngrams of variable sizes
(1, 2 and 3). The model is trained on a large input text. Then, until all availables
letters are used, we pick the longest and most probable ngram continuing what
has been already generated.

Instead of returning one solution, all solutions are explored (actually, the
parameter `k` allow for controlling how many ngrams are tried) and sorted
according the combination of the probabilities of all the transitions used in
the generation. This computation is done by assuming independence, yet this is
a wrong assumption. But for this use case, it does not seem to be much of an issue.

The dataset used to train the Markov chain model is the original fulltext of
*Les Misérables* by Victor Hugo. Firstnames are mainly extracted from
[Wikipedia](https://fr.wikipedia.org/wiki/Liste_de_pr%C3%A9noms_fran%C3%A7ais_et_de_la_francophonie).
