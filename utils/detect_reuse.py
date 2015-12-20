from multiprocessing import Pool
from collections import defaultdict, Counter
from nltk.util import ngrams
from annoy import AnnoyIndex
import numpy, glob, codecs, json, sys, os

####################
# Metadata methods #
####################

def autovivify():
    """Create a defaultdict that supports infinite nesting"""
    return defaultdict(autovivify)


def retrieve_metadata(metadata_path):
    """Read in a metadata file in tsv format"""
    d = autovivify()
    with codecs.open(metadata_path, 'r', 'utf-8') as f:
        f = f.read().split("\n")
        for r in f:
            sr = r.split("\t")
            if len(sr) < 4:
                continue 
            filename, title, year, id, author  = sr              
            d[id]["filename"] = filename
            d[id]["title"] = title
            d[id]["year"] = year
            d[id]["author"] = author
    return d 


###################
# Feature methods #
###################  

def alpha_hashes(alpha):
    """Return a map of all 3-character hashes"""
    c = 0
    hashes = {}
    for i in alpha:
        for j in alpha:
            for k in alpha:
                hashes[i+j+k] = c
                c += 1
    return hashes 


def make_vectors(f):
    """Return {file_id.sentence_id:vector} for each sentence in f"""
    file_vectors = {}
    file_id = infile_to_id[f]
    with codecs.open(f, 'r', 'utf-8') as f:
        segments = f.read().split("\n\n")
        for idx, s in enumerate(segments):   
            s = "".join(s for s in s.lower() if s in alpha or s == ' ')
            c = Counter()
            for charGram in ngrams(s, 3): 
                c[hashes[''.join(charGram)]] += 1 
            vector = numpy.array( [c[i] for i in xrange(len(hashes))], dtype=numpy.int8)
            label = float(str(file_id) + "." + str(idx))
            file_vectors[label] = vector
    return file_vectors
    
    
def reduce_df(results_array):
    """Given an array of {label:vector} dicts, create ann index"""
    labels = []
    i = 0

    # prepare an ann index by specifying length of observations
    ann_index = AnnoyIndex(len(hashes))

    # results_array consists of dicts; iterate over each
    for d in results_array: 
        for k in d:
            labels.append(k)
            ann_index.add_item(i, numpy.array(d[k]) )
            i += 1    
    
    return labels, ann_index


def vectorize_files(files):
    """Return a matrix where row = doc and col = word class"""
    df_pool = Pool()
    character_vectors = []

    for r in df_pool.imap(make_vectors, files):
        character_vectors.append(r)

    labels, ann_index = reduce_df(character_vectors)
    return labels, ann_index


#############
# Index I/O #
#############

def persist_index(labels, ann_index):
    """Write the labels and ann_index to disk"""
    if not os.path.exists("ann"):
        os.makedirs("ann")
    ann_index.save("ann/trees.ann")
    with open("ann/labels.json",'w') as labels_out:
        json.dump(labels, labels_out)

def load_index():
    """Read the labels and ann_index from disk"""
    ann_index.load("ann/trees.ann")
    with open("ann/labels.json") as labels_in:
        labels = json.load(labels_in)
    return labels, ann_index
   

###############
# ANN methods #
###############

def find_nearest_neighbors(labels, ann_index, knn=3):
    """Find the nearest neighbors for all observations"""
    nn = defaultdict(list)
    for c, i in enumerate(labels):
        nearest_neighbors = ann_index.get_nns_by_item(c, knn)        
        for n in nearest_neighbors:
            nn[c].append(n)
    return knn, nn


def print_nn(knn, nn):
    """Print nearest neighbors to terminal"""
    for c in nn.iterkeys():
        for n in nn[c]:
            file_id, segment_id = str(labels[n]).split(".")
            file_path = id_to_infile[int(file_id)]
            segment = int(segment_id)
            with codecs.open(file_path,'r','utf-8') as f:
                print " ".join( f.read().split("\n\n")[segment].split() )
        print "\n"


#########################
# Visualization methods #
#########################

def write_dropdown_json(infile_to_id, metadata):
    """Write file selector json with file name and glob id"""
    root_filename_to_id = {}
    for f in infile_to_id:
        root_filename = os.path.basename(f)
        root_filename_to_id[root_filename] = infile_to_id[f]

    with open("../json/dropdown.json", 'w') as dropdown_out:
        d = []
        for i in metadata:
            filename = metadata[i]["filename"]
            display_title = metadata[i]["title"]
            glob_id = root_filename_to_id[filename] 
            d.append({"name":display_title,"id":glob_id})
        json.dump(d, dropdown_out)
       
def write_similarity_json(knn, nn, labels):
    """Write json that documents similarity of file segments"""
    d = defaultdict(lambda: defaultdict(list))
    for c in nn.iterkeys():
        for n in nn[c]:
            source_id = int(labels[c])
            target_id = int(labels[n])

            # Store alignments for each pairwise combination of texts
            # using the segment index positions to denote location
            # the following hack returns the decimal portion of number
            source_segment = int( str(labels[c]).split(".")[1] )
            target_segment = int( str(labels[n]).split(".")[1] )
           
            d[source_id][target_id].append({"source_segment":source_segment,
                "target_segment": target_segment})

    out_dir = "../json/alignments/"
    for source_id in d:
        for target_id in d[source_id]:
            out_file_root = str(source_id) + "_" + str(target_id) 
            out_path = out_dir + out_file_root + "_alignments.json"
            with open(out_path,'w') as alignments_out:
                json.dump( d[source_id][target_id], alignments_out ) 


def write_segments(infiles):
    """Write the segments from each file to disk"""
    out_dir = "../json/segments/"
    for c, i in enumerate(infiles): 
        out_file = "segments_" + str(c) + ".json"
        with open(out_dir + out_file, 'w') as segments_out:
            with codecs.open(i, 'r', 'utf-8') as f:
                segments = f.read().split("\n\n")
                segments = [s.replace("\n","</br>") for s in segments]
                json.dump(segments, segments_out)


########
# Main #
########

if __name__ == "__main__":

    # metadata resources
    metadata_path = "../data/metadata/corpus_metadata.tsv"
    metadata = retrieve_metadata(metadata_path)
    
    # alphabetic hash resources
    alpha = "abcdefghijklmnopqrstuvwxyz "
    hashes = alpha_hashes(alpha)    

    # specify files to analyze
    infiles = glob.glob(sys.argv[1])
    infile_to_id = {i:c for c, i in enumerate(infiles)}
    id_to_infile = {c:i for c, i in enumerate(infiles)}

    # build ann index. Increasing num_trees increases precision
    # but also increases runtime
    labels, ann_index = vectorize_files(infiles) 
    num_trees = 10
    ann_index.build(num_trees)
  
    # persist ann index and labels, then read them from disk
    persist_index(labels, ann_index)
    labels, ann_index = load_index()

    # find nearest neighbors
    knn, nn = find_nearest_neighbors(labels, ann_index) 
    print_nn(knn, nn)

    # write json to disk for visualization
    if not os.path.exists("../json/alignments"):
        os.makedirs("../json/alignments")
    if not os.path.exists("../json/segments"):
        os.makedirs("../json/segments")
    write_dropdown_json(infile_to_id, metadata)
    write_similarity_json(knn, nn, labels) 
    write_segments(infiles)
