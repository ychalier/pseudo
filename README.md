# Pseudonym Generator with Anagrams

Generates permutations of lists of letters that sound like real proper nouns.

- Try it at [chalier.fr/pseudo/](https://chalier.fr/pseudo/)
- Read about how it works in [this blog article](https://chalier.fr/blog/pseudonym-generator-with-anagrams)

## Built With

- [zip.js](https://gildas-lormeau.github.io/zip.js/)
- [xz/fonts](https://fonts.xz.style/)

## License

This project is licensed under the GPL-3.0 license.

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

- [firstnames.txt](data/firstnames.txt) (mostly drawn from [Wikipedia](https://fr.wikipedia.org/wiki/Liste_de_pr%C3%A9noms_fran%C3%A7ais_et_de_la_francophonie))
- [streets.txt](data/streets.txt) 

You may add your own list within the archive. It should contain one entry per line. Normalization is performed on the fly, so you do not have to worry about it. Again, if you put it inside the [data](data/) folder, the [archive.ps1](data/archive.ps1) and [archive.sh](data/archive.sh) scripts can add it to the archive for you.

Then, make sure to add the filename of this list as an option for the prefix `select` tag in [index.html](www/index.html) (option's value should be the filename with the extension).
