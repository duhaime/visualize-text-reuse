from multiprocessing import Pool
from collections import defaultdict, Counter
from nltk.util import ngrams
from difflib import SequenceMatcher
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
            d[filename]["filename"] = filename
            d[filename]["title"] = title
            d[filename]["year"] = year
            d[filename]["author"] = author
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


def get_segments(s):
    """Read in a string and return an array of segments"""
    return s.split("\n\n")


def make_vectors(f):
    """Return {file_id.sentence_id:vector} for each sentence in f"""
    file_vectors = {}
    file_id = infile_to_id[f]
    with codecs.open(f, 'r', 'utf-8') as f:
        segments = get_segments(f.read())
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

def subdivide_list(l, n):
    """Yield successive n-sized chunks from l."""
    for i in xrange(0, len(l), n):
        yield l[i:i+n]


def find_neighbors(c_knn_tuple):
    """Return the knn for index position c in labels"""
    c, knn = c_knn_tuple
    d = {c:[]}
    nn = ann_index.get_nns_by_item(c, knn)    
    for n in nn:
        d[c].append(n)
    return d


def find_nearest_neighbors(labels, ann_index, knn=3):
    """Find the nearest neighbors for all observations"""
    nn = {}
    pool_two = Pool()
    index_knn_iterable = ((c, knn) for c in xrange(len(labels)))
    for result in pool_two.imap(find_neighbors, index_knn_iterable):
        nn.update(result)
    return knn, nn


def print_nn(knn, nn):
    """Print nearest neighbors to terminal"""
    print nn

    for c in nn.iterkeys():
        for n in nn[c]:
            file_id, segment_id = str(labels[n]).split(".")
            file_path = id_to_infile[int(file_id)]
            segment = int(segment_id)
            with codecs.open(file_path,'r','utf-8') as f:
                print " ".join( get_segments(f.read())[segment].split() )
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
            pub_year = metadata[i]["year"]
            glob_id = root_filename_to_id[filename] 
            d.append({"name":display_title,
                "id":glob_id,
                "year":pub_year})
        json.dump(d, dropdown_out)
      

def calculate_similarity(source_path, target_path, source_segment,
    target_segment):
    with codecs.open(source_path,'r','utf-8') as s:
        with codecs.open(target_path,'r','utf-8') as t:    
            s = get_segments(s.read())
            t = get_segments(t.read())

            # retrieve the relevant portions of source + target
            s = s[source_segment]
            t = t[target_segment]
            response = SequenceMatcher(None, s, t, autojunk=False) 
            sim = response.ratio()
    return sim


def write_similarity_json(knn, nn, labels):
    """Write json that documents similarity of file segments"""
    d = defaultdict(list)
    for c in nn.iterkeys():
        # Retrieve source id, path, and title
        source_id = int(labels[c])
        source_path = id_to_infile[source_id]
        source_title = metadata[os.path.basename(source_path)]["title"]

        # Analyze the source file's nearest neighbors
        for n in nn[c]:
            target_id = int(labels[n])

            # skip the trivial case where source == target
            if source_id == target_id:
                continue
 
            # Retrieve the decimal portion of number
            source_segment = int( str(labels[c]).split(".")[1] )
            target_segment = int( str(labels[n]).split(".")[1] ) 

            # Retrieve the path and title for the target file
            target_path = id_to_infile[target_id]
            target_title = metadata[os.path.basename(target_path)]["title"]
            target_year = metadata[os.path.basename(target_path)]["year"]

            sim = calculate_similarity(source_path, target_path,
                    source_segment, target_segment)

            # limit float point precision to compress json
            sim = "{0:.3f}".format(sim)

            sim_d = {"sourceId": source_id,
                 "sourceSegment": source_segment, 
                 "sourceTitle": source_title,
                 "similarId": target_id,
                 "similarSegment": target_segment,
                 "similarTitle": target_title,
                 "similarYear": target_year,
                 "similarity": sim}
            
            d[source_id].append(sim_d)
   
    out_dir = "../json/alignments/"
    for source_id in d:
        out_file_root = str(source_id) + "_alignments.json"  
        out_path = out_dir + out_file_root 
        with open(out_path,'w') as alignments_out:
            json.dump( d[source_id], alignments_out ) 


def write_segments(infiles):
    """Write the segments from each file to disk"""
    out_dir = "../json/segments/"
    for c, i in enumerate(infiles): 
        out_file = "segments_" + str(c) + ".json"
        with open(out_dir + out_file, 'w') as segments_out:
            with codecs.open(i, 'r', 'utf-8') as f:
                segments = get_segments(f.read())
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
