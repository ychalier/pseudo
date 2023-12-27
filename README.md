# Pseudonym Generator using Anagrams

Try it at https://chalier.fr/pseudo/.

## How It Works

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

## Built With

- [zip.js](https://gildas-lormeau.github.io/zip.js/)
- [xz/fonts](https://fonts.xz.style/)

## Contributing

Contributions are welcomed. Feel free to create pull requests with your changes!

### Training A Model

You will need a working installation of [Python 3](https://www.python.org/).

Current corpus only contains the full text of [*Les Misérables* by Victor Hugo](https://en.wikipedia.org/wiki/Les_Mis%C3%A9rables). It is more than enough for training a basic model for French. Yet, you may want to use more recent datasets or add support for other languages. In that case, you may want to start by gathering a few megabytes of text data.

Execute the [train.py](train.py) script, and pass your [corpus](corpus/) as argument. For instance, here is how the default French model was trained:

```console
python train.py --max-token-length 5 --output-path data/tokens.tsv corpus/*
```

Then, put the generated TSV file in the [model.zip](www/model.zip) archive. The [archive.ps1](data/archive.ps1) and [archive.sh](data/archive.sh) scripts can do that for you.

### Adding Prefix Lists

The [model.zip](www/model.zip) archive contains text files serving as prefix list:

- [firstnames.txt](data/firstnames.txt) (currently drawn from [Wikipedia](https://fr.wikipedia.org/wiki/Liste_de_pr%C3%A9noms_fran%C3%A7ais_et_de_la_francophonie))
- [streets.txt](data/streets.txt) 

You may add your own lists within the archive. Again, if you put those lists within the [data](data/) folder, the [archive.ps1](data/archive.ps1) and [archive.sh](data/archive.sh) scripts can do that for you.

Those lists should contain one entry per line. Normalization is performed on the fly, so you should not have to worry about it.
