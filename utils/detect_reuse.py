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

    df_pool.close()
    df_pool.join()

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
    nn = ann_index.get_nns_by_item(c, knn, 
        search_k, include_distances=False)    
    for n in nn:
        d[c].append(n)
    return d


def find_nearest_neighbors(labels, ann_index, knn):
    """Find the nearest neighbors for all observations"""
    nn = {}
    pool_two = Pool()
    index_knn_iterable = ((c, knn) for c in xrange(len(labels)))
    for result in pool_two.imap(find_neighbors, index_knn_iterable):
        nn.update(result)
    pool_two.close()
    pool_two.join()

    return nn


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


def collect_similarity_json_slave(nn_key):
    """Write the similarity json for a single nn_key to disk"""
    similarity_list = []

    source_id = int(labels[nn_key])
    source_path = id_to_infile[source_id]
    source_title = metadata[os.path.basename(source_path)]["title"]
    source_year = metadata[os.path.basename(source_path)]["year"]

    # Analyze the source file's nearest neighbors
    for n in nn[nn_key]:
        target_id = int(labels[n])

        # skip the trivial case where source == target
        if source_id == target_id:
            continue

        # Retrieve the decimal portion of number
        source_segment = int( str(labels[nn_key]).split(".")[1] )
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
             "sourceYear": source_year,
             "similarId": target_id,
             "similarSegment": target_segment,
             "similarTitle": target_title,
             "similarYear": target_year,
             "similarity": sim}
        similarity_list.append( sim_d )

    return source_id, similarity_list


def collect_similarity_json(knn, nn, labels):
    """Write json that documents similarity of file segments"""
    d = defaultdict(list)
    similarity_pool = Pool()
    for r in similarity_pool.imap(collect_similarity_json_slave,
            nn.iterkeys()):
        source_id, sim_list = r
        for l in sim_list:
            d[source_id].append(l)
    similarity_pool.close()
    similarity_pool.join()
    return d


def write_similarity_json_slave(source_id):
    """Given a source id, write that id's similarity json to disk"""
    out_dir = "../json/alignments/"
    out_file_root = str(source_id) + "_alignments.json"
    out_path = out_dir + out_file_root
    with open(out_path,'w') as alignments_out:
        json.dump( similarity_json_dict[source_id], alignments_out )


def write_similarity_json(similarity_keys):
    """Write the similarity json for each file"""
    write_similarity_pool = Pool()
    write_similarity_pool.imap(write_similarity_json_slave, similarity_keys)
    write_similarity_pool.close()
    write_similarity_pool.join()


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

    # retrieve runtime paramaters
    with open("../config.json") as f:
        runtime_params = json.load(f)

    # metadata resources
    metadata_path = runtime_params["metadata"]
    metadata = retrieve_metadata(metadata_path)
    
    # alphabetic hash resources
    alpha = "abcdefghijklmnopqrstuvwxyz "
    hashes = alpha_hashes(alpha)    

    # specify files to analyze
    infiles = glob.glob(runtime_params["infile_glob"])
    infile_to_id = {i:c for c, i in enumerate(infiles)}
    id_to_infile = {c:i for c, i in enumerate(infiles)}

    # build ann index. Increasing num_trees increases precision
    # but also increases runtime
    labels, ann_index = vectorize_files(infiles) 
    n_trees = runtime_params["n_trees"]
    ann_index.build(n_trees)
  
    # persist ann index and labels or read them from disk
    if runtime_params["persist_index"] == 1:
        persist_index(labels, ann_index)
    if runtime_params["load_index"] == 1:
        labels, ann_index = load_index()

    # find nearest neighbors
    knn = runtime_params["knn"]
    search_k = runtime_params["search_k"] 
    nn = find_nearest_neighbors(labels, ann_index, knn) 
    
    # print nn if requested
    if runtime_params["print_nn"] == 1:
        print_nn(knn, nn)

    # write json to disk for visualization
    if not os.path.exists("../json/alignments"):
        os.makedirs("../json/alignments")
    if not os.path.exists("../json/segments"):
        os.makedirs("../json/segments")

    # write similarity json
    similarity_json_dict = collect_similarity_json(knn, nn, labels)
    write_similarity_json(similarity_json_dict.iterkeys())

    write_dropdown_json(infile_to_id, metadata)
    write_segments(infiles)
