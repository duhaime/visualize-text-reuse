###Dependencies

This code requires the following Python libraries: numpy, annoy, and nltk. If you don't already have numpy, I recommend the Anaconda distribution of Python, which ships with numpy, scipy, and other libraries that can prove difficult to compile manually. Once the numpy dependency is settled, one can satisfy the other dependencies by running:  
<pre><code>pip install nltk  
pip install annoy</code></pre>

###Quickstart

This repository contains utilities for detecting and visualizing text reuse. To get started, run:

<pre><code>git clone https://github.com/duhaime/visualize-text-reuse.git
cd visualize-text-reuse/utils
python detect_reuse.py
cd ../
python -m SimpleHTTPServer 8000</code></pre>

Then open a browser (Chrome is recommended) and navigate to `localhost:8000` to see the results of the analysis.

###Process custom dataset

To process a dataset other than the files contained in `data/full_text/`, just open up `config.json` and provide a new glob path to the `infile_glob` parameter, as well as a new metadata file to the `metadata` parameter. Make sure that the metadata file you provide is formatted as `data/metadata/corpus_metadata.tsv` is formatted:

<table>
  <tr>
    <td>filename</td>
    <td>display title</td>
    <td>publication year</td>
    <td>file id</td>
    <td>file author</td>
  </tr>
</table>

### Change runtime parameters

One can change the following runtime parameters within `config.json`:  

`infile_glob`: Glob path to the plaintext files to be processed 
 
`metadata`: Metadata file that corresponds to the files in `infile_glob`  

`persist_index`: {0,1} Controls whether the index used to detect text reuse will be saved to disk.  

`load_index`: {0,1} Controls whether the algorithm will load an already saved index from disk.  

`knn`: An integer that controls the number of nearest neighbors to find for each passage of each file.  

`print_nn`: {0,1} If set to 1, running `utils/detect_reuse.py` will print the nearest neighbors of each passage to the terminal.  

`n_trees`: An integer that controls the number of trees to build within the index. Increasing this value requires more memory but improves search precision.  

`search_k`: An integer that determines the number of searches to be executed for each nearest neighbor lookup. Increasing this value requires more runtime but improves search precision.  

